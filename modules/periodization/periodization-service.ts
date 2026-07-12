import { NotFoundError, ValidationError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import type { CreatePeriodizationInput } from "./periodization-schema";

// Produto v1 da periodização: a camada estratégica MANUAL. O treinador desenha
// o macrociclo (fases + semanas derivadas da janela) e o serviço mostra quantos
// treinos já estão agendados em cada semana. Escopo org+treinador em toda
// leitura/escrita. NÃO gera treinos — o motor AUTOMATIC/ASSISTED (GenerationBatch)
// é Fase 5 e depende de dados acumulados.

export interface PeriodizationActor {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DerivedWeek {
  sequence: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

const DAY_MS = 86_400_000;
const MAX_WEEKS = 104; // ~2 anos; janela maior que isso é erro de digitação, não plano

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// Semanas de treino = janelas de 7 dias a partir da data de início do plano.
// A última semana é aparada na data final. Pura (testável, sem drift de fuso).
export function deriveWeeks(startISO: string, endISO: string): DerivedWeek[] {
  const start = Date.parse(`${startISO}T00:00:00.000Z`);
  const end = Date.parse(`${endISO}T00:00:00.000Z`);
  const weeks: DerivedWeek[] = [];
  let cursor = start;
  let sequence = 1;
  while (cursor <= end) {
    const weekEnd = Math.min(cursor + 6 * DAY_MS, end);
    weeks.push({
      sequence,
      startDate: new Date(cursor).toISOString().slice(0, 10),
      endDate: new Date(weekEnd).toISOString().slice(0, 10),
    });
    cursor += 7 * DAY_MS;
    sequence += 1;
  }
  return weeks;
}

export async function createPeriodization(
  athleteId: string,
  input: CreatePeriodizationInput,
  actor: PeriodizationActor,
) {
  const weeks = deriveWeeks(input.startDate, input.endDate);
  if (weeks.length > MAX_WEEKS) {
    throw new ValidationError(`Janela muito longa: máximo de ${MAX_WEEKS} semanas por plano.`);
  }

  return prisma.$transaction(async (tx) => {
    const periodization = await tx.periodization.create({
      data: {
        organizationId: actor.organizationId,
        athleteId,
        trainerId: actor.trainerProfileId,
        title: input.title,
        goal: input.goal,
        startDate: day(input.startDate),
        endDate: day(input.endDate),
      },
    });

    const createdPhases: { id: string; start: string; end: string }[] = [];
    for (const [i, p] of input.phases.entries()) {
      const phase = await tx.periodizationPhase.create({
        data: {
          periodizationId: periodization.id,
          name: p.name,
          sequence: i + 1,
          startDate: day(p.startDate),
          endDate: day(p.endDate),
          targetVolumeKm: p.targetVolumeKm ?? null,
          targetIntensity: p.targetIntensity ?? null,
        },
      });
      createdPhases.push({ id: phase.id, start: p.startDate, end: p.endDate });
    }

    // Cada semana herda a fase que cobre sua data de início (se houver).
    await tx.trainingWeek.createMany({
      data: weeks.map((w) => ({
        periodizationId: periodization.id,
        phaseId:
          createdPhases.find((ph) => w.startDate >= ph.start && w.startDate <= ph.end)?.id ?? null,
        sequence: w.sequence,
        startDate: day(w.startDate),
        endDate: day(w.endDate),
      })),
    });

    await recordAuditLog(tx, {
      action: "CREATE_PERIODIZATION",
      entityName: "Periodization",
      entityId: periodization.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return periodization;
  });
}

export async function listTrainerPeriodizations(athleteId: string, actor: PeriodizationActor) {
  return prisma.periodization.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      athleteId,
    },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { phases: true, weeks: true } } },
  });
}

export async function getPeriodization(id: string, actor: PeriodizationActor) {
  const periodization = await prisma.periodization.findUnique({
    where: { id },
    include: {
      phases: { orderBy: { sequence: "asc" } },
      weeks: { orderBy: { sequence: "asc" } },
    },
  });
  if (
    !periodization ||
    periodization.organizationId !== actor.organizationId ||
    periodization.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Periodização não encontrada.");
  }

  // Treinos já no calendário dentro da janela — mostra a aderência da estrutura
  // ao que de fato foi agendado, sem exigir vínculo explícito de FK.
  const workouts = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      athleteId: periodization.athleteId,
      plannedDate: { gte: periodization.startDate, lte: periodization.endDate },
    },
    select: { plannedDate: true },
  });

  const weeks = periodization.weeks.map((w) => ({
    ...w,
    scheduledCount: workouts.filter(
      (wk) => wk.plannedDate >= w.startDate && wk.plannedDate <= w.endDate,
    ).length,
  }));

  return { ...periodization, weeks };
}

export async function deletePeriodization(id: string, actor: PeriodizationActor) {
  const current = await prisma.periodization.findUnique({ where: { id } });
  if (
    !current ||
    current.organizationId !== actor.organizationId ||
    current.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Periodização não encontrada.");
  }
  // Fases e semanas caem por cascade. Workout referencia com onDelete: Restrict,
  // mas o v1 não vincula treinos ao plano, então nada bloqueia a remoção.
  await prisma.$transaction(async (tx) => {
    await tx.periodization.delete({ where: { id } });
    await recordAuditLog(tx, {
      action: "DELETE_PERIODIZATION",
      entityName: "Periodization",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });
}
