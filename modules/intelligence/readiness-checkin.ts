import type { ReadinessCheckIn } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { classifyReadiness, type ReadinessResult } from "./readiness";
import type { SubmitReadinessInput } from "./readiness-schema";

// Questionário de prontidão/recuperação (Fase II — item 5). Coleta o auto-relato
// diário e devolve cada check-in já classificado. Escopo por org+atleta.

export interface ReadinessAthleteActor {
  userId: string;
  organizationId: string;
  athleteProfileId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ReadinessCheckInView {
  id: string;
  checkInDate: string; // ISO (YYYY-MM-DD)
  sleepHours: number | null;
  sleepQuality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
  notes: string | null;
  readiness: ReadinessResult;
}

// Data do dia em UTC-midnight, coerente com o resto do sistema (@db.Date).
function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toView(row: ReadinessCheckIn): ReadinessCheckInView {
  const sleepHours = row.sleepHours != null ? Number(row.sleepHours) : null;
  return {
    id: row.id,
    checkInDate: row.checkInDate.toISOString().slice(0, 10),
    sleepHours,
    sleepQuality: row.sleepQuality,
    fatigue: row.fatigue,
    soreness: row.soreness,
    stress: row.stress,
    motivation: row.motivation,
    notes: row.notes,
    readiness: classifyReadiness({
      sleepHours,
      sleepQuality: row.sleepQuality,
      fatigue: row.fatigue,
      soreness: row.soreness,
      stress: row.stress,
      motivation: row.motivation,
    }),
  };
}

// Upsert do check-in de HOJE — um por atleta por dia; reenviar corrige o do dia.
export async function submitReadinessCheckIn(
  input: SubmitReadinessInput,
  actor: ReadinessAthleteActor,
  now: Date,
): Promise<ReadinessCheckInView> {
  const checkInDate = utcDay(now);
  const data = {
    sleepHours: input.sleepHours ?? null,
    sleepQuality: input.sleepQuality ?? null,
    fatigue: input.fatigue ?? null,
    soreness: input.soreness ?? null,
    stress: input.stress ?? null,
    motivation: input.motivation ?? null,
    notes: input.notes ?? null,
  };

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.readinessCheckIn.upsert({
      where: { athleteId_checkInDate: { athleteId: actor.athleteProfileId, checkInDate } },
      update: { ...data, lockVersion: { increment: 1 } },
      create: {
        organizationId: actor.organizationId,
        athleteId: actor.athleteProfileId,
        checkInDate,
        ...data,
      },
    });

    await recordAuditLog(tx, {
      action: "SUBMIT_READINESS_CHECKIN",
      entityName: "ReadinessCheckIn",
      entityId: saved.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return saved;
  });

  return toView(row);
}

// Histórico recente do próprio atleta (mais novo primeiro).
export async function getMyReadiness(
  athleteProfileId: string,
  days = 14,
): Promise<ReadinessCheckInView[]> {
  const rows = await prisma.readinessCheckIn.findMany({
    where: { athleteId: athleteProfileId },
    orderBy: { checkInDate: "desc" },
    take: days,
  });
  return rows.map(toView);
}

// Leitura pelo treinador (a rota valida o vínculo antes de chamar).
export async function getAthleteReadiness(
  organizationId: string,
  athleteProfileId: string,
  days = 14,
): Promise<ReadinessCheckInView[]> {
  const rows = await prisma.readinessCheckIn.findMany({
    where: { organizationId, athleteId: athleteProfileId },
    orderBy: { checkInDate: "desc" },
    take: days,
  });
  return rows.map(toView);
}
