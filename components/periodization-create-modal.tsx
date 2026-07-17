"use client";

import { useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { addDays, toISODate } from "@/app/_lib/calendar";
import { Modal } from "@/components/ui/modal";
import {
  DIFFICULTY_DISTRIBUTIONS,
  LOAD_CONTROL_METHODS,
  MODALITIES,
  PERIODIZATION_LEVELS,
} from "@/modules/periodization/periodization-schema";

// Modal "Criar periodização" (Fase 04). Sobreposto — mantém a lista de planos
// visível ao fundo (Interface Spec). Dropdowns reduzem digitação; os parâmetros
// se ajustam à modalidade (multiesporte ≠ genérico). Salvar como rascunho não
// exige objetivo/modalidade. Regra de negócio vive no serviço/Zod — este
// componente só monta o corpo e chama a API.

interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
}

const MODALITY_LABEL: Record<(typeof MODALITIES)[number], string> = {
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

const DIFFICULTY_LABEL: Record<(typeof DIFFICULTY_DISTRIBUTIONS)[number], string> = {
  LINEAR: "Linear",
  ONDULATORIA: "Ondulatória",
  POLARIZADA: "Polarizada",
  EM_BLOCOS: "Em blocos",
};

// Campos de parâmetro relevantes por modalidade. `num` = input numérico;
// `text` = texto; `list` = texto separado por vírgula → array.
type ParamField = { key: string; label: string; kind: "num" | "text" | "list" };
const PARAMS_BY_MODALITY: Record<(typeof MODALITIES)[number], ParamField[]> = {
  RUNNING: [
    { key: "vdot", label: "VDOT", kind: "num" },
    { key: "pace", label: "Pace alvo (mm:ss/km)", kind: "text" },
    { key: "hrZone", label: "Zona de FC", kind: "text" },
    { key: "rpeTarget", label: "RPE alvo", kind: "num" },
    { key: "distanceKm", label: "Distância (km)", kind: "num" },
    { key: "durationMin", label: "Duração (min)", kind: "num" },
  ],
  CYCLING: [
    { key: "ftp", label: "FTP (W)", kind: "num" },
    { key: "tss", label: "TSS", kind: "num" },
    { key: "hrZone", label: "Zona de FC", kind: "text" },
    { key: "rpeTarget", label: "RPE alvo", kind: "num" },
    { key: "durationMin", label: "Duração (min)", kind: "num" },
  ],
  SWIMMING: [
    { key: "css", label: "CSS / ritmo crítico", kind: "text" },
    { key: "pacePer100m", label: "Ritmo /100m", kind: "text" },
    { key: "distanceKm", label: "Distância (km)", kind: "num" },
    { key: "rpeTarget", label: "RPE alvo", kind: "num" },
    { key: "durationMin", label: "Duração (min)", kind: "num" },
  ],
  TRIATHLON: [
    { key: "vdot", label: "VDOT (corrida)", kind: "num" },
    { key: "ftp", label: "FTP (ciclismo, W)", kind: "num" },
    { key: "css", label: "CSS (natação)", kind: "text" },
    { key: "rpeTarget", label: "RPE alvo", kind: "num" },
  ],
  STRENGTH: [
    { key: "frequency", label: "Frequência semanal", kind: "num" },
    { key: "sets", label: "Séries", kind: "num" },
    { key: "reps", label: "Repetições (ex.: 8-12)", kind: "text" },
    { key: "rir", label: "RIR", kind: "num" },
    { key: "tonnage", label: "Tonelagem alvo", kind: "num" },
    { key: "muscleGroups", label: "Grupos musculares (vírgula)", kind: "list" },
  ],
  FUNCTIONAL: [
    { key: "movementPattern", label: "Padrão de movimento", kind: "text" },
    { key: "density", label: "Densidade", kind: "text" },
    { key: "durationMin", label: "Duração (min)", kind: "num" },
    { key: "rpeTarget", label: "RPE alvo", kind: "num" },
    { key: "equipment", label: "Equipamento (vírgula)", kind: "list" },
  ],
};

type Modality = (typeof MODALITIES)[number];

export function PeriodizationCreateModal({
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
  const [modality, setModality] = useState<Modality | "">("");
  const [targetEvent, setTargetEvent] = useState("");
  const [level, setLevel] = useState("");
  const [start, setStart] = useState(() => toISODate(new Date()));
  const [end, setEnd] = useState(() => toISODate(addDays(new Date(), 83)));
  const [loadControlMethod, setLoadControlMethod] = useState("");
  const [mainUnit, setMainUnit] = useState("");
  const [totalVolume, setTotalVolume] = useState("");
  const [mesocycleCount, setMesocycleCount] = useState("");
  const [microcycleCount, setMicrocycleCount] = useState("");
  const [recoveryStrategy, setRecoveryStrategy] = useState("");
  const [difficultyDistribution, setDifficultyDistribution] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [notes, setNotes] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"draft" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildParameters() {
    if (!modality) return undefined;
    const out: Record<string, unknown> = {};
    for (const field of PARAMS_BY_MODALITY[modality]) {
      const raw = params[field.key]?.trim();
      if (!raw) continue;
      if (field.kind === "num") {
        const n = Number(raw);
        if (!Number.isNaN(n)) out[field.key] = n;
      } else if (field.kind === "list") {
        const arr = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (arr.length > 0) out[field.key] = arr;
      } else {
        out[field.key] = raw;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  async function submit(isDraft: boolean) {
    if (!athleteId || !title.trim()) {
      setError("Informe atleta e título.");
      return;
    }
    setBusy(isDraft ? "draft" : "create");
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        goal: goal.trim(),
        startDate: start,
        endDate: end,
        autoGenerate,
        isDraft,
      };
      if (modality) body.modality = modality;
      if (targetEvent.trim()) body.targetEvent = targetEvent.trim();
      if (level) body.level = level;
      if (loadControlMethod) body.loadControlMethod = loadControlMethod;
      if (mainUnit.trim()) body.mainUnit = mainUnit.trim();
      if (totalVolume.trim()) body.totalVolume = Number(totalVolume);
      if (mesocycleCount.trim()) body.mesocycleCount = Number(mesocycleCount);
      if (microcycleCount.trim()) body.microcycleCount = Number(microcycleCount);
      if (recoveryStrategy.trim()) body.recoveryStrategy = recoveryStrategy.trim();
      if (difficultyDistribution) body.difficultyDistribution = difficultyDistribution;
      if (notes.trim()) body.notes = notes.trim();
      const parameters = buildParameters();
      if (parameters) body.parameters = parameters;

      const result = await apiFetch<{ periodization: { id: string } }>(
        `/api/trainer/athletes/${athleteId}/periodizations`,
        { method: "POST", body: JSON.stringify(body) },
      );
      onCreated(athleteId, result.periodization.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível salvar o plano.");
    } finally {
      setBusy(null);
    }
  }

  const modalityFields = modality ? PARAMS_BY_MODALITY[modality] : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar periodização"
      description="Desenhe o macrociclo. Salve como rascunho para completar depois."
      size="lg"
      footer={
        <>
          <button
            type="button"
            className={uiClasses.buttonGhost}
            onClick={() => submit(true)}
            disabled={busy != null}
          >
            {busy === "draft" ? "Salvando…" : "Salvar rascunho"}
          </button>
          <button
            type="button"
            className={uiClasses.button}
            onClick={() => submit(false)}
            disabled={busy != null}
          >
            {busy === "create" ? "Criando…" : "Criar plano"}
          </button>
        </>
      }
    >
      {error && <p className={uiClasses.error}>{error}</p>}

      <div>
        <label htmlFor="p-athlete" className={uiClasses.label}>
          Atleta
        </label>
        <select
          id="p-athlete"
          className={uiClasses.select}
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
        >
          {athletes.map((a) => (
            <option key={a.athleteProfileId} value={a.athleteProfileId}>
              {a.name ?? "Atleta"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="p-title" className={uiClasses.label}>
          Título do plano
        </label>
        <input
          id="p-title"
          className={uiClasses.input}
          placeholder="Ex.: Base para 21k"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-modality" className={uiClasses.label}>
            Modalidade
          </label>
          <select
            id="p-modality"
            className={uiClasses.select}
            value={modality}
            onChange={(e) => setModality(e.target.value as Modality | "")}
          >
            <option value="">Selecione…</option>
            {MODALITIES.map((m) => (
              <option key={m} value={m}>
                {MODALITY_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-level" className={uiClasses.label}>
            Nível
          </label>
          <select
            id="p-level"
            className={uiClasses.select}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">Selecione…</option>
            {PERIODIZATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="p-goal" className={uiClasses.label}>
          Objetivo
        </label>
        <input
          id="p-goal"
          className={uiClasses.input}
          placeholder="Ex.: Concluir meia maratona em 12 semanas"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="p-event" className={uiClasses.label}>
          Prova-alvo (opcional)
        </label>
        <input
          id="p-event"
          className={uiClasses.input}
          placeholder="Ex.: Maratona de Porto Alegre — 2026-11-08"
          value={targetEvent}
          onChange={(e) => setTargetEvent(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="p-start" className={uiClasses.label}>
            Início
          </label>
          <input
            id="p-start"
            type="date"
            className={uiClasses.input}
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="p-end" className={uiClasses.label}>
            Fim
          </label>
          <input
            id="p-end"
            type="date"
            className={uiClasses.input}
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-load" className={uiClasses.label}>
            Método de controle de carga
          </label>
          <select
            id="p-load"
            className={uiClasses.select}
            value={loadControlMethod}
            onChange={(e) => setLoadControlMethod(e.target.value)}
          >
            <option value="">Selecione…</option>
            {LOAD_CONTROL_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-difficulty" className={uiClasses.label}>
            Distribuição de dificuldade
          </label>
          <select
            id="p-difficulty"
            className={uiClasses.select}
            value={difficultyDistribution}
            onChange={(e) => setDifficultyDistribution(e.target.value)}
          >
            <option value="">Selecione…</option>
            {DIFFICULTY_DISTRIBUTIONS.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="p-unit" className={uiClasses.label}>
            Unidade principal
          </label>
          <input
            id="p-unit"
            className={uiClasses.input}
            placeholder="km, min…"
            value={mainUnit}
            onChange={(e) => setMainUnit(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="p-volume" className={uiClasses.label}>
            Volume total
          </label>
          <input
            id="p-volume"
            type="number"
            min="0"
            className={uiClasses.input}
            value={totalVolume}
            onChange={(e) => setTotalVolume(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="p-meso" className={uiClasses.label}>
            Mesociclos
          </label>
          <input
            id="p-meso"
            type="number"
            min="0"
            className={uiClasses.input}
            value={mesocycleCount}
            onChange={(e) => setMesocycleCount(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="p-micro" className={uiClasses.label}>
            Microciclos
          </label>
          <input
            id="p-micro"
            type="number"
            min="0"
            className={uiClasses.input}
            value={microcycleCount}
            onChange={(e) => setMicrocycleCount(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="p-recovery" className={uiClasses.label}>
          Recuperação
        </label>
        <input
          id="p-recovery"
          className={uiClasses.input}
          placeholder="Ex.: 1 semana leve a cada 3"
          value={recoveryStrategy}
          onChange={(e) => setRecoveryStrategy(e.target.value)}
        />
      </div>

      {modalityFields.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-faint">
            Parâmetros — {MODALITY_LABEL[modality as Modality]}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {modalityFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`p-param-${f.key}`} className={uiClasses.label}>
                  {f.label}
                </label>
                <input
                  id={`p-param-${f.key}`}
                  type={f.kind === "num" ? "number" : "text"}
                  className={uiClasses.input}
                  value={params[f.key] ?? ""}
                  onChange={(e) => setParams((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          className="accent-electric"
          checked={autoGenerate}
          onChange={(e) => setAutoGenerate(e.target.checked)}
        />
        Geração automática de sessões (sugestões continuam como rascunho)
      </label>

      <div>
        <label htmlFor="p-notes" className={uiClasses.label}>
          Observações (opcional)
        </label>
        <textarea
          id="p-notes"
          className={uiClasses.textarea}
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
