import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { RecordTestResultBody } from "./assessment-schema";

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
  return {
    id: r.id,
    testType: r.testType,
    resultValue: Number(r.resultValue),
    unit: r.unit,
    protocol: r.protocol,
    calculatedMetrics: (r.calculatedMetrics as Record<string, unknown> | null) ?? null,
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
