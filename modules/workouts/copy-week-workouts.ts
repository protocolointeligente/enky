import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { WorkoutActor } from "./create-workout-draft";
import { persistWorkoutBlocks } from "./persist-blocks";
import { workoutBlocksToInput, workoutContentInclude } from "./workout-content";

export interface CopyWeekInput {
  sourceWeekStart: string; // yyyy-mm-dd, must be a Monday
  targetWeekStart: string; // yyyy-mm-dd, must be a Monday
  athleteId?: string; // optional: copy only this athlete's workouts
}

// Non-copyable terminal statuses — CANCELLED and ARCHIVED workouts are stale
// prescriptions that shouldn't propagate into a fresh planning week.
const SKIP_STATUSES = ["CANCELLED", "ARCHIVED"] as const;

function assertMonday(dateStr: string, label: string): Date {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  // getUTCDay(): 0=Sun, 1=Mon
  if (date.getUTCDay() !== 1) {
    throw new BusinessRuleError(`${label} deve ser uma segunda-feira.`);
  }
  return date;
}

// Copies all workouts from one training week (Mon–Sun) to another,
// creating fresh DRAFTs. Each workout's day-of-week and time-of-day are
// preserved — only the week shifts. Used to replicate a planned
// microcycle without re-prescribing every session.
export async function copyWeekWorkouts(input: CopyWeekInput, actor: WorkoutActor) {
  const sourceStart = assertMonday(input.sourceWeekStart, "Semana de origem");
  const targetStart = assertMonday(input.targetWeekStart, "Semana de destino");

  if (sourceStart.getTime() === targetStart.getTime()) {
    throw new BusinessRuleError("A semana de destino deve ser diferente da semana de origem.");
  }

  const deltaMs = targetStart.getTime() - sourceStart.getTime();
  const sourceEnd = new Date(sourceStart.getTime() + 6 * 86_400_000); // Sunday

  // Find all copyable workouts in the source week, scoped to this trainer.
  const workouts = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      plannedDate: { gte: sourceStart, lte: sourceEnd },
      status: { notIn: [...SKIP_STATUSES] },
      ...(input.athleteId ? { athleteId: input.athleteId } : {}),
    },
    include: workoutContentInclude,
    orderBy: [{ plannedDate: "asc" }, { plannedStartAt: "asc" }],
  });

  if (workouts.length === 0) {
    return { created: [] };
  }

  // Validate active link to every target athlete up-front — fail fast rather
  // than creating partial duplicates.
  const uniqueAthleteIds = [...new Set(workouts.map((w) => w.athleteId))];
  for (const athleteId of uniqueAthleteIds) {
    await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);
  }

  return prisma.$transaction(async (tx) => {
    const createdIds: string[] = [];

    for (const source of workouts) {
      const newPlannedDate = new Date(source.plannedDate.getTime() + deltaMs);
      const newStartAt = source.plannedStartAt
        ? new Date(source.plannedStartAt.getTime() + deltaMs)
        : undefined;
      const newEndAt = source.plannedEndAt
        ? new Date(source.plannedEndAt.getTime() + deltaMs)
        : undefined;

      const blocks = workoutBlocksToInput(source.blocks);

      const workout = await tx.workout.create({
        data: {
          organizationId: actor.organizationId,
          athleteId: source.athleteId,
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
      createdIds.push(workout.id);
    }

    await recordAuditLog(tx, {
      action: "COPY_WEEK",
      entityName: "Workout",
      entityId: createdIds[0] ?? "batch",
      userId: actor.userId,
      organizationId: actor.organizationId,
      reason: `copied_week:${input.sourceWeekStart}→${input.targetWeekStart}:${createdIds.length}_workouts`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { created: createdIds };
  });
}
