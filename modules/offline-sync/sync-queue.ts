// Política PURA da fila de sincronização offline (Etapa 6, §17). Sem IndexedDB,
// sem fetch, sem Date.now — o adapter de browser (store + loop de envio) é glue
// e vive junto do cliente PWA. Aqui fica só o que precisa de teste: idempotência,
// backoff, seleção do que está "vencido" e transições de status.

export type SyncItemType =
  | "EXECUTION_STARTED"
  | "EXECUTION_EVENT"
  | "FEEDBACK_SUBMITTED"
  | "READINESS_SUBMITTED"
  | "NOTE_CREATED";

export type SyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export interface SyncItem {
  id: string;
  type: SyncItemType;
  payload: unknown;
  createdAt: number; // epoch ms
  attemptCount: number;
  lastAttemptAt: number | null;
  status: SyncStatus;
  idempotencyKey: string; // servidor deduplica com isto (§52)
}

export const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // teto de 5min

// ponytail: backoff exponencial determinístico (sem jitter — jitter exigiria
// random e a política precisa ser pura/testável). Adicionar jitter no adapter
// se muitos clientes ressincronizarem em rajada.
export function backoffMs(attemptCount: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attemptCount));
}

/** Um item terminou (bem ou mal) e não deve mais ser tentado. */
export function isDone(item: SyncItem): boolean {
  return item.status === "SYNCED" || item.status === "CONFLICT";
}

/** Esgotou as tentativas — fica FAILED de forma definitiva (§17: limite). */
export function isExhausted(item: SyncItem): boolean {
  return item.status === "FAILED" && item.attemptCount >= MAX_ATTEMPTS;
}

/** Está pronto para (re)tentar agora, respeitando o backoff. */
export function isDue(item: SyncItem, now: number): boolean {
  if (isDone(item) || item.status === "SYNCING" || isExhausted(item)) return false;
  if (item.lastAttemptAt === null) return true; // nunca tentado
  return now >= item.lastAttemptAt + backoffMs(item.attemptCount);
}

/**
 * Adiciona um item à fila deduplicando por idempotencyKey: se já existe um item
 * com a mesma chave que não falhou definitivamente, ignora — é isto que impede
 * feedback/conclusão duplicados quando a UI reenvia (§17).
 */
export function enqueue(items: readonly SyncItem[], item: SyncItem): SyncItem[] {
  const clash = items.find((i) => i.idempotencyKey === item.idempotencyKey && !isExhausted(i));
  if (clash) return [...items];
  return [...items, item];
}

/** Próximo lote a enviar: itens vencidos, mais antigos primeiro, até `limit`. */
export function nextBatch(items: readonly SyncItem[], now: number, limit = 10): SyncItem[] {
  return items
    .filter((i) => isDue(i, now))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, limit);
}

export type SyncResult = "OK" | "TRANSIENT" | "CONFLICT";

/**
 * Aplica o resultado de UMA tentativa de envio a um item, retornando a versão
 * atualizada (imutável). `TRANSIENT` incrementa a tentativa e volta a PENDING
 * (ou fica FAILED ao esgotar); `CONFLICT` é terminal e sobe para a UI resolver.
 */
export function applyResult(item: SyncItem, result: SyncResult, now: number): SyncItem {
  const base = { ...item, lastAttemptAt: now, attemptCount: item.attemptCount + 1 };
  switch (result) {
    case "OK":
      return { ...base, status: "SYNCED" };
    case "CONFLICT":
      return { ...base, status: "CONFLICT" };
    case "TRANSIENT":
      return { ...base, status: base.attemptCount >= MAX_ATTEMPTS ? "FAILED" : "PENDING" };
  }
}

/** Marca como em envio (evita reprocessar no mesmo loop). */
export function markSyncing(item: SyncItem): SyncItem {
  return { ...item, status: "SYNCING" };
}

/** Quantos itens ainda pendem — para avisar o usuário (§17). */
export function pendingCount(items: readonly SyncItem[]): number {
  return items.filter((i) => !isDone(i)).length;
}
