import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { getAthleteWorkout } from "@/modules/workouts/get-athlete-workout";
import type { StartExecutionInput } from "./execution-schema";

export interface AthleteActor {
  userId: string;
  athleteProfileId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Inicia uma execução de treino. É idempotente e tolerante a múltiplos
 * dispositivos (§45): se já existe uma execução ativa (STARTED/PAUSED) para
 * este treino, ela é retornada em vez de criar uma segunda; e a mesma
 * `idempotencyKey` (reenvio da fila offline) também retorna a existente.
 *
 * Congela um snapshot imutável da prescrição + a versão (`Workout.lockVersion`)
 * no início (§18-19), então alterações posteriores do treinador não corrompem
 * uma execução em andamento. NÃO altera `Workout.status` — o feedback continua
 * sendo a fonte da verdade do estado do treino.
 */
export async function startWorkoutExecution(
  workoutId: string,
  input: StartExecutionInput,
  actor: AthleteActor,
) {
  // Ownership + visibilidade (lança NotFoundError se não for do atleta).
  const workout = await getAthleteWorkout(workoutId, {
    organizationId: actor.organizationId,
    athleteProfileId: actor.athleteProfileId,
  });

  if (workout.status !== "PUBLISHED") {
    throw new BusinessRuleError("Só é possível iniciar treinos publicados.");
  }

  const active = await prisma.workoutExecution.findFirst({
    where: {
      workoutId,
      athleteId: actor.athleteProfileId,
      status: { in: ["STARTED", "PAUSED"] },
    },
  });
  if (active) return active;

  const existing = await prisma.workoutExecution.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;

  const { lockVersion } = await prisma.workout.findUniqueOrThrow({
    where: { id: workoutId },
    select: { lockVersion: true },
  });

  // Cópia plana e imutável: JSON.stringify resolve Date→ISO e Decimal→string,
  // então o snapshot nunca guarda referências vivas do Prisma.
  const workoutSnapshot = JSON.parse(JSON.stringify(workout)) as Prisma.InputJsonValue;

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.workoutExecution.create({
        data: {
          organizationId: actor.organizationId,
          athleteId: actor.athleteProfileId,
          workoutId,
          status: "STARTED",
          idempotencyKey: input.idempotencyKey,
          deviceId: input.deviceId,
          clientVersion: input.clientVersion,
          offlineCreatedAt: input.offlineCreatedAt ? new Date(input.offlineCreatedAt) : undefined,
          workoutVersion: lockVersion,
          workoutSnapshot,
        },
      });

      await recordAuditLog(tx, {
        action: "WORKOUT_EXECUTION_STARTED",
        entityName: "WorkoutExecution",
        entityId: created.id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });

      return created;
    });
  } catch (error) {
    // Corrida de idempotência: dois "start" com a mesma chave chegam juntos; o
    // perdedor bate no unique e deve retornar a execução já criada, não erro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.workoutExecution.findUniqueOrThrow({
        where: { idempotencyKey: input.idempotencyKey },
      });
    }
    throw error;
  }
}
