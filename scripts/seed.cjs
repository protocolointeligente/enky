/* eslint-disable */
// Idempotent demo seed for dev/test/preview. NEVER runs in production.
//
//   npm run seed:dev      # NODE_ENV=development, marker "dev"
//   npm run seed:test     # NODE_ENV=test, marker "test"
//   node scripts/seed.cjs preview   # marker "preview" (only for an isolated Preview DB)
//
// Idempotent: re-running converges to the same demo state (upserts on unique
// keys; the demo org's workouts are rebuilt each run). Touches ONLY the single
// demo organization it owns — no global deletes, no real data.
//
// Builds a small demo roster with RELATIVE-date histories so the ENKY
// Intelligence "Precisam de atenção" panel is populated with varied insights:
//   Ana   → salto de carga aguda (ACWR)  → "revisar"  + login p/ o painel do atleta
//   Bruno → dor recente relatada         → "urgente"
//   Carla → sequência de treinos perdidos→ "revisar"
//   Diego → carga estável, saudável      → SEM alerta (caso de não-falso-alarme)
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
  athleteEmail: `atleta.demo.${MODE}@enky.local`, // Ana — login do atleta
  password: "EnkyDemo2026",
};

async function firstOrCreate(model, where, create) {
  const existing = await model.findFirst({ where });
  return existing ?? model.create({ data: create });
}

// Data em UTC midnight = hoje + deltaDays (negativo = passado, positivo = futuro).
function at(deltaDays) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d;
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
  let strengthExercise = null;
  for (const ex of exerciseNames) {
    const row = await prisma.exercise.upsert({
      where: { name_organizationId: { name: ex.name, organizationId: org.id } },
      update: { category: ex.category, targetMuscles: ex.targetMuscles },
      create: {
        organizationId: org.id,
        name: ex.name,
        category: ex.category,
        targetMuscles: ex.targetMuscles,
      },
    });
    if (ex.name === "Agachamento Livre") strengthExercise = row;
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

  // Rebuild the demo org's workouts each run (scoped to this org only).
  await prisma.workout.deleteMany({ where: { organizationId: org.id } });

  async function createAthlete(email, name) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, globalRole: "ATHLETE" },
      create: { email, name, passwordHash, globalRole: "ATHLETE" },
    });
    const profile = await firstOrCreate(
      prisma.athleteProfile,
      { userId: user.id },
      { userId: user.id },
    );
    await firstOrCreate(
      prisma.coachAthleteRelationship,
      { organizationId: org.id, trainerId: trainerProfile.id, athleteId: profile.id },
      {
        organizationId: org.id,
        trainerId: trainerProfile.id,
        athleteId: profile.id,
        isActive: true,
      },
    );
    return profile;
  }

  // Cria um treino (com bloco + passo/exercício) e, opcionalmente, feedback.
  async function session(athlete, delta, opts) {
    const modality = opts.modality || "RUNNING";
    const day = at(delta);
    const durationMin = opts.durationMin || 50;
    const startAt =
      opts.startHour != null ? new Date(day.getTime() + opts.startHour * 3600000) : null;
    const workout = await prisma.workout.create({
      data: {
        organizationId: org.id,
        athleteId: athlete.id,
        trainerId: trainerProfile.id,
        title: opts.title,
        modality,
        status: opts.status,
        source: "MANUAL",
        plannedDate: day,
        plannedStartAt: startAt,
        plannedEndAt: startAt ? new Date(startAt.getTime() + durationMin * 60000) : null,
      },
    });
    const block = await prisma.workoutBlock.create({
      data: { workoutId: workout.id, sequence: 1, repetitions: 1, name: "Principal" },
    });
    if ((modality === "STRENGTH" || modality === "FUNCTIONAL") && strengthExercise) {
      await prisma.workoutExercise.create({
        data: {
          workoutBlockId: block.id,
          exerciseId: strengthExercise.id,
          sequence: 1,
          sets: 4,
          reps: 8,
          loadKg: 60,
          restSeconds: 90,
        },
      });
    } else {
      await prisma.workoutStep.create({
        data: {
          workoutBlockId: block.id,
          sequence: 1,
          stepType: "RODAGEM",
          durationSeconds: durationMin * 60,
          distanceMeters: opts.distanceM || 8000,
        },
      });
    }
    if (opts.feedback) {
      const rpe = opts.rpe || 6;
      await prisma.workoutFeedback.create({
        data: {
          workoutId: workout.id,
          actualDurationMinutes: durationMin,
          sessionRpe: rpe,
          sessionRpeLoad: rpe * durationMin,
          loadStatus: "COMPLETE",
          completionSource: "ATHLETE_REPORTED",
          fatigueLevel: opts.fatigue ?? 4,
          recoveryLevel: opts.recovery ?? 7,
          painLevel: opts.pain ?? 0,
          painRegion: opts.painRegion ?? null,
        },
      });
    }
    return workout;
  }

  // ── Ana — carga aguda elevada (ACWR) + login do atleta ──────────────────
  const ana = await createAthlete(DEMO.athleteEmail, "Ana Corredora");
  for (let d = 84; d >= 14; d--) {
    if (d % 7 < 5) {
      await session(ana, -d, {
        title: "Rodagem base",
        status: "COMPLETED",
        rpe: 6,
        durationMin: 50,
        distanceM: 8000,
        feedback: true,
      });
    }
  }
  for (const d of [10, 9, 8, 6, 5, 3, 2, 1]) {
    // bloco recente pesado → carga aguda >> crônica
    await session(ana, -d, {
      title: "Bloco forte",
      status: "COMPLETED",
      rpe: 8,
      durationMin: 72,
      distanceM: 12000,
      feedback: true,
      fatigue: 7,
      recovery: 4,
    });
  }
  await session(ana, 0, {
    title: "Rodagem de hoje",
    status: "PUBLISHED",
    durationMin: 45,
    distanceM: 8000,
    startHour: 7,
  });
  await session(ana, 1, {
    title: "Intervalado 6×800",
    status: "PUBLISHED",
    durationMin: 60,
    distanceM: 10000,
    startHour: 6,
  });
  await session(ana, 3, {
    title: "Longão 16 km",
    status: "PUBLISHED",
    durationMin: 90,
    distanceM: 16000,
    startHour: 7,
  });
  await session(ana, 2, {
    title: "Rodagem leve (rascunho)",
    status: "DRAFT",
    durationMin: 40,
    distanceM: 6000,
  });

  // ── Bruno — dor recente → urgente ───────────────────────────────────────
  const bruno = await createAthlete(`bruno.demo.${MODE}@enky.local`, "Bruno Ciclista");
  for (let d = 60; d >= 8; d--) {
    if (d % 7 < 4) {
      await session(bruno, -d, {
        title: "Pedal Z2",
        modality: "CYCLING",
        status: "COMPLETED",
        rpe: 6,
        durationMin: 60,
        distanceM: 30000,
        feedback: true,
      });
    }
  }
  await session(bruno, -2, {
    title: "Pedal com desconforto",
    modality: "CYCLING",
    status: "COMPLETED",
    rpe: 7,
    durationMin: 55,
    distanceM: 28000,
    feedback: true,
    pain: 5,
    painRegion: "joelho direito",
    recovery: 4,
  });
  await session(bruno, 0, {
    title: "Recuperativo",
    modality: "CYCLING",
    status: "PUBLISHED",
    durationMin: 40,
    startHour: 18,
  });

  // ── Carla — sequência de treinos perdidos → revisar ─────────────────────
  const carla = await createAthlete(`carla.demo.${MODE}@enky.local`, "Carla Nadadora");
  for (let d = 45; d >= 10; d--) {
    if (d % 7 < 3) {
      await session(carla, -d, {
        title: "Natação técnica",
        modality: "SWIMMING",
        status: "COMPLETED",
        rpe: 5,
        durationMin: 45,
        distanceM: 2000,
        feedback: true,
      });
    }
  }
  for (const d of [2, 4, 6]) {
    await session(carla, -d, {
      title: "Natação (perdida)",
      modality: "SWIMMING",
      status: "MISSED",
      durationMin: 45,
    });
  }
  await session(carla, 1, {
    title: "Série de velocidade",
    modality: "SWIMMING",
    status: "PUBLISHED",
    durationMin: 50,
    startHour: 7,
  });

  // ── Diego — estável e saudável → SEM alerta ─────────────────────────────
  const diego = await createAthlete(`diego.demo.${MODE}@enky.local`, "Diego Forte");
  for (let d = 50; d >= 2; d--) {
    if (d % 7 < 4) {
      await session(diego, -d, {
        title: "Força corpo inteiro",
        modality: "STRENGTH",
        status: "COMPLETED",
        rpe: 6,
        durationMin: 55,
        feedback: true,
      });
    }
  }
  await session(diego, 0, {
    title: "Superiores",
    modality: "STRENGTH",
    status: "PUBLISHED",
    durationMin: 50,
    startHour: 19,
  });

  console.log("Seed concluído (modo:", MODE + "):");
  console.log("  organização :", org.slug);
  console.log("  treinador   :", DEMO.trainerEmail, "/", DEMO.password);
  console.log(
    "  atleta (login do painel):",
    DEMO.athleteEmail,
    "/",
    DEMO.password,
    "(Ana Corredora)",
  );
  console.log("  carteira    : Ana (carga/ACWR), Bruno (dor), Carla (perdidos), Diego (saudável)");
  console.log("  → dashboard do treinador deve mostrar 3 InsightCards em 'Precisam de atenção'.");
}

main()
  .catch((error) => {
    console.error("Seed FALHOU:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
