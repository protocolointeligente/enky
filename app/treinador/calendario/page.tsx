"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

const MODALITIES = [
  "RUNNING",
  "STRENGTH",
  "FUNCTIONAL",
  "CYCLING",
  "SWIMMING",
  "TRIATHLON",
] as const;
const FILTER_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "COMPLETED",
  "PARTIAL",
  "MISSED",
  "CANCELLED",
] as const;

interface CalendarCard {
  id: string;
  athleteId: string;
  athleteName: string | null;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  plannedStartAt: string | null;
  plannedDurationMinutes: number | null;
  hasFeedback: boolean;
}

interface AthleteOption {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
}

export default function TrainerCalendarPage() {
  const { checked } = useRequireRole("TRAINER");
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [athleteId, setAthleteId] = useState("");
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarCard | null>(null);

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
    if (athleteId) params.set("athleteId", athleteId);
    if (modality) params.set("modality", modality);
    if (status) params.set("status", status);
    return apiFetch<{ workouts: CalendarCard[] }>(`/api/trainer/calendar?${params.toString()}`)
      .then((r) => {
        setCards(r.workouts);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [range.from, range.to, athleteId, modality, status]);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes")
      .then((r) => setAthletes(r.athletes))
      .catch(() => undefined);
  }, [checked]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={uiClasses.heading}>Calendário</h1>
          <Link href="/treinador/treinos/novo" className={uiClasses.button}>
            + Novo treino
          </Link>
        </div>

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

        <div className="flex flex-wrap gap-2">
          <select
            className={uiClasses.select}
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
          >
            <option value="">Todos os atletas</option>
            {athletes.map((a) => (
              <option key={a.athleteProfileId} value={a.athleteProfileId}>
                {a.name ?? a.email ?? a.athleteProfileId}
              </option>
            ))}
          </select>
          <select
            className={uiClasses.select}
            value={modality}
            onChange={(e) => setModality(e.target.value)}
          >
            <option value="">Todas as modalidades</option>
            {MODALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className={uiClasses.select}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
                      onClick={() => setSelected(card)}
                      className="w-full truncate rounded bg-slate-800/70 px-1.5 py-1 text-left text-xs text-slate-100 hover:bg-slate-700"
                      title={`${card.title} — ${card.athleteName ?? ""}`}
                    >
                      <span
                        className={`mr-1 inline-block h-2 w-2 rounded-full ${statusBadgeClass[card.status] ?? ""}`}
                      />
                      {card.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <WorkoutActionPanel
          card={selected}
          athletes={athletes}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            setSelected(null);
            await load();
          }}
        />
      )}
    </main>
  );
}

function WorkoutActionPanel({
  card,
  athletes,
  onClose,
  onChanged,
}: {
  card: CalendarCard;
  athletes: AthleteOption[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [moveDate, setMoveDate] = useState(card.plannedDate);
  const [dupDate, setDupDate] = useState(card.plannedDate);
  const [dupAthlete, setDupAthlete] = useState(card.athleteId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      setBusy(false);
    }
  }

  const isDraft = card.status === "DRAFT";
  const canMove = (card.status === "DRAFT" || card.status === "PUBLISHED") && !card.hasFeedback;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div className={`${uiClasses.card} w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-100">{card.title}</p>
            <p className="text-xs text-slate-400">
              {card.athleteName ?? "—"} · {card.modality} · {card.plannedDate}
            </p>
          </div>
          <span className={`${uiClasses.badge} ${statusBadgeClass[card.status] ?? ""}`}>
            {card.status}
          </span>
        </div>

        {error && <p className={`${uiClasses.error} mb-3`}>{error}</p>}

        <div className="flex flex-col gap-3">
          <Link href={`/treinador/treinos/${card.id}`} className={uiClasses.buttonSecondary}>
            Abrir detalhes
          </Link>

          {isDraft && (
            <div className="flex gap-2">
              <Link
                href={`/treinador/treinos/${card.id}/editar`}
                className={`${uiClasses.buttonSecondary} flex-1 text-center`}
              >
                Editar
              </Link>
              <button
                type="button"
                className={`${uiClasses.button} flex-1`}
                disabled={busy}
                onClick={() =>
                  run(() =>
                    apiFetch(`/api/trainer/workouts/${card.id}/publish`, { method: "POST" }),
                  )
                }
              >
                Publicar
              </button>
            </div>
          )}

          {canMove && (
            <div className="rounded-lg border border-slate-800 p-2">
              <p className="mb-1 text-xs font-medium text-slate-400">Mover para</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={uiClasses.input}
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                />
                <button
                  type="button"
                  className={uiClasses.buttonSecondary}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      apiFetch(`/api/trainer/workouts/${card.id}/move`, {
                        method: "POST",
                        body: JSON.stringify({ plannedDate: moveDate }),
                      }),
                    )
                  }
                >
                  Mover
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 p-2">
            <p className="mb-1 text-xs font-medium text-slate-400">Duplicar como rascunho</p>
            <div className="flex flex-col gap-2">
              <select
                className={uiClasses.select}
                value={dupAthlete}
                onChange={(e) => setDupAthlete(e.target.value)}
              >
                {athletes.map((a) => (
                  <option key={a.athleteProfileId} value={a.athleteProfileId}>
                    {a.name ?? a.email ?? a.athleteProfileId}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={uiClasses.input}
                  value={dupDate}
                  onChange={(e) => setDupDate(e.target.value)}
                />
                <button
                  type="button"
                  className={uiClasses.buttonSecondary}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      apiFetch(`/api/trainer/workouts/${card.id}/duplicate`, {
                        method: "POST",
                        body: JSON.stringify({ plannedDate: dupDate, athleteId: dupAthlete }),
                      }),
                    )
                  }
                >
                  Duplicar
                </button>
              </div>
            </div>
          </div>

          {canMove && (
            <button
              type="button"
              className="text-sm text-red-400 hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                run(() => apiFetch(`/api/trainer/workouts/${card.id}/cancel`, { method: "POST" }))
              }
            >
              Cancelar treino
            </button>
          )}

          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-200"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
