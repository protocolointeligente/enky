import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import {
  persistManyWorkoutBlocks,
  type WorkoutBlocksItem,
} from "@/modules/workouts/persist-blocks";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { GenerateInput } from "./generation-schema";
import {
  ALGORITHM_VERSION,
  RATIONALE_VERSION,
  planWeek,
  type GenerationRationale,
  type WeekContext,
} from "./generation-rules";
import { inferFromHistory, type InferredInput } from "./infer-generation-input";
import type { PeriodizationActor } from "./periodization-service";

// Camada de persistência da geração assistida (Fase 6). Toda a ciência vive em
// generation-rules.ts (puro); aqui só resolvemos contexto, gravamos DRAFTs e
// registramos o lote.
//
// INVARIANTE DO PRODUTO: nada aqui publica, em NENHUM modo. Todo treino nasce
// DRAFT com source=PERIODIZATION_GENERATED e só vira PUBLISHED pela ação
// explícita do treinador (modules/workouts/publish-workout.ts). `AUTOMATIC`
// diz que o motor escolheu os parâmetros, não que ele decide o que o atleta
// enxerga — não existe caminho de auto-publicação.

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Quanto histórico o modo AUTOMATIC olha para trás ao deduzir a rotina.
const HISTORY_DAYS = 60;

type WeekWithPhase = Prisma.TrainingWeekGetPayload<{ include: { phase: true } }>;

export interface WeekOutcome {
  weekId: string;
  sequence: number;
  confidence: "LOW" | "MODERATE" | "HIGH";
  /** O que o motor de fato viu nesta semana — congelado para o snapshot. */
  context: WeekContext;
  rationale: GenerationRationale;
  workoutCount: number;
}

const CONFIDENCE_ORDER = ["LOW", "MODERATE", "HIGH"] as const;

async function loadPeriodization(periodizationId: string, actor: PeriodizationActor) {
  const periodization = await prisma.periodization.findUnique({
    where: { id: periodizationId },
    include: { weeks: { include: { phase: true }, orderBy: { sequence: "asc" } } },
  });

  if (
    !periodization ||
    periodization.organizationId !== actor.organizationId ||
    periodization.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Periodização não encontrada.");
  }
  return periodization;
}

// Modo AUTOMATIC: deduz do histórico recente o que o treinador não informou.
// Só é chamado quando `mode === "AUTOMATIC"` — no ASSISTED os parâmetros são
// obrigatórios (validado no schema) e nada é deduzido.
async function resolveAutomaticInput(
  athleteId: string,
  actor: PeriodizationActor,
  input: GenerateInput,
): Promise<InferredInput> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
  const history = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      athleteId,
      plannedDate: { gte: since },
      // Só conta o que o treinador de fato assumiu: rascunho gerado pelo
      // próprio motor não é evidência de rotina — deduzir dele seria o motor
      // aprendendo com o próprio chute.
      status: { in: ["PUBLISHED", "COMPLETED", "PARTIAL", "MISSED"] },
    },
    select: { modality: true, plannedDate: true },
    orderBy: { plannedDate: "desc" },
    take: 60,
  });

  const inference = inferFromHistory(history);

  // O que o treinador informou explicitamente sempre vence a dedução.
  const modality = input.modality ?? inference.modality;
  const availableWeekdays = input.availableWeekdays ?? inference.availableWeekdays;

  if (!modality || !availableWeekdays) {
    // Regra do produto: faltou dado, ou geramos rebaixado ou PEDIMOS o dado.
    // Aqui pedimos — sem modalidade ou sem nenhum dia não há o que prescrever,
    // e inventar ambos produziria um plano que não é de ninguém.
    throw new ValidationError(
      `Não há histórico suficiente para deduzir ${!modality ? "a modalidade" : "os dias disponíveis"}. ${inference.notes.join(" ")}`,
    );
  }

  return {
    modality,
    availableWeekdays,
    level: input.level,
    // Só é "deduzido" o que o treinador não mandou.
    inferred: inference.inferred.filter((field) =>
      field === "modality" ? !input.modality : !input.availableWeekdays,
    ),
    notes: inference.notes,
  };
}

interface RunArgs {
  periodizationId: string;
  athleteId: string;
  goal: string;
  weeks: WeekWithPhase[];
  scope: "SINGLE_WEEK" | "FULL_CYCLE";
  input: GenerateInput;
  resolved: { modality: NonNullable<GenerateInput["modality"]>; availableWeekdays: number[] };
  inference: InferredInput | null;
  actor: PeriodizationActor;
}

async function runGeneration(args: RunArgs) {
  const { periodizationId, athleteId, goal, weeks, scope, input, resolved, inference, actor } =
    args;

  // Rascunhos gerados antes para estas semanas. Publicados/editados ficam fora
  // do filtro de propósito: regerar nunca pode destruir trabalho do treinador
  // nem um treino que o atleta já enxerga.
  const weekIds = weeks.map((w) => w.id);
  const staleDrafts = await prisma.workout.findMany({
    where: {
      trainingWeekId: { in: weekIds },
      organizationId: actor.organizationId,
      status: "DRAFT",
      source: "PERIODIZATION_GENERATED",
      trainerModified: false,
    },
    select: { id: true },
  });

  if (staleDrafts.length > 0 && !input.replaceExisting) {
    throw new ConflictError(
      `Já existem ${staleDrafts.length} rascunho(s) gerado(s) para ${scope === "FULL_CYCLE" ? "este ciclo" : "esta semana"}. Use a opção de substituir para gerar novamente.`,
    );
  }

  // --- Planejamento (puro, fora da transação) ------------------------------
  const outcomes: WeekOutcome[] = [];
  const workoutRows: Prisma.WorkoutCreateManyInput[] = [];
  const blockItems: WorkoutBlocksItem[] = [];
  const created: {
    id: string;
    title: string;
    plannedDate: string;
    modality: string;
    weekSequence: number;
  }[] = [];

  for (const week of weeks) {
    // O volume alvo da semana manda; se estiver vazio, a fase responde. Se as
    // duas estiverem vazias, o motor assume um padrão e rebaixa a confiança.
    const targetVolumeKm =
      week.targetVolume?.toNumber() ?? week.phase?.targetVolumeKm?.toNumber() ?? undefined;

    const context: WeekContext = {
      goal,
      modality: resolved.modality,
      level: input.level,
      availableWeekdays: resolved.availableWeekdays,
      phaseName: week.phase?.name,
      isRecoveryWeek: week.isRecoveryWeek,
      targetVolumeKm,
      targetIntensity: week.targetIntensity ?? week.phase?.targetIntensity ?? undefined,
      weekStartDate: isoDate(week.startDate),
      weekEndDate: isoDate(week.endDate),
      includeStrength: input.includeStrength,
    };

    const plan = planWeek(context);

    // Deduzir é palpite sobre o passado — entra no rationale e derruba a
    // confiança, nunca passa em silêncio.
    const rationale: GenerationRationale =
      inference && inference.inferred.length > 0
        ? {
            ...plan.rationale,
            missingData: [...plan.rationale.missingData, ...inference.inferred],
            caveats: [...plan.rationale.caveats, ...inference.notes],
            rules: [
              ...plan.rationale.rules,
              {
                id: "automatic-inference",
                version: "1",
                explanation: `Modo automático: ${inference.inferred.join(", ")} deduzido(s) do histórico dos últimos ${HISTORY_DAYS} dias, não informado(s) pelo treinador. Confere antes de publicar.`,
              },
            ],
          }
        : plan.rationale;

    const confidence =
      inference && inference.inferred.length > 0 && plan.confidence === "HIGH"
        ? "MODERATE"
        : plan.confidence;

    for (const session of plan.sessions) {
      const workoutId = randomUUID();
      workoutRows.push({
        id: workoutId,
        organizationId: actor.organizationId,
        athleteId,
        trainerId: actor.trainerProfileId,
        periodizationId,
        periodizationPhaseId: week.phaseId,
        trainingWeekId: week.id,
        title: session.title,
        description: session.description,
        modality: session.modality,
        status: "DRAFT",
        source: "PERIODIZATION_GENERATED",
        plannedDate: new Date(`${session.plannedDate}T00:00:00.000Z`),
        generationMode: input.mode,
        algorithmVersion: ALGORITHM_VERSION,
        generationRationaleVersion: RATIONALE_VERSION,
        confidenceLevel: confidence,
        // Rationale por treino (e não só no lote): o treinador revisa uma
        // sessão de cada vez e precisa da regra ali, não num lote distante.
        generationRationale: {
          ...rationale,
          sessionKind: session.kind,
        } as unknown as Prisma.InputJsonObject,
      });
      blockItems.push({ workoutId, blocks: session.blocks });
      created.push({
        id: workoutId,
        title: session.title,
        plannedDate: session.plannedDate,
        modality: session.modality,
        weekSequence: week.sequence,
      });
    }

    outcomes.push({
      weekId: week.id,
      sequence: week.sequence,
      confidence,
      context,
      rationale,
      workoutCount: plan.sessions.length,
    });
  }

  // A confiança do lote é a PIOR das semanas: um ciclo não é mais confiável
  // que a sua semana mais malservida de dados.
  const batchConfidence = outcomes.reduce<"LOW" | "MODERATE" | "HIGH">(
    (worst, outcome) =>
      CONFIDENCE_ORDER.indexOf(outcome.confidence) < CONFIDENCE_ORDER.indexOf(worst)
        ? outcome.confidence
        : worst,
    "HIGH",
  );
  // Rationale representativo = o da semana que puxou a confiança para baixo.
  // É o que o treinador precisa ver, não a melhor semana do lote.
  const representative =
    outcomes.find((outcome) => outcome.confidence === batchConfidence) ?? outcomes[0];

  const previousBatches = await prisma.generationBatch.count({ where: { periodizationId } });

  return prisma.$transaction(
    async (tx) => {
      if (staleDrafts.length > 0) {
        // Blocos/steps caem por cascade.
        await tx.workout.deleteMany({ where: { id: { in: staleDrafts.map((d) => d.id) } } });
      }

      const batch = await tx.generationBatch.create({
        data: {
          organizationId: actor.organizationId,
          periodizationId,
          athleteId,
          trainerId: actor.trainerProfileId,
          requestedByUserId: actor.userId,
          generationMode: input.mode,
          generationVersion: previousBatches + 1,
          algorithmVersion: ALGORITHM_VERSION,
          generationRationaleVersion: RATIONALE_VERSION,
          scope,
          status: "PROCESSING",
          startedAt: new Date(),
          // contextSnapshot = exatamente o que o motor viu. Sem isto, um treino
          // gerado hoje é inexplicável amanhã: o alvo da semana pode ter mudado,
          // a fase pode ter sido renomeada. O snapshot congela a entrada, o
          // rationale congela o raciocínio.
          contextSnapshot: {
            mode: input.mode,
            scope,
            resolvedInput: { ...resolved, level: input.level ?? null },
            inference: inference ? { ...inference } : null,
            confidence: batchConfidence,
            weeks: outcomes.map((outcome) => ({
              weekId: outcome.weekId,
              sequence: outcome.sequence,
              confidence: outcome.confidence,
              // `context` é a ENTRADA congelada, `rationale` o raciocínio. Sem
              // a entrada, um treino gerado hoje é inexplicável amanhã: o alvo
              // da semana pode mudar, a fase pode ser renomeada.
              context: outcome.context,
              rationale: outcome.rationale,
              workoutCount: outcome.workoutCount,
            })),
          } as unknown as Prisma.InputJsonObject,
        },
      });

      if (workoutRows.length > 0) {
        // Batelado: um ciclo inteiro são dezenas de treinos e centenas de
        // steps. Um create por linha estouraria o teto da transação — é a
        // razão de persistManyWorkoutBlocks existir.
        await tx.workout.createMany({
          data: workoutRows.map((row) => ({
            ...row,
            generationBatchId: batch.id,
            generationVersion: batch.generationVersion,
          })),
        });
        await persistManyWorkoutBlocks(tx, actor.organizationId, blockItems);
      }

      await tx.generationBatch.update({
        where: { id: batch.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await recordAuditLog(tx, {
        action: scope === "FULL_CYCLE" ? "GENERATE_CYCLE" : "GENERATE_WEEK",
        entityName: "GenerationBatch",
        entityId: batch.id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        reason: `${scope}:${input.mode}:${weeks.length}_semana(s):${created.length}_drafts:confidence_${batchConfidence}:${ALGORITHM_VERSION}`,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });

      return {
        batchId: batch.id,
        scope,
        mode: input.mode,
        workouts: created,
        confidence: batchConfidence,
        rationale: representative?.rationale ?? null,
        weeks: outcomes.map(({ weekId, sequence, confidence, workoutCount }) => ({
          weekId,
          sequence,
          confidence,
          workoutCount,
        })),
        replacedDrafts: staleDrafts.length,
      };
    },
    // Teto ainda elevado (a transação apaga rascunhos, cria o lote e insere em
    // massa), mas agora com ~8 idas ao banco em vez de uma por linha.
    { timeout: 30_000, maxWait: 10_000 },
  );
}

async function resolveInput(athleteId: string, input: GenerateInput, actor: PeriodizationActor) {
  if (input.mode === "AUTOMATIC") {
    const inference = await resolveAutomaticInput(athleteId, actor, input);
    return {
      resolved: {
        modality: inference.modality!,
        availableWeekdays: inference.availableWeekdays!,
      },
      inference,
    };
  }
  // ASSISTED: o schema já garante que ambos vieram.
  return {
    resolved: { modality: input.modality!, availableWeekdays: input.availableWeekdays! },
    inference: null,
  };
}

/** Gera os rascunhos de UMA semana. */
export async function generateWeekDrafts(
  target: { periodizationId: string; weekId: string },
  input: GenerateInput,
  actor: PeriodizationActor,
) {
  const periodization = await loadPeriodization(target.periodizationId, actor);

  // A semana é única globalmente, então sem esta checagem a rota
  // /periodizations/A/weeks/<semana-de-B> geraria silenciosamente para B.
  const week = periodization.weeks.find((w) => w.id === target.weekId);
  if (!week) throw new NotFoundError("Semana de treino não encontrada.");

  // Invariante de negócio reforçada no serviço, como nos demais módulos: seguro
  // a partir de qualquer entry point futuro, mesmo que a rota já valide.
  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    periodization.athleteId,
  );

  const { resolved, inference } = await resolveInput(periodization.athleteId, input, actor);

  return runGeneration({
    periodizationId: periodization.id,
    athleteId: periodization.athleteId,
    goal: periodization.goal,
    weeks: [week],
    scope: "SINGLE_WEEK",
    input,
    resolved,
    inference,
    actor,
  });
}

/** Gera os rascunhos do CICLO INTEIRO — todas as semanas do plano. */
export async function generateCycleDrafts(
  periodizationId: string,
  input: GenerateInput,
  actor: PeriodizationActor,
) {
  const periodization = await loadPeriodization(periodizationId, actor);

  if (periodization.weeks.length === 0) {
    throw new ValidationError("Este plano não tem semanas para gerar.");
  }

  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    periodization.athleteId,
  );

  const { resolved, inference } = await resolveInput(periodization.athleteId, input, actor);

  return runGeneration({
    periodizationId: periodization.id,
    athleteId: periodization.athleteId,
    goal: periodization.goal,
    weeks: periodization.weeks,
    scope: "FULL_CYCLE",
    input,
    resolved,
    inference,
    actor,
  });
}
