// UNIÃO DO MERGE CRM↔Marketplace. Dois subsistemas de avaliação coexistem sobre
// modelos Prisma distintos, sem colisão de símbolos:
//   • Marketplace (Fase B): TestResult + zonas Coggan/Friel/pace/CSS —
//     recordTestResult / listAthleteTestResults / deleteTestResult (produção).
//   • CRM (Etapa 4): Assessment tipado por modalidade + validação —
//     createAssessment / updateAssessmentDraft / validateAssessment / getAssessment.
import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { CreateAssessmentInput, RecordTestResultBody } from "./assessment-schema";
import { computeZonesForTest, type ZoneSet } from "./zones";

// ─────────────── Marketplace: TestResult + zonas (Fase B) ───────────────

// Serviço de avaliação física (§28) sobre o modelo TestResult, que já existia no
// schema sem ninguém escrever nele. Escopo sempre org + athleteProfileId (tenant
// + athlete isolation). Sem cálculo de zona inventado — armazena o que o
// treinador mediu/derivou.

export interface TrainerAssessmentActor {
  organizationId: string;
  trainerProfileId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AssessmentView {
  id: string;
  testType: string;
  resultValue: number;
  unit: string;
  protocol: string | null;
  calculatedMetrics: Record<string, unknown> | null;
  /** Zonas de treino derivadas do limiar (Coggan/Friel), quando aplicável. */
  zones: ZoneSet | null;
  performedAt: string;
}

function toView(r: {
  id: string;
  testType: string;
  resultValue: Prisma.Decimal;
  unit: string;
  protocol: string | null;
  calculatedMetrics: Prisma.JsonValue;
  performedAt: Date;
}): AssessmentView {
  const resultValue = Number(r.resultValue);
  return {
    id: r.id,
    testType: r.testType,
    resultValue,
    unit: r.unit,
    protocol: r.protocol,
    calculatedMetrics: (r.calculatedMetrics as Record<string, unknown> | null) ?? null,
    zones: computeZonesForTest(r.unit, resultValue),
    performedAt: r.performedAt.toISOString(),
  };
}

export async function recordTestResult(
  athleteProfileId: string,
  input: RecordTestResultBody,
  actor: TrainerAssessmentActor,
): Promise<AssessmentView> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.testResult.create({
      data: {
        organizationId: actor.organizationId,
        athleteId: athleteProfileId,
        trainerId: actor.trainerProfileId,
        testType: input.testType,
        resultValue: input.resultValue,
        unit: input.unit,
        protocol: input.protocol,
        calculatedMetrics: (input.calculatedMetrics ?? undefined) as Prisma.InputJsonValue | undefined,
        performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
      },
    });
    await recordAuditLog(tx, {
      action: "RECORD_TEST_RESULT",
      entityName: "TestResult",
      entityId: created.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return toView(created);
  });
}

// Lista as avaliações de um atleta (mesmo shape para treinador e atleta; a
// autorização — vínculo do treinador ou identidade do atleta — é da rota).
export async function listAthleteTestResults(
  organizationId: string,
  athleteProfileId: string,
): Promise<AssessmentView[]> {
  const results = await prisma.testResult.findMany({
    where: { organizationId, athleteId: athleteProfileId },
    orderBy: { performedAt: "desc" },
  });
  return results.map(toView);
}

export async function deleteTestResult(
  id: string,
  actor: TrainerAssessmentActor,
): Promise<void> {
  const existing = await prisma.testResult.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!existing) throw new NotFoundError("Avaliação não encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.testResult.delete({ where: { id } });
    await recordAuditLog(tx, {
      action: "DELETE_TEST_RESULT",
      entityName: "TestResult",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });
}

// ─────────────── CRM: Assessment tipado por modalidade (Etapa 4) ────────

// Serviço de avaliações (fatia A). Ciclo de vida: DRAFT → VALID; validar uma
// avaliação SUPERSEDE a anterior VÁLIDA do mesmo tipo (histórico preservado,
// nada é apagado). Escopo org+treinador reforçado em toda entrada, como nas
// demais escritas (createPeriodization etc.). NÃO calcula zonas — isso é a
// fatia C (motor de zonas).

export interface AssessmentActor {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
  ipAddress?: string;
  userAgent?: string;
}

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// Só o cabeçalho persistível — measurements/derivedMetrics são JSON.
function toData(input: CreateAssessmentInput, actor: AssessmentActor, athleteId: string) {
  return {
    organizationId: actor.organizationId,
    athleteId,
    assessmentType: input.assessmentType,
    modality: input.modality ?? null,
    protocolCode: input.protocolCode,
    protocolVersion: input.protocolVersion,
    assessmentDate: day(input.assessmentDate),
    validUntil: input.validUntil ? day(input.validUntil) : null,
    source: input.source,
    confidence: input.confidence,
    notes: input.notes ?? null,
    measurements: input.measurements as Prisma.InputJsonValue,
  };
}

export async function createAssessment(
  athleteId: string,
  input: CreateAssessmentInput,
  actor: AssessmentActor,
) {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);

  return prisma.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        ...toData(input, actor, athleteId),
        performedByUserId: actor.userId,
        status: "DRAFT",
      },
    });
    await recordAuditLog(tx, {
      action: "CREATE_ASSESSMENT",
      entityName: "Assessment",
      entityId: assessment.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return assessment;
  });
}

// Carrega uma avaliação garantindo escopo (org + acesso do treinador ao atleta).
async function requireOwnedAssessment(id: string, actor: AssessmentActor) {
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment || assessment.organizationId !== actor.organizationId) {
    throw new NotFoundError("Avaliação não encontrada.");
  }
  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    assessment.athleteId,
  );
  return assessment;
}

export async function updateAssessmentDraft(
  id: string,
  input: CreateAssessmentInput,
  actor: AssessmentActor,
) {
  const current = await requireOwnedAssessment(id, actor);
  if (current.status !== "DRAFT") {
    throw new ConflictError("Só rascunhos podem ser editados. Crie uma nova avaliação.");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.assessment.update({
      where: { id },
      data: toData(input, actor, current.athleteId),
    });
    await recordAuditLog(tx, {
      action: "UPDATE_ASSESSMENT_DRAFT",
      entityName: "Assessment",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return updated;
  });
}

// Valida um rascunho. A anterior VÁLIDA do MESMO tipo vira SUPERSEDED — nova
// avaliação nunca apaga a antiga. Idempotência: validar algo já VALID é conflito.
export async function validateAssessment(id: string, actor: AssessmentActor) {
  const current = await requireOwnedAssessment(id, actor);
  if (current.status !== "DRAFT") {
    throw new ConflictError("Apenas rascunhos podem ser validados.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.assessment.updateMany({
      where: {
        organizationId: actor.organizationId,
        athleteId: current.athleteId,
        assessmentType: current.assessmentType,
        status: "VALID",
      },
      data: { status: "SUPERSEDED" },
    });
    const validated = await tx.assessment.update({
      where: { id },
      data: { status: "VALID" },
    });
    await recordAuditLog(tx, {
      action: "VALIDATE_ASSESSMENT",
      entityName: "Assessment",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return validated;
  });
}

export async function listAssessments(athleteId: string, actor: AssessmentActor) {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);
  return prisma.assessment.findMany({
    where: { organizationId: actor.organizationId, athleteId },
    orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getAssessment(id: string, actor: AssessmentActor) {
  return requireOwnedAssessment(id, actor);
}
