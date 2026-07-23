"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { addDays, toISODate } from "@/app/_lib/calendar";
import { modalityLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { AlertCard, type AlertSeverity } from "@/components/ui/alert-card";
import { type InsightCardInsight } from "@/components/insight-card";

import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  DumbbellIcon,
  LayersIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/ui/icons";

interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "REVOKED" | "ENDED";
}

interface AgendaCard {
  id: string;
  athleteName: string | null;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  plannedStartAt: string | null;
}

interface WorkoutItem {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  feedback: { id: string } | null;
}

const REVIEW_STATUSES = ["COMPLETED", "PARTIAL", "MISSED"];

// Mapeia insights da ENKY Intelligence para severidade do AlertCard
function insightToSeverity(insight: InsightCardInsight): AlertSeverity {
  if (insight.risk === "urgente") return "high";
  if (insight.risk === "revisar") return "mid";
  return "low";
}

function formatDay(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Hoje";
  if (iso === toISODate(addDays(new Date(`${todayIso}T00:00:00`), 1))) return "Amanhã";
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function formatTime(startAt: string | null): string | null {
  if (!startAt) return null;
  return new Date(startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Cor de modalidade para badge
const MODALITY_COLORS: Record<string, string> = {
  RUNNING:    "bg-orange-lo text-orange-hi",
  CYCLING:    "bg-electric-lo text-electric-hi",
  SWIMMING:   "bg-turq-lo text-turq",
  STRENGTH:   "bg-surface-2 text-muted",
  TRIATHLON:  "bg-electric-lo text-electric-hi",
  HIKING:     "bg-turq-lo text-turq",
  OTHER:      "bg-surface text-muted",
};

function ModalityBadge({ modality }: { modality: string }) {
  const cls = MODALITY_COLORS[modality] ?? "bg-surface text-muted";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {modalityLabel(modality)}
    </span>
  );
}

export default function TrainerDashboardPage() {
  const { user, checked } = useRequireRole("TRAINER");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [agenda, setAgenda] = useState<AgendaCard[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [insights, setInsights] = useState<InsightCardInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayIso = useMemo(() => toISODate(new Date()), []);
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  useEffect(() => {
    if (!checked) return;
    const to = toISODate(addDays(new Date(), 30));
    Promise.all([
      apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster"),
      apiFetch<{ workouts: AgendaCard[] }>(`/api/trainer/calendar?from=${todayIso}&to=${to}`),
      apiFetch<{ workouts: WorkoutItem[] }>("/api/trainer/workouts"),
    ])
      .then(([rosterResult, calendarResult, workoutsResult]) => {
        setRoster(rosterResult.athletes);
        setAgenda(calendarResult.workouts);
        setWorkouts(workoutsResult.workouts);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));

    // ENKY Intelligence — nunca quebra o painel
    apiFetch<{ insights: InsightCardInsight[] }>("/api/trainer/intelligence/attention")
      .then((r) => setInsights(r.insights))
      .catch(() => undefined);
  }, [checked, todayIso]);

  const activeAthletes  = roster.filter((e) => e.status === "ACTIVE").length;
  const pendingInvites  = roster.filter((e) => e.status === "PENDING").length;
  const todayWorkouts   = agenda.filter((c) => c.plannedDate === todayIso);
  const drafts          = workouts.filter((w) => w.status === "DRAFT");
  const reviewPending   = workouts.filter((w) => w.feedback && REVIEW_STATUSES.includes(w.status));
  const upcoming        = [...agenda]
    .sort((a, b) =>
      a.plannedDate === b.plannedDate
        ? (a.plannedStartAt ?? "").localeCompare(b.plannedStartAt ?? "")
        : a.plannedDate.localeCompare(b.plannedDate),
    )
    .slice(0, 8);

  const hasPendencies = drafts.length > 0 || reviewPending.length > 0 || pendingInvites > 0;

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <div className={uiClasses.wide}>
          <div className="flex flex-col gap-4">
            {/* Skeleton KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-kpi-bg" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className={uiClasses.eyebrow}>Centro de decisão</span>
            <h1 className="font-display text-2xl font-bold text-ink">
              Olá, <span className="text-orange-hi">{user?.name?.split(" ")[0] ?? "treinador"}</span>
            </h1>
            <p className="text-sm capitalize text-muted">{todayLabel}</p>
          </div>
          <Link href="/treinador/treinos/novo" className={uiClasses.button}>
            <PlusIcon />
            Criar treino
          </Link>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {/* ── KPI GRID ────────────────────────────────────────────────── */}
        <section
          className="grid grid-cols-2 gap-3 lg:grid-cols-5"
          aria-label="Indicadores do painel"
        >
          <StatCard
            label="Atletas ativos"
            value={activeAthletes}
            icon={<UsersIcon />}
            tone="default"
            href="/treinador/atletas"
            hint={pendingInvites > 0 ? `${pendingInvites} convite${pendingInvites > 1 ? "s" : ""} pendente${pendingInvites > 1 ? "s" : ""}` : undefined}
          />
          <StatCard
            label="Treinos hoje"
            value={todayWorkouts.length}
            icon={<CalendarIcon />}
            tone="electric"
            href="/treinador/calendario"
          />
          <StatCard
            label="Rascunhos"
            value={drafts.length}
            icon={<LayersIcon />}
            tone={drafts.length > 0 ? "orange" : "default"}
            hint={drafts.length > 0 ? "Aguardando publicação" : "Nenhum em aberto"}
          />
          <StatCard
            label="Retornos para revisar"
            value={reviewPending.length}
            icon={<CheckIcon />}
            tone={reviewPending.length > 0 ? "turq" : "default"}
          />
          <StatCard
            label="Convites pendentes"
            value={pendingInvites}
            icon={<UsersIcon />}
            tone={pendingInvites > 0 ? "warning" : "default"}
            href="/treinador/atletas"
          />
        </section>

        {/* ── ENKY INTELLIGENCE ALERTS ───────────────────────────────── */}
        {insights.length > 0 && (
          <section aria-label="Alertas ENKY Intelligence">
            <div className={uiClasses.sectionHeader}>
              <div className="flex items-center gap-2">
                <h2 className={uiClasses.subheading}>Atenção da carteira</h2>
                <span className="rounded-full bg-danger-lo px-2 py-0.5 text-[11px] font-bold text-danger">
                  {insights.length}
                </span>
              </div>
              <span className="text-[11px] text-faint">ENKY Intelligence</span>
            </div>
            <div className="flex flex-col gap-2">
              {insights.map((insight) => (
                <AlertCard
                  key={`${insight.athleteId}-${insight.engine}`}
                  athleteName={insight.athleteName ?? "Atleta"}
                  alertType={insight.observacao}
                  signal={insight.engine}
                  severity={insightToSeverity(insight)}
                  href={`/treinador/atletas/${insight.athleteId}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── GRID: PRÓXIMOS TREINOS + PENDÊNCIAS ─────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Próximos treinos — 2/3 */}
          <section className={`${uiClasses.panel} lg:col-span-2`} aria-label="Próximos treinos">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className={uiClasses.subheading}>Próximos treinos</h2>
              <Link href="/treinador/calendario" className={uiClasses.link}>
                Ver calendário
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Nenhum treino programado"
                  description="Você não tem treinos nos próximos 30 dias."
                  icon={<CalendarIcon width={28} height={28} />}
                  action={{ label: "Criar primeiro treino", href: "/treinador/treinos/novo" }}
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((card) => {
                  const time = formatTime(card.plannedStartAt);
                  const dayLabel = formatDay(card.plannedDate, todayIso);
                  const isToday = card.plannedDate === todayIso;
                  return (
                    <li key={card.id}>
                      <Link
                        href={`/treinador/treinos/${card.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface"
                      >
                        {/* Data */}
                        <div className="flex w-16 shrink-0 flex-col">
                          <span className={`text-xs font-bold capitalize ${isToday ? "text-orange-hi" : "text-ink"}`}>
                            {dayLabel}
                          </span>
                          {time && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted">
                              <ClockIcon width={11} height={11} />
                              {time}
                            </span>
                          )}
                        </div>

                        {/* Avatar atleta */}
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted uppercase select-none">
                          {(card.athleteName ?? "A").slice(0, 2)}
                        </span>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{card.title}</p>
                          <p className="truncate text-xs text-muted">
                            {card.athleteName ?? "Atleta"}
                          </p>
                        </div>

                        {/* Modalidade + status */}
                        <div className="flex shrink-0 items-center gap-2">
                          <ModalityBadge modality={card.modality} />
                          <StatusBadge status={card.status} />
                        </div>
                        <ChevronRightIcon className="shrink-0 text-faint" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pendências — 1/3 */}
          <section className={uiClasses.panel} aria-label="Pendências">
            <div className="border-b border-line px-5 py-4">
              <h2 className={uiClasses.subheading}>Pendências</h2>
            </div>

            {!hasPendencies ? (
              <div className="p-6">
                <EmptyState
                  title="Tudo em dia"
                  description="Sem rascunhos, retornos ou convites pendentes."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {drafts.length > 0 && (
                  <PendencyRow
                    label="Rascunhos"
                    count={drafts.length}
                    hint="Treinos ainda não publicados"
                    href="/treinador/calendario"
                    tone="orange"
                  />
                )}
                {reviewPending.length > 0 && (
                  <PendencyRow
                    label="Retornos para revisar"
                    count={reviewPending.length}
                    hint="Atletas já enviaram feedback"
                    href="/treinador/calendario"
                    tone="turq"
                  />
                )}
                {pendingInvites > 0 && (
                  <PendencyRow
                    label="Convites pendentes"
                    count={pendingInvites}
                    hint="Aguardando ativação do atleta"
                    href="/treinador/atletas"
                    tone="warning"
                  />
                )}
              </div>
            )}

            {/* Atalhos rápidos */}
            <div className="border-t border-line px-5 py-4">
              <p className={`${uiClasses.eyebrow} mb-3`}>Acesso rápido</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: "/treinador/atletas",     label: "Atletas",       icon: <UsersIcon width={15} height={15} /> },
                  { href: "/treinador/templates",   label: "Templates",     icon: <LayersIcon width={15} height={15} /> },
                  { href: "/treinador/periodizacao",label: "Periodização",  icon: <CalendarIcon width={15} height={15} /> },
                  { href: "/treinador/relatorios",  label: "Relatórios",    icon: <CopyIcon width={15} height={15} /> },
                ].map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
                  >
                    <span className="text-faint">{s.icon}</span>
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function PendencyRow({
  label,
  count,
  hint,
  href,
  tone = "orange",
}: {
  label: string;
  count: number;
  hint: string;
  href: string;
  tone?: "orange" | "turq" | "warning";
}) {
  const toneClass = {
    orange:  "bg-orange-lo text-orange-hi",
    turq:    "bg-turq-lo text-turq",
    warning: "bg-warning-lo text-warning",
  }[tone];

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface"
    >
      <span className={`tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${toneClass}`}>
        {count}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
      <ChevronRightIcon className="shrink-0 text-faint" />
    </Link>
  );
}
