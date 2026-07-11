// Pure date helpers for the calendar views. All buckets key off the local
// calendar day as a yyyy-mm-dd string, matching how the API returns
// Workout.plannedDate — so no timezone drift between fetch and render.

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return next;
}

// Week starts on Monday (training weeks run Mon–Sun).
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -day);
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Full weeks (Mon-start) covering the anchor's month, padded into adjacent
// months so the grid is always complete rows of 7.
export function getMonthMatrix(anchor: Date): Date[][] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  // 6 rows guarantees any month fits.
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function monthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function weekLabel(anchor: Date): string {
  const days = getWeekDays(anchor);
  const first = days[0];
  const last = days[6];
  if (!first || !last) return "";
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(first)} – ${fmt(last)}`;
}

export function isSameMonth(date: Date, anchor: Date): boolean {
  return date.getMonth() === anchor.getMonth() && date.getFullYear() === anchor.getFullYear();
}

export function isToday(date: Date): boolean {
  return toISODate(date) === toISODate(new Date());
}
