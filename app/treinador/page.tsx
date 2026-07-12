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
import { InsightCard, type InsightCardInsight } from "@/components/insight-card";
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

const SHORTCUTS = [
  { href: "/treinador/calendario", label: "Calendário", icon: <CalendarIcon /> },
  { href: "/treinador/atletas", label: "Atletas", icon: <UsersIcon /> },
  { href: "/treinador/exercicios", label: "Exercícios", icon: <DumbbellIcon /> },
  { href: "/treinador/templates", label: "Templates", icon: <LayersIcon /> },
  { href: "/treinador/periodizacao", label: "Periodização", icon: <CalendarIcon /> },
  { href: "/treinador/relatorios", label: "Relatórios", icon: <CopyIcon /> },
];

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

export default function TrainerDashboardPage() {
  const { user, checked } = useRequireRole("TRAINER");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [agenda, setAgenda] = useState<AgendaCard[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [insights, setInsights] = useState<InsightCardInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayIso = useMemo(() => toISODate(new Date()), []);

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

    // ENKY Intelligence — atenção da carteira (falha em silêncio; nunca quebra o painel).
    apiFetch<{ insights: InsightCardInsight[] }>("/api/trainer/intelligence/attention")
      .then((r) => setInsights(r.insights))
      .catch(() => undefined);
  }, [checked, todayIso]);

  const activeAthletes = roster.filter((entry) => entry.status === "ACTIVE").length;
  const pendingInvites = roster.filter((entry) => entry.status === "PENDING").length;
  const todayWorkouts = agenda.filter((card) => card.plannedDate === todayIso);
  const drafts = workouts.filter((workout) => workout.status === "DRAFT");
  const reviewPending = workouts.filter(
    (workout) => workout.feedback && REVIEW_STATUSES.includes(workout.status),
  );
  const upcoming = [...agenda]
    .sort((a, b) =>
      a.plannedDate === b.plannedDate
        ? (a.plannedStartAt ?? "").localeCompare(b.plannedStartAt ?? "")
        : a.plannedDate.localeCompare(b.plannedDate),
    )
    .slice(0, 6);

  const hasPendencies = drafts.length > 0 || reviewPending.length > 0 || pendingInvites > 0;

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando painel...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        {/* Cabeçalho */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className={uiClasses.eyebrow}>Central operacional</span>
            <h1 className={uiClasses.heading}>Olá, {user?.name?.split(" ")[0] ?? "treinador"}</h1>
          </div>
          <Link href="/treinador/treinos/novo" className={uiClasses.button}>
            <PlusIcon />
            Criar treino
          </Link>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {/* Atalhos */}
        <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="flex items-center gap-3 rounded-xl border border-line bg-petrol/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface"
            >
              <span className="text-electric-hi">{shortcut.icon}</span>
              {shortcut.label}
            </Link>
          ))}
        </nav>

        {/* Indicadores */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Atletas ativos"
            value={activeAthletes}
            icon={<UsersIcon />}
            href="/treinador/atletas"
          />
          <StatCard
            label="Treinos hoje"
            value={todayWorkouts.length}
            icon={<CalendarIcon />}
            tone="electric"
            href="/treinador/calendario"
          />
          <StatCard label="Rascunhos" value={drafts.length} icon={<LayersIcon />} tone="orange" />
          <StatCard
            label="Retornos p/ revisar"
            value={reviewPending.length}
            icon={<CheckIcon />}
            tone="turq"
          />
        </section>

        {/* Atenção — ENKY Intelligence */}
        {insights.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className={uiClasses.subheading}>Precisam de atenção</h2>
              <span className="text-xs text-faint">análise da ENKY Intelligence</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((insight) => (
                <InsightCard key={`${insight.athleteId}-${insight.engine}`} insight={insight} />
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Agenda */}
          <section className={`${uiClasses.panel} lg:col-span-2`}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className={uiClasses.subheading}>Próximos treinos</h2>
              <Link href="/treinador/calendario" className={uiClasses.link}>
                Ver calendário
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="p-5">
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
                  return (
                    <li key={card.id}>
                      <Link
                        href={`/treinador/treinos/${card.id}`}
                        className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface"
                      >
                        <div className="flex w-20 shrink-0 flex-col">
                          <span className="text-sm font-semibold capitalize text-ink">
                            {formatDay(card.plannedDate, todayIso)}
                          </span>
                          {time && (
                            <span className="flex items-center gap-1 text-xs text-muted">
                              <ClockIcon width={13} height={13} />
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{card.title}</p>
                          <p className="truncate text-xs text-muted">
                            {card.athleteName ?? "Atleta"} · {modalityLabel(card.modality)}
                          </p>
                        </div>
                        <StatusBadge status={card.status} />
                        <ChevronRightIcon className="shrink-0 text-faint" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pendências */}
          <section className={uiClasses.panel}>
            <div className="border-b border-line px-5 py-4">
              <h2 className={uiClasses.subheading}>Pendências</h2>
            </div>
            {!hasPendencies ? (
              <div className="p-5">
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
                  />
                )}
                {reviewPending.length > 0 && (
                  <PendencyRow
                    label="Retornos aguardando revisão"
                    count={reviewPending.length}
                    hint="Atletas já enviaram feedback"
                    href="/treinador/calendario"
                  />
                )}
                {pendingInvites > 0 && (
                  <PendencyRow
                    label="Convites pendentes"
                    count={pendingInvites}
                    hint="Aguardando ativação do atleta"
                    href="/treinador/atletas"
                  />
                )}
              </div>
            )}
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
}: {
  label: string;
  count: number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface"
    >
      <span className="tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange/15 font-display text-sm font-bold text-orange-hi">
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
