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

// Kept intentionally short (roadmap signal, not clutter): a single, honest
// "em breve" affordance for the headline future capability. Everything the
// domain can't do yet stays out of the menu rather than filling it.
const FUTURE_ITEM = "Periodização";

function isMovable(card: CalendarCard): boolean {
  return (card.status === "DRAFT" || card.status === "PUBLISHED") && !card.hasFeedback;
}

function initials(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

function statusTone(status: string): string {
  switch (status) {
    case "PUBLISHED":
      return "text-electric-hi";
    case "COMPLETED":
      return "text-turq";
    case "PARTIAL":
    case "DRAFT":
      return "text-orange-hi";
    case "MISSED":
    case "CANCELLED":
      return "text-danger";
    default:
      return "text-faint";
  }
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

  const selectedAthlete = athletes.find((a) => a.athleteProfileId === athleteId) ?? null;

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
        {/* ── Cabeçalho do calendário ─────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-2xl border border-line bg-petrol/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl font-display text-sm font-bold"
                style={{
                  backgroundColor: selectedAthlete
                    ? `${modalityMeta(modality || "RUNNING").accent}22`
                    : "var(--color-surface)",
                  color: selectedAthlete
                    ? modalityMeta(modality || "RUNNING").accent
                    : "var(--color-muted)",
                }}
              >
                {selectedAthlete
                  ? initials(selectedAthlete.name ?? selectedAthlete.email ?? "?")
                  : "◎"}
              </span>
              <div className="flex flex-col">
                <span className={uiClasses.eyebrow}>Núcleo de prescrição</span>
                <span className="font-display text-lg font-semibold text-ink">
                  {selectedAthlete
                    ? (selectedAthlete.name ?? selectedAthlete.email)
                    : "Todos os atletas"}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                className={`${uiClasses.button} px-5 py-2.5 text-[15px]`}
                onClick={() => setCreateDate(toISODate(new Date()))}
              >
                <PlusIcon />
                Criar treino
              </button>
              <span className="text-[11px] text-faint">ou clique em um dia do calendário</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-line px-2.5 py-2 text-muted transition-colors hover:bg-surface hover:text-ink"
                onClick={() => step(-1)}
                aria-label="Anterior"
              >
                ‹
              </button>
              <h1 className="min-w-[190px] text-center font-display text-2xl font-bold capitalize tracking-tight text-ink sm:text-[28px]">
                {view === "month" ? monthLabel(anchor) : weekLabel(anchor)}
              </h1>
              <button
                type="button"
                className="rounded-lg border border-line px-2.5 py-2 text-muted transition-colors hover:bg-surface hover:text-ink"
                onClick={() => step(1)}
                aria-label="Próximo"
              >
                ›
              </button>
              <button
                type="button"
                className={`${uiClasses.buttonGhost} ml-1`}
                onClick={() => setAnchor(new Date())}
              >
                Hoje
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="tabular rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
                {summary.sessions} {summary.sessions === 1 ? "sessão" : "sessões"} na janela
              </span>
              <div className="flex overflow-hidden rounded-lg border border-line">
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-semibold transition-colors ${view === "week" ? "bg-orange text-deep" : "text-muted hover:bg-surface"}`}
                  onClick={() => setView("week")}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-semibold transition-colors ${view === "month" ? "bg-orange text-deep" : "text-muted hover:bg-surface"}`}
                  onClick={() => setView("month")}
                >
                  Mês
                </button>
              </div>
            </div>
          </div>

          {/* Filtros + toggles de rail */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              className={uiClasses.buttonGhost}
              onClick={() => setLeftOpen((v) => !v)}
            >
              {leftOpen ? "◂ Atletas" : "▸ Atletas"}
            </button>
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
            {(modality || status || athleteId) && (
              <button
                type="button"
                className={uiClasses.buttonGhost}
                onClick={() => {
                  setModality("");
                  setStatus("");
                  setAthleteId("");
                }}
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              className={`${uiClasses.buttonGhost} ml-auto`}
              onClick={() => setRightOpen((v) => !v)}
            >
              {rightOpen ? "Resumo ▸" : "◂ Resumo"}
            </button>
          </div>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* ── Rail esquerdo ──────────────────────────────────────── */}
          {leftOpen && (
            <aside className="flex flex-col gap-4 lg:w-60 lg:shrink-0">
              <div className="rounded-2xl border border-line bg-petrol/70">
                <div className="flex items-center justify-between px-4 pt-3.5">
                  <h3 className="font-display text-sm font-semibold text-ink">Atletas</h3>
                  <Link
                    href="/treinador/atletas"
                    className="text-xs text-electric-hi hover:underline"
                  >
                    gerir
                  </Link>
                </div>
                <div className="p-3">
                  <input
                    className={uiClasses.input}
                    placeholder="Buscar atleta..."
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                  />
                  <div className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setAthleteId("")}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                        athleteId === "" ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface"
                      }`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-xs">
                        ◎
                      </span>
                      Todos os atletas
                    </button>
                    {visibleAthletes.map((a) => {
                      const label = a.name ?? a.email ?? a.athleteProfileId;
                      const active = athleteId === a.athleteProfileId;
                      return (
                        <button
                          key={a.athleteProfileId}
                          type="button"
                          onClick={() => setAthleteId(a.athleteProfileId)}
                          className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                            active
                              ? "bg-surface-2 text-ink ring-1 ring-orange/40"
                              : "text-muted hover:bg-surface"
                          }`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface font-display text-[11px] font-bold text-muted">
                            {initials(label)}
                          </span>
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-petrol/70">
                <div className="flex items-center justify-between px-4 pt-3.5">
                  <h3 className="font-display text-sm font-semibold text-ink">Templates</h3>
                  <Link
                    href="/treinador/templates"
                    className="text-xs text-electric-hi hover:underline"
                  >
                    ver
                  </Link>
                </div>
                <div className="flex flex-col gap-1.5 p-3">
                  {templates.length === 0 ? (
                    <p className="text-xs text-muted">Nenhum template ainda.</p>
                  ) : (
                    templates.slice(0, 6).map((t) => {
                      const meta = modalityMeta(t.modality);
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2"
                          style={{ borderLeft: `3px solid ${meta.accent}` }}
                        >
                          <span style={{ color: meta.accent }}>{meta.icon}</span>
                          <span className="truncate text-xs text-ink">{t.title}</span>
                        </div>
                      );
                    })
                  )}
                  <p className="mt-0.5 text-[11px] text-faint">Aplique pelo menu “＋” de um dia.</p>
                </div>
              </div>
            </aside>
          )}

          {/* ── Centro — grade ─────────────────────────────────────── */}
          <section className="min-w-0 flex-1">
            {loading && <p className="mb-2 text-sm text-muted">Carregando treinos...</p>}
            <div
              className={
                view === "month"
                  ? "grid grid-cols-7 gap-1.5"
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
                    className={`group relative flex min-h-[122px] flex-col rounded-xl border p-1.5 transition-colors ${
                      isDropTarget
                        ? "border-orange bg-orange/10"
                        : isToday(day)
                          ? "border-electric bg-electric/5"
                          : "border-line hover:border-line-strong"
                    } ${muted ? "opacity-40" : ""}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${isToday(day) ? "text-electric-hi" : "text-muted"}`}
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
                        className="flex h-5 w-5 items-center justify-center rounded-md text-faint opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <PlusIcon width={14} height={14} />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5">
                      {dayCards.map((card) => (
                        <WorkoutCardMini
                          key={card.id}
                          card={card}
                          onOpen={() => setSelected(card)}
                          onDragStart={() => setDragId(card.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                        />
                      ))}
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

          {/* ── Rail direito — resumo ──────────────────────────────── */}
          {rightOpen && (
            <aside className="flex flex-col gap-4 lg:w-64 lg:shrink-0">
              <div className="rounded-2xl border border-line bg-petrol/70 p-4">
                <h3 className="mb-3 font-display text-sm font-semibold text-ink">
                  Resumo do período
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Sessões" value={String(summary.sessions)} />
                  <Metric
                    label="Duração"
                    value={`${Math.floor(summary.minutes / 60)}h${String(summary.minutes % 60).padStart(2, "0")}`}
                  />
                  <Metric label="Rascunhos" value={String(summary.drafts)} tone="text-orange-hi" />
                  <Metric label="Retornos" value={String(summary.returns)} tone="text-turq" />
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-petrol/70 p-4">
                <h3 className="mb-3 font-display text-sm font-semibold text-ink">Por modalidade</h3>
                {summary.sessions === 0 ? (
                  <p className="text-xs text-muted">Sem treinos no período.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {MODALITY_ORDER.filter((m) => summary.byModality.get(m)).map((m) => {
                      const count = summary.byModality.get(m) ?? 0;
                      const pct = Math.round((count / summary.sessions) * 100);
                      const meta = modalityMeta(m);
                      return (
                        <div key={m} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted">
                              <span style={{ color: meta.accent }}>{meta.icon}</span>
                              {meta.label}
                            </span>
                            <span className="tabular text-faint">
                              {count} · {pct}%
                            </span>
                          </div>
                          <span className="h-2 overflow-hidden rounded-full bg-surface">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: meta.accent }}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {(summary.drafts > 0 || summary.returns > 0) && (
                <div className="rounded-2xl border border-line bg-petrol/70 p-4">
                  <h3 className="mb-2 font-display text-sm font-semibold text-ink">Atenção</h3>
                  <div className="flex flex-col gap-2">
                    {summary.drafts > 0 && (
                      <div className="rounded-lg border border-orange/30 bg-orange/10 px-3 py-2 text-xs text-orange-hi">
                        {summary.drafts}{" "}
                        {summary.drafts === 1 ? "rascunho aguardando" : "rascunhos aguardando"}{" "}
                        publicação.
                      </div>
                    )}
                    {summary.returns > 0 && (
                      <div className="rounded-lg border border-turq/30 bg-turq/10 px-3 py-2 text-xs text-turq">
                        {summary.returns} {summary.returns === 1 ? "retorno" : "retornos"} de atleta
                        para revisar.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-dashed border-line px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Próximas fases
                </p>
                <p className="mt-1 text-xs text-muted">
                  Carga fisiológica, periodização e sugestões automáticas da ENKY Intelligence.
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

// Compact but structured card: modality color stripe + icon, title, and a
// second line with time · duration · status. Draft reads as a dashed outline;
// a turquesa dot marks feedback awaiting review.
function WorkoutCardMini({
  card,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  card: CalendarCard;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const meta = modalityMeta(card.modality);
  const draft = card.status === "DRAFT";
  const dim = card.status === "CANCELLED" || card.status === "ARCHIVED";
  const movable = isMovable(card);
  const time = card.plannedStartAt
    ? new Date(card.plannedStartAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const duration = card.plannedDurationMinutes ? `${card.plannedDurationMinutes}min` : null;

  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{ borderLeftColor: meta.accent }}
      className={`flex w-full flex-col gap-0.5 rounded-lg border-l-[3px] px-2 py-1.5 text-left transition-colors ${
        draft
          ? "border border-dashed border-line-strong bg-transparent"
          : "bg-surface hover:bg-surface-2"
      } ${dim ? "opacity-50" : ""} ${movable ? "cursor-grab" : ""}`}
      title={`${card.title} — ${card.athleteName ?? ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0" style={{ color: meta.accent }}>
          {meta.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{card.title}</span>
        {card.hasFeedback && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-turq" title="Feedback pendente" />
        )}
      </div>
      <div className="flex items-center gap-1.5 pl-[22px] text-[10.5px] leading-tight">
        {time && <span className="tabular text-muted">{time}</span>}
        {duration && <span className="tabular text-faint">{duration}</span>}
        <span className={`ml-auto font-medium ${statusTone(card.status)}`}>
          {statusLabel(card.status)}
        </span>
      </div>
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <div className="text-[11px] text-faint">{label}</div>
      <div className={`tabular font-display text-xl font-bold ${tone ?? "text-ink"}`}>{value}</div>
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
      <span className="menu-item cursor-not-allowed text-faint">
        {FUTURE_ITEM}
        <span className="ml-auto rounded-full border border-line px-1.5 py-px text-[10px]">
          em breve
        </span>
      </span>
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
