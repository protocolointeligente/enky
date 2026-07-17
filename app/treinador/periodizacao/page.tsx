"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { addDays, toISODate } from "@/app/_lib/calendar";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
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

interface PhaseDraft {
  name: string;
  startDate: string;
  endDate: string;
  targetVolumeKm: string;
  targetIntensity: string;
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
  const [athleteId, setAthleteId] = useState("");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<GenerationTarget | null>(null);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [start, setStart] = useState(() => toISODate(new Date()));
  const [end, setEnd] = useState(() => toISODate(addDays(new Date(), 83))); // 12 semanas
  const [phases, setPhases] = useState<PhaseDraft[]>([]);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster")
      .then((r) => {
        const active = r.athletes.filter((a) => a.status === "ACTIVE");
        setRoster(active);
        if (active[0]) setAthleteId(active[0].athleteProfileId);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    if (!athleteId) {
      setPlans([]);
      return;
    }
    apiFetch<{ periodizations: PlanSummary[] }>(`/api/trainer/athletes/${athleteId}/periodizations`)
      .then((r) => setPlans(r.periodizations))
      .catch(() => setPlans([]));
  }, [athleteId]);

  const loadDetail = useCallback(async () => {
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

  function addPhase() {
    setPhases((prev) => [
      ...prev,
      { name: "", startDate: start, endDate: end, targetVolumeKm: "", targetIntensity: "" },
    ]);
  }

  function updatePhase(index: number, patch: Partial<PhaseDraft>) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePhase(index: number) {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

  async function create() {
    if (!athleteId || !title.trim() || !goal.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        title,
        goal,
        startDate: start,
        endDate: end,
        phases: phases
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name.trim(),
            startDate: p.startDate,
            endDate: p.endDate,
            targetVolumeKm: p.targetVolumeKm ? Number(p.targetVolumeKm) : undefined,
            targetIntensity: p.targetIntensity.trim() || undefined,
          })),
      };
      const result = await apiFetch<{ periodization: { id: string } }>(
        `/api/trainer/athletes/${athleteId}/periodizations`,
        { method: "POST", body: JSON.stringify(body) },
      );
      // recarrega a lista e abre o plano recém-criado
      const list = await apiFetch<{ periodizations: PlanSummary[] }>(
        `/api/trainer/athletes/${athleteId}/periodizations`,
      );
      setPlans(list.periodizations);
      setSelectedId(result.periodization.id);
      setTitle("");
      setGoal("");
      setPhases([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível criar o plano.");
    } finally {
      setBusy(false);
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

                <div>
                  <label htmlFor="title" className={uiClasses.label}>
                    Título do plano
                  </label>
                  <input
                    id="title"
                    className={uiClasses.input}
                    placeholder="Ex.: Base para 21k"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="goal" className={uiClasses.label}>
                    Objetivo
                  </label>
                  <input
                    id="goal"
                    className={uiClasses.input}
                    placeholder="Ex.: Concluir meia maratona em 12 semanas"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="start" className={uiClasses.label}>
                      Início
                    </label>
                    <input
                      id="start"
                      type="date"
                      className={uiClasses.input}
                      value={start}
                      max={end}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="end" className={uiClasses.label}>
                      Fim
                    </label>
                    <input
                      id="end"
                      type="date"
                      className={uiClasses.input}
                      value={end}
                      min={start}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className={uiClasses.label}>Fases (opcional)</span>
                    <button type="button" className={uiClasses.buttonGhost} onClick={addPhase}>
                      + Adicionar fase
                    </button>
                  </div>
                  {phases.map((p, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                      <div className="flex items-center gap-2">
                        <input
                          className={uiClasses.input}
                          placeholder="Nome (base, build, pico, taper…)"
                          value={p.name}
                          onChange={(e) => updatePhase(i, { name: e.target.value })}
                        />
                        <button
                          type="button"
                          className={uiClasses.buttonGhost}
                          onClick={() => removePhase(i)}
                          aria-label="Remover fase"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          className={uiClasses.input}
                          value={p.startDate}
                          min={start}
                          max={end}
                          onChange={(e) => updatePhase(i, { startDate: e.target.value })}
                        />
                        <input
                          type="date"
                          className={uiClasses.input}
                          value={p.endDate}
                          min={start}
                          max={end}
                          onChange={(e) => updatePhase(i, { endDate: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          className={uiClasses.input}
                          placeholder="Volume alvo (km)"
                          value={p.targetVolumeKm}
                          onChange={(e) => updatePhase(i, { targetVolumeKm: e.target.value })}
                        />
                        <input
                          className={uiClasses.input}
                          placeholder="Intensidade alvo"
                          value={p.targetIntensity}
                          onChange={(e) => updatePhase(i, { targetIntensity: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className={uiClasses.button}
                  onClick={create}
                  disabled={busy || !title.trim() || !goal.trim()}
                >
                  {busy ? "Criando…" : "Criar plano"}
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
                          {detail.weeks.map((w) => (
                            <tr key={w.id}>
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
                          ))}
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

        <Link href="/treinador" className={uiClasses.link}>
          ← Voltar ao painel
        </Link>
      </div>
    </main>
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
