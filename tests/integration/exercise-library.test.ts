import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { createExerciseInputSchema } from "@/modules/exercises/exercise-schema";
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

  // Fase 5 — o índice parcial uq_organization_exercise_name é sobre
  // LOWER("name"), e o schema colapsa espaços: as duas variantes colidem.
  it("rejeita duplicata por variação de caixa e de espaço", async () => {
    const actor = await newTrainerActor("ex-dedup");
    await createExercise(
      { name: "Supino Reto", category: "peito", targetMuscles: [] },
      actor,
    );

    await expect(
      createExercise(
        { name: createExerciseInputSchema.parse({ name: "supino reto", category: "peito" }).name,
          category: "peito",
          targetMuscles: [] },
        actor,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // "Supino  Reto" (espaço duplo) normaliza para "Supino Reto" → mesma colisão.
    const spaced = createExerciseInputSchema.parse({ name: "Supino  Reto", category: "peito" });
    await expect(
      createExercise({ ...spaced, targetMuscles: [] }, actor),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("filtra por modalidade, grupo muscular, equipamento, nível e presença de vídeo", async () => {
    const actor = await newTrainerActor("ex-filters");
    const withVideo = await createExercise(
      {
        name: "Agachamento Livre",
        category: "membros inferiores",
        targetMuscles: ["quadríceps"],
        modality: "STRENGTH",
        equipment: "barra",
        level: "intermediário",
        videoUrl: "https://exemplo.com/agachamento.mp4",
        videoSource: "gravação própria",
        videoLicense: "material próprio",
      },
      actor,
    );
    const noVideo = await createExercise(
      {
        name: "Corrida Contínua",
        category: "aeróbio",
        targetMuscles: ["panturrilha"],
        modality: "RUNNING",
        equipment: "nenhum",
        level: "iniciante",
      },
      actor,
    );

    const scope = { organizationId: actor.organizationId };
    const idsOf = (list: { id: string }[]) => list.map((e) => e.id);

    expect(idsOf(await listExercises(scope, { modality: "STRENGTH" }))).toContain(withVideo.id);
    expect(idsOf(await listExercises(scope, { modality: "STRENGTH" }))).not.toContain(noVideo.id);

    expect(idsOf(await listExercises(scope, { muscleGroup: "quadríceps" }))).toEqual([
      withVideo.id,
    ]);
    expect(idsOf(await listExercises(scope, { equipment: "BARRA" }))).toEqual([withVideo.id]); // insensitive
    expect(idsOf(await listExercises(scope, { level: "iniciante" }))).toEqual([noVideo.id]);

    expect(idsOf(await listExercises(scope, { hasVideo: true }))).toContain(withVideo.id);
    expect(idsOf(await listExercises(scope, { hasVideo: true }))).not.toContain(noVideo.id);
    expect(idsOf(await listExercises(scope, { hasVideo: false }))).toContain(noVideo.id);

    // Rastreabilidade de vídeo sobrevive à ida-e-volta.
    const listed = (await listExercises(scope)).find((e) => e.id === withVideo.id);
    expect(listed?.videoSource).toBe("gravação própria");
    expect(listed?.videoLicense).toBe("material próprio");
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
