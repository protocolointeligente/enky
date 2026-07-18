"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityLabel, loadStatusLabel } from "@/app/_lib/labels";
import { modalityMeta } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { PlannedVsActual } from "@/components/planned-vs-actual";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorNotice } from "@/components/ui/error-notice";
import { AssessmentsTab } from "@/components/assessments-tab";
import { ChevronRightIcon, DumbbellIcon, PlusIcon } from "@/components/ui/icons";

interface Overview {
  athlete: {
    athleteProfileId: string;
    name: string | null;
    email: string | null;
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    heightCm: number | null;
  };
  trainer: { name: string | null };
  relationship: { active: boolean; startedAt: string } | null;
  plan: { modality: string | null; goal: string | null; targetEvent: string | null; title: string } | null;
  subscription: { plan: string; status: string } | null;
  metrics: {
    load: {
      ctl: number;
      atl: number;
      tsb: number;
      acwr: number | null;
      monotony: number | null;
      strain: number | null;
      rampPct: number | null;
      dataDays: number;
    };
    weeklyLoad: number | null;
    readiness: { class: string | null; score: number | null; date: string | null };
    adherence: { due: number; done: number; pct: number | null };
    pain: { latest: number | null; alerts: number };
    feedbackPending: number;
    formulaVersion: string;
    lastUpdatedAt: string | null;
    sufficient: boolean;
  };
}

interface WorkoutRow {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  feedback: { id: string; loadStatus: string; painLevel: number } | null;
}

const READINESS: Record<string, { label: string; tone: string }> = {
  boa: { label: "Boa", tone: "text-turq" },
  atencao: { label: "Atenção", tone: "text-orange-hi" },
  baixa: { label: "Baixa", tone: "text-danger" },
  insuficiente: { label: "—", tone: "text-faint" },
};

const TABS = [
  "Visão geral",
  "Calendário",
  "Prescrição",
  "Carga",
  "Prontidão",
  "Avaliações",
  "Evolução",
  "Feedback",
  "Provas e objetivos",
  "Plano contratado",
  "Perfil",
] as const;
type Tab = (typeof TABS)[number];

function fmtDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function num(n: number | null | undefined, digits = 0): string {
  return n == null ? "—" : n.toFixed(digits);
}
function initials(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function TrainerAthlete360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("TRAINER");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>("Visão geral");

  useEffect(() => {
    if (!checked) return;
    setLoading(true);
    Promise.all([
      apiFetch<Overview>(`/api/trainer/athletes/${id}/overview`),
      apiFetch<{ workouts: WorkoutRow[] }>(`/api/trainer/workouts?athleteId=${id}`).catch(() => ({
        workouts: [],
      })),
    ])
      .then(([o, w]) => {
        setOverview(o);
        setWorkouts(w.workouts);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked, id]);

  const feedbackWorkouts = useMemo(() => workouts.filter((w) => w.feedback), [workouts]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (error || !overview) {
    return (
      <main className={uiClasses.page}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ErrorNotice error={error ?? "Atleta não encontrado."} />
          <Link href="/treinador/atletas" className={uiClasses.link}>
            ← Voltar aos atletas
          </Link>
        </div>
      </main>
    );
  }

  const { athlete, plan, subscription, trainer, relationship, metrics } = overview;
  const name = athlete.name ?? "Atleta sem nome";
  const accent = modalityMeta(plan?.modality || "RUNNING").accent;
  const readiness = READINESS[metrics.readiness.class ?? "insuficiente"] ?? {
    label: "—",
    tone: "text-faint",
  };

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <Link
          href="/treinador/atletas"
          className="text-xs text-muted transition-colors hover:text-ink"
        >
          ← Atletas
        </Link>

        {/* ── Cabeçalho 360º ───────────────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-2xl border border-line bg-petrol/70 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              {initials(name)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{name}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                {athlete.age != null && <span>{athlete.age} anos</span>}
                {plan?.modality && <span className="text-faint">· {modalityLabel(plan.modality)}</span>}
                {subscription && <span className="text-faint">· Plano {subscription.plan}</span>}
                {trainer.name && <span className="text-faint">· Treinador {trainer.name}</span>}
                <span
                  className={`${uiClasses.badge} ${
                    relationship?.active ? "bg-turq/15 text-turq" : "bg-surface text-faint"
                  }`}
                >
                  {relationship?.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              {(plan?.goal || plan?.targetEvent) && (
                <p className="text-xs text-muted">
                  {plan.goal}
                  {plan.goal && plan.targetEvent ? " · " : ""}
                  {plan.targetEvent && <span className="text-faint">Prova: {plan.targetEvent}</span>}
                </p>
              )}
            </div>
          </div>
          <Link href={`/treinador/treinos/novo?athleteId=${id}`} className={uiClasses.button}>
            <PlusIcon />
            Criar treino
          </Link>
        </header>

        {/* ── Métricas sempre visíveis ─────────────────────────────── */}
        <section className="rounded-2xl border border-line bg-petrol/70 p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Tile label="CTL" value={num(metrics.load.ctl)} hint="carga crônica" />
            <Tile label="ATL" value={num(metrics.load.atl)} hint="carga aguda" />
            <Tile label="TSB" value={num(metrics.load.tsb)} hint="forma" />
            <Tile label="ACWR" value={num(metrics.load.acwr, 2)} hint="agudo/crônico" />
            <Tile label="Carga semanal" value={metrics.weeklyLoad != null ? String(metrics.weeklyLoad) : "—"} />
            <Tile label="Monotonia" value={num(metrics.load.monotony, 2)} />
            <Tile label="Strain" value={num(metrics.load.strain)} />
            <Tile
              label="Ramp"
              value={metrics.load.rampPct != null ? `${metrics.load.rampPct > 0 ? "+" : ""}${num(metrics.load.rampPct)}%` : "—"}
            />
            <Tile
              label="Aderência"
              value={metrics.adherence.pct != null ? `${metrics.adherence.pct}%` : "—"}
              hint={`${metrics.adherence.done}/${metrics.adherence.due} previstos`}
            />
            <Tile label="Prontidão" value={readiness.label} tone={readiness.tone} />
            <Tile
              label="Dor"
              value={metrics.pain.latest != null ? `${metrics.pain.latest}/10` : "—"}
              hint={metrics.pain.alerts > 0 ? `${metrics.pain.alerts} alertas` : undefined}
              tone={metrics.pain.latest != null && metrics.pain.latest >= 4 ? "text-danger" : undefined}
            />
            <Tile
              label="Feedback pend."
              value={String(metrics.feedbackPending)}
              tone={metrics.feedbackPending > 0 ? "text-turq" : undefined}
            />
          </div>
          <p className="mt-3 text-[11px] text-faint">
            Fonte: carga interna (sRPE) e check-ins de prontidão · fórmula de carga v
            {metrics.formulaVersion}
            {metrics.lastUpdatedAt ? ` · atualizado ${metrics.lastUpdatedAt}` : " · sem dados recentes"}
            {!metrics.sufficient && " · histórico insuficiente para leitura de carga confiável"}
          </p>
        </section>

        {/* ── Abas ─────────────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-line">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-orange text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <section>
          {tab === "Visão geral" && (
            <div className="flex flex-col gap-4">
              <PlannedVsActual athleteId={id} />
              <WorkoutList workouts={workouts.slice(0, 8)} title="Treinos recentes" emptyAthleteId={id} />
            </div>
          )}

          {tab === "Calendário" && (
            <Panel title="Calendário">
              <p className="text-sm text-muted">
                O calendário operacional já traz o cabeçalho de contexto deste atleta.
              </p>
              <Link href="/treinador/calendario" className={`${uiClasses.buttonSecondary} mt-3 w-fit`}>
                Abrir calendário
              </Link>
            </Panel>
          )}

          {tab === "Prescrição" && (
            <WorkoutList workouts={workouts} title="Treinos prescritos" emptyAthleteId={id} />
          )}

          {tab === "Carga" && (
            <Panel title="Estado de carga">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="CTL" value={num(metrics.load.ctl)} hint="crônica (42d)" />
                <Tile label="ATL" value={num(metrics.load.atl)} hint="aguda (7d)" />
                <Tile label="TSB" value={num(metrics.load.tsb)} hint="ctl − atl" />
                <Tile label="ACWR" value={num(metrics.load.acwr, 2)} />
                <Tile label="Monotonia" value={num(metrics.load.monotony, 2)} />
                <Tile label="Strain" value={num(metrics.load.strain)} />
                <Tile
                  label="Ramp"
                  value={metrics.load.rampPct != null ? `${num(metrics.load.rampPct)}%` : "—"}
                />
                <Tile label="Dias com dado" value={String(metrics.load.dataDays)} />
              </div>
              <p className="mt-3 text-xs text-faint">
                EWMA impulso-resposta sobre a carga sRPE · fórmula v{metrics.formulaVersion}.
                {!metrics.sufficient &&
                  " Histórico ainda insuficiente — os números ganham confiança conforme o atleta registra treinos."}
              </p>
            </Panel>
          )}

          {tab === "Prontidão" && (
            <Panel title="Prontidão">
              {metrics.readiness.class ? (
                <div className="flex flex-col gap-2">
                  <p className={`font-display text-2xl font-bold ${readiness.tone}`}>
                    {readiness.label}
                    {metrics.readiness.score != null && (
                      <span className="ml-2 text-base text-muted">{metrics.readiness.score}/100</span>
                    )}
                  </p>
                  {metrics.readiness.date && (
                    <p className="text-xs text-faint">Último check-in em {metrics.readiness.date}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">Nenhum check-in de prontidão registrado ainda.</p>
              )}
            </Panel>
          )}

          {tab === "Feedback" && (
            <Panel title="Feedback dos treinos">
              {feedbackWorkouts.length === 0 ? (
                <p className="text-sm text-muted">Nenhum feedback registrado ainda.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {feedbackWorkouts.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-20 shrink-0 text-xs text-muted">{fmtDate(w.plannedDate)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{w.title}</span>
                      {w.feedback && (
                        <span className="shrink-0 text-xs text-muted">
                          {loadStatusLabel(w.feedback.loadStatus)}
                          {w.feedback.painLevel > 0 ? ` · dor ${w.feedback.painLevel}/10` : ""}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {tab === "Provas e objetivos" && (
            <Panel title="Provas e objetivos">
              {plan?.goal || plan?.targetEvent ? (
                <div className="flex flex-col gap-2 text-sm">
                  {plan.goal && (
                    <p>
                      <span className="text-faint">Objetivo: </span>
                      <span className="text-ink">{plan.goal}</span>
                    </p>
                  )}
                  {plan.targetEvent && (
                    <p>
                      <span className="text-faint">Prova-alvo: </span>
                      <span className="text-ink">{plan.targetEvent}</span>
                    </p>
                  )}
                  {plan.title && (
                    <p>
                      <span className="text-faint">Plano: </span>
                      <span className="text-ink">{plan.title}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">Nenhum objetivo definido. Crie uma periodização.</p>
              )}
              <Link href="/treinador/periodizacao" className={`${uiClasses.buttonSecondary} mt-3 w-fit`}>
                Periodização
              </Link>
            </Panel>
          )}

          {tab === "Plano contratado" && (
            <Panel title="Plano contratado">
              {subscription ? (
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-semibold text-ink">
                    {subscription.plan}
                  </span>
                  <StatusBadge status={subscription.status} />
                </div>
              ) : (
                <p className="text-sm text-muted">Sem assinatura ativa nesta organização.</p>
              )}
              <Link href="/treinador/planos" className={`${uiClasses.buttonSecondary} mt-3 w-fit`}>
                Ver planos
              </Link>
            </Panel>
          )}

          {tab === "Perfil" && (
            <Panel title="Perfil">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Field label="Nome" value={athlete.name ?? "—"} />
                <Field label="E-mail" value={athlete.email ?? "—"} />
                <Field label="Idade" value={athlete.age != null ? `${athlete.age} anos` : "—"} />
                <Field label="Gênero" value={athlete.gender ?? "—"} />
                <Field label="Peso" value={athlete.weightKg != null ? `${athlete.weightKg} kg` : "—"} />
                <Field label="Altura" value={athlete.heightCm != null ? `${athlete.heightCm} cm` : "—"} />
              </dl>
            </Panel>
          )}

          {tab === "Avaliações" && <AssessmentsTab athleteId={id} />}

          {tab === "Evolução" && (
            <Panel title="Evolução">
              <EmptyState
                title="Sem série de evolução"
                description="A evolução de métricas ao longo do tempo entra numa próxima fase."
                icon={<DumbbellIcon width={28} height={28} />}
              />
            </Panel>
          )}
        </section>
      </div>
    </main>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <span className={`tabular font-display text-lg font-bold ${tone ?? "text-ink"}`}>{value}</span>
      {hint && <span className="text-[10px] text-faint">{hint}</span>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${uiClasses.panel} flex flex-col p-5`}>
      <h2 className={`${uiClasses.subheading} mb-3`}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}

function WorkoutList({
  workouts,
  title,
  emptyAthleteId,
}: {
  workouts: WorkoutRow[];
  title: string;
  emptyAthleteId: string;
}) {
  return (
    <div className={uiClasses.panel}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className={uiClasses.subheading}>{title}</h2>
        <span className="text-xs text-faint">
          {workouts.length} treino{workouts.length !== 1 ? "s" : ""}
        </span>
      </div>
      {workouts.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Nenhum treino ainda"
            description="Crie o primeiro treino para este atleta."
            icon={<DumbbellIcon width={28} height={28} />}
            action={{ label: "Criar treino", href: `/treinador/treinos/novo?athleteId=${emptyAthleteId}` }}
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link
                href={`/treinador/treinos/${w.id}`}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface"
              >
                <span className="w-20 shrink-0 text-sm font-semibold text-ink">
                  {fmtDate(w.plannedDate)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{w.title}</p>
                  <p className="truncate text-xs text-muted">
                    {modalityLabel(w.modality)}
                    {w.feedback ? ` · Carga: ${loadStatusLabel(w.feedback.loadStatus)}` : ""}
                    {w.feedback && w.feedback.painLevel > 0 ? ` · Dor: ${w.feedback.painLevel}/10` : ""}
                  </p>
                </div>
                <StatusBadge status={w.status} />
                <ChevronRightIcon className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
