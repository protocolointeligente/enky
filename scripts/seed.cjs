/* eslint-disable */
// Idempotent demo seed for dev/test/preview. NEVER runs in production.
//
//   npm run seed:dev      # NODE_ENV=development, marker "dev"
//   npm run seed:test     # NODE_ENV=test, marker "test"
//   node scripts/seed.cjs preview   # marker "preview" (only for an isolated Preview DB)
//
// Idempotent: re-running converges to the same demo state (upserts on unique
// keys; the demo org's workouts are rebuilt each run). It only ever touches the
// single demo organization it owns — no global deletes, no real data.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function guardProduction() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Seed BLOQUEADO: nunca execute seed em produção.");
  }
}

const MODE = process.argv[2] || "dev";
if (!["dev", "test", "preview"].includes(MODE)) {
  throw new Error(`Modo inválido: ${MODE}. Use dev | test | preview.`);
}

const DEMO = {
  orgSlug: `demo-${MODE}`,
  orgName: `Organização Demo (${MODE})`,
  trainerEmail: `treinador.demo.${MODE}@enky.local`,
  trainerName: "Treinador Demo",
  athleteEmail: `atleta.demo.${MODE}@enky.local`,
  athleteName: "Atleta Demo",
  password: "EnkyDemo2026",
};

async function firstOrCreate(model, where, create) {
  const existing = await model.findFirst({ where });
  return existing ?? model.create({ data: create });
}

async function main() {
  guardProduction();
  const passwordHash = await bcrypt.hash(DEMO.password, 12);

  const org = await prisma.organization.upsert({
    where: { slug: DEMO.orgSlug },
    update: { name: DEMO.orgName },
    create: { name: DEMO.orgName, slug: DEMO.orgSlug },
  });

  const trainerUser = await prisma.user.upsert({
    where: { email: DEMO.trainerEmail },
    update: { name: DEMO.trainerName, passwordHash, globalRole: "TRAINER" },
    create: {
      email: DEMO.trainerEmail,
      name: DEMO.trainerName,
      passwordHash,
      globalRole: "TRAINER",
    },
  });
  const trainerProfile = await firstOrCreate(
    prisma.trainerProfile,
    { userId: trainerUser.id },
    { userId: trainerUser.id },
  );
  await firstOrCreate(
    prisma.organizationMembership,
    { userId: trainerUser.id, organizationId: org.id },
    { userId: trainerUser.id, organizationId: org.id, role: "OWNER" },
  );

  const athleteUser = await prisma.user.upsert({
    where: { email: DEMO.athleteEmail },
    update: { name: DEMO.athleteName, passwordHash, globalRole: "ATHLETE" },
    create: {
      email: DEMO.athleteEmail,
      name: DEMO.athleteName,
      passwordHash,
      globalRole: "ATHLETE",
    },
  });
  const athleteProfile = await firstOrCreate(
    prisma.athleteProfile,
    { userId: athleteUser.id },
    { userId: athleteUser.id },
  );
  await firstOrCreate(
    prisma.coachAthleteRelationship,
    { organizationId: org.id, trainerId: trainerProfile.id, athleteId: athleteProfile.id },
    {
      organizationId: org.id,
      trainerId: trainerProfile.id,
      athleteId: athleteProfile.id,
      isActive: true,
    },
  );

  // Exercises (org-scoped), idempotent on the @@unique([name, organizationId]).
  const exerciseNames = [
    {
      name: "Agachamento Livre",
      category: "membros inferiores",
      targetMuscles: ["quadríceps", "glúteos"],
    },
    { name: "Supino Reto", category: "peito", targetMuscles: ["peitoral", "tríceps"] },
    { name: "Remada Curvada", category: "costas", targetMuscles: ["dorsal", "bíceps"] },
  ];
  for (const ex of exerciseNames) {
    await prisma.exercise.upsert({
      where: { name_organizationId: { name: ex.name, organizationId: org.id } },
      update: { category: ex.category, targetMuscles: ex.targetMuscles },
      create: {
        organizationId: org.id,
        name: ex.name,
        category: ex.category,
        targetMuscles: ex.targetMuscles,
      },
    });
  }

  // Template (idempotent by title within the org).
  const templateContent = {
    blocks: [
      {
        repetitions: 1,
        steps: [],
        exercises: [
          {
            exerciseName: "Agachamento Livre",
            exerciseCategory: "membros inferiores",
            sets: 4,
            reps: 8,
            loadKg: 80,
          },
          { exerciseName: "Supino Reto", exerciseCategory: "peito", sets: 4, reps: 10, loadKg: 60 },
        ],
      },
    ],
    tags: ["força", "demo"],
    level: "intermediário",
  };
  const existingTemplate = await prisma.workoutTemplate.findFirst({
    where: { organizationId: org.id, title: "Força — corpo inteiro (demo)" },
  });
  if (existingTemplate) {
    await prisma.workoutTemplate.update({
      where: { id: existingTemplate.id },
      data: { contentSnapshot: templateContent },
    });
  } else {
    await prisma.workoutTemplate.create({
      data: {
        organizationId: org.id,
        trainerId: trainerProfile.id,
        title: "Força — corpo inteiro (demo)",
        description: "Template de demonstração.",
        modality: "STRENGTH",
        contentSnapshot: templateContent,
      },
    });
  }

  // Workouts in several statuses. Rebuild the demo org's workouts each run so
  // the state is deterministic (scoped to this demo org only — never global).
  await prisma.workout.deleteMany({ where: { organizationId: org.id } });

  const baseDate = "2026-08-10";
  const runningStep = {
    workoutBlockId: "",
    sequence: 1,
    stepType: "RODAGEM",
    durationSeconds: 3000,
    distanceMeters: 8000,
  };

  async function createRunning(title, plannedDate, status) {
    const workout = await prisma.workout.create({
      data: {
        organizationId: org.id,
        athleteId: athleteProfile.id,
        trainerId: trainerProfile.id,
        title,
        modality: "RUNNING",
        status,
        source: "MANUAL",
        plannedDate: new Date(`${plannedDate}T00:00:00.000Z`),
      },
    });
    const block = await prisma.workoutBlock.create({
      data: { workoutId: workout.id, sequence: 1, repetitions: 1 },
    });
    await prisma.workoutStep.create({ data: { ...runningStep, workoutBlockId: block.id } });
    return workout;
  }

  await createRunning("Rodagem leve (rascunho)", baseDate, "DRAFT");
  await createRunning("Rodagem publicada", "2026-08-12", "PUBLISHED");

  const completed = await createRunning("Rodagem concluída", "2026-08-05", "COMPLETED");
  await prisma.workoutFeedback.create({
    data: {
      workoutId: completed.id,
      actualDurationMinutes: 48,
      sessionRpe: 6,
      sessionRpeLoad: 288,
      loadStatus: "COMPLETE",
      completionSource: "ATHLETE_REPORTED",
      fatigueLevel: 4,
      recoveryLevel: 7,
      painLevel: 0,
    },
  });

  const missed = await createRunning("Rodagem perdida", "2026-08-03", "MISSED");
  await prisma.workoutFeedback.create({
    data: {
      workoutId: missed.id,
      loadStatus: "NOT_AVAILABLE",
      completionSource: "ATHLETE_REPORTED",
      painLevel: 0,
    },
  });

  console.log("Seed concluído (modo:", MODE + "):");
  console.log("  organização :", org.slug);
  console.log("  treinador   :", DEMO.trainerEmail, "/", DEMO.password);
  console.log("  atleta      :", DEMO.athleteEmail, "/", DEMO.password);
  console.log("  exercícios  : 3 | template: 1 | treinos: 4 (DRAFT/PUBLISHED/COMPLETED/MISSED)");
}

main()
  .catch((error) => {
    console.error("Seed FALHOU:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
