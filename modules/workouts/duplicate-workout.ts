import { recordAuditLog } from "@/domain/audit";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { WorkoutActor } from "./create-workout-draft";
import { persistWorkoutBlocks } from "./persist-blocks";
import { workoutBlocksToInput, workoutContentInclude } from "./workout-content";

export interface DuplicateWorkoutInput {
  plannedDate: string; // yyyy-mm-dd — required
  athleteId?: string; // optional target athlete (must be same org, active); defaults to the source's athlete
}

// Duplicates a workout as a fresh DRAFT (§8). Copies the prescription content
// (title, description, modality, timezone, blocks/steps/exercises, planned
// window) but NEVER the athlete's response — feedback, Session-RPE, completed
// status, execution timestamps and the original ids are all left behind
// because a new prescription starts clean.
export async function duplicateWorkout(
  workoutId: string,
  input: DuplicateWorkoutInput,
  actor: WorkoutActor,
) {
  const source = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: workoutContentInclude,
  });

  if (
    !source ||
    source.organizationId !== actor.organizationId ||
    source.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Treino não encontrado.");
  }

  const targetAthleteId = input.athleteId ?? source.athleteId;
  // Always re-validate an active link to the target — this blocks duplicating
  // to an athlete of another organization or with an inactive relationship,
  // even when the target is the source's own athlete.
  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    targetAthleteId,
  );

  const newPlannedDate = new Date(`${input.plannedDate}T00:00:00.000Z`);
  const oldPlannedDate = new Date(`${source.plannedDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const deltaMs = newPlannedDate.getTime() - oldPlannedDate.getTime();
  const newStartAt = source.plannedStartAt
    ? new Date(source.plannedStartAt.getTime() + deltaMs)
    : undefined;
  const newEndAt = source.plannedEndAt
    ? new Date(source.plannedEndAt.getTime() + deltaMs)
    : undefined;

  const blocks = workoutBlocksToInput(source.blocks);

  return prisma.$transaction(async (tx) => {
    const workout = await tx.workout.create({
      data: {
        organizationId: actor.organizationId,
        athleteId: targetAthleteId,
        trainerId: actor.trainerProfileId,
        title: source.title,
        description: source.description,
        modality: source.modality,
        status: "DRAFT",
        source: "MANUAL",
        plannedDate: newPlannedDate,
        plannedStartAt: newStartAt,
        plannedEndAt: newEndAt,
        timezone: source.timezone,
      },
    });

    await persistWorkoutBlocks(tx, workout.id, actor.organizationId, blocks);

    await recordAuditLog(tx, {
      action: "DUPLICATE_WORKOUT",
      entityName: "Workout",
      entityId: workout.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      // reason links the duplicate to its source without exposing anything
      // sensitive — just the originating workout id.
      reason: `duplicated_from:${source.id}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return workout;
  });
}
