import type { Prisma } from "@prisma/client";
import { NotFoundError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import type { IntelligenceActor } from "./attention";
import type { ResolveInsightInput } from "./insight-decision-schema";
import { fingerprintOf, type Insight, type PersistedInsight } from "./insight";

// Persistência do ciclo de vida do Insight (02H). O motor calcula on-the-fly;
// aqui gravamos detecção→exposição→ação→resultado para calibração. Escopo
// org+treinador em toda leitura/escrita, como o resto do sistema.

// Grava a exposição na leitura da carteira e devolve cada Insight com seu
// estado persistido. Uma linha por fingerprint (situação estável); decisões
// anteriores (aceito/ignorado/resultado) são preservadas entre varreduras.
export async function upsertExposedInsights(
  actor: IntelligenceActor,
  insights: Insight[],
): Promise<PersistedInsight[]> {
  if (insights.length === 0) return [];

  const prepared = insights.map((insight) => ({ insight, fingerprint: fingerprintOf(insight) }));

  // ponytail: grava na leitura (idempotente via ON CONFLICT DO NOTHING).
  // Barato na escala MVP; migrar para cron/lote por organização na Fase II
  // (ENKY_INTELLIGENCE_ARCHITECTURE §5) se a escrita por load pesar.
  await prisma.insight.createMany({
    data: prepared.map(({ insight, fingerprint }) => ({
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      athleteId: insight.athleteId,
      engine: insight.engine,
      risk: insight.risk,
      fingerprint,
      content: insight as unknown as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });

  const rows = await prisma.insight.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      fingerprint: { in: prepared.map((p) => p.fingerprint) },
    },
    select: { id: true, fingerprint: true, status: true, outcome: true },
  });
  const byFingerprint = new Map(rows.map((row) => [row.fingerprint, row]));

  return prepared.map(({ insight, fingerprint }) => {
    const row = byFingerprint.get(fingerprint);
    return {
      ...insight,
      id: row?.id ?? null,
      status: row?.status ?? "PENDING",
      outcome: row?.outcome ?? null,
    };
  });
}

export interface ResolveInsightActor extends IntelligenceActor {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Registra a decisão do treinador sobre um Insight: aceitar/ignorar (a ação)
// e/ou o resultado (outcome). Escopo checado — só o dono da linha resolve.
export async function resolveInsight(
  insightId: string,
  actor: ResolveInsightActor,
  input: ResolveInsightInput,
  now: Date,
) {
  const current = await prisma.insight.findUnique({ where: { id: insightId } });
  if (
    !current ||
    current.organizationId !== actor.organizationId ||
    current.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Insight não encontrado.");
  }

  return prisma.$transaction(async (tx) => {
    const data: Prisma.InsightUpdateInput = { lockVersion: { increment: 1 } };
    if (input.status != null) {
      data.status = input.status;
      data.resolvedAt = now;
      data.resolvedBy = { connect: { id: actor.userId } };
    }
    if (input.outcome != null) {
      data.outcome = input.outcome;
    }

    const updated = await tx.insight.update({ where: { id: insightId }, data });

    await recordAuditLog(tx, {
      action: "RESOLVE_INSIGHT",
      entityName: "Insight",
      entityId: insightId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      changedFields: [
        ...(input.status != null ? ["status"] : []),
        ...(input.outcome != null ? ["outcome"] : []),
      ],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  });
}
