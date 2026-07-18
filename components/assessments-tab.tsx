"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { Modal } from "@/components/ui/modal";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  ASSESSMENT_SOURCES,
  ASSESSMENT_TYPES,
  CONFIDENCE_LEVELS,
} from "@/modules/assessments/assessment-schema";

// Aba Avaliações da página 360º (fatia E): lista o histórico, cria (rascunho),
// valida (DRAFT→VALID, supersede) e identifica a atual/expirada. O cálculo de
// zonas (fatias C/D) já consome estas avaliações.

interface AssessmentRow {
  id: string;
  assessmentType: string;
  modality: string | null;
  protocolCode: string;
  protocolVersion: string;
  assessmentDate: string;
  source: string;
  status: string;
  confidence: string;
  validUntil: string | null;
  measurements: Record<string, unknown>;
  notes: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  HEART_RATE: "Frequência cardíaca",
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  STRENGTH: "Musculação",
  BODY_COMPOSITION: "Composição corporal",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  VALID: { label: "Atual", cls: "bg-turq/15 text-turq" },
  DRAFT: { label: "Rascunho", cls: "bg-orange/15 text-orange-hi" },
  SUPERSEDED: { label: "Substituída", cls: "bg-surface text-faint" },
  EXPIRED: { label: "Expirada", cls: "bg-danger/15 text-danger" },
  INVALID: { label: "Inválida", cls: "bg-surface text-faint" },
};

// Campos de medição por tipo (chaves = assessment-schema). `s/km` e `s/100m` em
// segundos (o refinamento mm:ss é um follow-up).
type FieldKind = "int" | "num" | "text" | "select";
const FIELDS: Record<string, { key: string; label: string; kind: FieldKind; options?: string[] }[]> = {
  HEART_RATE: [
    { key: "restingHeartRate", label: "FC repouso (bpm)", kind: "int" },
    { key: "maximumHeartRate", label: "FC máxima (bpm)", kind: "int" },
    { key: "thresholdHeartRate", label: "FC limiar (bpm)", kind: "int" },
    {
      key: "measurementMethod",
      label: "Método FC máx",
      kind: "select",
      options: ["MEDIDA", "ESTIMADA_POR_IDADE", "TESTE_DE_CAMPO", "TESTE_LABORATORIAL", "LIMIAR"],
    },
  ],
  RUNNING: [
    { key: "vdot", label: "VDOT", kind: "num" },
    { key: "vam", label: "VAM (km/h)", kind: "num" },
    { key: "criticalSpeed", label: "Vel. crítica (km/h)", kind: "num" },
    { key: "thresholdPace", label: "Pace limiar (s/km)", kind: "int" },
    { key: "pace5k", label: "Pace 5k (s/km)", kind: "int" },
  ],
  CYCLING: [
    { key: "ftp", label: "FTP (W)", kind: "int" },
    { key: "criticalPower", label: "Potência crítica (W)", kind: "int" },
    { key: "thresholdHeartRate", label: "FC limiar (bpm)", kind: "int" },
  ],
  SWIMMING: [
    { key: "css", label: "CSS (s/100m)", kind: "int" },
    { key: "pacePer100m", label: "Ritmo /100m (s)", kind: "int" },
  ],
  STRENGTH: [
    { key: "exerciseId", label: "Exercício (ID, opcional)", kind: "text" },
    { key: "oneRepMax", label: "1RM medido (kg)", kind: "num" },
    { key: "testLoadKg", label: "Carga do teste (kg)", kind: "num" },
    { key: "testRepetitions", label: "Repetições", kind: "int" },
    {
      key: "formulaCode",
      label: "Fórmula",
      kind: "select",
      options: ["ONE_RM_DIRECT", "EPLEY", "BRZYCKI", "LANDER", "O_CONNER"],
    },
  ],
  BODY_COMPOSITION: [
    { key: "weightKg", label: "Peso (kg)", kind: "num" },
    { key: "bodyFatPercentage", label: "% gordura", kind: "num" },
  ],
};

function today(): string {
  // Sem Date.now proibido aqui? Este é client — new Date() é permitido no browser.
  return new Date().toISOString().slice(0, 10);
}

export function AssessmentsTab({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    return apiFetch<{ assessments: AssessmentRow[] }>(
      `/api/trainer/athletes/${athleteId}/assessments`,
    )
      .then((r) => {
        setRows(r.assessments);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiClientError ? e : "Erro ao carregar avaliações."));
  }, [athleteId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function validate(id: string) {
    try {
      await apiFetch(`/api/trainer/assessments/${id}/validate`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e : "Não foi possível validar.");
    }
  }

  const byType = new Map<string, AssessmentRow[]>();
  for (const r of rows) {
    const list = byType.get(r.assessmentType) ?? [];
    list.push(r);
    byType.set(r.assessmentType, list);
  }

  if (loading) return <p className="text-sm text-muted">Carregando avaliações…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className={uiClasses.hint}>Cadastre e valide as avaliações que alimentam as zonas.</p>
        <button type="button" className={uiClasses.button} onClick={() => setCreateOpen(true)}>
          Nova avaliação
        </button>
      </div>

      <ErrorNotice error={error} />

      {rows.length === 0 ? (
        <div className={`${uiClasses.card} text-sm text-muted`}>
          Nenhuma avaliação registrada. Cadastre a primeira para calcular zonas.
        </div>
      ) : (
        [...byType.entries()].map(([type, list]) => (
          <div key={type} className={`${uiClasses.panel} p-4`}>
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">
              {TYPE_LABEL[type] ?? type}
            </h3>
            <ul className="flex flex-col gap-2">
              {list.map((a) => {
                const meta = STATUS_META[a.status] ?? { label: a.status, cls: "bg-surface text-faint" };
                const expiredSoon = a.validUntil && a.status === "VALID" && a.validUntil < today();
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  >
                    <span className={`${uiClasses.badge} ${meta.cls}`}>{meta.label}</span>
                    <span className="text-ink">{a.assessmentDate}</span>
                    <span className="text-xs text-muted">
                      {a.protocolCode} v{a.protocolVersion}
                      {a.modality ? ` · ${modalityLabel(a.modality)}` : ""}
                    </span>
                    <span className="text-xs text-faint">
                      {a.source.toLowerCase()} · confiança {a.confidence.toLowerCase()}
                      {a.validUntil ? ` · validade ${a.validUntil}` : ""}
                    </span>
                    {expiredSoon && <span className="text-xs text-danger">⚠ vencida</span>}
                    <span className="ml-auto text-xs text-faint">{summary(a)}</span>
                    {a.status === "DRAFT" && (
                      <button
                        type="button"
                        className="text-xs font-medium text-turq hover:underline"
                        onClick={() => validate(a.id)}
                      >
                        Validar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {createOpen && (
        <CreateAssessmentModal
          athleteId={athleteId}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

// Resumo curto das medições para a linha da lista.
function summary(a: AssessmentRow): string {
  const m = a.measurements;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "number") parts.push(`${k} ${v}`);
    if (parts.length >= 2) break;
  }
  return parts.join(" · ");
}

function CreateAssessmentModal({
  athleteId,
  onClose,
  onCreated,
}: {
  athleteId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [type, setType] = useState<string>("HEART_RATE");
  const [protocolCode, setProtocolCode] = useState("FIELD_TEST");
  const [date, setDate] = useState(today());
  const [source, setSource] = useState("MEASURED");
  const [confidence, setConfidence] = useState("MODERATE");
  const [validUntil, setValidUntil] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fields = FIELDS[type] ?? [];
  const needsModality = ["RUNNING", "CYCLING", "SWIMMING"].includes(type);

  function buildMeasurements(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = values[f.key]?.trim();
      if (!raw) continue;
      if (f.kind === "int") out[f.key] = Number.parseInt(raw, 10);
      else if (f.kind === "num") out[f.key] = Number.parseFloat(raw);
      else out[f.key] = raw;
    }
    return out;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const modality =
        type === "RUNNING" ? "RUNNING" : type === "CYCLING" ? "CYCLING" : type === "SWIMMING" ? "SWIMMING" : undefined;
      const body: Record<string, unknown> = {
        assessmentType: type,
        protocolCode: protocolCode.trim(),
        assessmentDate: date,
        source,
        confidence,
        measurements: buildMeasurements(),
      };
      if (modality) body.modality = modality;
      if (validUntil) body.validUntil = validUntil;
      await apiFetch(`/api/trainer/athletes/${athleteId}/assessments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await onCreated();
    } catch (e) {
      setError(e instanceof ApiClientError ? e : "Não foi possível salvar a avaliação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova avaliação"
      description="Escolha o tipo e o protocolo; preencha os campos relevantes."
      size="lg"
      footer={
        <button type="button" className={uiClasses.button} onClick={submit} disabled={busy}>
          {busy ? "Salvando…" : "Salvar rascunho"}
        </button>
      }
    >
      <ErrorNotice error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={uiClasses.label}>Tipo</label>
          <select
            className={uiClasses.select}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setValues({});
            }}
          >
            {ASSESSMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={uiClasses.label}>Protocolo</label>
          <input
            className={uiClasses.input}
            value={protocolCode}
            onChange={(e) => setProtocolCode(e.target.value)}
          />
        </div>
        <div>
          <label className={uiClasses.label}>Data</label>
          <input
            type="date"
            className={uiClasses.input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className={uiClasses.label}>Validade (opcional)</label>
          <input
            type="date"
            className={uiClasses.input}
            value={validUntil}
            min={date}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div>
          <label className={uiClasses.label}>Fonte</label>
          <select className={uiClasses.select} value={source} onChange={(e) => setSource(e.target.value)}>
            {ASSESSMENT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={uiClasses.label}>Confiança</label>
          <select
            className={uiClasses.select}
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            {CONFIDENCE_LEVELS.map((c) => (
              <option key={c} value={c}>
                {c.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsModality && (
        <p className="mt-1 text-[11px] text-faint">Modalidade definida pelo tipo ({TYPE_LABEL[type]}).</p>
      )}

      <fieldset className="mt-3 flex flex-col gap-2 rounded-lg border border-line p-3">
        <legend className="px-1 text-xs font-semibold text-faint">Medições</legend>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className={uiClasses.label}>{f.label}</label>
              {f.kind === "select" ? (
                <select
                  className={uiClasses.select}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {f.options!.map((o) => (
                    <option key={o} value={o}>
                      {o.toLowerCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind === "text" ? "text" : "number"}
                  className={uiClasses.input}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
