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
import { modalityLabel, statusLabel } from "@/app/_lib/labels";
import { MODALITY_ORDER, modalityMeta } from "@/app/_lib/modality";
import { toast } from "@/app/_lib/toast";
import { uiClasses } from "@/app/_lib/ui";
import { useExerciseOptions } from "@/app/_lib/use-exercise-options";
import { useRequireRole } from "@/app/_lib/use-session";
import { StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/ui/icons";
import { PrescriptionModal } from "@/components/prescription-modal";
import type { AthleteOption, TemplateOption } from "@/components/workout-prescription-form";

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

export default function TrainerCalendarPage() {
  const { checked } = useRequireRole("TRAINER");
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [athleteId, setAthleteId] = useState("");
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarCard | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const exerciseOptions = useExerciseOptions(checked);

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
    Promise.all([
      apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes"),
      apiFetch<{ templates: TemplateOption[] }>("/api/trainer/templates").catch(() => ({
        templates: [],
      })),
    ]).then(([a, t]) => {
      setAthletes(a.athletes);
      setTemplates(t.templates);
    });
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
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className={uiClasses.eyebrow}>Núcleo de prescrição</span>
            <h1 className={uiClasses.heading}>Calendário</h1>
          </div>
          <button
            type="button"
            className={uiClasses.button}
            onClick={() => setCreateDate(toISODate(new Date()))}
          >
            <PlusIcon />
            Criar treino
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={uiClasses.buttonSecondary}
            onClick={() => step(-1)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className={uiClasses.buttonSecondary}
            onClick={() => setAnchor(new Date())}
          >
            Hoje
          </button>
          <button
            type="button"
            className={uiClasses.buttonSecondary}
            onClick={() => step(1)}
            aria-label="Próximo"
          >
            ›
          </button>
          <span className="ml-1 font-display font-semibold capitalize text-ink">
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
            {MODALITY_ORDER.map((m) => (
              <option key={m} value={m}>
                {modalityLabel(m)}
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
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}
        {loading && <p className="text-sm text-muted">Carregando treinos...</p>}

        <div
          className={
            view === "month" ? "grid grid-cols-7 gap-1" : "grid grid-cols-1 gap-2 sm:grid-cols-7"
          }
        >
          {view === "month" &&
            WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-faint"
              >
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
                className={`group flex min-h-[104px] flex-col rounded-lg border p-1.5 ${
                  isToday(day) ? "border-electric bg-electric/5" : "border-line"
                } ${muted ? "opacity-40" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${isToday(day) ? "text-electric-hi" : "text-muted"}`}
                  >
                    {view === "week"
                      ? day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
                      : day.getDate()}
                  </span>
                  <button
                    type="button"
                    aria-label={`Criar treino em ${iso}`}
                    onClick={() => setCreateDate(iso)}
                    className="rounded p-0.5 text-faint opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <PlusIcon width={14} height={14} />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  {dayCards.map((card) => {
                    const meta = modalityMeta(card.modality);
                    const dim = card.status === "CANCELLED" || card.status === "ARCHIVED";
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelected(card)}
                        style={{ borderLeftColor: meta.accent }}
                        className={`flex w-full items-center gap-1 rounded border-l-2 bg-surface px-1.5 py-1 text-left transition-colors hover:bg-surface-2 ${
                          dim ? "opacity-50" : ""
                        }`}
                        title={`${card.title} — ${card.athleteName ?? ""} · ${statusLabel(card.status)}`}
                      >
                        <span className="shrink-0" style={{ color: meta.accent }}>
                          {meta.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">
                          {card.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PrescriptionModal
        open={createDate !== null}
        onClose={() => setCreateDate(null)}
        athletes={athletes}
        exerciseOptions={exerciseOptions}
        templates={templates}
        initialDate={createDate ?? undefined}
        initialAthleteId={athleteId || undefined}
        onCreated={load}
      />

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        description={
          selected
            ? `${selected.athleteName ?? "—"} · ${modalityLabel(selected.modality)} · ${selected.plannedDate}`
            : undefined
        }
      >
        {selected && (
          <WorkoutActions
            card={selected}
            athletes={athletes}
            onDone={async () => {
              setSelected(null);
              await load();
            }}
          />
        )}
      </Modal>
    </main>
  );
}

function WorkoutActions({
  card,
  athletes,
  onDone,
}: {
  card: CalendarCard;
  athletes: AthleteOption[];
  onDone: () => void | Promise<void>;
}) {
  const [moveDate, setMoveDate] = useState(card.plannedDate);
  const [dupDate, setDupDate] = useState(card.plannedDate);
  const [dupAthlete, setDupAthlete] = useState(card.athleteId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast.success(successMessage);
      await onDone();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  }

  const isDraft = card.status === "DRAFT";
  const canMove = (card.status === "DRAFT" || card.status === "PUBLISHED") && !card.hasFeedback;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <StatusBadge status={card.status} />
      </div>

      {error && <p className={uiClasses.error}>{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Link href={`/treinador/treinos/${card.id}`} className={uiClasses.buttonSecondary}>
          Abrir detalhes
        </Link>
        {isDraft && (
          <>
            <Link
              href={`/treinador/treinos/${card.id}/editar`}
              className={uiClasses.buttonSecondary}
            >
              Editar
            </Link>
            <button
              type="button"
              className={uiClasses.button}
              disabled={busy}
              onClick={() =>
                run(
                  () => apiFetch(`/api/trainer/workouts/${card.id}/publish`, { method: "POST" }),
                  "Treino publicado.",
                )
              }
            >
              Publicar
            </button>
          </>
        )}
      </div>

      {canMove && (
        <div className="rounded-lg border border-line p-3">
          <p className={uiClasses.label}>Mover para</p>
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
                run(
                  () =>
                    apiFetch(`/api/trainer/workouts/${card.id}/move`, {
                      method: "POST",
                      body: JSON.stringify({ plannedDate: moveDate }),
                    }),
                  "Treino movido.",
                )
              }
            >
              Mover
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-line p-3">
        <p className={uiClasses.label}>Duplicar como rascunho</p>
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
                run(
                  () =>
                    apiFetch(`/api/trainer/workouts/${card.id}/duplicate`, {
                      method: "POST",
                      body: JSON.stringify({ plannedDate: dupDate, athleteId: dupAthlete }),
                    }),
                  "Treino duplicado.",
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
          className={uiClasses.buttonDanger}
          disabled={busy}
          onClick={() =>
            run(
              () => apiFetch(`/api/trainer/workouts/${card.id}/cancel`, { method: "POST" }),
              "Treino cancelado.",
            )
          }
        >
          Cancelar treino
        </button>
      )}
    </div>
  );
}
