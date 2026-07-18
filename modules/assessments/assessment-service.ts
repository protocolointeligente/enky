import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { CreateAssessmentInput } from "./assessment-schema";

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
