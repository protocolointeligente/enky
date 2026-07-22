// Lógica PURA de execução de treino (Etapa 6, §10-13-15). Sem React, sem I/O,
// sem Date.now: o "agora" é sempre injetado para ser testável e determinístico.
// Timestamps são epoch em ms (o `occurredAt` do cliente), então a contagem de
// tempo é recalculada a partir de marcos — sobrevive a lock de tela / background,
// que congelam setInterval mas não os timestamps (§13).

export type ExecStatus =
  | "STARTED"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "ABANDONED";

export type ExecEventType =
  | "START"
  | "PAUSE"
  | "RESUME"
  | "STEP_COMPLETED"
  | "STEP_SKIPPED"
  | "BLOCK_COMPLETED"
  | "EXERCISE_COMPLETED"
  | "LAP"
  | "NOTE"
  | "ABANDON"
  | "COMPLETE"
  | "SYNC";

export interface ExecEvent {
  type: ExecEventType;
  at: number; // epoch ms — quando o evento ocorreu no cliente
  sequence: number; // ordem determinística por execução
  idempotencyKey: string; // dedupe da fila offline
  /** COMPLETE pode marcar conclusão parcial. */
  partial?: boolean;
}

const TERMINAL: ReadonlySet<ExecStatus> = new Set([
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "ABANDONED",
]);

export function isTerminal(status: ExecStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * Próximo status ao aplicar um evento de transição, ou `null` se o evento não
 * altera o status (STEP_COMPLETED, NOTE, LAP…) ou é inválido a partir daqui
 * (ex.: RESUME quando não está pausado, qualquer coisa após terminal).
 */
export function nextStatus(status: ExecStatus, event: ExecEvent): ExecStatus | null {
  if (isTerminal(status)) return null;
  switch (event.type) {
    case "PAUSE":
      return status === "STARTED" ? "PAUSED" : null;
    case "RESUME":
      return status === "PAUSED" ? "STARTED" : null;
    case "ABANDON":
      return "ABANDONED";
    case "COMPLETE":
      return event.partial ? "PARTIALLY_COMPLETED" : "COMPLETED";
    default:
      return null; // START e eventos de progresso não mudam o status
  }
}

/**
 * Remove duplicatas por `idempotencyKey` (a fila offline pode reenviar) e ordena
 * por `sequence`, com desempate estável por `at`. Primeira ocorrência vence.
 */
export function dedupeAndOrder(events: readonly ExecEvent[]): ExecEvent[] {
  const seen = new Set<string>();
  const unique: ExecEvent[] = [];
  for (const e of events) {
    if (seen.has(e.idempotencyKey)) continue;
    seen.add(e.idempotencyKey);
    unique.push(e);
  }
  return unique.sort((a, b) => a.sequence - b.sequence || a.at - b.at);
}

export interface ExecTime {
  elapsedSeconds: number; // relógio de parede do início ao fim/agora
  activeSeconds: number; // exclui intervalos pausados
}

/**
 * Contagem de tempo por timestamp. `elapsed` = início→fim (ou →agora se ainda
 * ativo). `active` = elapsed menos os intervalos pausados. Robusto a: pausas
 * consecutivas sem resume, resume sem pause, e execução encerrada enquanto pausada.
 */
export function computeTime(events: readonly ExecEvent[], now: number): ExecTime {
  const ordered = dedupeAndOrder(events);
  const start = ordered.find((e) => e.type === "START");
  if (!start) return { elapsedSeconds: 0, activeSeconds: 0 };

  const terminal = ordered.find((e) => e.type === "ABANDON" || e.type === "COMPLETE");
  const end = Math.max(start.at, terminal ? terminal.at : now);

  let pausedMs = 0;
  let pauseStart: number | null = null;
  for (const e of ordered) {
    if (e.at < start.at || e.at > end) continue;
    if (e.type === "PAUSE" && pauseStart === null) pauseStart = e.at;
    else if (e.type === "RESUME" && pauseStart !== null) {
      pausedMs += e.at - pauseStart;
      pauseStart = null;
    }
  }
  if (pauseStart !== null) pausedMs += end - pauseStart; // encerrado/agora enquanto pausado

  const elapsedMs = end - start.at;
  const activeMs = Math.max(0, elapsedMs - pausedMs);
  return {
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    activeSeconds: Math.floor(activeMs / 1000),
  };
}

/**
 * Formata segundos como cronômetro: `m:ss` abaixo de 1h, `h:mm:ss` acima.
 * O hook React de UI chama isto a cada tick, mas o número vem sempre de
 * `computeTime` (timestamp), não de um contador acumulado — por isso a exibição
 * se corrige sozinha após lock de tela / background (§13).
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export interface ExecSnapshot extends ExecTime {
  status: ExecStatus;
}

/**
 * Reduz um fluxo de eventos ao estado atual da execução (status + tempos).
 * Eventos inválidos/duplicados são ignorados sem quebrar — o servidor confia
 * nisto para reconciliar o que a fila offline entregar (§17-18).
 */
export function reduce(events: readonly ExecEvent[], now: number): ExecSnapshot {
  const ordered = dedupeAndOrder(events);
  let status: ExecStatus = "STARTED";
  for (const e of ordered) {
    const next = nextStatus(status, e);
    if (next) status = next;
  }
  return { status, ...computeTime(ordered, now) };
}
