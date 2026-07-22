import type { Prisma } from "@prisma/client";
import { NotFoundError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import type { IntelligenceActor } from "./attention";
import type { ResolveInsightInput } from "./insight-decision-schema";
import {
  fingerprintOf,
  isoWeekKey,
  RULESET_VERSION,
  type Insight,
  type InsightLifecycleStatus,
  type PersistedInsight,
} from "./insight";

// Persistência do ciclo de vida do Insight (02H → Fase 03). O motor calcula
// on-the-fly; aqui gravamos detecção→exposição→ação→resultado para calibração.
// Escopo org+treinador em toda leitura/escrita, como o resto do sistema.

// Linhas ainda "abertas" (sem decisão do treinador) que expiram quando a
// situação some da varredura. ACCEPTED/IGNORED/RESOLVED nunca são sobrescritas.
const EXPIRABLE: InsightLifecycleStatus[] = ["NEW", "VIEWED"];

// Grava a exposição na leitura da carteira e devolve cada Insight com seu
// estado persistido. Uma linha por fingerprint (situação estável dentro da
// janela); decisões anteriores são preservadas. Situações abertas que não
// aparecem mais nesta varredura (o motor deixou de recalculá-las) viram EXPIRED.
// A varredura cobre a carteira inteira do treinador — por isso a expiração é
// segura: uma linha ausente é genuinamente uma situação que passou.
export async function upsertExposedInsights(
  actor: IntelligenceActor,
  insights: Insight[],
  now: Date = new Date(),
): Promise<PersistedInsight[]> {
  const windowKey = isoWeekKey(now);
  const version = RULESET_VERSION;
  const prepared = insights.map((insight) => ({
    insight,
    fingerprint: fingerprintOf(insight, { version, windowKey }),
  }));
  const liveFingerprints = prepared.map((p) => p.fingerprint);

  await prisma.$transaction(async (tx) => {
    if (prepared.length > 0) {
      // ponytail: grava na leitura (idempotente via ON CONFLICT DO NOTHING).
      // Barato na escala MVP; migrar para cron/lote por organização na Fase II
      // (ENKY_INTELLIGENCE_ARCHITECTURE §5) se a escrita por load pesar.
      await tx.insight.createMany({
        data: prepared.map(({ insight, fingerprint }) => ({
          organizationId: actor.organizationId,
          trainerId: actor.trainerProfileId,
          athleteId: insight.athleteId,
          workoutId: insight.workoutId ?? null,
          engine: insight.engine,
          risk: insight.risk,
          rulesetVersion: version,
          fingerprint,
          content: insight as unknown as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
    }

    // Expira o que ficou aberto e não voltou nesta varredura.
    await tx.insight.updateMany({
      where: {
        organizationId: actor.organizationId,
        trainerId: actor.trainerProfileId,
        status: { in: EXPIRABLE },
        fingerprint: { notIn: liveFingerprints.length > 0 ? liveFingerprints : ["__none__"] },
      },
      data: { status: "EXPIRED" },
    });
  });

  if (prepared.length === 0) return [];

  const rows = await prisma.insight.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      fingerprint: { in: liveFingerprints },
    },
    select: { id: true, fingerprint: true, status: true, note: true, outcome: true },
  });
  const byFingerprint = new Map(rows.map((row) => [row.fingerprint, row]));

  return prepared.map(({ insight, fingerprint }) => {
    const row = byFingerprint.get(fingerprint);
    return {
      ...insight,
      id: row?.id ?? null,
      status: (row?.status ?? "NEW") as InsightLifecycleStatus,
      note: row?.note ?? null,
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

  // VIEWED é uma transição "leve": só marca que o treinador abriu, e nunca
  // rebaixa uma decisão já tomada (ACCEPTED/IGNORED/RESOLVED) de volta.
  const isDecision = (s: string | null | undefined) =>
    s === "ACCEPTED" || s === "IGNORED" || s === "RESOLVED";
  const applyStatus =
    input.status === "VIEWED" && current.status !== "NEW" ? undefined : input.status;

  return prisma.$transaction(async (tx) => {
    const data: Prisma.InsightUpdateInput = { lockVersion: { increment: 1 } };
    if (applyStatus != null) {
      data.status = applyStatus;
      // Só uma resolução real carimba quem/quando; VIEWED não é resolução.
      if (isDecision(applyStatus)) {
        data.resolvedAt = now;
        data.resolvedBy = { connect: { id: actor.userId } };
      }
    }
    if (input.note != null) {
      data.note = input.note;
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
        ...(applyStatus != null ? ["status"] : []),
        ...(input.note != null ? ["note"] : []),
        ...(input.outcome != null ? ["outcome"] : []),
      ],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  });
}
