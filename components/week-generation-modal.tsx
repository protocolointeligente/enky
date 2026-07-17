"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { MODALITY_META, MODALITY_ORDER } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";
import { Modal } from "@/components/ui/modal";

// Geração assistida de UMA semana da periodização (Fase 6).
//
// A tela é deliberadamente honesta sobre o que o motor sabe: mostra a
// confiança, o que faltou de dado e a regra aplicada em cada decisão. O botão
// final é "revisar", nunca "publicar" — o motor entrega rascunho, quem publica
// é o treinador, um treino de cada vez.

interface GeneratedWorkout {
  id: string;
  title: string;
  plannedDate: string;
  modality: string;
}

interface AppliedRule {
  id: string;
  version: string;
  explanation: string;
}

interface Rationale {
  algorithmVersion: string;
  phaseKind: string;
  weekVolumeKm: number | null;
  rules: AppliedRule[];
  missingData: string[];
  caveats: string[];
}

interface GenerateResult {
  batchId: string;
  workouts: GeneratedWorkout[];
  confidence: "LOW" | "MODERATE" | "HIGH";
  rationale: Rationale;
  replacedDrafts: number;
}

export interface WeekTarget {
  periodizationId: string;
  weekId: string;
  sequence: number;
  startDate: string;
  endDate: string;
  phaseName: string | null;
  isRecoveryWeek: boolean;
  scheduledCount: number;
}

interface Props {
  week: WeekTarget | null;
  onClose: () => void;
  onGenerated: () => void | Promise<void>;
}

const LEVELS = [
  { value: "", label: "Não informar" },
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermediário" },
  { value: "ADVANCED", label: "Avançado" },
] as const;

// ISO: 1 = segunda … 7 = domingo, igual ao que o motor espera.
const WEEKDAYS = [
  { iso: 1, label: "Seg" },
  { iso: 2, label: "Ter" },
  { iso: 3, label: "Qua" },
  { iso: 4, label: "Qui" },
  { iso: 5, label: "Sex" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
] as const;

const CONFIDENCE_META: Record<GenerateResult["confidence"], { label: string; chip: string }> = {
  HIGH: { label: "Confiança alta", chip: "bg-turq/15 text-turq" },
  MODERATE: { label: "Confiança moderada", chip: "bg-orange/15 text-orange-hi" },
  LOW: { label: "Confiança baixa", chip: "bg-danger/15 text-danger" },
};

const MISSING_LABEL: Record<string, string> = {
  targetVolume: "volume alvo",
  level: "nível do atleta",
  phaseName: "fase do ciclo",
};

function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function WeekGenerationModal({ week, onClose, onGenerated }: Props) {
  const [modality, setModality] = useState<string>("RUNNING");
  const [level, setLevel] = useState<string>("INTERMEDIATE");
  const [weekdays, setWeekdays] = useState<number[]>([2, 4, 6]);
  const [includeStrength, setIncludeStrength] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Preenchido só quando o servidor recusa por já existirem rascunhos: a
  // substituição é uma decisão consciente, não um checkbox ligado por padrão.
  const [conflict, setConflict] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  function reset() {
    setError(null);
    setConflict(false);
    setResult(null);
  }

  function toggleDay(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort((a, b) => a - b),
    );
  }

  async function generate(replaceExisting: boolean) {
    if (!week || weekdays.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const generated = await apiFetch<GenerateResult>(
        `/api/trainer/periodizations/${week.periodizationId}/weeks/${week.weekId}/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            modality,
            level: level || undefined,
            availableWeekdays: weekdays,
            includeStrength,
            replaceExisting,
          }),
        },
      );
      setResult(generated);
      setConflict(false);
      await onGenerated();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível gerar.";
      setError(message);
      // 409 do serviço: a semana já tem rascunhos gerados.
      setConflict(/já tem/i.test(message));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    reset();
    onClose();
  }

  if (!week) return null;

  const confidence = result ? CONFIDENCE_META[result.confidence] : null;

  return (
    <Modal
      open
      onClose={close}
      size="lg"
      title={`Gerar semana ${week.sequence}`}
      description={`${fmtDay(week.startDate)} – ${fmtDay(week.endDate)}${
        week.phaseName ? ` · ${week.phaseName}` : " · sem fase definida"
      }${week.isRecoveryWeek ? " · semana regenerativa" : ""}`}
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${uiClasses.badge} ${confidence!.chip}`}>{confidence!.label}</span>
            <span className="text-sm text-muted">
              {result.workouts.length} rascunho(s) criado(s)
              {result.replacedDrafts > 0 ? ` · ${result.replacedDrafts} substituído(s)` : ""}
            </span>
          </div>

          {/* Nada é publicado: o treinador abre um a um para revisar. */}
          <p className={uiClasses.hint}>
            Tudo foi criado como <strong className="text-ink">rascunho</strong>. O atleta só enxerga
            depois que você revisar e publicar cada treino.
          </p>

          <div className="flex flex-col gap-2">
            {result.workouts.map((w) => {
              const meta = MODALITY_META[w.modality];
              return (
                <Link
                  key={w.id}
                  href={`/treinador/treinos/${w.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-electric"
                >
                  <span className="flex items-center gap-2">
                    {meta?.icon}
                    <span className="font-medium text-ink">{w.title}</span>
                  </span>
                  <span className="text-xs text-muted">{fmtDay(w.plannedDate)}</span>
                </Link>
              );
            })}
          </div>

          {result.rationale.missingData.length > 0 && (
            <div className={uiClasses.error}>
              <strong>Faltou dado:</strong>{" "}
              {result.rationale.missingData.map((d) => MISSING_LABEL[d] ?? d).join(", ")}. A
              prescrição foi gerada assim mesmo, com confiança rebaixada — preencha o que falta e
              gere de novo para um plano mais específico.
            </div>
          )}

          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Por que o motor decidiu assim ({result.rationale.rules.length} regras ·{" "}
              {result.rationale.algorithmVersion})
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {result.rationale.rules.map((rule) => (
                <li key={rule.id} className="text-xs text-muted">
                  <span className="font-mono text-faint">
                    {rule.id}@{rule.version}
                  </span>
                  <br />
                  {rule.explanation}
                </li>
              ))}
            </ul>
            {result.rationale.caveats.length > 0 && (
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-4">
                {result.rationale.caveats.map((caveat) => (
                  <li key={caveat} className="text-xs text-faint">
                    {caveat}
                  </li>
                ))}
              </ul>
            )}
          </details>

          <div className="flex justify-end gap-2">
            <button type="button" className={uiClasses.buttonGhost} onClick={reset}>
              Gerar de novo
            </button>
            <button type="button" className={uiClasses.button} onClick={close}>
              Concluir
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && <p className={uiClasses.error}>{error}</p>}

          <div>
            <label htmlFor="gen-modality" className={uiClasses.label}>
              Modalidade
            </label>
            <select
              id="gen-modality"
              className={uiClasses.select}
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            >
              {MODALITY_ORDER.map((m) => (
                <option key={m} value={m}>
                  {MODALITY_META[m]?.label ?? m}
                </option>
              ))}
            </select>
            {modality === "TRIATHLON" && (
              <p className="mt-1 text-xs text-faint">
                Gera sessões separadas de natação, ciclismo e corrida. O volume em km é dividido
                entre as disciplinas por uma proporção de referência — revise cada sessão.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gen-level" className={uiClasses.label}>
              Nível do atleta
            </label>
            <select
              id="gen-level"
              className={uiClasses.select}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {!level && (
              <p className="mt-1 text-xs text-faint">
                Sem o nível, o motor assume intermediário e rebaixa a confiança.
              </p>
            )}
          </div>

          <fieldset>
            <legend className={uiClasses.label}>Dias disponíveis na semana</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = weekdays.includes(d.iso);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d.iso)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      on
                        ? "border-electric bg-electric/15 text-electric-hi"
                        : "border-line text-muted hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-faint">
              O motor nunca agenda mais sessões do que o nível suporta, mesmo com a agenda cheia.
            </p>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeStrength}
              onChange={(e) => setIncludeStrength(e.target.checked)}
            />
            Incluir força complementar
          </label>

          {week.scheduledCount > 0 && !conflict && (
            <p className={uiClasses.hint}>
              Esta semana já tem {week.scheduledCount} treino(s) agendado(s).
            </p>
          )}

          {conflict ? (
            // Substituir só aparece depois que o servidor recusou — e o texto
            // diz exatamente o que sobrevive.
            <div className="flex flex-col gap-2">
              <p className={uiClasses.hint}>
                Treinos publicados ou que você já editou <strong className="text-ink">não</strong>{" "}
                serão tocados — só os rascunhos gerados e ainda intactos são refeitos.
              </p>
              <button
                type="button"
                className={uiClasses.buttonDanger}
                onClick={() => generate(true)}
                disabled={busy}
              >
                {busy ? "Gerando…" : "Substituir rascunhos e gerar"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={uiClasses.button}
              onClick={() => generate(false)}
              disabled={busy || weekdays.length === 0}
            >
              {busy ? "Gerando…" : "Gerar rascunhos"}
            </button>
          )}

          <p className="text-xs text-faint">
            O motor propõe, você dispõe: nada é publicado automaticamente.
          </p>
        </div>
      )}
    </Modal>
  );
}
