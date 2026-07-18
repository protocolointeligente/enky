"use client";

import { useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { addDays, toISODate } from "@/app/_lib/calendar";
import { Modal } from "@/components/ui/modal";
import { ErrorNotice } from "@/components/ui/error-notice";
import { MODALITIES, PERIODIZATION_LEVELS } from "@/modules/periodization/periodization-schema";

// Modal "Gerar com ENKY" — motor estratégico (Fase 1). O treinador informa
// objetivo, prova e o essencial do atleta; o ENKY PROPÕE o macrociclo inteiro
// (fases, taper, deload, onda de carga) e mostra o PORQUÊ de cada decisão. Nada
// é salvo até o treinador clicar em salvar — e mesmo então nasce RASCUNHO. A
// ciência vive no motor puro/serviço; este componente só coleta, mostra e chama.

interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
}

type Modality = (typeof MODALITIES)[number];

const MODALITY_LABEL: Record<Modality, string> = {
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
  STRENGTH: "Musculação",
  FUNCTIONAL: "Funcional",
};

const LEVEL_LABEL: Record<(typeof PERIODIZATION_LEVELS)[number], string> = {
  INICIANTE: "Iniciante",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
  ELITE: "Elite",
};

// Dias ISO 1=segunda … 7=domingo.
const WEEKDAYS: { iso: number; label: string }[] = [
  { iso: 1, label: "Seg" },
  { iso: 2, label: "Ter" },
  { iso: 3, label: "Qua" },
  { iso: 4, label: "Qui" },
  { iso: 5, label: "Sex" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
];

const CONFIDENCE_LABEL: Record<string, { text: string; cls: string }> = {
  HIGH: { text: "Confiança alta", cls: "bg-turq/15 text-turq" },
  MODERATE: { text: "Confiança moderada", cls: "bg-orange/15 text-orange" },
  LOW: { text: "Confiança baixa", cls: "bg-red-500/15 text-red-400" },
};

function isEndurance(m: Modality): boolean {
  return m !== "STRENGTH" && m !== "FUNCTIONAL";
}

interface Mesocycle {
  sequence: number;
  name: string;
  kind: string;
  weeks: number;
  startDate: string;
  endDate: string;
  intensityFocus: string;
}
interface WeekRow {
  sequence: number;
  startDate: string;
  endDate: string;
  phaseKind: string;
  isRecoveryWeek: boolean;
  isEventWeek: boolean;
  targetVolumeKm: number | null;
}
interface Rationale {
  strategyVersion: string;
  rules: { id: string; version: string; explanation: string }[];
  missingData: string[];
  caveats: string[];
  references: string[];
}
interface Preview {
  macrocycle: { totalWeeks: number; startDate: string; endDate: string };
  mesocycles: Mesocycle[];
  weeks: WeekRow[];
  confidence: string;
  rationale: Rationale;
}

interface SessionSuggestion {
  plannedDate: string;
  modality: string;
  kind: string;
  title: string;
  matched: boolean;
  objective: string | null;
  energySystem: string | null;
  adaptation: string | null;
  risk: string[];
  evidenceLevel: string | null;
  references: string[];
  predictedLoad: number | null;
  why: string;
}
interface WeekSuggestion {
  catalogVersion: string;
  sessions: SessionSuggestion[];
  confidence: string;
}

// Nível PT → nível do motor (3 faixas), espelhando toEngineLevel do servidor.
const LEVEL_TO_ENGINE: Record<string, string> = {
  INICIANTE: "BEGINNER",
  INTERMEDIARIO: "INTERMEDIATE",
  AVANCADO: "ADVANCED",
  ELITE: "ADVANCED",
};

// PhaseKind → um nome que o classificador do gerador reconhece de volta.
const PHASE_NAME: Record<string, string> = {
  BASE: "Base",
  BUILD: "Construção específica",
  PEAK: "Pico",
  TAPER: "Taper",
  TRANSITION: "Transição",
};

function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function PeriodizationStrategyModal({
  open,
  onClose,
  athletes,
  defaultAthleteId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  athletes: RosterEntry[];
  defaultAthleteId: string;
  onCreated: (athleteId: string, periodizationId: string) => void;
}) {
  const [athleteId, setAthleteId] = useState(defaultAthleteId);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [modality, setModality] = useState<Modality>("RUNNING");
  const [level, setLevel] = useState("");
  const [start, setStart] = useState(() => toISODate(new Date()));
  const [eventDate, setEventDate] = useState(() => toISODate(addDays(new Date(), 111)));
  const [weekdays, setWeekdays] = useState<number[]>([2, 4, 6]);
  const [baseVolume, setBaseVolume] = useState("");
  const [includeStrength, setIncludeStrength] = useState(false);
  const [notes, setNotes] = useState("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [suggestions, setSuggestions] = useState<WeekSuggestion | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<unknown>(null);

  function toggleDay(iso: number) {
    setPreview(null); // mudou a entrada — a prévia deixa de valer.
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort((a, b) => a - b),
    );
  }

  function buildBody() {
    const body: Record<string, unknown> = {
      title: title.trim() || `Plano ${MODALITY_LABEL[modality]}`,
      goal: goal.trim(),
      modality,
      startDate: start,
      eventDate,
      availableWeekdays: weekdays,
      includeStrength,
    };
    if (level) body.level = level;
    if (baseVolume.trim() && isEndurance(modality)) body.baseWeeklyVolumeKm = Number(baseVolume);
    if (notes.trim()) body.notes = notes.trim();
    return body;
  }

  async function runPreview() {
    if (!athleteId || !goal.trim()) {
      setError("Informe atleta e objetivo.");
      return;
    }
    setBusy("preview");
    setError(null);
    setSuggestions(null);
    try {
      const result = await apiFetch<Preview>(
        `/api/trainer/athletes/${athleteId}/periodizations/strategy/preview`,
        { method: "POST", body: JSON.stringify(buildBody()) },
      );
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err : "Não foi possível gerar a prévia.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!athleteId || !goal.trim()) {
      setError("Informe atleta e objetivo.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const result = await apiFetch<{ periodization: { id: string } }>(
        `/api/trainer/athletes/${athleteId}/periodizations/strategy`,
        { method: "POST", body: JSON.stringify(buildBody()) },
      );
      onCreated(athleteId, result.periodization.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err : "Não foi possível salvar o plano.");
    } finally {
      setBusy(null);
    }
  }

  // Escolhe uma semana representativa (a de maior carga na fase de construção) e
  // pede ao motor de sugestão as sessões-exemplo enriquecidas pelo catálogo —
  // fecha visualmente Fase 1 (estrutura) + 2 (biblioteca) + 3 (sugestão).
  async function loadExampleSessions() {
    if (!preview) return;
    if (weekdays.length === 0) {
      setError("Selecione ao menos um dia disponível para ver as sessões.");
      return;
    }
    const build = preview.weeks.filter((w) => w.phaseKind === "BUILD" && !w.isRecoveryWeek);
    const pool = build.length ? build : preview.weeks.filter((w) => !w.isRecoveryWeek);
    const week = pool.reduce<WeekRow | null>(
      (best, w) => ((w.targetVolumeKm ?? 0) > (best?.targetVolumeKm ?? -1) ? w : best),
      null,
    ) ?? preview.weeks[0];
    if (!week) return;

    setSuggestBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        goal: goal.trim(),
        modality,
        availableWeekdays: weekdays,
        phaseName: PHASE_NAME[week.phaseKind] ?? week.phaseKind,
        isRecoveryWeek: week.isRecoveryWeek,
        weekStartDate: week.startDate,
        weekEndDate: week.endDate,
        includeStrength,
      };
      const engineLevel = level ? LEVEL_TO_ENGINE[level] : undefined;
      if (engineLevel) body.level = engineLevel;
      if (week.targetVolumeKm != null) body.targetVolumeKm = week.targetVolumeKm;

      const result = await apiFetch<WeekSuggestion>(
        `/api/trainer/athletes/${athleteId}/session-suggestions`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setSuggestions(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err : "Não foi possível carregar as sessões.");
    } finally {
      setSuggestBusy(false);
    }
  }

  const conf = preview ? (CONFIDENCE_LABEL[preview.confidence] ?? CONFIDENCE_LABEL.LOW!) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar com ENKY — motor estratégico"
      description="O ENKY propõe o macrociclo a partir da prova e do atleta. Você revisa e decide — a proposta nasce rascunho."
      size="xl"
      footer={
        <>
          <button
            type="button"
            className={uiClasses.buttonGhost}
            onClick={runPreview}
            disabled={busy != null}
          >
            {busy === "preview" ? "Gerando…" : preview ? "Regerar prévia" : "Simular"}
          </button>
          <button
            type="button"
            className={uiClasses.button}
            onClick={save}
            disabled={busy != null || !preview}
            title={preview ? undefined : "Gere a prévia antes de salvar."}
          >
            {busy === "save" ? "Salvando…" : "Salvar rascunho"}
          </button>
        </>
      }
    >
      <ErrorNotice error={error} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="s-athlete" className={uiClasses.label}>
            Atleta
          </label>
          <select
            id="s-athlete"
            className={uiClasses.select}
            value={athleteId}
            onChange={(e) => {
              setPreview(null);
              setAthleteId(e.target.value);
            }}
          >
            {athletes.map((a) => (
              <option key={a.athleteProfileId} value={a.athleteProfileId}>
                {a.name ?? "Atleta"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-modality" className={uiClasses.label}>
            Modalidade
          </label>
          <select
            id="s-modality"
            className={uiClasses.select}
            value={modality}
            onChange={(e) => {
              setPreview(null);
              setModality(e.target.value as Modality);
            }}
          >
            {MODALITIES.map((m) => (
              <option key={m} value={m}>
                {MODALITY_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="s-goal" className={uiClasses.label}>
          Objetivo
        </label>
        <input
          id="s-goal"
          className={uiClasses.input}
          placeholder="Ex.: Maratona sub-4h"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="s-title" className={uiClasses.label}>
            Título (opcional)
          </label>
          <input
            id="s-title"
            className={uiClasses.input}
            placeholder="Ex.: Ciclo Maratona 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="s-level" className={uiClasses.label}>
            Nível (opcional)
          </label>
          <select
            id="s-level"
            className={uiClasses.select}
            value={level}
            onChange={(e) => {
              setPreview(null);
              setLevel(e.target.value);
            }}
          >
            <option value="">Assumir intermediário</option>
            {PERIODIZATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="s-start" className={uiClasses.label}>
            Início
          </label>
          <input
            id="s-start"
            type="date"
            className={uiClasses.input}
            value={start}
            max={eventDate}
            onChange={(e) => {
              setPreview(null);
              setStart(e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="s-event" className={uiClasses.label}>
            Data da prova
          </label>
          <input
            id="s-event"
            type="date"
            className={uiClasses.input}
            value={eventDate}
            min={start}
            onChange={(e) => {
              setPreview(null);
              setEventDate(e.target.value);
            }}
          />
        </div>
      </div>

      <div>
        <span className={uiClasses.label}>Dias disponíveis</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = weekdays.includes(d.iso);
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => toggleDay(d.iso)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-electric bg-electric/15 text-ink"
                    : "border-line bg-petrol/70 text-muted hover:border-line-strong"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {isEndurance(modality) && (
        <div>
          <label htmlFor="s-vol" className={uiClasses.label}>
            Volume semanal atual (km, opcional)
          </label>
          <input
            id="s-vol"
            type="number"
            min="0"
            className={uiClasses.input}
            placeholder="Sem isto, o motor usa um padrão e rebaixa a confiança"
            value={baseVolume}
            onChange={(e) => {
              setPreview(null);
              setBaseVolume(e.target.value);
            }}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          className="accent-electric"
          checked={includeStrength}
          onChange={(e) => {
            setPreview(null);
            setIncludeStrength(e.target.checked);
          }}
        />
        Incluir força complementar nos dias leves
      </label>

      <div>
        <label htmlFor="s-notes" className={uiClasses.label}>
          Observações (opcional)
        </label>
        <textarea
          id="s-notes"
          className={uiClasses.textarea}
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* ----------------------------- PRÉVIA ----------------------------- */}
      {preview && (
        <div className="mt-2 flex flex-col gap-4 rounded-xl border border-line bg-deep/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">
              Proposta · {preview.macrocycle.totalWeeks} semanas ·{" "}
              {preview.mesocycles.length} fases
            </h3>
            {conf && <span className={`${uiClasses.badge} ${conf.cls}`}>{conf.text}</span>}
          </div>

          {/* Fases */}
          <div className="flex flex-col gap-1.5">
            {preview.mesocycles.map((m) => (
              <div
                key={m.sequence}
                className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">
                  {m.name} <span className="text-xs text-faint">({m.kind})</span>
                </span>
                <span className="text-xs text-muted">
                  {fmtDay(m.startDate)} – {fmtDay(m.endDate)} · {m.weeks} sem
                </span>
              </div>
            ))}
          </div>

          {/* Semanas — resumo enxuto */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase tracking-wider text-faint">
                  <th className="py-1 pr-3">#</th>
                  <th className="py-1 pr-3">Período</th>
                  <th className="py-1 pr-3">Fase</th>
                  <th className="py-1 pr-3 text-right">Volume</th>
                  <th className="py-1">Marca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.weeks.map((w) => (
                  <tr key={w.sequence}>
                    <td className="py-1 pr-3 tabular text-muted">{w.sequence}</td>
                    <td className="py-1 pr-3 text-ink">
                      {fmtDay(w.startDate)} – {fmtDay(w.endDate)}
                    </td>
                    <td className="py-1 pr-3 text-muted">{w.phaseKind}</td>
                    <td className="py-1 pr-3 text-right tabular text-ink">
                      {w.targetVolumeKm != null ? `${w.targetVolumeKm} km` : "—"}
                    </td>
                    <td className="py-1">
                      {w.isEventWeek && (
                        <span className={`${uiClasses.badge} bg-electric/15 text-electric`}>
                          prova
                        </span>
                      )}
                      {w.isRecoveryWeek && (
                        <span className={`${uiClasses.badge} bg-turq/15 text-turq`}>
                          regenerativa
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Por quê (Fase 7 — explicabilidade) */}
          <details className="rounded-lg border border-line bg-petrol/50 p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Por que este plano? ({preview.rationale.rules.length} regras ·{" "}
              {preview.rationale.strategyVersion})
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
              {preview.rationale.rules.map((r) => (
                <li key={r.id} className="flex gap-2">
                  <span className="text-electric">›</span>
                  <span>{r.explanation}</span>
                </li>
              ))}
            </ul>

            {preview.rationale.missingData.length > 0 && (
              <p className="mt-2 text-xs text-orange">
                Dados ausentes (assumidos com aviso): {preview.rationale.missingData.join(", ")}.
              </p>
            )}

            {preview.rationale.caveats.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-[11px] text-faint">
                {preview.rationale.caveats.map((c, i) => (
                  <li key={i}>⚠ {c}</li>
                ))}
              </ul>
            )}

            {preview.rationale.references.length > 0 && (
              <div className="mt-2 border-t border-line pt-2 text-[11px] text-faint">
                <span className="font-medium">Referências:</span>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {preview.rationale.references.map((ref, i) => (
                    <li key={i}>· {ref}</li>
                  ))}
                </ul>
              </div>
            )}
          </details>

          {/* Sessões-exemplo enriquecidas pelo catálogo (Fase 3) */}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">Sessões de exemplo</span>
              <button
                type="button"
                className={uiClasses.buttonGhost}
                onClick={loadExampleSessions}
                disabled={suggestBusy}
              >
                {suggestBusy
                  ? "Carregando…"
                  : suggestions
                    ? "Recarregar"
                    : "Ver sessões da semana de maior carga"}
              </button>
            </div>

            {suggestions && (
              <div className="flex flex-col gap-2">
                {suggestions.sessions.length === 0 ? (
                  <p className="text-xs text-muted">Nenhuma sessão nesta semana.</p>
                ) : (
                  suggestions.sessions.map((s, i) => (
                    <div key={i} className="rounded-lg border border-line bg-petrol/50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{s.title}</span>
                        <span className="flex items-center gap-1.5 text-faint">
                          {s.predictedLoad != null && <span>~{s.predictedLoad} UA</span>}
                          {s.evidenceLevel && (
                            <span className={`${uiClasses.badge} bg-electric/15 text-electric`}>
                              Ev. {s.evidenceLevel}
                            </span>
                          )}
                        </span>
                      </div>
                      {s.objective && <p className="mt-1 text-muted">{s.objective}</p>}
                      {s.adaptation && (
                        <p className="mt-1 text-faint">
                          Sistema {s.energySystem} · {s.adaptation}
                        </p>
                      )}
                      {s.risk.length > 0 && (
                        <p className="mt-1 text-orange">Risco: {s.risk.join("; ")}.</p>
                      )}
                      {!s.matched && (
                        <p className="mt-1 text-faint">
                          Sem sessão de catálogo específica desta fase — análogo, revise a
                          intensidade.
                        </p>
                      )}
                    </div>
                  ))
                )}
                <p className="text-[11px] text-faint">
                  Exemplo da semana de maior carga · catálogo {suggestions.catalogVersion}. As
                  sessões só são criadas (como rascunho) quando você gerar o ciclo depois de salvar.
                </p>
              </div>
            )}
          </div>

          <p className={uiClasses.hint}>
            Confiança alta significa que o motor tinha os dados que a regra pede — não que a
            estratégia está certa para este atleta. A revisão é sua.
          </p>
        </div>
      )}
    </Modal>
  );
}
