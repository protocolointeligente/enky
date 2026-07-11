import { Modality, WorkoutStatus } from "@prisma/client";
import { z } from "zod";
import { ValidationError } from "@/domain/errors";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use AAAA-MM-DD.");

export const moveWorkoutInputSchema = z.object({
  plannedDate: isoDate,
});
export type MoveWorkoutInputParsed = z.infer<typeof moveWorkoutInputSchema>;

export const duplicateWorkoutInputSchema = z.object({
  plannedDate: isoDate,
  athleteId: z.string().uuid("Atleta inválido.").optional(),
});
export type DuplicateWorkoutInputParsed = z.infer<typeof duplicateWorkoutInputSchema>;

// Calendar range comes from query params. Cap the window so a single request
// can't scan an unbounded date range (max ~3 months covers month/week views).
const MAX_RANGE_DAYS = 92;

export interface ParsedCalendarRange {
  from: Date;
  to: Date;
}

export function parseCalendarRange(
  fromRaw: string | null,
  toRaw: string | null,
): ParsedCalendarRange {
  const from = parseDateParam(fromRaw, "from");
  const to = parseDateParam(toRaw, "to");
  if (to.getTime() < from.getTime()) {
    throw new ValidationError("O fim do período não pode ser antes do início.");
  }
  const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
  if (spanDays > MAX_RANGE_DAYS) {
    throw new ValidationError(`Período muito longo — máximo de ${MAX_RANGE_DAYS} dias.`);
  }
  return { from, to };
}

function parseDateParam(raw: string | null, label: string): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError(`Parâmetro "${label}" inválido — use AAAA-MM-DD.`);
  }
  return new Date(`${raw}T00:00:00.000Z`);
}

// Optional enum filters from query params — an unknown value is ignored
// (treated as "no filter") rather than rejected, so a stale bookmarked URL
// never hard-fails the calendar.
export function parseModalityParam(raw: string | null): Modality | undefined {
  return raw && raw in Modality ? (raw as Modality) : undefined;
}

export function parseStatusParam(raw: string | null): WorkoutStatus | undefined {
  return raw && raw in WorkoutStatus ? (raw as WorkoutStatus) : undefined;
}
