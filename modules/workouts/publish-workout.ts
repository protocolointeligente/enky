import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { WorkoutActor } from "./create-workout-draft";

export async function publishWorkout(workoutId: string, actor: WorkoutActor) {
  const current = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { blocks: true },
  });

  if (!current || current.organizationId !== actor.organizationId || current.trainerId !== actor.trainerProfileId) {
    throw new NotFoundError("Treino não encontrado.");
  }
  if (current.status !== "DRAFT") {
    throw new ConflictError("Somente treinos em rascunho podem ser publicados.");
  }
  if (current.blocks.length === 0) {
    throw new BusinessRuleError("O treino precisa de pelo menos um bloco de conteúdo antes de ser publicado.");
  }

  return prisma.$transaction(async (tx) => {
    const result = await tx.workout.updateMany({
      where: { id: workoutId, status: "DRAFT" },
      data: { status: "PUBLISHED" },
    });

    if (result.count === 0) {
      throw new ConflictError("O treino não está mais em rascunho.");
    }

    // No publishedAt column exists, and none is added for this: AuditLog's
    // own createdAt is an append-only, more reliable record of "when this
    // was published" than a mutable field would be — no migration needed.
    await recordAuditLog(tx, {
      action: "PUBLISH_WORKOUT",
      entityName: "Workout",
      entityId: workoutId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tx.workout.findUniqueOrThrow({ where: { id: workoutId } });
  });
}
