"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { MODALITY_META, MODALITY_ORDER } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";
import { Modal } from "@/components/ui/modal";

// Geração assistida da periodização (Fase 6) — uma semana ou o ciclo inteiro.
//
// A tela é deliberadamente honesta sobre o que o motor sabe: mostra a
// confiança, o que faltou de dado e a regra aplicada em cada decisão. O botão
// final é "revisar", nunca "publicar" — o motor entrega rascunho, quem publica
// é o treinador, um treino de cada vez. Isso vale para os DOIS modos: o
// "automático" decide os parâmetros, não decide o que o atleta enxerga.

interface GeneratedWorkout {
  id: string;
  title: string;
  plannedDate: string;
  modality: string;
  weekSequence: number;
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

type Confidence = "LOW" | "MODERATE" | "HIGH";

interface WeekOutcome {
  weekId: string;
  sequence: number;
  confidence: Confidence;
  workoutCount: number;
}

interface GenerateResult {
  batchId: string;
  scope: "SINGLE_WEEK" | "FULL_CYCLE";
  mode: "ASSISTED" | "AUTOMATIC";
  workouts: GeneratedWorkout[];
  confidence: Confidence;
  rationale: Rationale | null;
  weeks: WeekOutcome[];
  replacedDrafts: number;
}

export interface GenerationTarget {
  kind: "week" | "cycle";
  periodizationId: string;
  /** null quando o alvo é o ciclo inteiro. */
  weekId: string | null;
  sequence: number | null;
  startDate: string;
  endDate: string;
  phaseName: string | null;
  isRecoveryWeek: boolean;
  /** Semanas do plano — só usado no alvo "cycle". */
  weekCount: number;
}

interface CycleBatchStatus {
  batchId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  failureCode: string | null;
  workoutCount: number;
}

interface Props {
  target: GenerationTarget | null;
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

const CONFIDENCE_META: Record<Confidence, { label: string; chip: string }> = {
  HIGH: { label: "Confiança alta", chip: "bg-turq/15 text-turq" },
  MODERATE: { label: "Confiança moderada", chip: "bg-orange/15 text-orange-hi" },
  LOW: { label: "Confiança baixa", chip: "bg-danger/15 text-danger" },
};

const MISSING_LABEL: Record<string, string> = {
  targetVolume: "volume alvo",
  level: "nível do atleta",
  phaseName: "fase do ciclo",
  modality: "modalidade (deduzida)",
  availableWeekdays: "dias disponíveis (deduzidos)",
};

function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function WeekGenerationModal({ target, onClose, onGenerated }: Props) {
  const [mode, setMode] = useState<"ASSISTED" | "AUTOMATIC">("ASSISTED");
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
  // Geração em segundo plano (Fase 9): dispara o job e acompanha por polling.
  const [asyncBatch, setAsyncBatch] = useState<CycleBatchStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }
  // Garante que o polling pare se o componente desmontar.
  useEffect(() => stopPolling, []);

  function reset() {
    setError(null);
    setConflict(false);
    setResult(null);
    setAsyncBatch(null);
    stopPolling();
  }

  function toggleDay(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort((a, b) => a - b),
    );
  }

  async function generate(replaceExisting: boolean) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const path =
        target.kind === "cycle"
          ? `/api/trainer/periodizations/${target.periodizationId}/generate`
          : `/api/trainer/periodizations/${target.periodizationId}/weeks/${target.weekId}/generate`;

      const generated = await apiFetch<GenerateResult>(path, {
        method: "POST",
        body: JSON.stringify({
          mode,
          // No automático o motor deduz; mandar os defaults do formulário
          // faria a dedução parecer escolha do treinador.
          modality: mode === "ASSISTED" ? modality : undefined,
          availableWeekdays: mode === "ASSISTED" ? weekdays : undefined,
          level: level || undefined,
          includeStrength,
          replaceExisting,
        }),
      });
      setResult(generated);
      setConflict(false);
      await onGenerated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível gerar.");
      // Pelo CÓDIGO, não pela frase: o texto do erro é conteúdo de produto e
      // muda; o contrato é o code do ConflictError (409).
      setConflict(err instanceof ApiClientError && err.code === "CONFLICT");
    } finally {
      setBusy(false);
    }
  }

  function startPolling(batchId: string, periodizationId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await apiFetch<CycleBatchStatus>(
          `/api/trainer/periodizations/${periodizationId}/batches/${batchId}`,
        );
        setAsyncBatch(s);
        if (s.status === "COMPLETED" || s.status === "FAILED") {
          stopPolling();
          if (s.status === "COMPLETED") await onGenerated();
        }
      } catch {
        // Erro transitório de rede — mantém o polling.
      }
    }, 2500);
  }

  async function generateAsync() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const { batchId } = await apiFetch<{ batchId: string }>(
        `/api/trainer/periodizations/${target.periodizationId}/generate/async`,
        {
          method: "POST",
          body: JSON.stringify({
            mode,
            modality: mode === "ASSISTED" ? modality : undefined,
            availableWeekdays: mode === "ASSISTED" ? weekdays : undefined,
            level: level || undefined,
            includeStrength,
            replaceExisting: false,
          }),
        },
      );
      setAsyncBatch({ batchId, status: "PENDING", failureCode: null, workoutCount: 0 });
      startPolling(batchId, target.periodizationId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível iniciar a geração.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    reset();
    onClose();
  }

  if (!target) return null;

  const isCycle = target.kind === "cycle";
  const confidence = result ? CONFIDENCE_META[result.confidence] : null;
  const canSubmit = mode === "AUTOMATIC" || weekdays.length > 0;

  return (
    <Modal
      open
      onClose={close}
      size="lg"
      title={isCycle ? "Gerar ciclo inteiro" : `Gerar semana ${target.sequence}`}
      description={
        isCycle
          ? `${target.weekCount} semanas · ${fmtDay(target.startDate)} – ${fmtDay(target.endDate)}`
          : `${fmtDay(target.startDate)} – ${fmtDay(target.endDate)}${
              target.phaseName ? ` · ${target.phaseName}` : " · sem fase definida"
            }${target.isRecoveryWeek ? " · semana regenerativa" : ""}`
      }
    >
      {asyncBatch ? (
        <div className="flex flex-col gap-4">
          {asyncBatch.status === "FAILED" ? (
            <p className={uiClasses.error}>
              A geração em segundo plano falhou
              {asyncBatch.failureCode ? `: ${asyncBatch.failureCode}` : "."}
            </p>
          ) : asyncBatch.status === "COMPLETED" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${uiClasses.badge} bg-turq/15 text-turq`}>Concluído</span>
              <span className="text-sm text-muted">
                {asyncBatch.workoutCount} rascunho(s) criado(s)
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${uiClasses.badge} bg-electric/15 text-electric-hi`}>Gerando…</span>
              <span className="text-sm text-muted">
                Processando em segundo plano — pode fechar esta janela; os rascunhos aparecem no
                plano quando prontos.
              </span>
            </div>
          )}
          <p className={uiClasses.hint}>
            Tudo nasce <strong className="text-ink">rascunho</strong>. Nada é publicado
            automaticamente.
          </p>
          <div className="flex justify-end">
            <button type="button" className={uiClasses.button} onClick={close}>
              {asyncBatch.status === "COMPLETED" || asyncBatch.status === "FAILED"
                ? "Concluir"
                : "Fechar"}
            </button>
          </div>
        </div>
      ) : result ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${uiClasses.badge} ${confidence!.chip}`}>{confidence!.label}</span>
            <span className="text-sm text-muted">
              {result.workouts.length} rascunho(s) criado(s)
              {result.weeks.length > 1 ? ` em ${result.weeks.length} semanas` : ""}
              {result.replacedDrafts > 0 ? ` · ${result.replacedDrafts} substituído(s)` : ""}
            </span>
          </div>

          {/* Nada é publicado: o treinador abre um a um para revisar. */}
          <p className={uiClasses.hint}>
            Tudo foi criado como <strong className="text-ink">rascunho</strong>. O atleta só enxerga
            depois que você revisar e publicar cada treino.
          </p>

          {result.weeks.length > 1 && (
            <p className="text-xs text-faint">
              A confiança do lote é a da pior semana — um ciclo não é mais confiável que a semana
              com menos dados.
            </p>
          )}

          {isCycle ? (
            // As sessões do ciclo inteiro, agrupadas por semana. Cada semana é
            // um bloco recolhível para o treinador ver as sessões (com a
            // modalidade) sem afogar 36 links de uma vez.
            <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
              {result.weeks.map((week, i) => {
                const sessions = result.workouts.filter((w) => w.weekSequence === week.sequence);
                return (
                  <details
                    key={week.weekId}
                    className="rounded-lg border border-line"
                    open={i === 0}
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-semibold text-ink">Semana {week.sequence}</span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`${uiClasses.badge} ${CONFIDENCE_META[week.confidence].chip}`}
                        >
                          {CONFIDENCE_META[week.confidence].label}
                        </span>
                        <span className="text-xs text-muted">{sessions.length} sessão(ões)</span>
                      </span>
                    </summary>
                    <div className="flex flex-col gap-1 border-t border-line p-2">
                      {sessions.map((w) => (
                        <Link
                          key={w.id}
                          href={`/treinador/treinos/${w.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface"
                        >
                          <span className="flex items-center gap-2">
                            {MODALITY_META[w.modality]?.icon}
                            <span className="text-ink">{w.title}</span>
                          </span>
                          <span className="text-xs text-muted">{fmtDay(w.plannedDate)}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
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
          )}

          {result.rationale && result.rationale.missingData.length > 0 && (
            <div className={uiClasses.error}>
              <strong>Faltou dado:</strong>{" "}
              {result.rationale.missingData.map((d) => MISSING_LABEL[d] ?? d).join(", ")}. A
              prescrição foi gerada assim mesmo, com confiança rebaixada — preencha o que falta e
              gere de novo para um plano mais específico.
            </div>
          )}

          {result.rationale && (
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
          )}

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

          <fieldset>
            <legend className={uiClasses.label}>Quem escolhe os parâmetros</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "ASSISTED", label: "Eu informo" },
                  { value: "AUTOMATIC", label: "Deduzir do histórico" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === option.value
                      ? "border-electric bg-electric/15 text-electric-hi"
                      : "border-line text-muted hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-faint">
              {mode === "AUTOMATIC"
                ? "O motor deduz a modalidade e os dias a partir dos treinos dos últimos 60 dias. Cada dedução rebaixa a confiança — e nenhum modo publica sozinho."
                : "Você define a modalidade e os dias; o motor só monta a semana."}
            </p>
          </fieldset>

          {mode === "ASSISTED" && (
            <>
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
                  O motor nunca agenda mais sessões do que o nível suporta, mesmo com a agenda
                  cheia.
                </p>
              </fieldset>
            </>
          )}

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
            <p className="mt-1 text-xs text-faint">
              {level
                ? "Nível nunca é deduzido do histórico: frequência não é nível."
                : "Sem o nível, o motor assume intermediário e rebaixa a confiança."}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeStrength}
              onChange={(e) => setIncludeStrength(e.target.checked)}
            />
            Incluir força complementar
          </label>

          {isCycle && !conflict && (
            <p className={uiClasses.hint}>
              Gera as {target.weekCount} semanas de uma vez, cada uma com a regra da sua fase.
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={uiClasses.button}
                onClick={() => generate(false)}
                disabled={busy || !canSubmit}
              >
                {busy ? "Gerando…" : "Gerar rascunhos"}
              </button>
              {isCycle && (
                <button
                  type="button"
                  className={uiClasses.buttonSecondary}
                  onClick={generateAsync}
                  disabled={busy || !canSubmit}
                  title="Dispara a geração e libera a interface — acompanhe o progresso aqui"
                >
                  Gerar em segundo plano
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-faint">
            O motor propõe, você dispõe: nada é publicado automaticamente, em nenhum modo.
          </p>
        </div>
      )}
    </Modal>
  );
}
