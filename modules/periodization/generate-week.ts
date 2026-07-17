import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { persistWorkoutBlocks } from "@/modules/workouts/persist-blocks";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { GenerateWeekInput } from "./generation-schema";
import {
  ALGORITHM_VERSION,
  RATIONALE_VERSION,
  planWeek,
  type WeekContext,
} from "./generation-rules";
import type { PeriodizationActor } from "./periodization-service";

// Camada de persistência da geração assistida (Fase 6). Toda a ciência vive em
// generation-rules.ts (puro); aqui só resolvemos contexto, gravamos DRAFTs e
// registramos o lote.
//
// INVARIANTE DO PRODUTO: nada aqui publica. Todo treino nasce DRAFT com
// source=PERIODIZATION_GENERATED e só vira PUBLISHED pela ação explícita do
// treinador (modules/workouts/publish-workout.ts). Não existe caminho de
// auto-publicação — é isso que mantém o treinador no comando.

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function generateWeekDrafts(
  target: { periodizationId: string; weekId: string },
  input: GenerateWeekInput,
  actor: PeriodizationActor,
) {
  const week = await prisma.trainingWeek.findUnique({
    where: { id: target.weekId },
    include: { periodization: true, phase: true },
  });

  // `periodizationId` também é conferido: a semana é única globalmente, então
  // sem esta checagem a rota /periodizations/A/weeks/<semana-de-B> geraria
  // silenciosamente para B. O escopo org+treinador já barra o acesso indevido;
  // isto impede que a URL minta sobre o que foi gerado.
  if (
    !week ||
    week.periodizationId !== target.periodizationId ||
    week.periodization.organizationId !== actor.organizationId ||
    week.periodization.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Semana de treino não encontrada.");
  }

  // Invariante de negócio reforçada no serviço, como nos demais módulos: seguro
  // a partir de qualquer entry point futuro, mesmo que a rota já valide.
  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    week.periodization.athleteId,
  );

  // Rascunhos gerados antes para esta semana. Publicados/editados ficam fora do
  // filtro de propósito: regenerar nunca pode destruir trabalho do treinador
  // nem um treino que o atleta já enxerga.
  const staleDrafts = await prisma.workout.findMany({
    where: {
      trainingWeekId: week.id,
      organizationId: actor.organizationId,
      status: "DRAFT",
      source: "PERIODIZATION_GENERATED",
      trainerModified: false,
    },
    select: { id: true },
  });

  if (staleDrafts.length > 0 && !input.replaceExisting) {
    throw new ConflictError(
      `Esta semana já tem ${staleDrafts.length} rascunho(s) gerado(s). Use a opção de substituir para gerar novamente.`,
    );
  }

  // O volume alvo da semana manda; se estiver vazio, a fase responde. Se as
  // duas estiverem vazias, o motor assume um padrão e rebaixa a confiança.
  const targetVolumeKm =
    week.targetVolume?.toNumber() ?? week.phase?.targetVolumeKm?.toNumber() ?? undefined;

  const context: WeekContext = {
    goal: week.periodization.goal,
    modality: input.modality,
    level: input.level,
    availableWeekdays: input.availableWeekdays,
    phaseName: week.phase?.name,
    isRecoveryWeek: week.isRecoveryWeek,
    targetVolumeKm,
    targetIntensity: week.targetIntensity ?? week.phase?.targetIntensity ?? undefined,
    weekStartDate: isoDate(week.startDate),
    weekEndDate: isoDate(week.endDate),
    includeStrength: input.includeStrength,
  };

  const plan = planWeek(context);

  const previousBatches = await prisma.generationBatch.count({
    where: { periodizationId: week.periodizationId },
  });

  return prisma.$transaction(
    async (tx) => {
      if (staleDrafts.length > 0) {
        // Blocos/steps caem por cascade.
        await tx.workout.deleteMany({ where: { id: { in: staleDrafts.map((d) => d.id) } } });
      }

      const batch = await tx.generationBatch.create({
        data: {
          organizationId: actor.organizationId,
          periodizationId: week.periodizationId,
          athleteId: week.periodization.athleteId,
          trainerId: actor.trainerProfileId,
          requestedByUserId: actor.userId,
          generationMode: "ASSISTED",
          generationVersion: previousBatches + 1,
          algorithmVersion: ALGORITHM_VERSION,
          generationRationaleVersion: RATIONALE_VERSION,
          scope: "SINGLE_WEEK",
          status: "PROCESSING",
          startedAt: new Date(),
          // contextSnapshot = exatamente o que o motor viu. Sem isto, um treino
          // gerado hoje é inexplicável amanhã: o alvo da semana pode ter mudado,
          // a fase pode ter sido renomeada. O snapshot congela a entrada, o
          // rationale congela o raciocínio.
          // Interfaces TS não satisfazem o index signature que o Prisma exige em
          // campos Json; o cast é só para o compilador — a forma é a do
          // rationale versionado.
          contextSnapshot: {
            context: { ...context },
            weekSequence: week.sequence,
            phaseId: week.phaseId,
            rationale: plan.rationale,
            confidence: plan.confidence,
            sessionCount: plan.sessions.length,
          } as unknown as Prisma.InputJsonObject,
        },
      });

      // Devolve os rascunhos, não só os ids: a tela lista cada sessão com link
      // direto para revisar. Sem isto, o treinador cairia num calendário aberto
      // no mês de hoje, que pode não ser o mês da semana gerada.
      const created: { id: string; title: string; plannedDate: string; modality: string }[] = [];
      for (const session of plan.sessions) {
        const workout = await tx.workout.create({
          data: {
            organizationId: actor.organizationId,
            athleteId: week.periodization.athleteId,
            trainerId: actor.trainerProfileId,
            periodizationId: week.periodizationId,
            periodizationPhaseId: week.phaseId,
            trainingWeekId: week.id,
            generationBatchId: batch.id,
            title: session.title,
            description: session.description,
            modality: session.modality,
            status: "DRAFT",
            source: "PERIODIZATION_GENERATED",
            plannedDate: new Date(`${session.plannedDate}T00:00:00.000Z`),
            generationMode: "ASSISTED",
            generationVersion: batch.generationVersion,
            algorithmVersion: ALGORITHM_VERSION,
            generationRationaleVersion: RATIONALE_VERSION,
            confidenceLevel: plan.confidence,
            // Rationale por treino (e não só no lote): o treinador revisa uma
            // sessão de cada vez e precisa da regra ali, não num lote distante.
            generationRationale: {
              ...plan.rationale,
              sessionKind: session.kind,
            } as unknown as Prisma.InputJsonObject,
          },
        });

        await persistWorkoutBlocks(tx, workout.id, actor.organizationId, session.blocks);
        created.push({
          id: workout.id,
          title: workout.title,
          plannedDate: session.plannedDate,
          modality: session.modality,
        });
      }

      await tx.generationBatch.update({
        where: { id: batch.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await recordAuditLog(tx, {
        action: "GENERATE_WEEK",
        entityName: "GenerationBatch",
        entityId: batch.id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        reason: `week:${week.sequence}:${created.length}_drafts:confidence_${plan.confidence}:${ALGORITHM_VERSION}`,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });

      return {
        batchId: batch.id,
        workouts: created,
        confidence: plan.confidence,
        rationale: plan.rationale,
        replacedDrafts: staleDrafts.length,
      };
    },
    // Uma semana gerada é MUITO mais escrita que um rascunho avulso: até 7
    // treinos × blocos × steps/exercícios, tudo sequencial. Com os 5s padrão do
    // Prisma, uma semana cheia estoura ("Transaction not found") num banco
    // remoto — não é artefato de teste, quebraria em produção do mesmo jeito.
    // ponytail: teto elevado em vez de lote com createMany; persistWorkoutBlocks
    // é compartilhado com os outros fluxos e reescrevê-lo em batch é um diff bem
    // maior. Se a geração de ciclo inteiro (FULL_CYCLE) entrar, aí sim vale
    // batelar as inserções em vez de subir o teto de novo.
    { timeout: 30_000, maxWait: 10_000 },
  );
}
