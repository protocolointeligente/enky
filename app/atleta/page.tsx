"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityLabel } from "@/app/_lib/labels";
import { modalityMeta } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import type { HomeWorkout } from "@/modules/athletes/get-athlete-home";
import { StatusBadge, ReadinessBadge, readinessTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  PlayIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";

interface HomeData {
  today: HomeWorkout[];
  upcoming: HomeWorkout[];
  recentCompleted: HomeWorkout[];
  pending: { feedbackMissing: HomeWorkout[]; readinessTodayMissing: boolean };
  readiness: {
    checkInDate: string;
    sleepHours: number | null;
    sleepQuality: number | null;
    fatigue: number | null;
    soreness: number | null;
    stress: number | null;
    motivation: number | null;
  } | null;
  summary: { completed7d: number; scheduled7d: number; adherence7d: number | null; streak: number };
}

function timeOf(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Calcula um score de readiness simplificado a partir dos campos disponíveis
function readinessScore(r: HomeData["readiness"]): number | null {
  if (!r) return null;
  const vals = [r.sleepQuality, r.fatigue, r.motivation].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  // fatigue e soreness são "quanto pior, menor o score" — invertemos
  const sleepQ   = r.sleepQuality  != null ? (r.sleepQuality  / 5) * 100 : null;
  const fatigue  = r.fatigue       != null ? ((5 - r.fatigue)  / 5) * 100 : null;
  const motivation = r.motivation  != null ? (r.motivation     / 5) * 100 : null;
  const scores = [sleepQ, fatigue, motivation].filter((v): v is number => v != null);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export default function AthleteHomePage() {
  const { user, checked } = useRequireRole("ATHLETE");
  const [home, setHome] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ home: HomeData }>("/api/athlete/home")
      .then((result) => setHome(result.home))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-surface" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface" />
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-kpi-bg" />)}
          </div>
        </div>
      </main>
    );
  }

  const score = home ? readinessScore(home.readiness) : null;
  const tone  = readinessTone(score);
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-5">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className={uiClasses.eyebrow}>{todayLabel}</span>
            <h1 className="font-display text-2xl font-bold text-ink">
              Olá, <span className="text-orange-hi">{user?.name?.split(" ")[0] ?? "atleta"}</span>
            </h1>
          </div>
          {score != null && (
            <div className="flex flex-col items-end gap-1 pt-0.5">
              <span className={uiClasses.eyebrow}>Prontidão</span>
              <ReadinessBadge score={score} />
            </div>
          )}
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {home && (
          <>
            {/* ── TREINO DE HOJE — hero card ─────────────────────── */}
            <section aria-label="Treino de hoje">
              {home.today.length === 0 ? (
                <div className={`${uiClasses.panel} p-6`}>
                  <EmptyState
                    title="Dia de descanso 🌱"
                    description="Você não tem treino programado para hoje. Aproveite a recuperação."
                    icon={<CalendarIcon width={28} height={28} />}
                  />
                </div>
              ) : (
                home.today.map((w) => <TodayHeroCard key={w.id} workout={w} />)
              )}
            </section>

            {/* ── KPI ROW ────────────────────────────────────────── */}
            <section
              className="grid grid-cols-3 gap-3"
              aria-label="Resumo semanal"
            >
              <KpiTile
                label="Aderência 7d"
                value={home.summary.adherence7d != null ? `${home.summary.adherence7d}%` : "—"}
                color={home.summary.adherence7d != null && home.summary.adherence7d >= 70 ? "turq" : "orange"}
                href="/atleta/evolucao"
              />
              <KpiTile
                label="Concluídos 7d"
                value={`${home.summary.completed7d}/${home.summary.scheduled7d}`}
                color="electric"
                href="/atleta/evolucao"
              />
              <KpiTile
                label="Sequência"
                value={`${home.summary.streak}d`}
                color={home.summary.streak >= 7 ? "turq" : "default"}
                href="/atleta/evolucao"
              />
            </section>

            {/* ── PRONTIDÃO ──────────────────────────────────────── */}
            {home.pending.readinessTodayMissing ? (
              <ReadinessPrompt />
            ) : (
              home.readiness && <ReadinessDisplay readiness={home.readiness} score={score} />
            )}

            {/* ── PRECISA DE ATENÇÃO ─────────────────────────────── */}
            {home.pending.feedbackMissing.length > 0 && (
              <section aria-label="Feedbacks pendentes">
                <div className={uiClasses.sectionHeader}>
                  <h2 className={uiClasses.subheading}>Feedback pendente</h2>
                  <span className="rounded-full bg-orange-lo px-2 py-0.5 text-[11px] font-bold text-orange-hi">
                    {home.pending.feedbackMissing.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {home.pending.feedbackMissing.map((w) => (
                    <WorkoutRow key={w.id} workout={w} cta="Enviar feedback" />
                  ))}
                </div>
              </section>
            )}

            {/* ── PRÓXIMOS TREINOS ────────────────────────────────── */}
            <section aria-label="Próximos treinos">
              <div className={uiClasses.sectionHeader}>
                <h2 className={uiClasses.subheading}>Próximos treinos</h2>
                <Link href="/atleta/calendario" className={uiClasses.link}>
                  Calendário
                </Link>
              </div>
              {home.upcoming.length === 0 ? (
                <p className="text-sm text-muted">Nenhum treino programado.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {home.upcoming.map((w) => (
                    <WorkoutRow key={w.id} workout={w} />
                  ))}
                </div>
              )}
            </section>

            {/* ── CONCLUÍDOS RECENTES ─────────────────────────────── */}
            {home.recentCompleted.length > 0 && (
              <section aria-label="Treinos concluídos recentemente">
                <div className={uiClasses.sectionHeader}>
                  <h2 className={uiClasses.subheading}>Concluídos recentemente</h2>
                  <Link href="/atleta/evolucao" className={`flex items-center gap-1 ${uiClasses.link}`}>
                    <TrendingUpIcon width={14} height={14} />
                    Evolução
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {home.recentCompleted.map((w) => (
                    <WorkoutRow key={w.id} workout={w} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ── Hero card — treino de hoje ────────────────────────────────────────────
function TodayHeroCard({ workout }: { workout: HomeWorkout }) {
  const meta = modalityMeta(workout.modality);
  const time = timeOf(workout.plannedStartAt);

  return (
    <Link
      href={`/atleta/treinos/${workout.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-petrol p-5 transition-colors hover:border-line-strong hover:bg-surface"
      style={{ borderLeftWidth: "4px", borderLeftColor: meta.accent }}
    >
      {/* Modalidade + status */}
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: meta.accent }}
        >
          {meta.icon}
          {modalityLabel(workout.modality)}
        </span>
        <StatusBadge status={workout.status} />
      </div>

      {/* Título */}
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{workout.title}</h2>
        {time && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <ClockIcon width={13} height={13} />
            {time}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-faint">Toque para ver o treino</span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-onbrand transition-all group-hover:bg-orange-hi">
          <PlayIcon width={14} height={14} />
          Iniciar treino
        </span>
      </div>
    </Link>
  );
}

// ── KPI tile compacto ─────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: string;
  color: "turq" | "electric" | "orange" | "default";
  href?: string;
}) {
  const colorClass = {
    turq:     "text-turq",
    electric: "text-electric-hi",
    orange:   "text-orange-hi",
    default:  "text-ink",
  }[color];

  const body = (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-kpi-bg p-3.5 text-center transition-colors hover:border-line-strong">
      <span className={`tabular font-display text-xl font-bold leading-none ${colorClass}`}>
        {value}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

// ── Workout row compacto ──────────────────────────────────────────────────
function WorkoutRow({ workout, cta }: { workout: HomeWorkout; cta?: string }) {
  const meta = modalityMeta(workout.modality);
  const date = new Date(`${workout.plannedDate}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return (
    <Link
      href={`/atleta/treinos/${workout.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-petrol/70 p-3.5 transition-colors hover:border-line-strong hover:bg-surface"
      style={{ borderLeftWidth: "3px", borderLeftColor: meta.accent }}
    >
      <span className="shrink-0" style={{ color: meta.accent }}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{workout.title}</p>
        <p className="truncate text-xs capitalize text-muted">
          {date} · {modalityLabel(workout.modality)}
        </p>
      </div>
      {cta ? (
        <span className="shrink-0 rounded-xl bg-orange px-3 py-1.5 text-xs font-semibold text-onbrand">
          {cta}
        </span>
      ) : (
        <>
          <StatusBadge status={workout.status} />
          <ChevronRightIcon className="shrink-0 text-faint" />
        </>
      )}
    </Link>
  );
}

// ── Prompt de prontidão (não preenchida hoje) ─────────────────────────────
function ReadinessPrompt() {
  return (
    <Link
      href="/atleta/prontidao"
      className="flex items-center justify-between rounded-2xl border border-orange/40 bg-orange-lo p-4 transition-colors hover:border-orange"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-lo">
          <AlertIcon className="text-orange-hi" width={18} height={18} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">Como você está hoje?</p>
          <p className="truncate text-xs text-muted">Leva menos de 30s: sono, fadiga, motivação…</p>
        </div>
      </div>
      <ChevronRightIcon className="shrink-0 text-faint" />
    </Link>
  );
}

// ── Display de prontidão (já preenchida) ─────────────────────────────────
function ReadinessDisplay({
  readiness,
  score,
}: {
  readiness: NonNullable<HomeData["readiness"]>;
  score: number | null;
}) {
  const chips: { label: string; value: number | null; icon: string }[] = [
    { label: "Sono",      value: readiness.sleepHours,   icon: "🌙" },
    { label: "Qualidade", value: readiness.sleepQuality,  icon: "⭐" },
    { label: "Fadiga",    value: readiness.fatigue,       icon: "⚡" },
    { label: "Dor",       value: readiness.soreness,      icon: "🔥" },
    { label: "Motivação", value: readiness.motivation,    icon: "💪" },
  ];

  return (
    <section aria-label="Prontidão de hoje">
      <div className={uiClasses.sectionHeader}>
        <h2 className={uiClasses.subheading}>Prontidão de hoje</h2>
        {score != null && (
          <ReadinessBadge score={score} />
        )}
      </div>
      <div className={`${uiClasses.panel} p-4`}>
        <div className="grid grid-cols-5 gap-2">
          {chips.map((c) => (
            <div key={c.label} className="flex flex-col items-center gap-1 rounded-xl bg-surface p-2.5 text-center">
              <span className="text-base leading-none" aria-hidden="true">{c.icon}</span>
              <p className="tabular text-sm font-bold text-ink">{c.value ?? "—"}</p>
              <p className="text-[10px] text-muted">{c.label}</p>
            </div>
          ))}
        </div>
        <Link
          href="/atleta/prontidao"
          className="mt-3 flex items-center justify-center gap-1 text-xs text-faint transition-colors hover:text-muted"
        >
          Atualizar prontidão
          <ChevronRightIcon width={13} height={13} />
        </Link>
      </div>
    </section>
  );
}
