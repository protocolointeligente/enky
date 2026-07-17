import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { generateWeekDrafts } from "@/modules/periodization/generate-week";
import { createPeriodization } from "@/modules/periodization/periodization-service";
import { getAthleteWorkout, listAthleteWorkouts } from "@/modules/workouts/get-athlete-workout";
import { publishWorkout } from "@/modules/workouts/publish-workout";
import { updateWorkoutDraft } from "@/modules/workouts/update-workout-draft";
import { uniqueEmail } from "./helpers";

// Fase 6 — critério de aceite ponta a ponta: o treinador cria uma periodização,
// o sistema gera as sessões da semana em RASCUNHO, o treinador edita e publica,
// e só então o atleta enxerga. Cobre também o isolamento por organização.

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

async function newTrainer(prefix: string) {
  const result = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(result.userId);
  createdOrganizationIds.push(result.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: result.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);
  return {
    userId: result.userId,
    organizationId: result.organizationId,
    trainerProfileId: trainerProfile.id,
  };
}

async function newActiveAthlete(trainer: {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
}) {
  const invitation = await inviteAthlete({ email: uniqueEmail("gen-athlete") }, trainer);
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: "Atleta Geração",
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);
  return invitation.athleteProfileId;
}

// Semana 1 = 2026-03-02 (segunda) a 2026-03-08 (domingo).
const PLAN = {
  title: "Maratona de Berlim",
  goal: "Sub 3h30 na maratona",
  startDate: "2026-03-02",
  endDate: "2026-03-29",
  phases: [
    {
      name: "Base aeróbica",
      startDate: "2026-03-02",
      endDate: "2026-03-29",
      targetVolumeKm: 45,
      targetIntensity: "Predominância aeróbica",
    },
  ],
};

async function setupPlan(prefix: string) {
  const trainer = await newTrainer(prefix);
  const athleteId = await newActiveAthlete(trainer);
  const periodization = await createPeriodization(athleteId, PLAN, trainer);
  const week = await prisma.trainingWeek.findFirstOrThrow({
    where: { periodizationId: periodization.id, sequence: 1 },
  });
  return { trainer, athleteId, periodization, week };
}

const REQUEST = {
  modality: "RUNNING" as const,
  level: "INTERMEDIATE" as const,
  availableWeekdays: [2, 4, 6],
  includeStrength: false,
  replaceExisting: false,
};

describe("Fase 6 — geração assistida por semana", () => {
  it("gera rascunhos que o treinador edita e publica, e só então o atleta vê", async () => {
    const { trainer, athleteId, periodization, week } = await setupPlan("gen-flow");

    const result = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      REQUEST,
      trainer,
    );

    expect(result.workouts).toHaveLength(3);
    expect(result.confidence).toBe("HIGH");

    // 1) Tudo nasce DRAFT. Nada de auto-publicação.
    const drafts = await prisma.workout.findMany({
      where: { id: { in: result.workouts.map((w) => w.id) } },
      include: { blocks: { include: { steps: true } } },
      orderBy: { plannedDate: "asc" },
    });
    expect(drafts.every((w) => w.status === "DRAFT")).toBe(true);
    expect(drafts.every((w) => w.source === "PERIODIZATION_GENERATED")).toBe(true);
    expect(drafts.every((w) => w.generationMode === "ASSISTED")).toBe(true);
    expect(drafts.every((w) => w.confidenceLevel === "HIGH")).toBe(true);

    // 2) Vínculo com a estrutura do plano e conteúdo real prescrito.
    expect(drafts.every((w) => w.periodizationId === periodization.id)).toBe(true);
    expect(drafts.every((w) => w.trainingWeekId === week.id)).toBe(true);
    expect(drafts.every((w) => w.periodizationPhaseId === week.phaseId)).toBe(true);
    expect(drafts.every((w) => w.blocks.length > 0)).toBe(true);
    expect(drafts.every((w) => w.blocks.some((b) => b.steps.length > 0))).toBe(true);

    // 3) Datas caem nos dias pedidos (ter/qui/sáb da semana 1).
    expect(drafts.map((w) => w.plannedDate.toISOString().slice(0, 10))).toEqual([
      "2026-03-03",
      "2026-03-05",
      "2026-03-07",
    ]);

    // 4) Rationale por treino: a regra viaja junto da sessão.
    const first = drafts[0]!;
    const rationale = first.generationRationale as Record<string, unknown>;
    expect(rationale.algorithmVersion).toBe(first.algorithmVersion);
    expect((rationale.rules as unknown[]).length).toBeGreaterThan(0);

    // 5) O lote guarda o contexto que o motor de fato viu.
    const batch = await prisma.generationBatch.findUniqueOrThrow({ where: { id: result.batchId } });
    expect(batch.status).toBe("COMPLETED");
    expect(batch.scope).toBe("SINGLE_WEEK");
    expect(batch.generationVersion).toBe(1);
    const snapshot = batch.contextSnapshot as Record<string, unknown>;
    expect((snapshot.context as Record<string, unknown>).targetVolumeKm).toBe(45);
    expect((snapshot.context as Record<string, unknown>).goal).toBe(PLAN.goal);

    // 6) Enquanto é rascunho, o atleta não enxerga nada.
    const athleteScope = { organizationId: trainer.organizationId, athleteProfileId: athleteId };
    expect(await listAthleteWorkouts(athleteScope)).toHaveLength(0);
    await expect(getAthleteWorkout(first.id, athleteScope)).rejects.toThrow(/não encontrado/i);

    // 7) O treinador revisa, edita e publica.
    const edited = await updateWorkoutDraft(
      first.id,
      {
        athleteId,
        title: "Rodagem — ajustada pelo treinador",
        modality: "RUNNING",
        plannedDate: "2026-03-03",
        timezone: "America/Sao_Paulo",
        lockVersion: first.lockVersion,
        blocks: [
          {
            name: "Rodagem contínua",
            repetitions: 1,
            steps: [
              {
                stepType: "RODAGEM",
                distanceMeters: 9000,
                targetType: "RPE",
                targetMin: 3,
                targetMax: 4,
              },
            ],
            exercises: [],
          },
        ],
      },
      trainer,
    );
    expect(edited.trainerModified).toBe(true);

    const published = await publishWorkout(first.id, trainer);
    expect(published.status).toBe("PUBLISHED");

    // 8) Publicado => o atleta enxerga, e só esse.
    const visible = await listAthleteWorkouts(athleteScope);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.title).toBe("Rodagem — ajustada pelo treinador");
    const detail = await getAthleteWorkout(first.id, athleteScope);
    expect(detail.blocks[0]?.steps[0]?.distanceMeters).toBe(9000);

    // 9) Auditoria do lote.
    const log = await prisma.auditLog.findFirst({
      where: { action: "GENERATE_WEEK", entityId: result.batchId },
    });
    expect(log?.reason).toMatch(/confidence_HIGH/);
  }, 60_000);

  it("recusa gerar duas vezes e, ao substituir, preserva o que o treinador tocou", async () => {
    const { trainer, periodization, week } = await setupPlan("gen-replace");

    const first = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      REQUEST,
      trainer,
    );

    // Sem replaceExisting, regerar é conflito — nunca duplica silenciosamente.
    await expect(
      generateWeekDrafts({ periodizationId: periodization.id, weekId: week.id }, REQUEST, trainer),
    ).rejects.toThrow(/já tem/i);

    // O treinador publica um e edita outro; ambos viram trabalho a preservar.
    await publishWorkout(first.workouts[0]!.id, trainer);
    const second = await prisma.workout.findUniqueOrThrow({ where: { id: first.workouts[1]!.id } });
    await updateWorkoutDraft(
      second.id,
      {
        athleteId: second.athleteId,
        title: "Ajustado à mão",
        modality: "RUNNING",
        plannedDate: second.plannedDate.toISOString().slice(0, 10),
        timezone: second.timezone,
        lockVersion: second.lockVersion,
        blocks: [
          {
            name: "Rodagem",
            repetitions: 1,
            steps: [{ stepType: "RODAGEM", distanceMeters: 5000 }],
            exercises: [],
          },
        ],
      },
      trainer,
    );

    const regenerated = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      { ...REQUEST, replaceExisting: true },
      trainer,
    );

    // Só o terceiro (rascunho intocado) foi descartado e refeito.
    expect(regenerated.replacedDrafts).toBe(1);
    const firstIds = first.workouts.map((w) => w.id);
    const survivors = await prisma.workout.findMany({ where: { id: { in: firstIds } } });
    expect(survivors.map((w) => w.id).sort()).toEqual(firstIds.slice(0, 2).sort());
    expect(await prisma.workout.count({ where: { trainingWeekId: week.id } })).toBe(5);

    const batch = await prisma.generationBatch.findUniqueOrThrow({
      where: { id: regenerated.batchId },
    });
    expect(batch.generationVersion).toBe(2);
  }, 60_000);

  it("gera com confiança rebaixada quando faltam dados, em vez de barrar o treinador", async () => {
    const trainer = await newTrainer("gen-lowconf");
    const athleteId = await newActiveAthlete(trainer);
    // Plano sem fase e sem volume alvo: o motor não tem o que usar.
    const periodization = await createPeriodization(athleteId, { ...PLAN, phases: [] }, trainer);
    const week = await prisma.trainingWeek.findFirstOrThrow({
      where: { periodizationId: periodization.id, sequence: 1 },
    });

    const result = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      { ...REQUEST, level: undefined },
      trainer,
    );

    expect(result.workouts.length).toBeGreaterThan(0);
    expect(result.confidence).toBe("LOW");
    expect(result.rationale.missingData).toEqual(
      expect.arrayContaining(["phaseName", "level", "targetVolume"]),
    );
    const workout = await prisma.workout.findUniqueOrThrow({
      where: { id: result.workouts[0]!.id },
    });
    expect(workout.confidenceLevel).toBe("LOW");
    expect(workout.periodizationPhaseId).toBeNull();
  });

  it("herda o volume alvo da fase quando a semana não define o seu", async () => {
    const { trainer, periodization, week } = await setupPlan("gen-inherit");
    // A semana não tem targetVolume; a fase tem 45 km.
    expect(week.targetVolume).toBeNull();

    const result = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      REQUEST,
      trainer,
    );
    expect(result.rationale.weekVolumeKm).toBe(45);
    expect(result.rationale.missingData).not.toContain("targetVolume");
  });

  it("aplica a semana regenerativa marcada na estrutura do plano", async () => {
    const { trainer, periodization, week } = await setupPlan("gen-recovery");
    await prisma.trainingWeek.update({
      where: { id: week.id },
      data: { isRecoveryWeek: true },
    });

    const result = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      REQUEST,
      trainer,
    );

    expect(result.rationale.weekVolumeKm).toBeCloseTo(45 * 0.6, 5);
    const workouts = await prisma.workout.findMany({
      where: { id: { in: result.workouts.map((w) => w.id) } },
    });
    expect(workouts.every((w) => w.title.includes("regenerativo"))).toBe(true);
  });

  it("não deixa a semana de outra organização ser gerada", async () => {
    const { periodization, week } = await setupPlan("gen-tenant-a");
    const intruder = await newTrainer("gen-tenant-b");

    await expect(
      generateWeekDrafts({ periodizationId: periodization.id, weekId: week.id }, REQUEST, intruder),
    ).rejects.toThrow(/não encontrada/i);
  });

  it("não gera quando a semana não pertence à periodização da URL", async () => {
    const { trainer, week } = await setupPlan("gen-mismatch");
    const other = await setupPlan("gen-mismatch-other");

    // Semana existe e o treinador tem acesso — mas não a esta periodização.
    await expect(
      generateWeekDrafts(
        { periodizationId: other.periodization.id, weekId: week.id },
        REQUEST,
        trainer,
      ),
    ).rejects.toThrow(/não encontrada/i);
  });
});

describe("Fase 6 — geração por modalidade", () => {
  const MODALITIES = [
    { modality: "RUNNING" as const, expected: ["RUNNING"] },
    { modality: "SWIMMING" as const, expected: ["SWIMMING"] },
    { modality: "CYCLING" as const, expected: ["CYCLING"] },
  ];

  for (const { modality, expected } of MODALITIES) {
    it(`persiste rascunhos de ${modality} com conteúdo específico`, async () => {
      const { trainer, periodization, week } = await setupPlan(`gen-${modality.toLowerCase()}`);
      const result = await generateWeekDrafts(
        { periodizationId: periodization.id, weekId: week.id },
        { ...REQUEST, modality },
        trainer,
      );
      const workouts = await prisma.workout.findMany({
        where: { id: { in: result.workouts.map((w) => w.id) } },
        include: { blocks: { include: { steps: true } } },
      });
      expect(workouts.length).toBeGreaterThan(0);
      expect([...new Set(workouts.map((w) => w.modality))]).toEqual(expected);
      expect(workouts.every((w) => w.status === "DRAFT")).toBe(true);
      expect(workouts.every((w) => w.blocks.some((b) => b.steps.length > 0))).toBe(true);
    });
  }

  it("persiste o triathlon como sessões das três disciplinas", async () => {
    const { trainer, periodization, week } = await setupPlan("gen-tri");
    const result = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      { ...REQUEST, modality: "TRIATHLON", availableWeekdays: [1, 2, 3, 4, 5, 6] },
      trainer,
    );

    const workouts = await prisma.workout.findMany({
      where: { id: { in: result.workouts.map((w) => w.id) } },
    });
    expect(new Set(workouts.map((w) => w.modality))).toEqual(
      new Set(["SWIMMING", "CYCLING", "RUNNING"]),
    );
    // Km não são comparáveis entre disciplinas — nunca prometemos HIGH aqui.
    expect(result.confidence).toBe("MODERATE");
  }, 40_000);

  it("persiste a força complementar junto do endurance", async () => {
    const { trainer, periodization, week } = await setupPlan("gen-strength");
    const result = await generateWeekDrafts(
      { periodizationId: periodization.id, weekId: week.id },
      { ...REQUEST, availableWeekdays: [1, 2, 3, 4, 5, 6], includeStrength: true },
      trainer,
    );

    const workouts = await prisma.workout.findMany({
      where: { id: { in: result.workouts.map((w) => w.id) } },
      include: { blocks: { include: { exercises: { include: { exercise: true } } } } },
    });
    const strength = workouts.filter((w) => w.modality === "FUNCTIONAL");
    expect(strength.length).toBeGreaterThan(0);
    // Os exercícios foram materializados na biblioteca da organização.
    const names = strength.flatMap((w) =>
      w.blocks.flatMap((b) => b.exercises.map((e) => e.exercise.name)),
    );
    expect(names).toContain("Agachamento livre");
  }, 40_000);
});

afterAll(async () => {
  if (createdOrganizationIds.length > 0) {
    await prisma.workout.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
    await prisma.generationBatch.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.periodization.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.exercise.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  }
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
