import type { Modality, WorkoutStatus } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { ATHLETE_VISIBLE_STATUSES } from "./workout-visibility";

// Lightweight card the calendar renders — never includes block/step/exercise
// trees (those are loaded only on the detail view) so a month view stays cheap.
export interface CalendarWorkoutCard {
  id: string;
  athleteId: string;
  athleteName: string | null;
  title: string;
  modality: Modality;
  status: WorkoutStatus;
  plannedDate: string; // ISO yyyy-mm-dd (calendar bucket key)
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedDurationMinutes: number | null;
  hasFeedback: boolean;
}

export interface TrainerCalendarScope {
  organizationId: string;
  trainerProfileId: string;
}

export interface AthleteCalendarScope {
  organizationId: string;
  athleteProfileId: string;
}

export interface CalendarFilters {
  from: Date; // inclusive
  to: Date; // inclusive
  athleteId?: string;
  modality?: Modality;
  status?: WorkoutStatus;
}

function plannedDurationMinutes(startAt: Date | null, endAt: Date | null): number | null {
  if (!startAt || !endAt) return null;
  const ms = endAt.getTime() - startAt.getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}

function toCardDate(plannedDate: Date): string {
  // plannedDate is a @db.Date — take the calendar day without timezone drift.
  return plannedDate.toISOString().slice(0, 10);
}

// Trainer sees every athlete's workout in the org (their own athletes),
// filterable. Always scoped by organizationId + trainerId on the server — the
// client-supplied filters can only narrow, never widen, the tenant.
export async function listTrainerCalendarWorkouts(
  actor: TrainerCalendarScope,
  filters: CalendarFilters,
): Promise<CalendarWorkoutCard[]> {
  if (filters.athleteId) {
    await requireTrainerAccessToAthlete(
      actor.organizationId,
      actor.trainerProfileId,
      filters.athleteId,
    );
  }

  const workouts = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      plannedDate: { gte: filters.from, lte: filters.to },
      ...(filters.athleteId ? { athleteId: filters.athleteId } : {}),
      ...(filters.modality ? { modality: filters.modality } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: [{ plannedDate: "asc" }, { plannedStartAt: "asc" }],
    select: {
      id: true,
      athleteId: true,
      title: true,
      modality: true,
      status: true,
      plannedDate: true,
      plannedStartAt: true,
      plannedEndAt: true,
      athlete: { select: { user: { select: { name: true } } } },
      feedback: { select: { id: true } },
    },
  });

  return workouts.map((w) => ({
    id: w.id,
    athleteId: w.athleteId,
    athleteName: w.athlete.user?.name ?? null,
    title: w.title,
    modality: w.modality,
    status: w.status,
    plannedDate: toCardDate(w.plannedDate),
    plannedStartAt: w.plannedStartAt?.toISOString() ?? null,
    plannedEndAt: w.plannedEndAt?.toISOString() ?? null,
    plannedDurationMinutes: plannedDurationMinutes(w.plannedStartAt, w.plannedEndAt),
    hasFeedback: w.feedback !== null,
  }));
}

// Athlete sees only their own workouts, and only visible statuses (never
// DRAFT). The status filter, if given, is intersected with the visible set.
export async function listAthleteCalendarWorkouts(
  actor: AthleteCalendarScope,
  filters: CalendarFilters,
): Promise<CalendarWorkoutCard[]> {
  const statusFilter =
    filters.status && ATHLETE_VISIBLE_STATUSES.includes(filters.status)
      ? [filters.status]
      : [...ATHLETE_VISIBLE_STATUSES];

  const workouts = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      athleteId: actor.athleteProfileId,
      status: { in: statusFilter },
      plannedDate: { gte: filters.from, lte: filters.to },
      ...(filters.modality ? { modality: filters.modality } : {}),
    },
    orderBy: [{ plannedDate: "asc" }, { plannedStartAt: "asc" }],
    select: {
      id: true,
      athleteId: true,
      title: true,
      modality: true,
      status: true,
      plannedDate: true,
      plannedStartAt: true,
      plannedEndAt: true,
      feedback: { select: { id: true } },
    },
  });

  return workouts.map((w) => ({
    id: w.id,
    athleteId: w.athleteId,
    athleteName: null,
    title: w.title,
    modality: w.modality,
    status: w.status,
    plannedDate: toCardDate(w.plannedDate),
    plannedStartAt: w.plannedStartAt?.toISOString() ?? null,
    plannedEndAt: w.plannedEndAt?.toISOString() ?? null,
    plannedDurationMinutes: plannedDurationMinutes(w.plannedStartAt, w.plannedEndAt),
    hasFeedback: w.feedback !== null,
  }));
}
