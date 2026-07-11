import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  archiveExercise,
  createExercise,
  listExercises,
  reactivateExercise,
  updateExercise,
  type ExerciseActor,
} from "@/modules/exercises/exercise-service";
import { uniqueEmail } from "./helpers";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdGlobalExerciseIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

async function newTrainerActor(prefix: string): Promise<ExerciseActor> {
  const trainer = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(trainer.userId);
  createdOrganizationIds.push(trainer.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: trainer.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);
  return { userId: trainer.userId, organizationId: trainer.organizationId };
}

describe("Fase 02D.2 — biblioteca de exercícios", () => {
  it("cria um exercício da organização e rejeita nome duplicado na mesma org", async () => {
    const actor = await newTrainerActor("ex-create");
    const created = await createExercise(
      {
        name: "Agachamento Búlgaro",
        category: "membros inferiores",
        targetMuscles: ["quadríceps", "glúteos"],
      },
      actor,
    );
    expect(created.organizationId).toBe(actor.organizationId);

    await expect(
      createExercise({ name: "Agachamento Búlgaro", category: "outra", targetMuscles: [] }, actor),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lista exercícios da própria org e globais, mas nunca de outra org", async () => {
    const actorA = await newTrainerActor("ex-iso-a");
    const actorB = await newTrainerActor("ex-iso-b");
    const globalEx = await prisma.exercise.create({
      data: {
        organizationId: null,
        name: `Global Supino ${Date.now()}`,
        category: "peito",
        targetMuscles: [],
      },
    });
    createdGlobalExerciseIds.push(globalEx.id);

    const exA = await createExercise(
      { name: "Exercício A", category: "cat", targetMuscles: [] },
      actorA,
    );

    const listForB = await listExercises({ organizationId: actorB.organizationId });
    expect(listForB.find((e) => e.id === exA.id)).toBeUndefined(); // other org's exercise hidden
    const globalInB = listForB.find((e) => e.id === globalEx.id);
    expect(globalInB?.isGlobal).toBe(true);
    expect(globalInB?.editable).toBe(false);
  });

  it("permite editar exercício próprio, bloqueia global e esconde o de outra org", async () => {
    const actorA = await newTrainerActor("ex-edit-a");
    const actorB = await newTrainerActor("ex-edit-b");
    const own = await createExercise(
      { name: "Próprio", category: "cat", targetMuscles: [] },
      actorA,
    );
    const globalEx = await prisma.exercise.create({
      data: {
        organizationId: null,
        name: `Global Edit ${Date.now()}`,
        category: "cat",
        targetMuscles: [],
      },
    });
    createdGlobalExerciseIds.push(globalEx.id);

    const updated = await updateExercise(
      own.id,
      { name: "Próprio Renomeado", category: "nova", targetMuscles: ["x"] },
      actorA,
    );
    expect(updated.name).toBe("Próprio Renomeado");

    await expect(
      updateExercise(globalEx.id, { name: "hack", category: "c", targetMuscles: [] }, actorA),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });

    await expect(
      updateExercise(own.id, { name: "cross", category: "c", targetMuscles: [] }, actorB),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("arquiva e reativa um exercício próprio (soft delete), controlando a visibilidade padrão", async () => {
    const actor = await newTrainerActor("ex-archive");
    const ex = await createExercise(
      { name: "Arquivável", category: "cat", targetMuscles: [] },
      actor,
    );

    await archiveExercise(ex.id, actor);
    const activeOnly = await listExercises({ organizationId: actor.organizationId });
    expect(activeOnly.find((e) => e.id === ex.id)).toBeUndefined();
    const withInactive = await listExercises(
      { organizationId: actor.organizationId },
      { includeInactive: true },
    );
    expect(withInactive.find((e) => e.id === ex.id)?.isActive).toBe(false);

    await reactivateExercise(ex.id, actor);
    const reactivated = await listExercises({ organizationId: actor.organizationId });
    expect(reactivated.find((e) => e.id === ex.id)?.isActive).toBe(true);
  });

  afterAll(async () => {
    if (createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await prisma.exercise.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    }
    if (createdGlobalExerciseIds.length > 0) {
      await prisma.exercise.deleteMany({ where: { id: { in: createdGlobalExerciseIds } } });
    }
    if (createdTrainerProfileIds.length > 0) {
      await prisma.trainerProfile.deleteMany({ where: { id: { in: createdTrainerProfileIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
});
