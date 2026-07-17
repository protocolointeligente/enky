import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { createWorkoutDraft } from "@/modules/workouts/create-workout-draft";
import { updateWorkoutDraft } from "@/modules/workouts/update-workout-draft";
import { getAthleteWorkout } from "@/modules/workouts/get-athlete-workout";
import { publishWorkout } from "@/modules/workouts/publish-workout";
import {
  applyTemplate,
  createTemplate,
  duplicateTemplate,
  getTemplate,
  saveWorkoutAsTemplate,
  updateTemplate,
  type TemplateActor,
} from "@/modules/templates/template-service";
import { uniqueEmail } from "./helpers";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

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

  const actor: TemplateActor = {
    userId: trainer.userId,
    trainerProfileId: trainerProfile.id,
    organizationId: trainer.organizationId,
  };
  return { actor, athleteProfileId: invitation.athleteProfileId };
}

function strengthContent(exerciseName: string) {
  return {
    blocks: [
      {
        repetitions: 1,
        steps: [],
        exercises: [
          { exerciseName, exerciseCategory: "membros inferiores", sets: 4, reps: 8, loadKg: 80 },
        ],
      },
    ],
    tags: ["força"],
  };
}

describe("Fase 02D.2 — templates de treino", () => {
  it("cria e aplica um template criando um Workout DRAFT/TEMPLATE com o conteúdo copiado", async () => {
    const { actor, athleteProfileId } = await newTrainerWithAthlete("tpl-apply");
    const template = await createTemplate(
      { title: "Força A", modality: "STRENGTH", content: strengthContent("Agachamento") },
      actor,
    );

    const workout = await applyTemplate(
      template.id,
      { athleteId: athleteProfileId, plannedDate: "2026-08-15" },
      actor,
    );
    expect(workout.status).toBe("DRAFT");
    expect(workout.source).toBe("TEMPLATE");
    expect(workout.workoutTemplateId).toBe(template.id);

    const blocks = await prisma.workoutBlock.findMany({
      where: { workoutId: workout.id },
      include: { exercises: { include: { exercise: true } } },
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.exercises[0]?.exercise.name).toBe("Agachamento");
  });

  it("mantém o template imutável: editar o treino aplicado não altera o template e vice-versa", async () => {
    const { actor, athleteProfileId } = await newTrainerWithAthlete("tpl-immutable");
    const template = await createTemplate(
      { title: "Base", modality: "STRENGTH", content: strengthContent("Supino") },
      actor,
    );
    const workout = await applyTemplate(
      template.id,
      { athleteId: athleteProfileId, plannedDate: "2026-08-16" },
      actor,
    );

    // Edit the applied workout — a completely different prescription.
    const fresh = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } });
    await updateWorkoutDraft(
      workout.id,
      {
        athleteId: athleteProfileId,
        title: "Editado",
        modality: "STRENGTH",
        plannedDate: "2026-08-16",
        timezone: "America/Sao_Paulo",
        lockVersion: fresh.lockVersion,
        blocks: [
          {
            repetitions: 2,
            steps: [],
            exercises: [
              { exerciseName: "Levantamento Terra", exerciseCategory: "costas", sets: 5, reps: 5 },
            ],
          },
        ],
      },
      actor,
    );

    // Template still holds its original single "Supino" exercise.
    const afterWorkoutEdit = await getTemplate(template.id, actor);
    expect(afterWorkoutEdit.content.blocks).toHaveLength(1);
    expect(afterWorkoutEdit.content.blocks[0]?.exercises[0]?.exerciseName).toBe("Supino");

    // Now edit the template — the already-applied workout must not change.
    await updateTemplate(
      template.id,
      { title: "Base v2", modality: "STRENGTH", content: strengthContent("Remada") },
      actor,
    );
    const workoutBlocks = await prisma.workoutBlock.findMany({
      where: { workoutId: workout.id },
      include: { exercises: { include: { exercise: true } } },
    });
    expect(workoutBlocks[0]?.exercises[0]?.exercise.name).toBe("Levantamento Terra");
  });

  // Critério de aceite da Fase 5, ponta a ponta: treinador cria template →
  // aplica no atleta/data → publica → o ATLETA vê o treino clonado; editar o
  // template depois NÃO muda o que o atleta já recebeu.
  it("atleta recebe o treino clonado ao publicar, e editar o template depois não o altera", async () => {
    const { actor, athleteProfileId } = await newTrainerWithAthlete("tpl-athlete");
    const template = await createTemplate(
      { title: "Full Body", modality: "STRENGTH", content: strengthContent("Agachamento Frontal") },
      actor,
    );
    const workout = await applyTemplate(
      template.id,
      { athleteId: athleteProfileId, plannedDate: "2026-08-20" },
      actor,
    );

    const athleteScope = {
      organizationId: actor.organizationId,
      athleteProfileId,
    };

    // Enquanto DRAFT, o atleta não enxerga nada.
    await expect(getAthleteWorkout(workout.id, athleteScope)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await publishWorkout(workout.id, actor);

    const received = await getAthleteWorkout(workout.id, athleteScope);
    expect(received.source).toBe("TEMPLATE");
    expect(received.title).toBe("Full Body");
    expect(received.blocks[0]?.exercises[0]?.exercise.name).toBe("Agachamento Frontal");

    // O treinador reescreve o template inteiro depois da entrega.
    await updateTemplate(
      template.id,
      { title: "Full Body v2", modality: "STRENGTH", content: strengthContent("Stiff") },
      actor,
    );

    const afterTemplateEdit = await getAthleteWorkout(workout.id, athleteScope);
    expect(afterTemplateEdit.title).toBe("Full Body");
    expect(afterTemplateEdit.blocks[0]?.exercises[0]?.exercise.name).toBe("Agachamento Frontal");
  });

  it("bloqueia aplicar template para atleta de outra organização", async () => {
    const { actor } = await newTrainerWithAthlete("tpl-cross-a");
    const { athleteProfileId: otherOrgAthlete } = await newTrainerWithAthlete("tpl-cross-b");
    const template = await createTemplate(
      { title: "X", modality: "STRENGTH", content: strengthContent("Agachamento") },
      actor,
    );

    await expect(
      applyTemplate(template.id, { athleteId: otherOrgAthlete, plannedDate: "2026-08-17" }, actor),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
  });

  it("salva um treino existente como template sem alterar o treino, e duplica o template", async () => {
    const { actor, athleteProfileId } = await newTrainerWithAthlete("tpl-save");
    const workout = await createWorkoutDraft(
      {
        athleteId: athleteProfileId,
        title: "Treino base",
        modality: "STRENGTH",
        plannedDate: "2026-08-18",
        timezone: "America/Sao_Paulo",
        blocks: [
          {
            repetitions: 1,
            steps: [],
            exercises: [
              { exerciseName: "Leg Press", exerciseCategory: "pernas", sets: 3, reps: 12 },
            ],
          },
        ],
      },
      actor,
    );

    const template = await saveWorkoutAsTemplate(
      workout.id,
      { title: "Template do treino", tags: [] },
      actor,
    );
    const detail = await getTemplate(template.id, actor);
    expect(detail.content.blocks[0]?.exercises[0]?.exerciseName).toBe("Leg Press");
    expect(detail.modality).toBe("STRENGTH");

    const copy = await duplicateTemplate(template.id, actor);
    expect(copy.id).not.toBe(template.id);
    expect(copy.title).toContain("cópia");
  });

  it("retorna NOT_FOUND ao acessar template de outra organização", async () => {
    const { actor } = await newTrainerWithAthlete("tpl-iso-a");
    const { actor: strangerActor } = await newTrainerWithAthlete("tpl-iso-b");
    const template = await createTemplate(
      { title: "Privado", modality: "STRENGTH", content: strengthContent("Agachamento") },
      actor,
    );

    await expect(getTemplate(template.id, strangerActor)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  afterAll(async () => {
    if (createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await prisma.workout.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await prisma.workoutTemplate.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await prisma.exercise.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
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
