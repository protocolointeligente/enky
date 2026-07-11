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
const REVIEW_STATUSES = ["COMPLETED", "PARTIAL", "MISSED"];

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

const FUTURE_ITEMS = [
  "Adicionar evento",
  "Adicionar prova",
  "Adicionar descanso",
  "Adicionar nota",
  "Periodização",
];

function isMovable(card: CalendarCard): boolean {
  return (card.status === "DRAFT" || card.status === "PUBLISHED") && !card.hasFeedback;
}

export default function TrainerCalendarPage() {
  const { checked } = useRequireRole("TRAINER");
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [athleteId, setAthleteId] = useState("");
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CalendarCard | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [dayMenu, setDayMenu] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<CalendarCard | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
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

  const summary = useMemo(() => {
    const sessions = cards.length;
    const minutes = cards.reduce((sum, c) => sum + (c.plannedDurationMinutes ?? 0), 0);
    const drafts = cards.filter((c) => c.status === "DRAFT").length;
    const returns = cards.filter((c) => c.hasFeedback && REVIEW_STATUSES.includes(c.status)).length;
    const byModality = new Map<string, number>();
    for (const c of cards) byModality.set(c.modality, (byModality.get(c.modality) ?? 0) + 1);
    return { sessions, minutes, drafts, returns, byModality };
  }, [cards]);

  const visibleAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => (a.name ?? a.email ?? "").toLowerCase().includes(q));
  }, [athletes, athleteSearch]);

  function step(direction: 1 | -1) {
    setAnchor((prev) =>
      view === "month" ? addMonths(prev, direction) : addDays(prev, direction * 7),
    );
  }

  // Optimistic move: shift the card locally, persist, roll back (reload) on error.
  async function moveTo(card: CalendarCard, plannedDate: string) {
    if (plannedDate === card.plannedDate) return;
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, plannedDate } : c)));
    try {
      await apiFetch(`/api/trainer/workouts/${card.id}/move`, {
        method: "POST",
        body: JSON.stringify({ plannedDate }),
      });
      toast.success("Treino movido.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Não foi possível mover.");
      await load();
    }
  }

  async function pasteInto(iso: string) {
    if (!clipboard) return;
    try {
      await apiFetch(`/api/trainer/workouts/${clipboard.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ plannedDate: iso, athleteId: clipboard.athleteId }),
      });
      toast.success("Treino colado como rascunho.");
      setDayMenu(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Não foi possível colar.");
    }
  }

  if (!checked) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page} onClick={() => dayMenu && setDayMenu(null)}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 flex flex-col gap-0.5">
            <span className={uiClasses.eyebrow}>Núcleo de prescrição</span>
            <h1 className={uiClasses.heading}>Calendário</h1>
          </div>
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
          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                className={view === "week" ? uiClasses.button : uiClasses.buttonSecondary}
                onClick={() => setView("week")}
              >
                Semana
              </button>
              <button
                type="button"
                className={view === "month" ? uiClasses.button : uiClasses.buttonSecondary}
                onClick={() => setView("month")}
              >
                Mês
              </button>
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
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={uiClasses.buttonGhost}
            onClick={() => setLeftOpen((v) => !v)}
            aria-label="Alternar painel de atletas"
          >
            {leftOpen ? "◂ Atletas" : "▸ Atletas"}
          </button>
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
          <button
            type="button"
            className={`${uiClasses.buttonGhost} ml-auto`}
            onClick={() => setRightOpen((v) => !v)}
          >
            {rightOpen ? "Resumo ▸" : "◂ Resumo"}
          </button>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Rail esquerdo */}
          {leftOpen && (
            <aside className="flex flex-col gap-4 lg:w-56 lg:shrink-0">
              <div className={uiClasses.panel}>
                <div className="border-b border-line px-4 py-3">
                  <h3 className={uiClasses.eyebrow}>Atletas</h3>
                </div>
                <div className="p-3">
                  <input
                    className={uiClasses.input}
                    placeholder="Buscar atleta..."
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                  />
                  <div className="mt-2 flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setAthleteId("")}
                      className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        athleteId === "" ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface"
                      }`}
                    >
                      Todos os atletas
                    </button>
                    {visibleAthletes.map((a) => (
                      <button
                        key={a.athleteProfileId}
                        type="button"
                        onClick={() => setAthleteId(a.athleteProfileId)}
                        className={`truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                          athleteId === a.athleteProfileId
                            ? "bg-surface-2 text-ink"
                            : "text-muted hover:bg-surface"
                        }`}
                      >
                        {a.name ?? a.email ?? a.athleteProfileId}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={uiClasses.panel}>
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h3 className={uiClasses.eyebrow}>Templates</h3>
                  <Link
                    href="/treinador/templates"
                    className="text-xs text-electric-hi hover:underline"
                  >
                    ver
                  </Link>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  {templates.length === 0 ? (
                    <p className="text-xs text-muted">Nenhum template ainda.</p>
                  ) : (
                    templates.slice(0, 6).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs text-muted"
                      >
                        <span style={{ color: modalityMeta(t.modality).accent }}>
                          {modalityMeta(t.modality).icon}
                        </span>
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))
                  )}
                  <p className="mt-1 text-[11px] text-faint">
                    Aplique um template pelo menu “＋” de um dia.
                  </p>
                </div>
              </div>
            </aside>
          )}

          {/* Centro — grade */}
          <section className="min-w-0 flex-1">
            {loading && <p className="mb-2 text-sm text-muted">Carregando treinos...</p>}
            <div
              className={
                view === "month"
                  ? "grid grid-cols-7 gap-1"
                  : "grid grid-cols-1 gap-2 sm:grid-cols-7"
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
                const isDropTarget = dragOver === iso;
                return (
                  <div
                    key={iso}
                    onDragOver={(e) => {
                      if (dragId) {
                        e.preventDefault();
                        setDragOver(iso);
                      }
                    }}
                    onDragLeave={() => setDragOver((v) => (v === iso ? null : v))}
                    onDrop={() => {
                      const card = cards.find((c) => c.id === dragId);
                      setDragOver(null);
                      setDragId(null);
                      if (card) void moveTo(card, iso);
                    }}
                    className={`group relative flex min-h-[108px] flex-col rounded-lg border p-1.5 transition-colors ${
                      isDropTarget
                        ? "border-orange bg-orange/10"
                        : isToday(day)
                          ? "border-electric bg-electric/5"
                          : "border-line"
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
                        aria-label={`Ações em ${iso}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDayMenu(dayMenu === iso ? null : iso);
                        }}
                        className="rounded p-0.5 text-faint opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <PlusIcon width={14} height={14} />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col gap-1">
                      {dayCards.map((card) => {
                        const meta = modalityMeta(card.modality);
                        const draft = card.status === "DRAFT";
                        const dim = card.status === "CANCELLED" || card.status === "ARCHIVED";
                        const movable = isMovable(card);
                        return (
                          <button
                            key={card.id}
                            type="button"
                            draggable={movable}
                            onDragStart={() => setDragId(card.id)}
                            onDragEnd={() => {
                              setDragId(null);
                              setDragOver(null);
                            }}
                            onClick={() => setSelected(card)}
                            style={{ borderLeftColor: meta.accent }}
                            className={`flex w-full items-center gap-1 rounded border-l-2 px-1.5 py-1 text-left transition-colors ${
                              draft
                                ? "border border-dashed border-line-strong bg-transparent"
                                : "bg-surface hover:bg-surface-2"
                            } ${dim ? "opacity-50" : ""} ${movable ? "cursor-grab" : ""}`}
                            title={`${card.title} — ${card.athleteName ?? ""} · ${statusLabel(card.status)}`}
                          >
                            <span className="shrink-0" style={{ color: meta.accent }}>
                              {meta.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-ink">
                              {card.title}
                            </span>
                            {card.hasFeedback && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-turq" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {dayMenu === iso && (
                      <DayMenu
                        iso={iso}
                        hasClipboard={clipboard !== null}
                        onCreate={() => {
                          setCreateDate(iso);
                          setDayMenu(null);
                        }}
                        onPaste={() => void pasteInto(iso)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Rail direito — resumo */}
          {rightOpen && (
            <aside className="flex flex-col gap-4 lg:w-64 lg:shrink-0">
              <div className={uiClasses.panel}>
                <div className="border-b border-line px-4 py-3">
                  <h3 className={uiClasses.subheading}>Resumo do período</h3>
                </div>
                <div className="flex flex-col gap-1.5 p-4 text-sm">
                  <SumRow k="Sessões" v={String(summary.sessions)} />
                  <SumRow
                    k="Duração planejada"
                    v={`${Math.round(summary.minutes / 60)}h${String(summary.minutes % 60).padStart(2, "0")}`}
                  />
                  <SumRow k="Rascunhos" v={String(summary.drafts)} tone="text-orange-hi" />
                  <SumRow k="Retornos a revisar" v={String(summary.returns)} tone="text-turq" />
                </div>
              </div>

              <div className={uiClasses.panel}>
                <div className="border-b border-line px-4 py-3">
                  <h3 className={uiClasses.eyebrow}>Distribuição por modalidade</h3>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  {summary.sessions === 0 ? (
                    <p className="text-xs text-muted">Sem treinos no período.</p>
                  ) : (
                    MODALITY_ORDER.filter((m) => summary.byModality.get(m)).map((m) => {
                      const count = summary.byModality.get(m) ?? 0;
                      const pct = Math.round((count / summary.sessions) * 100);
                      const meta = modalityMeta(m);
                      return (
                        <div
                          key={m}
                          className="grid grid-cols-[80px_1fr_24px] items-center gap-2 text-xs text-muted"
                        >
                          <span className="truncate">{meta.label}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-surface">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: meta.accent }}
                            />
                          </span>
                          <span className="tabular text-right">{count}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className={uiClasses.panel}>
                <div className="border-b border-line px-4 py-3">
                  <h3 className={uiClasses.eyebrow}>Periodização & Intelligence</h3>
                </div>
                <p className="p-4 text-xs text-faint">
                  Geração automática de sessões e alertas por dados de treino chegam em uma fase
                  futura.
                </p>
              </div>
            </aside>
          )}
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
            onCopy={() => {
              setClipboard(selected);
              setSelected(null);
              toast.info("Treino copiado. Use “＋ › Colar treino” em um dia.");
            }}
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

function SumRow({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{k}</span>
      <span className={`tabular font-display font-bold ${tone ?? "text-ink"}`}>{v}</span>
    </div>
  );
}

function DayMenu({
  iso,
  hasClipboard,
  onCreate,
  onPaste,
}: {
  iso: string;
  hasClipboard: boolean;
  onCreate: () => void;
  onPaste: () => void;
}) {
  return (
    <div
      className="absolute left-1 top-7 z-20 w-52 rounded-xl border border-line-strong bg-petrol p-1.5 shadow-2xl shadow-black/50"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-faint">{iso}</p>
      <button type="button" className="menu-item" onClick={onCreate}>
        <PlusIcon width={15} height={15} /> Criar treino
      </button>
      <button type="button" className="menu-item" onClick={onCreate}>
        ▤ Aplicar template
      </button>
      {hasClipboard && (
        <button type="button" className="menu-item" onClick={onPaste}>
          ⧉ Colar treino
        </button>
      )}
      <div className="my-1 border-t border-line" />
      {FUTURE_ITEMS.map((label) => (
        <span key={label} className="menu-item cursor-not-allowed text-faint">
          {label}
          <span className="ml-auto rounded-full border border-line px-1.5 py-px text-[10px]">
            em breve
          </span>
        </span>
      ))}
      <style>{`.menu-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--color-ink);padding:7px 8px;border-radius:8px;font-size:13px;text-align:left;cursor:pointer}.menu-item:hover{background:var(--color-surface)}`}</style>
    </div>
  );
}

function WorkoutActions({
  card,
  athletes,
  onCopy,
  onDone,
}: {
  card: CalendarCard;
  athletes: AthleteOption[];
  onCopy: () => void;
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
  const canMove = isMovable(card);

  return (
    <div className="flex flex-col gap-3">
      <StatusBadge status={card.status} />
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
        <button type="button" className={uiClasses.buttonGhost} onClick={onCopy}>
          Copiar
        </button>
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={uiClasses.buttonGhost}
          disabled={busy}
          onClick={() =>
            run(
              () => apiFetch(`/api/trainer/workouts/${card.id}/archive`, { method: "POST" }),
              "Treino arquivado.",
            )
          }
        >
          Arquivar
        </button>
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
    </div>
  );
}
