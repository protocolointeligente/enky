import { NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { ALGORITHM_VERSION } from "./generation-rules";
import { generateCycleDrafts } from "./generate-week";
import type { GenerateInput } from "./generation-schema";
import type { PeriodizationActor } from "./periodization-service";

// ============================================================================
// GERAÇÃO DO CICLO EM SEGUNDO PLANO (ENKY Intelligence 2.0 · Fase 9).
// ============================================================================
// A geração do ciclo inteiro é o único caminho pesado (persiste dezenas de
// treinos). Para nunca bloquear a interface, o job de background:
//   1. START — cria o GenerationBatch como PENDING e devolve o batchId NA HORA;
//   2. PROCESS — roda depois da resposta (Next `after`), ADOTANDO esse batch
//      (o síncrono homologado segue intocado — ver generate-week.ts);
//   3. STATUS — o cliente consulta o batch até COMPLETED/FAILED.
// O modelo GenerationBatch já existia para isto (status/startedAt/completedAt/
// failedAt). Nada aqui publica: os treinos nascem DRAFT como no caminho síncrono.

/** Cria o batch PENDING e devolve o id para o cliente acompanhar. Valida acesso
 *  e a existência de semanas ANTES de enfileirar (falha cedo, sem job órfão). */
export async function startCycleGeneration(
  periodizationId: string,
  input: GenerateInput,
  actor: PeriodizationActor,
): Promise<{ batchId: string }> {
  const periodization = await prisma.periodization.findUnique({
    where: { id: periodizationId },
    select: {
      id: true,
      organizationId: true,
      trainerId: true,
      athleteId: true,
      _count: { select: { weeks: true } },
    },
  });
  if (
    !periodization ||
    periodization.organizationId !== actor.organizationId ||
    periodization.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Periodização não encontrada.");
  }
  if (periodization._count.weeks === 0) {
    throw new ValidationError("Este plano não tem semanas para gerar.");
  }
  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    periodization.athleteId,
  );

  const previousBatches = await prisma.generationBatch.count({ where: { periodizationId } });
  const batch = await prisma.generationBatch.create({
    data: {
      organizationId: actor.organizationId,
      periodizationId,
      athleteId: periodization.athleteId,
      trainerId: actor.trainerProfileId,
      requestedByUserId: actor.userId,
      generationMode: input.mode,
      generationVersion: previousBatches + 1, // sobrescrito na adoção; placeholder.
      algorithmVersion: ALGORITHM_VERSION,
      scope: "FULL_CYCLE",
      status: "PENDING",
      // contextSnapshot é obrigatório; placeholder até a adoção congelar o real.
      contextSnapshot: { pending: true },
    },
    select: { id: true },
  });

  return { batchId: batch.id };
}

/** Roda a geração adotando o batch PENDING. Chamado de dentro de `after()` na
 *  rota — qualquer erro marca o batch como FAILED (o cliente vê no status). */
export async function processCycleGeneration(
  periodizationId: string,
  batchId: string,
  input: GenerateInput,
  actor: PeriodizationActor,
): Promise<void> {
  try {
    await generateCycleDrafts(periodizationId, input, actor, { existingBatchId: batchId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida na geração.";
    await prisma.generationBatch
      .update({
        where: { id: batchId },
        data: { status: "FAILED", failedAt: new Date(), failureCode: message.slice(0, 300) },
      })
      .catch(() => {
        // Se nem o registro de falha grava, não há mais o que fazer aqui — o
        // batch fica PENDING e o cliente eventualmente desiste do polling.
      });
  }
}

export interface CycleBatchStatus {
  batchId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  workoutCount: number;
}

/** Estado atual do job — escopo org+treinador via o próprio batch. */
export async function getCycleBatchStatus(
  batchId: string,
  actor: PeriodizationActor,
): Promise<CycleBatchStatus> {
  const batch = await prisma.generationBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      organizationId: true,
      trainerId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      failedAt: true,
      failureCode: true,
      _count: { select: { workouts: true } },
    },
  });
  if (
    !batch ||
    batch.organizationId !== actor.organizationId ||
    batch.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Geração não encontrada.");
  }

  return {
    batchId: batch.id,
    status: batch.status as CycleBatchStatus["status"],
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    failedAt: batch.failedAt?.toISOString() ?? null,
    failureCode: batch.failureCode,
    workoutCount: batch._count.workouts,
  };
}
