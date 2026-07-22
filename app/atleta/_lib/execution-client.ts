// Cliente de execução offline-first (Etapa 6, §16-17). Glue de browser: persiste
// em IndexedDB, enfileira via política pura (modules/offline-sync) e envia para
// as APIs start/events. Nenhuma regra de negócio aqui — só orquestração.
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { idbDelete, idbGet, idbGetAll, idbPut, STORE_EXECUTIONS, STORE_QUEUE } from "@/app/_lib/idb";
import {
  applyResult,
  enqueue,
  markSyncing,
  nextBatch,
  pendingCount,
  type SyncItem,
  type SyncResult,
} from "@/modules/offline-sync/sync-queue";
import type { ExecEvent, ExecEventType } from "@/modules/workout-execution/execution-state";
import type { ExecEventInput } from "@/modules/workout-execution/execution-schema";

// Códigos de erro que valem retry (transitórios). O resto é permanente → CONFLICT,
// para não ficar reenviando o que nunca vai passar.
const TRANSIENT_CODES = new Set([
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "EXTERNAL_SERVICE_ERROR",
  "AUTHENTICATION_ERROR",
]);

export interface LocalExecution {
  id: string; // localExecutionId (keyPath da store)
  workoutId: string;
  serverId: string | null; // preenchido quando o "start" sincroniza
  events: ExecEvent[]; // eventos locais, inclui START sintético para o timer
  nextSequence: number;
  startedAt: number;
}

function uuid(): string {
  return crypto.randomUUID();
}

/** Inicia uma execução localmente (funciona offline) e enfileira o start. */
export async function startExecution(workoutId: string): Promise<LocalExecution> {
  const now = Date.now();
  const startIdempotencyKey = uuid();
  // START local só para o timer; o servidor ancora o tempo em startedAt.
  const exec: LocalExecution = {
    id: uuid(),
    workoutId,
    serverId: null,
    events: [{ type: "START", at: now, sequence: 0, idempotencyKey: uuid() }],
    nextSequence: 1,
    startedAt: now,
  };
  await idbPut(STORE_EXECUTIONS, exec);
  await enqueueItem("EXECUTION_STARTED", startIdempotencyKey, {
    localExecutionId: exec.id,
    workoutId,
    idempotencyKey: startIdempotencyKey,
  });
  void flush();
  return exec;
}

/** Registra um evento de execução (STEP_COMPLETED, PAUSE, COMPLETE, ABANDON…). */
// Planejado-vs-realizado (§15) viaja no payload: além de posição (block/step),
// os valores reais da série de musculação (reps/carga/RIR). Passthrough no schema.
export type EventPayload = Record<string, number | undefined>;

export async function recordEvent(
  localExecutionId: string,
  type: ExecEventType,
  payload?: EventPayload,
  partial?: boolean,
): Promise<LocalExecution | null> {
  const exec = await idbGet<LocalExecution>(STORE_EXECUTIONS, localExecutionId);
  if (!exec) return null;
  const now = Date.now();
  const idempotencyKey = uuid();
  const sequence = exec.nextSequence;
  exec.events.push({ type, at: now, sequence, idempotencyKey, partial });
  exec.nextSequence += 1;
  await idbPut(STORE_EXECUTIONS, exec);

  const event: ExecEventInput = { type, sequence, occurredAt: now, idempotencyKey, payload, partial };
  await enqueueItem("EXECUTION_EVENT", idempotencyKey, { localExecutionId, event });
  void flush();
  return exec;
}

async function enqueueItem(
  type: SyncItem["type"],
  idempotencyKey: string,
  payload: unknown,
): Promise<void> {
  const queue = await idbGetAll<SyncItem>(STORE_QUEUE);
  const item: SyncItem = {
    id: uuid(),
    type,
    payload,
    createdAt: Date.now(),
    attemptCount: 0,
    lastAttemptAt: null,
    status: "PENDING",
    idempotencyKey,
  };
  // enqueue (puro) dedupe por idempotencyKey: só persiste se realmente entrou.
  if (enqueue(queue, item).length > queue.length) await idbPut(STORE_QUEUE, item);
  notify();
}

let flushing = false;

/** Tenta enviar o que está vencido na fila. Idempotente e seguro para chamar à vontade. */
export async function flush(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    const queue = await idbGetAll<SyncItem>(STORE_QUEUE);
    for (const item of nextBatch(queue, Date.now())) {
      await idbPut(STORE_QUEUE, markSyncing(item));
      const result = await send(item);
      const updated = applyResult(item, result, Date.now());
      if (updated.status === "SYNCED") await idbDelete(STORE_QUEUE, item.id);
      else await idbPut(STORE_QUEUE, updated);
    }
  } finally {
    flushing = false;
    notify();
  }
}

async function send(item: SyncItem): Promise<SyncResult> {
  try {
    if (item.type === "EXECUTION_STARTED") {
      const p = item.payload as { localExecutionId: string; workoutId: string; idempotencyKey: string };
      const { execution } = await apiFetch<{ execution: { id: string } }>(
        `/api/athlete/workouts/${p.workoutId}/execution/start`,
        { method: "POST", body: JSON.stringify({ idempotencyKey: p.idempotencyKey }) },
      );
      const exec = await idbGet<LocalExecution>(STORE_EXECUTIONS, p.localExecutionId);
      if (exec) {
        exec.serverId = execution.id;
        await idbPut(STORE_EXECUTIONS, exec);
      }
      return "OK";
    }
    if (item.type === "EXECUTION_EVENT") {
      const p = item.payload as { localExecutionId: string; event: ExecEventInput };
      const exec = await idbGet<LocalExecution>(STORE_EXECUTIONS, p.localExecutionId);
      // Depende do start ter sincronizado (temos o serverId). Se não, espera —
      // o start foi enfileirado antes, então flush já o processa primeiro.
      if (!exec?.serverId) return "TRANSIENT";
      await apiFetch(`/api/athlete/executions/${exec.serverId}/events`, {
        method: "POST",
        body: JSON.stringify({ events: [p.event] }),
      });
      return "OK";
    }
    return "OK";
  } catch (err) {
    if (err instanceof ApiClientError) return TRANSIENT_CODES.has(err.code) ? "TRANSIENT" : "CONFLICT";
    return "TRANSIENT"; // falha de rede / offline
  }
}

// --- pendências (para avisar o usuário, §17) ---
const listeners = new Set<(n: number) => void>();

export function subscribePending(fn: (n: number) => void): () => void {
  listeners.add(fn);
  void getPendingCount().then(fn);
  return () => listeners.delete(fn);
}

export async function getPendingCount(): Promise<number> {
  return pendingCount(await idbGetAll<SyncItem>(STORE_QUEUE));
}

function notify(): void {
  void getPendingCount().then((n) => listeners.forEach((l) => l(n)));
}

let booted = false;

/** Liga o flush ao voltar a conexão e faz um flush inicial. Chamar uma vez no cliente. */
export function initSync(): void {
  if (booted || typeof window === "undefined") return;
  booted = true;
  window.addEventListener("online", () => void flush());
  void flush();
}
