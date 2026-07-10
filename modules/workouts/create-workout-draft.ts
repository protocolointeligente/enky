import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { persistWorkoutBlocks } from "./persist-blocks";
import type { CreateWorkoutDraftInput } from "./prescription-schema";

export interface WorkoutActor {
  userId: string;
  trainerProfileId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createWorkoutDraft(input: CreateWorkoutDraftInput, actor: WorkoutActor) {
  // Business invariant, not a session check — enforced here even though
  // the route also validates it, so the service is safe to call from
  // any future entry point (calendar, template application, ...).
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, input.athleteId);

  return prisma.$transaction(async (tx) => {
    const workout = await tx.workout.create({
      data: {
        organizationId: actor.organizationId,
        athleteId: input.athleteId,
        trainerId: actor.trainerProfileId,
        title: input.title,
        description: input.description,
        modality: input.modality,
        status: "DRAFT",
        source: "MANUAL",
        plannedDate: new Date(input.plannedDate),
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : undefined,
        plannedEndAt: input.plannedEndAt ? new Date(input.plannedEndAt) : undefined,
        timezone: input.timezone,
      },
    });

    await persistWorkoutBlocks(tx, workout.id, actor.organizationId, input.blocks);

    await recordAuditLog(tx, {
      action: "CREATE_WORKOUT_DRAFT",
      entityName: "Workout",
      entityId: workout.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return workout;
  });
}
