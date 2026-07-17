import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  requireTrainerAccessToAthlete,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { createWorkoutDraft } from "@/modules/workouts/create-workout-draft";
import { getAthleteWorkout } from "@/modules/workouts/get-athlete-workout";
import { generateAthleteReport, getAthleteReport } from "@/modules/reports/report-service";
import { submitWorkoutFeedback } from "@/modules/feedback/submit-workout-feedback";
import { getTrainerWorkoutFeedback } from "@/modules/feedback/get-trainer-workout-feedback";
import { createTemplate, applyTemplate, getTemplate } from "@/modules/templates/template-service";
import { createExercise, updateExercise } from "@/modules/exercises/exercise-service";
import { createPeriodization, getPeriodization } from "@/modules/periodization/periodization-service";
import { resolveInsight } from "@/modules/intelligence/insight-store";
import { verifySessionByToken, createSession, revokeSession, hashSessionToken } from "@/server/auth/session";
import { uniqueEmail } from "./helpers";

const createdTemplateIds: string[] = [];
const createdExerciseIds: string[] = [];
const createdPeriodizationIds: string[] = [];
const createdInsightIds: string[] = [];

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
  return { ...result, trainerProfileId: trainerProfile.id };
}

async function newActiveAthlete(
  trainer: { userId: string; organizationId: string; trainerProfileId: string },
  prefix: string,
) {
  const invitation = await inviteAthlete(
    { email: uniqueEmail(prefix) },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
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
  return { athleteProfileId: invitation.athleteProfileId, userId: activation.userId };
}

describe("Fase 2 — Testes Negativos de Autorização", () => {
  // 1. treinador de uma organização tentando acessar atleta de outra organização
  it("bloqueia treinador tentando acessar atleta de outra organização", async () => {
    const trainerA = await newTrainer("neg-cross-a");
    const trainerB = await newTrainer("neg-cross-b");
    const athleteB = await newActiveAthlete(trainerB, "neg-cross-b");

    await expect(
      requireTrainerAccessToAthlete(
        trainerA.organizationId,
        trainerA.trainerProfileId,
        athleteB.athleteProfileId,
      ),
    ).rejects.toThrow();
  });

  // 2. treinador tentando criar treino para atleta sem vínculo ativo
  it("bloqueia treinador tentando criar treino para atleta sem vínculo ativo", async () => {
    const trainer = await newTrainer("neg-workout-nolink");
    const athlete = await newActiveAthlete(trainer, "neg-workout-nolink");

    // Deativar o vínculo
    await prisma.coachAthleteRelationship.update({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: trainer.organizationId,
          trainerId: trainer.trainerProfileId,
          athleteId: athlete.athleteProfileId,
        },
      },
      data: { isActive: false },
    });

    const draftInput = {
      athleteId: athlete.athleteProfileId,
      title: "Treino Desvinculado",
      modality: "STRENGTH" as const,
      plannedDate: "2026-08-01",
      timezone: "America/Sao_Paulo",
      blocks: [],
    };

    await expect(
      createWorkoutDraft(draftInput, {
        userId: trainer.userId,
        trainerProfileId: trainer.trainerProfileId,
        organizationId: trainer.organizationId,
      }),
    ).rejects.toThrow();
  });

  // 3. treinador tentando gerar relatório para atleta sem vínculo ativo
  it("bloqueia treinador tentando gerar relatório para atleta sem vínculo ativo", async () => {
    const trainer = await newTrainer("neg-report-nolink");
    const athlete = await newActiveAthlete(trainer, "neg-report-nolink");

    // Desativar o vínculo
    await prisma.coachAthleteRelationship.update({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: trainer.organizationId,
          trainerId: trainer.trainerProfileId,
          athleteId: athlete.athleteProfileId,
        },
      },
      data: { isActive: false },
    });

    const reportInput = {
      periodStart: "2026-07-01",
      periodEnd: "2026-07-07",
    };

    await expect(
      generateAthleteReport(athlete.athleteProfileId, reportInput, {
        userId: trainer.userId,
        organizationId: trainer.organizationId,
        trainerProfileId: trainer.trainerProfileId,
      }),
    ).rejects.toThrow();
  });

  // 4. atleta tentando acessar treino de outro atleta
  it("retorna NOT_FOUND ao atleta tentando acessar treino de outro atleta", async () => {
    const trainerA = await newTrainer("neg-workout-iso-a");
    const athleteA = await newActiveAthlete(trainerA, "neg-workout-iso-a");
    const trainerB = await newTrainer("neg-workout-iso-b");
    const athleteB = await newActiveAthlete(trainerB, "neg-workout-iso-b");

    const workout = await createWorkoutDraft(
      {
        athleteId: athleteA.athleteProfileId,
        title: "Corrida do Atleta A",
        modality: "RUNNING" as const,
        plannedDate: "2026-08-01",
        timezone: "America/Sao_Paulo",
        blocks: [],
      },
      {
        userId: trainerA.userId,
        trainerProfileId: trainerA.trainerProfileId,
        organizationId: trainerA.organizationId,
      },
    );

    // Publicar treino para torná-lo em tese visível
    await prisma.workout.update({
      where: { id: workout.id },
      data: { status: "PUBLISHED" },
    });

    await expect(
      getAthleteWorkout(workout.id, {
        athleteProfileId: athleteB.athleteProfileId,
        organizationId: trainerB.organizationId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // 5. atleta tentando acessar relatório não publicado
  it("retorna NOT_FOUND ao atleta tentando acessar relatório não publicado", async () => {
    const trainer = await newTrainer("neg-rep-iso");
    const athlete = await newActiveAthlete(trainer, "neg-rep-iso");

    const report = await generateAthleteReport(
      athlete.athleteProfileId,
      { periodStart: "2026-07-01", periodEnd: "2026-07-07" },
      {
        userId: trainer.userId,
        organizationId: trainer.organizationId,
        trainerProfileId: trainer.trainerProfileId,
      },
    );

    // Relatório foi criado em DRAFT por padrão, devendo ser inacessível para o atleta
    await expect(
      getAthleteReport(report.id, trainer.organizationId, athlete.athleteProfileId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // 6. usuário ATHLETE tentando acessar rotas de treinador
  it("lança erro de autorização quando usuário ATHLETE tenta acessar guard de treinador", () => {
    const athleteIdentity = {
      userId: "athlete-user",
      email: "athlete@enky.local",
      name: "Athlete User",
      globalRole: "ATHLETE" as const,
    };

    expect(() => requireGlobalRole(athleteIdentity, ["TRAINER"])).toThrow();
  });

  // 7. usuário TRAINER tentando acessar rotas admin
  it("lança erro de autorização quando usuário TRAINER tenta acessar guard de admin", () => {
    const trainerIdentity = {
      userId: "trainer-user",
      email: "trainer@enky.local",
      name: "Trainer User",
      globalRole: "TRAINER" as const,
    };

    expect(() => requireGlobalRole(trainerIdentity, ["ADMIN", "SUPERADMIN"])).toThrow();
  });

  // 7b. usuário ATHLETE tentando acessar rotas admin (Fase 9)
  it("lança erro de autorização quando usuário ATHLETE tenta acessar guard de admin", () => {
    const athleteIdentity = {
      userId: "athlete-user",
      email: "athlete@enky.local",
      name: "Athlete User",
      globalRole: "ATHLETE" as const,
    };

    expect(() => requireGlobalRole(athleteIdentity, ["ADMIN", "SUPERADMIN"])).toThrow();
  });

  // 8. sessão expirada/revogada tentando acessar API protegida
  it("rejeita sessões expiradas ou revocadas", async () => {
    const trainer = await newTrainer("neg-session-check");
    
    // Sessão Expirada
    const expiredSession = await createSession({ userId: trainer.userId });
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(expiredSession.token) },
      data: { expiresAt: new Date(Date.now() - 10_000) }, // expirou a 10s
    });

    const verifiedExpired = await verifySessionByToken(expiredSession.token);
    expect(verifiedExpired).toBeNull();

    // Sessão Revocada
    const revokedSession = await createSession({ userId: trainer.userId });
    await revokeSession(revokedSession.token);

    const verifiedRevoked = await verifySessionByToken(revokedSession.token);
    expect(verifiedRevoked).toBeNull();
  });

  // 9. atleta com múltiplos vínculos ativos deve falhar conforme invariante atual do MVP
  it("falha quando o atleta possui múltiplos vínculos ativos (invariante do MVP)", async () => {
    const trainerA = await newTrainer("neg-multi-link-a");
    const trainerB = await newTrainer("neg-multi-link-b");

    const invitationA = await inviteAthlete(
      { email: uniqueEmail("neg-multi-link-athlete") },
      {
        userId: trainerA.userId,
        trainerProfileId: trainerA.trainerProfileId,
        organizationId: trainerA.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitationA.athleteProfileId);

    const activation = await activateAthleteInvitation({
      token: invitationA.rawToken,
      name: "Athlete Multi",
      password: VALID_PASSWORD,
    });
    createdUserIds.push(activation.userId);

    // Inserir manualmente outro vínculo ativo
    await prisma.coachAthleteRelationship.create({
      data: {
        organizationId: trainerB.organizationId,
        trainerId: trainerB.trainerProfileId,
        athleteId: invitationA.athleteProfileId,
        isActive: true,
      },
    });

    await expect(resolveAthleteOrganization(activation.userId)).rejects.toThrow(
      "Atleta possui vínculos ativos em múltiplas organizações"
    );
  });

  // ─── Auditoria por módulo: isolamento cross-tenant nos serviços ───────────
  // Cada serviço de escrita/leitura deve barrar acesso fora do escopo
  // org+treinador (ou org+atleta) devolvendo erro genérico, sem revelar a
  // existência do recurso.

  // feedback: atleta não envia feedback em treino de outro atleta
  it("feedback — retorna NOT_FOUND ao atleta enviando feedback em treino alheio", async () => {
    const trainerA = await newTrainer("neg-fb-a");
    const athleteA = await newActiveAthlete(trainerA, "neg-fb-a");
    const trainerB = await newTrainer("neg-fb-b");
    const athleteB = await newActiveAthlete(trainerB, "neg-fb-b");

    const workout = await createWorkoutDraft(
      {
        athleteId: athleteA.athleteProfileId,
        title: "Treino do Atleta A",
        modality: "STRENGTH" as const,
        plannedDate: "2026-08-02",
        timezone: "America/Sao_Paulo",
        blocks: [],
      },
      { userId: trainerA.userId, trainerProfileId: trainerA.trainerProfileId, organizationId: trainerA.organizationId },
    );
    await prisma.workout.update({ where: { id: workout.id }, data: { status: "PUBLISHED" } });

    await expect(
      submitWorkoutFeedback(
        workout.id,
        { completionStatus: "COMPLETED", sessionRpe: 5 },
        { userId: athleteB.userId, athleteProfileId: athleteB.athleteProfileId, organizationId: trainerB.organizationId },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // feedback: treinador não lê feedback de treino de outra organização
  it("feedback — retorna NOT_FOUND ao treinador lendo feedback de treino de outra org", async () => {
    const trainerA = await newTrainer("neg-fbread-a");
    const athleteA = await newActiveAthlete(trainerA, "neg-fbread-a");
    const trainerB = await newTrainer("neg-fbread-b");

    const workout = await createWorkoutDraft(
      {
        athleteId: athleteA.athleteProfileId,
        title: "Treino A",
        modality: "RUNNING" as const,
        plannedDate: "2026-08-03",
        timezone: "America/Sao_Paulo",
        blocks: [],
      },
      { userId: trainerA.userId, trainerProfileId: trainerA.trainerProfileId, organizationId: trainerA.organizationId },
    );

    await expect(
      getTrainerWorkoutFeedback(workout.id, {
        organizationId: trainerB.organizationId,
        trainerProfileId: trainerB.trainerProfileId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // templates: treinador não lê template de outra organização
  it("templates — retorna NOT_FOUND ao treinador lendo template de outra org", async () => {
    const trainerA = await newTrainer("neg-tpl-a");
    const trainerB = await newTrainer("neg-tpl-b");

    const template = await createTemplate(
      { title: "Template A", modality: "STRENGTH" as const, content: { blocks: [], tags: [] } },
      { userId: trainerA.userId, trainerProfileId: trainerA.trainerProfileId, organizationId: trainerA.organizationId },
    );
    createdTemplateIds.push(template.id);

    await expect(
      getTemplate(template.id, {
        organizationId: trainerB.organizationId,
        trainerProfileId: trainerB.trainerProfileId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // templates: aplicar template a atleta sem vínculo ativo é barrado
  it("templates — bloqueia aplicar template a atleta sem vínculo", async () => {
    const trainerA = await newTrainer("neg-tplapply-a");
    const trainerB = await newTrainer("neg-tplapply-b");
    const athleteB = await newActiveAthlete(trainerB, "neg-tplapply-b");

    const template = await createTemplate(
      { title: "Template A", modality: "FUNCTIONAL" as const, content: { blocks: [], tags: [] } },
      { userId: trainerA.userId, trainerProfileId: trainerA.trainerProfileId, organizationId: trainerA.organizationId },
    );
    createdTemplateIds.push(template.id);

    await expect(
      applyTemplate(
        template.id,
        { athleteId: athleteB.athleteProfileId, plannedDate: "2026-08-04" },
        { userId: trainerA.userId, trainerProfileId: trainerA.trainerProfileId, organizationId: trainerA.organizationId },
      ),
    ).rejects.toThrow();
  });

  // exercises: treinador não edita exercício de outra organização
  it("exercises — retorna NOT_FOUND ao treinador editando exercício de outra org", async () => {
    const trainerA = await newTrainer("neg-ex-a");
    const trainerB = await newTrainer("neg-ex-b");

    const exercise = await createExercise(
      { name: `Agachamento ${Date.now()}`, category: "STRENGTH", targetMuscles: [] },
      { userId: trainerA.userId, organizationId: trainerA.organizationId },
    );
    createdExerciseIds.push(exercise.id);

    await expect(
      updateExercise(
        exercise.id,
        { name: "Roubado", category: "STRENGTH", targetMuscles: [] },
        { userId: trainerB.userId, organizationId: trainerB.organizationId },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // periodization: criar periodização sem vínculo ativo é barrado (guard de serviço)
  it("periodization — bloqueia criar plano para atleta sem vínculo ativo", async () => {
    const trainer = await newTrainer("neg-per-nolink");
    const athlete = await newActiveAthlete(trainer, "neg-per-nolink");

    await prisma.coachAthleteRelationship.update({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: trainer.organizationId,
          trainerId: trainer.trainerProfileId,
          athleteId: athlete.athleteProfileId,
        },
      },
      data: { isActive: false },
    });

    await expect(
      createPeriodization(
        athlete.athleteProfileId,
        {
          title: "Macro",
          goal: "BASE",
          autoGenerate: false,
          isDraft: false,
          startDate: "2026-08-01",
          endDate: "2026-08-28",
          phases: [],
        },
        { userId: trainer.userId, organizationId: trainer.organizationId, trainerProfileId: trainer.trainerProfileId },
      ),
    ).rejects.toThrow();
  });

  // periodization: treinador não lê plano de outra organização
  it("periodization — retorna NOT_FOUND ao treinador lendo plano de outra org", async () => {
    const trainerA = await newTrainer("neg-perread-a");
    const athleteA = await newActiveAthlete(trainerA, "neg-perread-a");
    const trainerB = await newTrainer("neg-perread-b");

    const periodization = await createPeriodization(
      athleteA.athleteProfileId,
      { title: "Macro A", goal: "BASE", autoGenerate: false, isDraft: false, startDate: "2026-08-01", endDate: "2026-08-28", phases: [] },
      { userId: trainerA.userId, organizationId: trainerA.organizationId, trainerProfileId: trainerA.trainerProfileId },
    );
    createdPeriodizationIds.push(periodization.id);

    await expect(
      getPeriodization(periodization.id, {
        userId: trainerB.userId,
        organizationId: trainerB.organizationId,
        trainerProfileId: trainerB.trainerProfileId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // intelligence: treinador não resolve insight de outra organização
  it("intelligence — retorna NOT_FOUND ao treinador resolvendo insight de outra org", async () => {
    const trainerA = await newTrainer("neg-ins-a");
    const athleteA = await newActiveAthlete(trainerA, "neg-ins-a");
    const trainerB = await newTrainer("neg-ins-b");

    const insight = await prisma.insight.create({
      data: {
        organizationId: trainerA.organizationId,
        trainerId: trainerA.trainerProfileId,
        athleteId: athleteA.athleteProfileId,
        engine: "attention",
        risk: "revisar",
        fingerprint: `neg-ins:${athleteA.athleteProfileId}`,
        content: {},
      },
    });
    createdInsightIds.push(insight.id);

    await expect(
      resolveInsight(
        insight.id,
        { userId: trainerB.userId, organizationId: trainerB.organizationId, trainerProfileId: trainerB.trainerProfileId },
        { status: "ACCEPTED" },
        new Date(),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  afterAll(async () => {
    if (createdInsightIds.length > 0) {
      await prisma.insight.deleteMany({ where: { id: { in: createdInsightIds } } });
    }
    if (createdPeriodizationIds.length > 0) {
      await prisma.periodization.deleteMany({ where: { id: { in: createdPeriodizationIds } } });
    }
    if (createdTemplateIds.length > 0) {
      await prisma.workoutTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    }
    if (createdExerciseIds.length > 0) {
      await prisma.exercise.deleteMany({ where: { id: { in: createdExerciseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
    }
    if (createdAthleteProfileIds.length > 0) {
      await prisma.workoutFeedback.deleteMany({
        where: { workout: { athleteId: { in: createdAthleteProfileIds } } },
      });
      await prisma.workout.deleteMany({
        where: { athleteId: { in: createdAthleteProfileIds } },
      });
      await prisma.report.deleteMany({
        where: { athleteId: { in: createdAthleteProfileIds } },
      });
      await prisma.coachAthleteRelationship.deleteMany({
        where: { athleteId: { in: createdAthleteProfileIds } },
      });
      await prisma.athleteInvitation.deleteMany({
        where: { athleteId: { in: createdAthleteProfileIds } },
      });
    }
    if (createdUserIds.length > 0 || createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: createdUserIds } }, { organizationId: { in: createdOrganizationIds } }],
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
});
