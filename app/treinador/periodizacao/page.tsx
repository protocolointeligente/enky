"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { PeriodizationCreateModal } from "@/components/periodization-create-modal";
import { PeriodizationStrategyModal } from "@/components/periodization-strategy-modal";
import { WeekGenerationModal, type GenerationTarget } from "@/components/week-generation-modal";

interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
  status: string;
}

interface PlanSummary {
  id: string;
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  _count: { phases: number; weeks: number };
}

interface Phase {
  id: string;
  name: string;
  sequence: number;
  startDate: string;
  endDate: string;
  targetVolumeKm: string | null;
  targetIntensity: string | null;
}

interface Week {
  id: string;
  sequence: number;
  startDate: string;
  endDate: string;
  phaseId: string | null;
  isRecoveryWeek: boolean;
  scheduledCount: number;
}

interface PlanDetail extends PlanSummary {
  phases: Phase[];
  weeks: Week[];
}

interface WeekAnalysisResult {
  workoutCount: number;
  anyEstimated: boolean;
  analysis: {
    internalLoad: number;
    intensity: { lowLoadPct: number | null; qualityLoadPct: number | null };
    alerts: { code: string; severity: string; message: string }[];
  };
}

function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function TrainerPeriodizationPage() {
  const { checked } = useRequireRole("TRAINER");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  // Contexto (atleta + plano) persistido na URL: recarregar ou voltar retorna ao
  // mesmo plano (§17). Lê os params uma vez; escreve a cada mudança (replaceState).
  const [athleteId, setAthleteId] = useState(() =>
    typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("athlete") ?? "") : "",
  );
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("plan") : null,
  );
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<GenerationTarget | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [weekAnalysis, setWeekAnalysis] = useState<Record<string, WeekAnalysisResult | null>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster")
      .then((r) => {
        const active = r.athletes.filter((a) => a.status === "ACTIVE");
        setRoster(active);
        // Preserva o atleta da URL se ainda válido; senão cai no primeiro ativo.
        setAthleteId((cur) =>
          cur && active.some((a) => a.athleteProfileId === cur)
            ? cur
            : (active[0]?.athleteProfileId ?? ""),
        );
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  useEffect(() => {
    setDetail(null);
    if (!athleteId) {
      setPlans([]);
      setSelectedId(null);
      return;
    }
    apiFetch<{ periodizations: PlanSummary[] }>(`/api/trainer/athletes/${athleteId}/periodizations`)
      .then((r) => {
        setPlans(r.periodizations);
        // Mantém o plano selecionado se pertence a este atleta (contexto da URL);
        // senão limpa. Assim recarregar/voltar volta ao mesmo plano.
        setSelectedId((cur) => (cur && r.periodizations.some((p) => p.id === cur) ? cur : null));
      })
      .catch(() => {
        setPlans([]);
        setSelectedId(null);
      });
  }, [athleteId]);

  // Espelha o contexto na URL (sem poluir o histórico).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (athleteId) params.set("athlete", athleteId);
    if (selectedId) params.set("plan", selectedId);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [athleteId, selectedId]);

  const loadDetail = useCallback(async () => {
    setWeekAnalysis({});
    if (!selectedId) {
      setDetail(null);
      return;
    }
    try {
      const r = await apiFetch<{ periodization: PlanDetail }>(
        `/api/trainer/periodizations/${selectedId}`,
      );
      setDetail(r.periodization);
    } catch {
      setDetail(null);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Recarrega a lista do atleta e seleciona o plano recém-criado (o modal cuida
  // do formulário e da chamada; aqui só sincronizamos a tela).
  async function onCreated(aid: string, id: string) {
    setAthleteId(aid);
    try {
      const list = await apiFetch<{ periodizations: PlanSummary[] }>(
        `/api/trainer/athletes/${aid}/periodizations`,
      );
      setPlans(list.periodizations);
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Plano criado, mas a lista não recarregou.");
    }
  }

  // Recálculo da semana (Fase 4) sobre os treinos reais já agendados nela.
  async function analyzeWeekRow(weekId: string) {
    if (!selectedId) return;
    setAnalyzingId(weekId);
    try {
      const r = await apiFetch<WeekAnalysisResult>(
        `/api/trainer/periodizations/${selectedId}/weeks/${weekId}/analysis`,
      );
      setWeekAnalysis((prev) => ({ ...prev, [weekId]: r }));
    } catch {
      setWeekAnalysis((prev) => ({ ...prev, [weekId]: null }));
    } finally {
      setAnalyzingId(null);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/trainer/periodizations/${id}`, { method: "DELETE" });
      setPlans((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível excluir.");
    }
  }

  const phaseName = useMemo(() => {
    const map = new Map<string, string>();
    detail?.phases.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [detail]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Trilha de navegação">
          <Link href="/treinador" className="transition-colors hover:text-ink">
            Painel
          </Link>
          <span className="text-faint">›</span>
          <span className="text-ink">Periodização</span>
          {detail && (
            <>
              <span className="text-faint">›</span>
              <span className="max-w-[40ch] truncate text-ink">{detail.title}</span>
            </>
          )}
        </nav>
        <header className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Periodização</span>
          <h1 className={uiClasses.heading}>Planejamento estratégico</h1>
          <p className={uiClasses.hint}>
            Desenhe o macrociclo do atleta — fases e semanas. As semanas são geradas pela janela do
            plano e mostram quantos treinos você já agendou em cada uma.
          </p>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {roster.length === 0 ? (
          <p className="text-muted">Nenhum atleta ativo para planejar.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            {/* Coluna esquerda: seleção + criação + lista */}
            <div className="flex flex-col gap-6">
              <section className={`${uiClasses.card} flex flex-col gap-4`}>
                <div>
                  <label htmlFor="athlete" className={uiClasses.label}>
                    Atleta
                  </label>
                  <select
                    id="athlete"
                    className={uiClasses.select}
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                  >
                    {roster.map((a) => (
                      <option key={a.athleteProfileId} value={a.athleteProfileId}>
                        {a.name ?? "Atleta"}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className={uiClasses.button}
                  onClick={() => setShowStrategy(true)}
                  disabled={!athleteId}
                >
                  ✨ Gerar com ENKY
                </button>
                <button
                  type="button"
                  className={uiClasses.buttonSecondary}
                  onClick={() => setShowCreate(true)}
                  disabled={!athleteId}
                >
                  + Criar manualmente
                </button>
              </section>

              <section className="flex flex-col gap-2">
                <h2 className={uiClasses.subheading}>Planos do atleta</h2>
                {plans.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum plano ainda.</p>
                ) : (
                  plans.map((plan) => (
                    <button
                      type="button"
                      key={plan.id}
                      onClick={() => setSelectedId(plan.id)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                        selectedId === plan.id
                          ? "border-electric bg-surface"
                          : "border-line bg-petrol/70 hover:border-line-strong"
                      }`}
                    >
                      <span className="font-semibold text-ink">{plan.title}</span>
                      <span className="text-xs text-muted">
                        {fmtDay(plan.startDate)} – {fmtDay(plan.endDate)} · {plan._count.weeks}{" "}
                        semanas · {plan._count.phases} fases
                      </span>
                    </button>
                  ))
                )}
              </section>
            </div>

            {/* Coluna direita: detalhe do plano */}
            <section className={uiClasses.panel}>
              {!detail ? (
                <div className="p-8 text-center text-sm text-muted">
                  Selecione ou crie um plano para ver a estrutura.
                </div>
              ) : (
                <div className="flex flex-col gap-5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className={uiClasses.subheading}>{detail.title}</h2>
                      <p className="text-sm text-muted">{detail.goal}</p>
                      <p className="mt-1 text-xs text-faint">
                        {fmtDay(detail.startDate)} – {fmtDay(detail.endDate)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={uiClasses.buttonGhost}
                      onClick={() => remove(detail.id)}
                    >
                      Excluir
                    </button>
                  </div>

                  {detail.phases.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-ink">Fases</h3>
                      <div className="flex flex-col gap-2">
                        {detail.phases.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-ink">{p.name}</span>
                            <span className="text-xs text-muted">
                              {fmtDay(p.startDate)} – {fmtDay(p.endDate)}
                              {p.targetVolumeKm ? ` · ${p.targetVolumeKm} km` : ""}
                              {p.targetIntensity ? ` · ${p.targetIntensity}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink">Semanas</h3>
                      <button
                        type="button"
                        className={uiClasses.buttonSecondary}
                        onClick={() =>
                          setGenerating({
                            kind: "cycle",
                            periodizationId: detail.id,
                            weekId: null,
                            sequence: null,
                            startDate: detail.startDate,
                            endDate: detail.endDate,
                            phaseName: null,
                            isRecoveryWeek: false,
                            weekCount: detail.weeks.length,
                          })
                        }
                      >
                        Gerar ciclo inteiro
                      </button>
                    </div>
                    <p className={uiClasses.hint}>
                      Gere as sessões a partir da fase, do volume alvo e da disponibilidade — uma
                      semana por vez ou o ciclo inteiro. Tudo sai como rascunho para você revisar.
                    </p>
                    {detail.weeks.length > 0 && (
                      <WeekLoadChart weeks={detail.weeks} phases={detail.phases} />
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wider text-faint">
                            <th className="py-2 pr-3">#</th>
                            <th className="py-2 pr-3">Período</th>
                            <th className="py-2 pr-3">Fase</th>
                            <th className="py-2 pr-3 text-right">Treinos</th>
                            <th className="py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {detail.weeks.map((w) => {
                            const wa = weekAnalysis[w.id];
                            return (
                            <Fragment key={w.id}>
                              <tr>
                                <td className="py-2 pr-3 tabular text-muted">{w.sequence}</td>
                                <td className="py-2 pr-3 text-ink">
                                  {fmtDay(w.startDate)} – {fmtDay(w.endDate)}
                                  {w.isRecoveryWeek && (
                                    <span className={`${uiClasses.badge} ml-2 bg-turq/15 text-turq`}>
                                      regenerativa
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pr-3 text-muted">
                                  {w.phaseId ? (phaseName.get(w.phaseId) ?? "—") : "—"}
                                </td>
                                <td className="py-2 pr-3 text-right tabular text-ink">
                                  {w.scheduledCount}
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    className={uiClasses.buttonGhost}
                                    disabled={w.scheduledCount === 0 || analyzingId === w.id}
                                    onClick={() => analyzeWeekRow(w.id)}
                                    title={
                                      w.scheduledCount === 0
                                        ? "Sem treinos agendados para analisar"
                                        : "Recalcular carga/polarização/alertas desta semana"
                                    }
                                  >
                                    {analyzingId === w.id ? "…" : "Analisar"}
                                  </button>
                                  <button
                                    type="button"
                                    className={uiClasses.buttonGhost}
                                    onClick={() =>
                                      setGenerating({
                                        kind: "week",
                                        periodizationId: detail.id,
                                        weekId: w.id,
                                        sequence: w.sequence,
                                        startDate: w.startDate,
                                        endDate: w.endDate,
                                        phaseName: w.phaseId
                                          ? (phaseName.get(w.phaseId) ?? null)
                                          : null,
                                        isRecoveryWeek: w.isRecoveryWeek,
                                        weekCount: detail.weeks.length,
                                      })
                                    }
                                  >
                                    Gerar
                                  </button>
                                </td>
                              </tr>
                              {wa !== undefined && (
                                <tr>
                                  <td colSpan={5} className="pb-3">
                                    <WeekAnalysisPanel result={wa} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <WeekGenerationModal
          target={generating}
          onClose={() => setGenerating(null)}
          onGenerated={loadDetail}
        />

        <PeriodizationStrategyModal
          open={showStrategy}
          onClose={() => setShowStrategy(false)}
          athletes={roster}
          defaultAthleteId={athleteId}
          onCreated={onCreated}
        />

        <PeriodizationCreateModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          athletes={roster}
          defaultAthleteId={athleteId}
          onCreated={onCreated}
        />

        <Link href="/treinador" className={uiClasses.link}>
          ← Voltar ao painel
        </Link>
      </div>
    </main>
  );
}

// Recálculo da semana (Fase 4): carga interna, polarização e alertas dos treinos
// REAIS já agendados. Carga real (sRPE) quando executado; estimada da prescrição
// quando ainda é rascunho — sinalizado.
function WeekAnalysisPanel({ result }: { result: WeekAnalysisResult | null }) {
  if (result === null) {
    return <p className="text-xs text-danger">Não foi possível analisar a semana.</p>;
  }
  const { analysis } = result;
  return (
    <div className="rounded-lg border border-line bg-deep/40 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-faint">
        <span>
          Carga <span className="tabular text-ink">{analysis.internalLoad} UA</span>
        </span>
        {analysis.intensity.qualityLoadPct != null && (
          <span>
            Polarização{" "}
            <span className="tabular text-ink">
              {analysis.intensity.lowLoadPct}% fácil / {analysis.intensity.qualityLoadPct}% qualidade
            </span>
          </span>
        )}
        <span className="tabular">{result.workoutCount} treino(s)</span>
        {result.anyEstimated && (
          <span className="text-orange">carga parcialmente estimada da prescrição</span>
        )}
      </div>
      {analysis.alerts.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {analysis.alerts.map((a, i) => (
            <li key={i} className={a.severity === "warning" ? "text-orange" : "text-faint"}>
              {a.severity === "warning" ? "⚠ " : "· "}
              {a.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Carga planejada do macrociclo: uma barra por microciclo (altura = treinos
// agendados). Fases alternam electric/laranja para o treinador enxergar os
// blocos; semana regenerativa em turquesa. Sem lib de gráfico — barras CSS.
function WeekLoadChart({ weeks, phases }: { weeks: Week[]; phases: Phase[] }) {
  const phaseIndex = new Map<string, number>();
  [...phases]
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((p, i) => phaseIndex.set(p.id, i));

  const maxCount = Math.max(1, ...weeks.map((w) => w.scheduledCount));
  const phaseColor = (i: number) =>
    i % 2 === 0 ? "var(--color-electric)" : "var(--color-orange)";
  const barColor = (w: Week) => {
    if (w.isRecoveryWeek) return "var(--color-turq)";
    if (!w.phaseId) return "var(--color-line-strong)";
    return phaseColor(phaseIndex.get(w.phaseId) ?? 0);
  };

  return (
    <div className="rounded-lg border border-line bg-deep/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Treinos por microciclo</span>
        <span className="text-[11px] tabular text-faint">pico: {maxCount}</span>
      </div>
      <div className="flex h-36 items-end gap-1 overflow-x-auto">
        {weeks.map((w) => (
          <div
            key={w.id}
            className="flex h-full min-w-[12px] flex-1 flex-col justify-end"
            title={`Semana ${w.sequence} · ${fmtDay(w.startDate)} – ${fmtDay(w.endDate)} · ${w.scheduledCount} treino${w.scheduledCount === 1 ? "" : "s"}`}
          >
            <span
              className="w-full rounded-t transition-[height]"
              style={{
                height: `${(w.scheduledCount / maxCount) * 100}%`,
                minHeight: w.scheduledCount > 0 ? 4 : 2,
                backgroundColor: w.scheduledCount > 0 ? barColor(w) : "var(--color-line)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {weeks.map((w) => (
          <span
            key={w.id}
            className="min-w-[12px] flex-1 text-center text-[10px] tabular text-faint"
          >
            {w.sequence}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {[...phases]
          .sort((a, b) => a.sequence - b.sequence)
          .map((p, i) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: phaseColor(i) }}
              />
              {p.name}
            </span>
          ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-turq)" }} />
          regenerativa
        </span>
      </div>
    </div>
  );
}
