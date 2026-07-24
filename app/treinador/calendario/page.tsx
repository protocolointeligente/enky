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
const RECENT_KEY = "enky:calendar-recent-athletes";

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

// Métricas vivas do atleta selecionado (report-free) — /api/trainer/athletes/:id/context.
interface AthleteContext {
  athlete: { athleteProfileId: string; name: string | null; email: string | null; age: number | null };
  plan: { modality: string | null; goal: string | null; targetEvent: string | null; title: string } | null;
  metrics: {
    load: { ctl: number; atl: number; tsb: number; acwr: number | null; dataDays: number };
    weeklyLoad: number | null;
    readiness: { class: string | null; score: number | null; date: string | null };
    formulaVersion: string;
    lastUpdatedAt: string | null;
    sufficient: boolean;
  };
}

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

const READINESS_META: Record<string, { label: string; tone: string }> = {
  boa: { label: "Boa", tone: "text-turq" },
  atencao: { label: "Atenção", tone: "text-orange-hi" },
  baixa: { label: "Baixa", tone: "text-danger" },
  insuficiente: { label: "—", tone: "text-faint" },
};

export default function TrainerCalendarPage() {
  const { checked } = useRequireRole("TRAINER");
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [athleteId, setAthleteId] = useState("");
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState<"" | "with" | "without">("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [context, setContext] = useState<AthleteContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CalendarCard | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [dayMenu, setDayMenu] = useState<string | null>(null);
  const [weekMenu, setWeekMenu] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<CalendarCard | null>(null);
  const [weekClipboard, setWeekClipboard] = useState<{ mondayISO: string; cards: CalendarCard[] } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const exerciseOptions = useExerciseOptions(checked);

  const weeks = useMemo(
    () => (view === "week" ? [getWeekDays(anchor)] : getMonthMatrix(anchor)),
    [view, anchor],
  );
  const days = useMemo(() => weeks.flat(), [weeks]);
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
    setRecentIds(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
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

  // Contexto vivo do atleta selecionado. "Todos os atletas" → sem contexto.
  useEffect(() => {
    if (!checked || !athleteId) {
      setContext(null);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    apiFetch<AthleteContext>(`/api/trainer/athletes/${athleteId}/context`)
      .then((c) => !cancelled && setContext(c))
      .catch(() => !cancelled && setContext(null))
      .finally(() => !cancelled && setContextLoading(false));
    return () => {
      cancelled = true;
    };
  }, [checked, athleteId]);

  function selectAthlete(id: string) {
    setAthleteId(id);
    setSelectorOpen(false);
    setAthleteSearch("");
    if (id) {
      setRecentIds((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    }
  }

  // Filtro cliente por retorno (com/sem feedback). Modalidade/status são server-side.
  const filteredCards = useMemo(() => {
    if (!feedbackFilter) return cards;
    return cards.filter((c) => (feedbackFilter === "with" ? c.hasFeedback : !c.hasFeedback));
  }, [cards, feedbackFilter]);

  const cardsByDay = useMemo(() => {
    const map = new Map<string, CalendarCard[]>();
    for (const card of filteredCards) {
      const list = map.get(card.plannedDate) ?? [];
      list.push(card);
      map.set(card.plannedDate, list);
    }
    return map;
  }, [filteredCards]);

  const listCards = useMemo(
    () =>
      [...filteredCards].sort(
        (a, b) =>
          a.plannedDate.localeCompare(b.plannedDate) ||
          (a.plannedStartAt ?? "").localeCompare(b.plannedStartAt ?? ""),
      ),
    [filteredCards],
  );

  const summary = useMemo(() => {
    const sessions = filteredCards.length;
    const minutes = filteredCards.reduce((sum, c) => sum + (c.plannedDurationMinutes ?? 0), 0);
    const drafts = filteredCards.filter((c) => c.status === "DRAFT").length;
    const returns = filteredCards.filter(
      (c) => c.hasFeedback && REVIEW_STATUSES.includes(c.status),
    ).length;
    const byModality = new Map<string, number>();
    for (const c of filteredCards) byModality.set(c.modality, (byModality.get(c.modality) ?? 0) + 1);
    return { sessions, minutes, drafts, returns, byModality };
  }, [filteredCards]);

  const visibleAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => (a.name ?? a.email ?? "").toLowerCase().includes(q));
  }, [athletes, athleteSearch]);

  const recentAthletes = useMemo(
    () =>
      recentIds
        .map((id) => athletes.find((a) => a.athleteProfileId === id))
        .filter((a): a is AthleteOption => a != null),
    [recentIds, athletes],
  );

  const selectedAthlete = athletes.find((a) => a.athleteProfileId === athleteId) ?? null;
  const activeFilterCount = (modality ? 1 : 0) + (status ? 1 : 0) + (feedbackFilter ? 1 : 0);

  function step(direction: 1 | -1) {
    setAnchor((prev) =>
      view === "week" ? addDays(prev, direction * 7) : addMonths(prev, direction),
    );
  }

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

  // ── Operações por semana ──────────────────────────────────────────────
  // Composição sobre /duplicate (preserva o dia-da-semana via delta de data e
  // aceita athleteId alvo) e /cancel. Copiar guarda os cards; colar duplica
  // cada um deslocado o número inteiro de semanas até a semana destino, no
  // atleta selecionado no cabeçalho (ou no próprio atleta de origem).
  function weekCardsOf(week: Date[]): CalendarCard[] {
    return week.flatMap((d) => cardsByDay.get(toISODate(d)) ?? []);
  }

  function copyWeek(week: Date[]) {
    const weekCards = weekCardsOf(week);
    setWeekMenu(null);
    if (weekCards.length === 0) return toast.info("Semana sem treinos para copiar.");
    setWeekClipboard({ mondayISO: toISODate(week[0]!), cards: weekCards });
    toast.success(`${weekCards.length} treino(s) copiado(s). Cole em outra semana.`);
  }

  async function pasteWeek(week: Date[]) {
    if (!weekClipboard) return;
    setWeekMenu(null);
    const deltaDays = Math.round(
      (Date.parse(`${toISODate(week[0]!)}T00:00:00Z`) -
        Date.parse(`${weekClipboard.mondayISO}T00:00:00Z`)) /
        86400000,
    );
    let ok = 0;
    let fail = 0;
    for (const card of weekClipboard.cards) {
      try {
        await apiFetch(`/api/trainer/workouts/${card.id}/duplicate`, {
          method: "POST",
          body: JSON.stringify({
            plannedDate: shiftISO(card.plannedDate, deltaDays),
            athleteId: athleteId || card.athleteId,
          }),
        });
        ok++;
      } catch {
        fail++;
      }
    }
    if (ok) toast.success(`${ok} treino(s) colado(s) como rascunho${fail ? ` · ${fail} falhou(ram)` : ""}.`);
    else toast.error("Não foi possível colar a semana.");
    await load();
  }

  async function deleteWeek(week: Date[]) {
    const cancellable = weekCardsOf(week).filter(isMovable);
    setWeekMenu(null);
    if (cancellable.length === 0)
      return toast.info("Nenhum treino cancelável nesta semana (concluídos/com retorno são mantidos).");
    if (
      !window.confirm(
        `Cancelar ${cancellable.length} treino(s) desta semana? Treinos com retorno do atleta são mantidos.`,
      )
    )
      return;
    let ok = 0;
    let fail = 0;
    for (const card of cancellable) {
      try {
        await apiFetch(`/api/trainer/workouts/${card.id}/cancel`, { method: "POST" });
        ok++;
      } catch {
        fail++;
      }
    }
    if (ok) toast.success(`${ok} treino(s) cancelado(s)${fail ? ` · ${fail} falhou(ram)` : ""}.`);
    else toast.error("Não foi possível excluir a semana.");
    await load();
  }

  function clearFilters() {
    setModality("");
    setStatus("");
    setFeedbackFilter("");
  }

  if (!checked) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main
      className={uiClasses.page}
      onClick={() => {
        if (dayMenu) setDayMenu(null);
        if (weekMenu) setWeekMenu(null);
        if (selectorOpen) setSelectorOpen(false);
        if (filtersOpen) setFiltersOpen(false);
      }}
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        {/* ── Athlete Context Header ───────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-2xl border border-line bg-petrol/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Identidade + seletor pesquisável */}
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold"
                style={{
                  backgroundColor: selectedAthlete
                    ? `${modalityMeta(context?.plan?.modality || modality || "RUNNING").accent}22`
                    : "var(--color-surface)",
                  color: selectedAthlete
                    ? modalityMeta(context?.plan?.modality || modality || "RUNNING").accent
                    : "var(--color-muted)",
                }}
              >
                {selectedAthlete
                  ? initials(selectedAthlete.name ?? selectedAthlete.email ?? "?")
                  : "◎"}
              </span>
              <div className="flex min-w-0 flex-col">
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectorOpen((v) => !v);
                    }}
                    className="flex items-center gap-1.5 text-left"
                    aria-haspopup="listbox"
                    aria-expanded={selectorOpen}
                  >
                    <span className="truncate font-display text-lg font-semibold text-ink">
                      {selectedAthlete
                        ? (selectedAthlete.name ?? selectedAthlete.email)
                        : "Todos os atletas"}
                    </span>
                    <span className="text-faint">▾</span>
                  </button>
                  {selectorOpen && (
                    <AthleteSelector
                      search={athleteSearch}
                      onSearch={setAthleteSearch}
                      all={visibleAthletes}
                      recents={recentAthletes}
                      currentId={athleteId}
                      onSelect={selectAthlete}
                    />
                  )}
                </div>
                {/* Sub-linha: idade · modalidade · objetivo/prova */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  {selectedAthlete ? (
                    <>
                      {context?.athlete.age != null && <span>{context.athlete.age} anos</span>}
                      {context?.plan?.modality && (
                        <span className="text-faint">· {modalityLabel(context.plan.modality)}</span>
                      )}
                      {(context?.plan?.targetEvent || context?.plan?.goal) && (
                        <span className="text-faint">
                          · {context.plan.targetEvent ?? context.plan.goal}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-faint">Selecione um atleta para ver as métricas</span>
                  )}
                </div>
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

          {/* Faixa de métricas vivas */}
          {selectedAthlete && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label="CTL" value={fmtNum(context?.metrics.load.ctl)} loading={contextLoading} />
                <MetricChip label="ATL" value={fmtNum(context?.metrics.load.atl)} loading={contextLoading} />
                <MetricChip label="TSB" value={fmtNum(context?.metrics.load.tsb)} loading={contextLoading} />
                <MetricChip
                  label="Carga semanal"
                  value={context?.metrics.weeklyLoad != null ? String(context.metrics.weeklyLoad) : "—"}
                  loading={contextLoading}
                />
                <MetricChip
                  label="Prontidão"
                  value={READINESS_META[context?.metrics.readiness.class ?? "insuficiente"]?.label ?? "—"}
                  tone={READINESS_META[context?.metrics.readiness.class ?? "insuficiente"]?.tone}
                  loading={contextLoading}
                />
              </div>
              {context && (
                <p className="text-[11px] text-faint">
                  {context.metrics.sufficient
                    ? "Carga sRPE"
                    : "Histórico insuficiente para leitura de carga confiável"}
                  {" · fórmula v"}
                  {context.metrics.formulaVersion}
                  {context.metrics.lastUpdatedAt
                    ? ` · atualizado ${context.metrics.lastUpdatedAt}`
                    : " · sem dados recentes"}
                  {" · "}
                  <Link
                    href={`/treinador/atletas/${athleteId}`}
                    className="text-electric-hi hover:underline"
                  >
                    abrir 360º
                  </Link>
                </p>
              )}
            </div>
          )}
        </header>

        {/* ── Barra de ferramentas: navegação + view + filtros ─────── */}
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
            <h1 className="min-w-[180px] text-center font-display text-xl font-bold capitalize tracking-tight text-ink sm:text-2xl">
              {view === "week" ? weekLabel(anchor) : monthLabel(anchor)}
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
              {summary.sessions} {summary.sessions === 1 ? "sessão" : "sessões"}
            </span>

            {/* Filtros compactos em popover */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFiltersOpen((v) => !v);
                }}
                className={`${uiClasses.buttonGhost} ${activeFilterCount > 0 ? "text-electric-hi" : ""}`}
                aria-expanded={filtersOpen}
              >
                Filtros{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </button>
              {filtersOpen && (
                <FiltersPopover
                  modality={modality}
                  status={status}
                  feedbackFilter={feedbackFilter}
                  onModality={setModality}
                  onStatus={setStatus}
                  onFeedback={setFeedbackFilter}
                  onClear={clearFilters}
                />
              )}
            </div>

            <div className="flex overflow-hidden rounded-lg border border-line">
              {(["week", "month", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    view === v ? "bg-orange text-onbrand" : "text-muted hover:bg-surface"
                  }`}
                  onClick={() => setView(v)}
                >
                  {v === "week" ? "Semana" : v === "month" ? "Mês" : "Lista"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}
        {loading && <p className="text-sm text-muted">Carregando treinos...</p>}

        {/* ── Calendário — área máxima, largura total ──────────────── */}
        {view === "list" ? (
          <ListView cards={listCards} onOpen={setSelected} />
        ) : (
          <section className="min-w-0 flex flex-col gap-1.5">
            {view === "month" && (
              <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_2rem] gap-1.5">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-faint"
                  >
                    {label}
                  </div>
                ))}
                <div />
              </div>
            )}
            {weeks.map((week) => {
              const weekKey = toISODate(week[0]!);
              const gridCols =
                view === "month"
                  ? "grid grid-cols-[repeat(7,minmax(0,1fr))_2rem] gap-1.5"
                  : "grid grid-cols-1 gap-2 sm:grid-cols-[repeat(7,minmax(0,1fr))_2rem]";
              return (
                <div key={weekKey} className={gridCols}>
                  {week.map((day) => {
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
                        className={`group relative flex ${
                          view === "week" ? "min-h-[180px]" : "min-h-[130px]"
                        } flex-col rounded-xl border p-1.5 transition-colors ${
                          isDropTarget
                            ? "border-orange bg-orange/10"
                            : isToday(day)
                              ? "border-electric bg-electric-lo"
                              : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
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

                  {/* Ícone lateral — ações da semana inteira */}
                  <div className="relative flex items-start justify-center pt-1">
                    <button
                      type="button"
                      aria-label={`Ações da semana de ${weekKey}`}
                      aria-haspopup="menu"
                      aria-expanded={weekMenu === weekKey}
                      onClick={(e) => {
                        e.stopPropagation();
                        setWeekMenu(weekMenu === weekKey ? null : weekKey);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-surface hover:text-ink ${
                        weekMenu === weekKey ? "bg-surface text-ink" : ""
                      }`}
                    >
                      ⋮
                    </button>
                    {weekMenu === weekKey && (
                      <WeekMenu
                        hasClipboard={weekClipboard !== null}
                        onCopy={() => copyWeek(week)}
                        onPaste={() => void pasteWeek(week)}
                        onDelete={() => void deleteWeek(week)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── Resumo do período — recolhível, abaixo do calendário ── */}
        <section className="rounded-2xl border border-line bg-petrol/70">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            aria-expanded={summaryOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <h3 className="font-display text-sm font-semibold text-ink">Resumo do período</h3>
            <span className="text-faint">{summaryOpen ? "▾" : "▸"}</span>
          </button>
          {summaryOpen && (
            <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Sessões" value={String(summary.sessions)} />
                <Metric
                  label="Duração"
                  value={`${Math.floor(summary.minutes / 60)}h${String(summary.minutes % 60).padStart(2, "0")}`}
                />
                <Metric label="Rascunhos" value={String(summary.drafts)} tone="text-orange-hi" />
                <Metric label="Retornos" value={String(summary.returns)} tone="text-turq" />
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                  Por modalidade
                </h4>
                {summary.sessions === 0 ? (
                  <p className="text-xs text-muted">Sem treinos no período.</p>
                ) : (
                  <div className="flex flex-col gap-2">
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

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Atenção</h4>
                {summary.drafts === 0 && summary.returns === 0 ? (
                  <p className="text-xs text-muted">Nada aguardando.</p>
                ) : (
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
                        {summary.returns} {summary.returns === 1 ? "retorno" : "retornos"} para
                        revisar.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
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

function fmtNum(n: number | undefined): string {
  return n == null ? "—" : Math.round(n).toString();
}

// Desloca uma data yyyy-mm-dd por N dias inteiros em UTC — sem drift de DST.
function shiftISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Seletor de atleta pesquisável: busca, recentes, todos. Troca sem navegação.
function AthleteSelector({
  search,
  onSearch,
  all,
  recents,
  currentId,
  onSelect,
}: {
  search: string;
  onSearch: (v: string) => void;
  all: AthleteOption[];
  recents: AthleteOption[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const row = (a: AthleteOption) => {
    const label = a.name ?? a.email ?? a.athleteProfileId;
    const active = currentId === a.athleteProfileId;
    return (
      <button
        key={a.athleteProfileId}
        type="button"
        role="option"
        aria-selected={active}
        onClick={() => onSelect(a.athleteProfileId)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
          active ? "bg-surface-2 text-ink ring-1 ring-orange/40" : "text-muted hover:bg-surface"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface font-display text-[11px] font-bold text-muted">
          {initials(label)}
        </span>
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div
      role="listbox"
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-line-strong bg-petrol p-2 shadow-2xl shadow-black/50"
    >
      <input
        autoFocus
        className={uiClasses.input}
        placeholder="Buscar atleta..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
        <button
          type="button"
          role="option"
          aria-selected={currentId === ""}
          onClick={() => onSelect("")}
          className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
            currentId === "" ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface"
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-xs">◎</span>
          Todos os atletas
        </button>
        {!search && recents.length > 0 && (
          <>
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              Recentes
            </p>
            {recents.map(row)}
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              Todos
            </p>
          </>
        )}
        {all.map(row)}
        {all.length === 0 && <p className="px-2 py-3 text-xs text-muted">Nenhum atleta encontrado.</p>}
      </div>
    </div>
  );
}

function FiltersPopover({
  modality,
  status,
  feedbackFilter,
  onModality,
  onStatus,
  onFeedback,
  onClear,
}: {
  modality: string;
  status: string;
  feedbackFilter: "" | "with" | "without";
  onModality: (v: string) => void;
  onStatus: (v: string) => void;
  onFeedback: (v: "" | "with" | "without") => void;
  onClear: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-9 z-30 flex w-64 flex-col gap-3 rounded-xl border border-line-strong bg-petrol p-3 shadow-2xl shadow-black/50"
    >
      <div>
        <label className={uiClasses.label}>Modalidade</label>
        <select className={uiClasses.select} value={modality} onChange={(e) => onModality(e.target.value)}>
          <option value="">Todas</option>
          {MODALITY_ORDER.map((m) => (
            <option key={m} value={m}>
              {modalityLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={uiClasses.label}>Status</label>
        <select className={uiClasses.select} value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="">Todos</option>
          {FILTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={uiClasses.label}>Feedback</label>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(
            [
              ["", "Todos"],
              ["with", "Com"],
              ["without", "Sem"],
            ] as const
          ).map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => onFeedback(val)}
              className={`flex-1 px-2 py-1.5 text-xs font-semibold transition-colors ${
                feedbackFilter === val ? "bg-orange text-onbrand" : "text-muted hover:bg-surface"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={uiClasses.buttonGhost} onClick={onClear}>
        Limpar filtros
      </button>
      <p className="text-[10px] text-faint">Grupos e treinador chegam quando o domínio existir.</p>
    </div>
  );
}

// Vista em LISTA — cronológica, mesma ação de abrir/cores/status dos cards.
function ListView({
  cards,
  onOpen,
}: {
  cards: CalendarCard[];
  onOpen: (card: CalendarCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <div className={`${uiClasses.card} text-sm text-muted`}>Nenhum treino no período.</div>
    );
  }
  const byDay = new Map<string, CalendarCard[]>();
  for (const c of cards) {
    const list = byDay.get(c.plannedDate) ?? [];
    list.push(c);
    byDay.set(c.plannedDate, list);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...byDay.entries()].map(([date, dayCards]) => (
        <div key={date} className="rounded-2xl border border-line bg-petrol/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            {new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "short",
            })}
          </p>
          <div className="flex flex-col gap-1.5">
            {dayCards.map((card) => {
              const meta = modalityMeta(card.modality);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onOpen(card)}
                  style={{ borderLeftColor: meta.accent }}
                  className="flex items-center gap-2.5 rounded-lg border-l-[3px] bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span style={{ color: meta.accent }}>{meta.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {card.title}
                  </span>
                  <span className="truncate text-xs text-muted">{card.athleteName ?? "—"}</span>
                  {card.hasFeedback && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-turq" title="Feedback pendente" />
                  )}
                  <span className={`shrink-0 text-xs font-medium ${statusTone(card.status)}`}>
                    {statusLabel(card.status)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricChip({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-[84px] flex-col rounded-lg border border-line bg-surface px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <span className={`tabular font-display text-lg font-bold ${tone ?? "text-ink"}`}>
        {loading ? "…" : value}
      </span>
    </div>
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
      className={`flex w-full flex-col gap-0.5 overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5 text-left transition-colors ${
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
      <div className="flex flex-wrap items-center gap-x-1.5 pl-[22px] text-[10.5px] leading-tight">
        {time && <span className="tabular shrink-0 text-muted">{time}</span>}
        {duration && <span className="tabular shrink-0 text-faint">{duration}</span>}
        <span className={`ml-auto min-w-0 truncate font-medium ${statusTone(card.status)}`}>
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

function WeekMenu({
  hasClipboard,
  onCopy,
  onPaste,
  onDelete,
}: {
  hasClipboard: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-line-strong bg-petrol p-1.5 shadow-2xl shadow-black/50"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-faint">Semana</p>
      <button type="button" className="menu-item" onClick={onCopy}>
        ⧉ Copiar semana
      </button>
      {hasClipboard && (
        <button type="button" className="menu-item" onClick={onPaste}>
          ▣ Colar semana
        </button>
      )}
      <div className="my-1 border-t border-line" />
      <button type="button" className="menu-item text-danger" onClick={onDelete}>
        ✕ Excluir semana
      </button>
      <style>{`.menu-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--color-ink);padding:7px 8px;border-radius:8px;font-size:13px;text-align:left;cursor:pointer}.menu-item:hover{background:var(--color-surface)}.menu-item.text-danger{color:var(--color-danger)}`}</style>
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
