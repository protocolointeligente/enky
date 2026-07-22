import { prisma } from "@/infrastructure/database/prisma";
import { type AthleteScope, listAthleteWorkouts } from "@/modules/workouts/get-athlete-workout";

// Agregador da home operacional do atleta (§8): responde num só request "o que
// faço hoje / como estou / o que vem / o que exige atenção / como evoluo".
// Sem regra de negócio pesada — só leitura e derivação.

const DONE = ["COMPLETED", "PARTIAL"];
const WEEK_DAYS = 7;

export interface HomeWorkout {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string; // ISO date (YYYY-MM-DD)
  plannedStartAt: string | null;
  hasFeedback: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "Hoje" no fuso do atleta (default da org), não em UTC do servidor.
function todayInTimezone(timeZone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone }); // en-CA => YYYY-MM-DD
}

function daysAgoIso(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

export async function getAthleteHome(actor: AthleteScope, timeZone = "America/Sao_Paulo") {
  const [rows, readiness] = await Promise.all([
    listAthleteWorkouts(actor),
    prisma.readinessCheckIn.findFirst({
      where: { athleteId: actor.athleteProfileId },
      orderBy: { checkInDate: "desc" },
      select: {
        checkInDate: true,
        sleepHours: true,
        sleepQuality: true,
        fatigue: true,
        soreness: true,
        stress: true,
        motivation: true,
      },
    }),
  ]);

  const todayIso = todayInTimezone(timeZone);
  const workouts: HomeWorkout[] = rows.map((w) => ({
    id: w.id,
    title: w.title,
    modality: w.modality,
    status: w.status,
    plannedDate: isoDate(w.plannedDate),
    plannedStartAt: w.plannedStartAt ? w.plannedStartAt.toISOString() : null,
    hasFeedback: Boolean(w.feedback),
  }));

  const today = workouts.filter((w) => w.plannedDate === todayIso);
  const upcoming = workouts
    .filter((w) => w.status === "PUBLISHED" && w.plannedDate > todayIso)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    .slice(0, 5);
  // Vencido sem feedback = precisa de atenção (§8.3).
  const feedbackMissing = workouts
    .filter((w) => w.status === "PUBLISHED" && w.plannedDate < todayIso && !w.hasFeedback)
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
  const recentCompleted = workouts
    .filter((w) => DONE.includes(w.status) || w.status === "MISSED")
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))
    .slice(0, 5);

  // Evolução resumida (§8.5): janela de 7 dias + sequência atual.
  const weekStart = daysAgoIso(todayIso, WEEK_DAYS - 1);
  const inWeek = workouts.filter((w) => w.plannedDate >= weekStart && w.plannedDate <= todayIso);
  const scheduled7d = inWeek.filter(
    (w) => DONE.includes(w.status) || w.status === "MISSED" || (w.status === "PUBLISHED" && w.plannedDate < todayIso),
  ).length;
  const completed7d = inWeek.filter((w) => DONE.includes(w.status)).length;

  // Sequência: treinos passados mais recentes concluídos em fila, até um furo.
  const pastDesc = workouts
    .filter((w) => w.plannedDate <= todayIso && w.status !== "PUBLISHED")
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
  let streak = 0;
  for (const w of pastDesc) {
    if (DONE.includes(w.status)) streak += 1;
    else break;
  }

  return {
    today,
    upcoming,
    recentCompleted,
    pending: {
      feedbackMissing,
      readinessTodayMissing: !readiness || isoDate(readiness.checkInDate) !== todayIso,
    },
    readiness: readiness
      ? {
          checkInDate: isoDate(readiness.checkInDate),
          sleepHours: readiness.sleepHours ? Number(readiness.sleepHours) : null,
          sleepQuality: readiness.sleepQuality,
          fatigue: readiness.fatigue,
          soreness: readiness.soreness,
          stress: readiness.stress,
          motivation: readiness.motivation,
        }
      : null,
    summary: {
      completed7d,
      scheduled7d,
      adherence7d: scheduled7d > 0 ? Math.round((completed7d / scheduled7d) * 100) : null,
      streak,
    },
  };
}
