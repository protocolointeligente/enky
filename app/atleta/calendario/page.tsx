"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import {
  addDays,
  addMonths,
  getMonthMatrix,
  getWeekDays,
  isSameMonth,
  isToday,
  monthLabel,
  toISODate,
  WEEKDAY_LABELS,
  weekLabel,
} from "@/app/_lib/calendar";
import { useRequireRole } from "@/app/_lib/use-session";
import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";

interface CalendarCard {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  hasFeedback: boolean;
}

export default function AthleteCalendarPage() {
  const { checked } = useRequireRole("ATHLETE");
  const router = useRouter();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(
    () => (view === "month" ? getMonthMatrix(anchor).flat() : getWeekDays(anchor)),
    [view, anchor],
  );
  const range = useMemo(() => {
    const first = days[0];
    const last = days[days.length - 1];
    return { from: first ? toISODate(first) : "", to: last ? toISODate(last) : "" };
  }, [days]);

  const load = useCallback(() => {
    if (!range.from || !range.to) return Promise.resolve();
    const params = new URLSearchParams({ from: range.from, to: range.to });
    return apiFetch<{ workouts: CalendarCard[] }>(`/api/athlete/calendar?${params.toString()}`)
      .then((r) => {
        setCards(r.workouts);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [range.from, range.to]);

  useEffect(() => {
    if (!checked) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [checked, load]);

  const cardsByDay = useMemo(() => {
    const map = new Map<string, CalendarCard[]>();
    for (const card of cards) {
      const list = map.get(card.plannedDate) ?? [];
      list.push(card);
      map.set(card.plannedDate, list);
    }
    return map;
  }, [cards]);

  function step(direction: 1 | -1) {
    setAnchor((prev) =>
      view === "month" ? addMonths(prev, direction) : addDays(prev, direction * 7),
    );
  }

  if (!checked) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <h1 className={uiClasses.heading}>Meu calendário</h1>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={uiClasses.buttonSecondary} onClick={() => step(-1)}>
            ‹
          </button>
          <button
            type="button"
            className={uiClasses.buttonSecondary}
            onClick={() => setAnchor(new Date())}
          >
            Hoje
          </button>
          <button type="button" className={uiClasses.buttonSecondary} onClick={() => step(1)}>
            ›
          </button>
          <span className="ml-1 font-medium capitalize text-slate-200">
            {view === "month" ? monthLabel(anchor) : weekLabel(anchor)}
          </span>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              className={view === "month" ? uiClasses.button : uiClasses.buttonSecondary}
              onClick={() => setView("month")}
            >
              Mês
            </button>
            <button
              type="button"
              className={view === "week" ? uiClasses.button : uiClasses.buttonSecondary}
              onClick={() => setView("week")}
            >
              Semana
            </button>
          </div>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}
        {loading && <p className="text-sm text-slate-400">Carregando treinos...</p>}

        <div
          className={
            view === "month" ? "grid grid-cols-7 gap-1" : "grid grid-cols-1 gap-2 sm:grid-cols-7"
          }
        >
          {view === "month" &&
            WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1 text-center text-xs font-semibold text-slate-500">
                {label}
              </div>
            ))}
          {days.map((day) => {
            const iso = toISODate(day);
            const dayCards = cardsByDay.get(iso) ?? [];
            const muted = view === "month" && !isSameMonth(day, anchor);
            return (
              <div
                key={iso}
                className={`min-h-[92px] rounded-lg border p-1.5 ${
                  isToday(day) ? "border-[#00e6c3]" : "border-slate-800"
                } ${muted ? "opacity-40" : ""}`}
              >
                <div className="mb-1 text-xs text-slate-400">
                  {view === "week"
                    ? day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
                    : day.getDate()}
                </div>
                <div className="flex flex-col gap-1">
                  {dayCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => router.push(`/atleta/treinos/${card.id}`)}
                      className="w-full truncate rounded bg-slate-800/70 px-1.5 py-1 text-left text-xs text-slate-100 hover:bg-slate-700"
                      title={card.title}
                    >
                      <span
                        className={`mr-1 inline-block h-2 w-2 rounded-full ${statusBadgeClass[card.status] ?? ""}`}
                      />
                      {card.title}
                      {card.hasFeedback ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
