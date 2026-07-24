import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  deleteTestResult,
  listAthleteTestResults,
  recordTestResult,
  type TrainerAssessmentActor,
} from "@/modules/assessments/assessment-service";
import { uniqueEmail } from "./helpers";

// Fase B — avaliação física sobre o TestResult existente, contra o banco real:
//   treinador registra → lista devolve → atleta B não vê (athlete isolation) →
//   org alheia não vê (tenant isolation) → apagar remove.

const VALID_PASSWORD = "correcthorse1";
const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdAthleteIds: string[] = [];

let actor: TrainerAssessmentActor;
let otherOrgId = "";
let athleteA = "";
let athleteB = "";

beforeAll(async () => {
  const trainer = await registerTrainer({
    name: "Assess Trainer",
    email: uniqueEmail("assess-trainer"),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(trainer.userId);
  createdOrganizationIds.push(trainer.organizationId);
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId: trainer.userId } });
  actor = { organizationId: trainer.organizationId, trainerProfileId: profile.id, userId: trainer.userId };

  const other = await registerTrainer({
    name: "Other Org Trainer",
    email: uniqueEmail("assess-other"),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(other.userId);
  createdOrganizationIds.push(other.organizationId);
  otherOrgId = other.organizationId;

  const a = await prisma.athleteProfile.create({ data: {} });
  const b = await prisma.athleteProfile.create({ data: {} });
  athleteA = a.id;
  athleteB = b.id;
  createdAthleteIds.push(a.id, b.id);
});

afterAll(async () => {
  await prisma.testResult.deleteMany({ where: { athleteId: { in: createdAthleteIds } } });
  await prisma.athleteProfile.deleteMany({ where: { id: { in: createdAthleteIds } } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.subscription.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.trainerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("Fase B — avaliação física", () => {
  it("registra, lista, isola por atleta e por org, e apaga", async () => {
    const created = await recordTestResult(
      athleteA,
      { testType: "FTP", resultValue: 250, unit: "W", protocol: "20min" },
      actor,
    );
    expect(created.resultValue).toBe(250);

    const listA = await listAthleteTestResults(actor.organizationId, athleteA);
    expect(listA).toHaveLength(1);
    expect(listA[0]?.testType).toBe("FTP");

    // Athlete isolation: atleta B não tem nada.
    expect(await listAthleteTestResults(actor.organizationId, athleteB)).toHaveLength(0);
    // Tenant isolation: org alheia não vê a avaliação do atleta A.
    expect(await listAthleteTestResults(otherOrgId, athleteA)).toHaveLength(0);

    await deleteTestResult(created.id, actor);
    expect(await listAthleteTestResults(actor.organizationId, athleteA)).toHaveLength(0);
  });
});
