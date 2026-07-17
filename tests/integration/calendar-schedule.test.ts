import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { createWorkoutDraft, type WorkoutActor } from "@/modules/workouts/create-workout-draft";
import { publishWorkout } from "@/modules/workouts/publish-workout";
import { moveWorkout } from "@/modules/workouts/move-workout";
import { duplicateWorkout } from "@/modules/workouts/duplicate-workout";
import {
  listAthleteCalendarWorkouts,
  listTrainerCalendarWorkouts,
} from "@/modules/workouts/list-calendar-workouts";
import {
  submitWorkoutFeedback,
  type AthleteActor,
} from "@/modules/feedback/submit-workout-feedback";
import { cleanupSubscriptions, grantUnlimitedPlan, uniqueEmail } from "./helpers";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";
const RANGE = {
  from: new Date("2026-08-01T00:00:00.000Z"),
  to: new Date("2026-08-31T00:00:00.000Z"),
};

async function newTrainerWithAthlete(prefix: string) {
  const trainer = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(`${prefix}-trainer`),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(trainer.userId);
  createdOrganizationIds.push(trainer.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: trainer.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);

  const invitation = await inviteAthlete(
    { email: uniqueEmail(`${prefix}-athlete`) },
    {
      userId: trainer.userId,
      trainerProfileId: trainerProfile.id,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: `${prefix} Athlete`,
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);

  const trainerActor: WorkoutActor = {
    userId: trainer.userId,
    trainerProfileId: trainerProfile.id,
    organizationId: trainer.organizationId,
  };
  const athleteActor: AthleteActor = {
    userId: activation.userId,
    athleteProfileId: invitation.athleteProfileId,
    organizationId: trainer.organizationId,
  };
  return { trainerActor, athleteActor };
}

function draftInput(
  athleteId: string,
  plannedDate: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    athleteId,
    title: "Rodagem",
    modality: "RUNNING" as const,
    plannedDate,
    timezone: "America/Sao_Paulo",
    blocks: [
      {
        repetitions: 1,
        steps: [{ stepType: "RODAGEM" as const, durationSeconds: 3600, distanceMeters: 10000 }],
        exercises: [],
      },
    ],
    ...overrides,
  };
}

describe("Fase 02D.2 — calendário e agendamento", () => {
  it("lista treinos do treinador no período e respeita filtros de atleta/modalidade/status", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("cal-list");
    const inRange = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-10"),
      trainerActor,
    );
    await createWorkoutDraft(draftInput(athleteActor.athleteProfileId, "2026-09-15"), trainerActor); // out of range

    const scope = {
      organizationId: trainerActor.organizationId,
      trainerProfileId: trainerActor.trainerProfileId,
    };
    const all = await listTrainerCalendarWorkouts(scope, RANGE);
    expect(all.map((w) => w.id)).toContain(inRange.id);
    expect(all.every((w) => w.plannedDate >= "2026-08-01" && w.plannedDate <= "2026-08-31")).toBe(
      true,
    );

    const byModality = await listTrainerCalendarWorkouts(scope, { ...RANGE, modality: "STRENGTH" });
    expect(byModality.find((w) => w.id === inRange.id)).toBeUndefined();

    const byStatus = await listTrainerCalendarWorkouts(scope, { ...RANGE, status: "PUBLISHED" });
    expect(byStatus.find((w) => w.id === inRange.id)).toBeUndefined(); // it's DRAFT
  });

  it("esconde DRAFT do calendário do atleta e mostra após publicação", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("cal-athlete");
    const workout = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-12"),
      trainerActor,
    );
    const scope = {
      organizationId: athleteActor.organizationId,
      athleteProfileId: athleteActor.athleteProfileId,
    };

    let visible = await listAthleteCalendarWorkouts(scope, RANGE);
    expect(visible.find((w) => w.id === workout.id)).toBeUndefined();

    await publishWorkout(workout.id, trainerActor);
    visible = await listAthleteCalendarWorkouts(scope, RANGE);
    expect(visible.find((w) => w.id === workout.id)?.status).toBe("PUBLISHED");
  });

  it("move um treino DRAFT para outra data preservando o horário planejado", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("move-draft");
    const workout = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-05", {
        plannedStartAt: "2026-08-05T09:00:00.000Z",
        plannedEndAt: "2026-08-05T10:00:00.000Z",
      }),
      trainerActor,
    );

    const moved = await moveWorkout(workout.id, { plannedDate: "2026-08-08" }, trainerActor);
    expect(moved.plannedDate.toISOString().slice(0, 10)).toBe("2026-08-08");
    expect(moved.plannedStartAt?.toISOString()).toBe("2026-08-08T09:00:00.000Z");
    expect(moved.plannedEndAt?.toISOString()).toBe("2026-08-08T10:00:00.000Z");
  });

  it("move um treino PUBLICADO sem feedback, mas bloqueia se já houver feedback", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("move-pub");
    const workout = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-06"),
      trainerActor,
    );
    await publishWorkout(workout.id, trainerActor);

    const moved = await moveWorkout(workout.id, { plannedDate: "2026-08-09" }, trainerActor);
    expect(moved.plannedDate.toISOString().slice(0, 10)).toBe("2026-08-09");

    await submitWorkoutFeedback(
      workout.id,
      { completionStatus: "COMPLETED", actualDurationMinutes: 55, sessionRpe: 6 },
      athleteActor,
    );
    await expect(
      moveWorkout(workout.id, { plannedDate: "2026-08-11" }, trainerActor),
    ).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
    });
  });

  it("retorna NOT_FOUND ao mover treino de outra organização", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("move-iso-a");
    const { trainerActor: strangerTrainer } = await newTrainerWithAthlete("move-iso-b");
    const workout = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-07"),
      trainerActor,
    );

    await expect(
      moveWorkout(workout.id, { plannedDate: "2026-08-14" }, strangerTrainer),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("duplica um treino como DRAFT copiando o conteúdo, sem copiar feedback nem status", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("dup-basic");
    const source = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-04"),
      trainerActor,
    );
    await publishWorkout(source.id, trainerActor);
    await submitWorkoutFeedback(
      source.id,
      { completionStatus: "COMPLETED", actualDurationMinutes: 50, sessionRpe: 7 },
      athleteActor,
    );

    const copy = await duplicateWorkout(source.id, { plannedDate: "2026-08-20" }, trainerActor);
    expect(copy.id).not.toBe(source.id);
    expect(copy.status).toBe("DRAFT");
    expect(copy.source).toBe("MANUAL");
    expect(copy.title).toBe(source.title);
    expect(copy.plannedDate.toISOString().slice(0, 10)).toBe("2026-08-20");

    const copyFeedback = await prisma.workoutFeedback.findUnique({ where: { workoutId: copy.id } });
    expect(copyFeedback).toBeNull();

    const copyBlocks = await prisma.workoutBlock.findMany({
      where: { workoutId: copy.id },
      include: { steps: true },
    });
    expect(copyBlocks).toHaveLength(1);
    expect(copyBlocks[0]?.steps).toHaveLength(1);
    expect(copyBlocks[0]?.steps[0]?.durationSeconds).toBe(3600);
  });

  it("duplica para outro atleta da mesma organização, mas bloqueia atleta de outra organização", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("dup-cross");
    // Dois atletas na mesma organização exigem plano pago desde a Fase 10 — o
    // grátis vale 1. Não é o assunto deste teste, é só o pré-requisito dele.
    await grantUnlimitedPlan(trainerActor.organizationId);
    // second athlete in the SAME org
    const invitation = await inviteAthlete(
      { email: uniqueEmail("dup-second-athlete") },
      {
        userId: trainerActor.userId,
        trainerProfileId: trainerActor.trainerProfileId,
        organizationId: trainerActor.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitation.athleteProfileId);
    const secondActivation = await activateAthleteInvitation({
      token: invitation.rawToken,
      name: "Segundo Atleta",
      password: VALID_PASSWORD,
    });
    createdUserIds.push(secondActivation.userId);

    const source = await createWorkoutDraft(
      draftInput(athleteActor.athleteProfileId, "2026-08-03"),
      trainerActor,
    );

    const copy = await duplicateWorkout(
      source.id,
      { plannedDate: "2026-08-22", athleteId: invitation.athleteProfileId },
      trainerActor,
    );
    expect(copy.athleteId).toBe(invitation.athleteProfileId);

    const { athleteActor: otherOrgAthlete } = await newTrainerWithAthlete("dup-otherorg");
    await expect(
      duplicateWorkout(
        source.id,
        { plannedDate: "2026-08-23", athleteId: otherOrgAthlete.athleteProfileId },
        trainerActor,
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0 || createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: createdUserIds } },
            { organizationId: { in: createdOrganizationIds } },
          ],
        },
      });
    }
    if (createdOrganizationIds.length > 0) {
      await prisma.workout.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      // Antes de apagar as organizações: Subscription.organization é
      // ON DELETE RESTRICT e travaria o delete abaixo.
      await cleanupSubscriptions(createdOrganizationIds);
      await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    }
    if (createdTrainerProfileIds.length > 0) {
      await prisma.trainerProfile.deleteMany({ where: { id: { in: createdTrainerProfileIds } } });
    }
    if (createdAthleteProfileIds.length > 0) {
      await prisma.athleteProfile.deleteMany({ where: { id: { in: createdAthleteProfileIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
});
