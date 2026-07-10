import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { createWorkoutDraft, type WorkoutActor } from "@/modules/workouts/create-workout-draft";
import { updateWorkoutDraft } from "@/modules/workouts/update-workout-draft";
import { publishWorkout } from "@/modules/workouts/publish-workout";
import { getAthleteWorkout, listAthleteWorkouts } from "@/modules/workouts/get-athlete-workout";
import {
  submitWorkoutFeedback,
  updateWorkoutFeedback,
  type AthleteActor,
} from "@/modules/feedback/submit-workout-feedback";
import { uniqueEmail } from "./helpers";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

async function newTrainerWithAthlete(prefix: string) {
  const trainerResult = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(`${prefix}-trainer`),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(trainerResult.userId);
  createdOrganizationIds.push(trainerResult.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: trainerResult.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);

  const invitation = await inviteAthlete(
    { email: uniqueEmail(`${prefix}-athlete`) },
    {
      userId: trainerResult.userId,
      trainerProfileId: trainerProfile.id,
      organizationId: trainerResult.organizationId,
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
    userId: trainerResult.userId,
    trainerProfileId: trainerProfile.id,
    organizationId: trainerResult.organizationId,
  };
  const athleteActor: AthleteActor = {
    userId: activation.userId,
    athleteProfileId: invitation.athleteProfileId,
    organizationId: trainerResult.organizationId,
  };

  return { trainerActor, athleteActor };
}

function runningDraftInput(athleteId: string) {
  return {
    athleteId,
    title: "Rodagem longa",
    modality: "RUNNING" as const,
    plannedDate: "2026-08-01",
    timezone: "America/Sao_Paulo",
    blocks: [
      {
        repetitions: 1,
        steps: [
          { stepType: "RODAGEM" as const, durationSeconds: 3600, distanceMeters: 10000 },
          { stepType: "TIRO" as const, repetitions: 6, distanceMeters: 400 },
        ],
        exercises: [],
      },
    ],
  };
}

function strengthDraftInput(athleteId: string) {
  return {
    athleteId,
    title: "Força — membros inferiores",
    modality: "STRENGTH" as const,
    plannedDate: "2026-08-02",
    timezone: "America/Sao_Paulo",
    blocks: [
      {
        repetitions: 1,
        steps: [],
        exercises: [{ exerciseName: "Agachamento livre", exerciseCategory: "geral", sets: 4, reps: 8, loadKg: 80 }],
      },
    ],
  };
}

describe("Fase 02C — prescrição, publicação e feedback de treino", () => {
  // -------------------------------------------------------------------
  // 1. Criação de rascunho — corrida (WorkoutBlock/WorkoutStep) + AuditLog
  // -------------------------------------------------------------------
  it("cria um treino de corrida em DRAFT com blocos e passos, e registra AuditLog sem dados sensíveis", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("create-running");

    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    expect(workout.status).toBe("DRAFT");
    expect(workout.source).toBe("MANUAL");

    const blocks = await prisma.workoutBlock.findMany({
      where: { workoutId: workout.id },
      include: { steps: true },
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.steps).toHaveLength(2);
    expect(blocks[0]?.steps.map((s) => s.sequence).sort()).toEqual([1, 2]);

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: "CREATE_WORKOUT_DRAFT", entityId: workout.id },
    });
    expect(JSON.stringify(auditLog)).not.toContain(VALID_PASSWORD);
  });

  // -------------------------------------------------------------------
  // 2. Criação de rascunho — força (WorkoutBlock/WorkoutExercise), com
  //    upsert de Exercise escopado por organização.
  // -------------------------------------------------------------------
  it("cria um treino de força com exercícios e faz upsert do Exercise por organização", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("create-strength");

    const workout = await createWorkoutDraft(strengthDraftInput(athleteActor.athleteProfileId), trainerActor);

    const blocks = await prisma.workoutBlock.findMany({
      where: { workoutId: workout.id },
      include: { exercises: { include: { exercise: true } } },
    });
    expect(blocks[0]?.exercises).toHaveLength(1);
    expect(blocks[0]?.exercises[0]?.exercise.name).toBe("Agachamento livre");
    expect(blocks[0]?.exercises[0]?.exercise.organizationId).toBe(trainerActor.organizationId);
  });

  // -------------------------------------------------------------------
  // 3. Sem vínculo ativo treinador-atleta → AUTHORIZATION_ERROR
  // -------------------------------------------------------------------
  it("rejeita a criação de treino quando o treinador não tem vínculo ativo com o atleta", async () => {
    const { trainerActor } = await newTrainerWithAthlete("create-no-link-a");
    const { athleteActor: strangerAthlete } = await newTrainerWithAthlete("create-no-link-b");

    await expect(
      createWorkoutDraft(runningDraftInput(strangerAthlete.athleteProfileId), trainerActor),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
  });

  // -------------------------------------------------------------------
  // 4. Edição de rascunho — lockVersion correto substitui os blocos
  // -------------------------------------------------------------------
  it("atualiza um rascunho com lockVersion correto e substitui os blocos por completo", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("update-ok");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);

    const updated = await updateWorkoutDraft(
      workout.id,
      { ...strengthDraftInput(athleteActor.athleteProfileId), lockVersion: workout.lockVersion },
      trainerActor,
    );
    expect(updated.lockVersion).toBe(workout.lockVersion + 1);
    expect(updated.modality).toBe("STRENGTH");

    const blocks = await prisma.workoutBlock.findMany({ where: { workoutId: workout.id } });
    expect(blocks).toHaveLength(1);
    const remainingSteps = await prisma.workoutStep.findMany({ where: { block: { workoutId: workout.id } } });
    expect(remainingSteps).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // 5. Edição de rascunho — lockVersion desatualizado → CONFLICT
  // -------------------------------------------------------------------
  it("rejeita a edição com lockVersion desatualizado (otimista)", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("update-stale-lock");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);

    await expect(
      updateWorkoutDraft(
        workout.id,
        { ...runningDraftInput(athleteActor.athleteProfileId), lockVersion: workout.lockVersion + 5 },
        trainerActor,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  // -------------------------------------------------------------------
  // 6. Edição bloqueada fora de DRAFT
  // -------------------------------------------------------------------
  it("rejeita a edição de um treino que já não está em DRAFT", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("update-not-draft");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);

    await expect(
      updateWorkoutDraft(
        workout.id,
        { ...runningDraftInput(athleteActor.athleteProfileId), lockVersion: workout.lockVersion },
        trainerActor,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  // -------------------------------------------------------------------
  // 7. Isolamento multi-tenant — outro treinador não enxerga o treino
  // -------------------------------------------------------------------
  it("retorna NOT_FOUND ao tentar editar um treino de outra organização", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("update-cross-tenant-a");
    const { trainerActor: strangerTrainer } = await newTrainerWithAthlete("update-cross-tenant-b");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);

    await expect(
      updateWorkoutDraft(
        workout.id,
        { ...runningDraftInput(athleteActor.athleteProfileId), lockVersion: workout.lockVersion },
        strangerTrainer,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // -------------------------------------------------------------------
  // 8. Publicação — DRAFT com ao menos um bloco vira PUBLISHED
  // -------------------------------------------------------------------
  it("publica um treino DRAFT com blocos e registra PUBLISH_WORKOUT", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("publish-ok");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);

    const published = await publishWorkout(workout.id, trainerActor);
    expect(published.status).toBe("PUBLISHED");

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: "PUBLISH_WORKOUT", entityId: workout.id },
    });
    expect(auditLog.organizationId).toBe(trainerActor.organizationId);
  });

  // -------------------------------------------------------------------
  // 9. Publicação bloqueada sem conteúdo
  // -------------------------------------------------------------------
  it("rejeita a publicação de um treino sem nenhum bloco", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("publish-empty");
    const workout = await createWorkoutDraft(
      { ...runningDraftInput(athleteActor.athleteProfileId), blocks: [] },
      trainerActor,
    );

    await expect(publishWorkout(workout.id, trainerActor)).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
    });
  });

  // -------------------------------------------------------------------
  // 10. Publicação bloqueada fora de DRAFT
  // -------------------------------------------------------------------
  it("rejeita publicar novamente um treino que já foi publicado", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("publish-twice");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);

    await expect(publishWorkout(workout.id, trainerActor)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  // -------------------------------------------------------------------
  // 11. Visibilidade do atleta — DRAFT nunca aparece, PUBLISHED aparece
  // -------------------------------------------------------------------
  it("esconde treinos DRAFT do atleta e mostra assim que publicados", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("visibility");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);

    await expect(getAthleteWorkout(workout.id, athleteActor)).rejects.toMatchObject({ code: "NOT_FOUND" });
    let visible = await listAthleteWorkouts(athleteActor);
    expect(visible.map((w) => w.id)).not.toContain(workout.id);

    await publishWorkout(workout.id, trainerActor);
    const nowVisible = await getAthleteWorkout(workout.id, athleteActor);
    expect(nowVisible.status).toBe("PUBLISHED");
    visible = await listAthleteWorkouts(athleteActor);
    expect(visible.map((w) => w.id)).toContain(workout.id);
  });

  // -------------------------------------------------------------------
  // 12. Isolamento entre atletas — atleta B não acessa treino do atleta A
  // -------------------------------------------------------------------
  it("nega acesso a um treino de outro atleta", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("cross-athlete-a");
    const { athleteActor: otherAthlete } = await newTrainerWithAthlete("cross-athlete-b");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);

    await expect(getAthleteWorkout(workout.id, otherAthlete)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // -------------------------------------------------------------------
  // 13. Feedback COMPLETE — calcula sessionRpeLoad e move status para
  //     COMPLETED, sem dados sensíveis no AuditLog.
  // -------------------------------------------------------------------
  it("calcula sessionRpeLoad em um feedback completo e move o treino para COMPLETED", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("feedback-complete");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);

    const feedback = await submitWorkoutFeedback(
      workout.id,
      {
        completionStatus: "COMPLETED",
        actualDurationMinutes: 58,
        sessionRpe: 7,
        painLevel: 2,
        painRegion: "joelho esquerdo",
        notes: "senti um leve desconforto",
      },
      athleteActor,
    );
    expect(feedback.loadStatus).toBe("COMPLETE");
    expect(Number(feedback.sessionRpeLoad)).toBe(406);

    const reloaded = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } });
    expect(reloaded.status).toBe("COMPLETED");

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: "SUBMIT_WORKOUT_FEEDBACK", entityId: feedback.id },
    });
    const serialized = JSON.stringify(auditLog);
    expect(serialized).not.toContain("joelho esquerdo");
    expect(serialized).not.toContain("leve desconforto");
  });

  // -------------------------------------------------------------------
  // 14. Feedback duplicado é rejeitado — envio concorrente do mesmo
  //     feedback só permite um vencedor (WorkoutFeedback.workoutId é
  //     @unique; a corrida é decidida pela constraint do banco, traduzida
  //     para ConflictError em vez de vazar o erro cru do Prisma).
  // -------------------------------------------------------------------
  it("permite apenas um envio de feedback bem-sucedido quando dois chegam concorrentemente", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("feedback-duplicate");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);

    const attempts = await Promise.allSettled([
      submitWorkoutFeedback(workout.id, { completionStatus: "COMPLETED", actualDurationMinutes: 40, sessionRpe: 6 }, athleteActor),
      submitWorkoutFeedback(workout.id, { completionStatus: "PARTIAL", actualDurationMinutes: 20 }, athleteActor),
    ]);

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a) => a.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });

    const feedbackRows = await prisma.workoutFeedback.findMany({ where: { workoutId: workout.id } });
    expect(feedbackRows).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // 14b. Reenvio sequencial após o status já ter avançado é bloqueado
  //      pela regra "só PUBLISHED/IN_PROGRESS aceitam feedback" — o
  //      envio inicial já move o Workout para COMPLETED/PARTIAL/MISSED,
  //      então uma segunda tentativa sequencial nunca chega a ver a
  //      constraint de unicidade.
  // -------------------------------------------------------------------
  it("bloqueia um reenvio sequencial porque o status já saiu de PUBLISHED", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("feedback-resubmit-sequential");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);
    await submitWorkoutFeedback(workout.id, { completionStatus: "MISSED" }, athleteActor);

    await expect(
      submitWorkoutFeedback(workout.id, { completionStatus: "COMPLETED" }, athleteActor),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });
  });

  // -------------------------------------------------------------------
  // 16. Feedback bloqueado enquanto o treino ainda é DRAFT
  // -------------------------------------------------------------------
  it("rejeita feedback para um treino que ainda está em DRAFT", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("feedback-draft-blocked");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);

    await expect(
      submitWorkoutFeedback(workout.id, { completionStatus: "COMPLETED" }, athleteActor),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });
  });

  // -------------------------------------------------------------------
  // 17. Atualização de feedback — compare-and-swap por updatedAt
  // -------------------------------------------------------------------
  it("atualiza um feedback existente com knownUpdatedAt correto e rejeita quando desatualizado", async () => {
    const { trainerActor, athleteActor } = await newTrainerWithAthlete("feedback-update-lock");
    const workout = await createWorkoutDraft(runningDraftInput(athleteActor.athleteProfileId), trainerActor);
    await publishWorkout(workout.id, trainerActor);
    const original = await submitWorkoutFeedback(
      workout.id,
      { completionStatus: "PARTIAL", actualDurationMinutes: 20 },
      athleteActor,
    );

    await expect(
      updateWorkoutFeedback(
        workout.id,
        {
          completionStatus: "COMPLETED",
          actualDurationMinutes: 60,
          sessionRpe: 5,
          knownUpdatedAt: new Date(original.updatedAt.getTime() - 1000).toISOString(),
        },
        athleteActor,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const updated = await updateWorkoutFeedback(
      workout.id,
      {
        completionStatus: "COMPLETED",
        actualDurationMinutes: 60,
        sessionRpe: 5,
        knownUpdatedAt: original.updatedAt.toISOString(),
      },
      athleteActor,
    );
    expect(updated.loadStatus).toBe("COMPLETE");
    expect(Number(updated.sessionRpeLoad)).toBe(300);
  });

  // -------------------------------------------------------------------
  // Limpeza — mesma ordem FK-segura da Fase 02B: AuditLog primeiro,
  // depois Organization. NOTE: Workout is deleted explicitly *before*
  // Organization rather than relying on Organization's cascade — Exercise
  // also cascades directly from Organization, and WorkoutExercise.exercise
  // is onDelete: Restrict. A single Organization delete fires both cascade
  // paths (Organization→Workout→...→WorkoutExercise and Organization→
  // Exercise) without a guaranteed order between them, so Postgres can hit
  // the Restrict constraint before the Workout-side cascade has removed
  // the referencing WorkoutExercise row. Deleting Workout up front removes
  // that race entirely.
  // -------------------------------------------------------------------
  afterAll(async () => {
    if (createdUserIds.length > 0 || createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: createdUserIds } }, { organizationId: { in: createdOrganizationIds } }],
        },
      });
    }
    if (createdOrganizationIds.length > 0) {
      await prisma.workout.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
    }
    if (createdOrganizationIds.length > 0) {
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
