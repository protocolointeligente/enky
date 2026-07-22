import { describe, expect, it } from "vitest";
import {
  applyResult,
  backoffMs,
  enqueue,
  isDue,
  isExhausted,
  MAX_ATTEMPTS,
  nextBatch,
  pendingCount,
  type SyncItem,
} from "@/modules/offline-sync/sync-queue";

function item(over: Partial<SyncItem> = {}): SyncItem {
  return {
    id: over.id ?? "1",
    type: "EXECUTION_EVENT",
    payload: {},
    createdAt: 1000,
    attemptCount: 0,
    lastAttemptAt: null,
    status: "PENDING",
    idempotencyKey: over.idempotencyKey ?? "key-1",
    ...over,
  };
}

describe("backoffMs", () => {
  it("cresce exponencial e satura no teto", () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(5 * 60 * 1000); // teto
  });
});

describe("enqueue", () => {
  it("não duplica por idempotencyKey (não duplica feedback/conclusão)", () => {
    const q = enqueue([item({ id: "1", idempotencyKey: "k" })], item({ id: "2", idempotencyKey: "k" }));
    expect(q).toHaveLength(1);
  });
  it("permite re-enfileirar se o anterior esgotou", () => {
    const dead = item({ id: "1", idempotencyKey: "k", status: "FAILED", attemptCount: MAX_ATTEMPTS });
    const q = enqueue([dead], item({ id: "2", idempotencyKey: "k" }));
    expect(q).toHaveLength(2);
  });
  it("adiciona chaves distintas", () => {
    const q = enqueue([item({ idempotencyKey: "a" })], item({ id: "2", idempotencyKey: "b" }));
    expect(q).toHaveLength(2);
  });
});

describe("isDue", () => {
  it("nunca tentado está vencido", () => {
    expect(isDue(item(), 5000)).toBe(true);
  });
  it("respeita o backoff após falha", () => {
    const failed = item({ status: "PENDING", attemptCount: 1, lastAttemptAt: 10_000 });
    expect(isDue(failed, 11_000)).toBe(false); // backoff(1)=2000 → precisa 12_000
    expect(isDue(failed, 12_000)).toBe(true);
  });
  it("SYNCING/SYNCED/CONFLICT/exhausted não estão vencidos", () => {
    expect(isDue(item({ status: "SYNCING" }), 9e9)).toBe(false);
    expect(isDue(item({ status: "SYNCED" }), 9e9)).toBe(false);
    expect(isDue(item({ status: "CONFLICT" }), 9e9)).toBe(false);
    expect(isDue(item({ status: "FAILED", attemptCount: MAX_ATTEMPTS }), 9e9)).toBe(false);
  });
});

describe("applyResult", () => {
  it("OK → SYNCED", () => {
    expect(applyResult(item(), "OK", 2000).status).toBe("SYNCED");
  });
  it("CONFLICT → CONFLICT (terminal)", () => {
    expect(applyResult(item(), "CONFLICT", 2000).status).toBe("CONFLICT");
  });
  it("TRANSIENT volta a PENDING e conta tentativa", () => {
    const r = applyResult(item({ attemptCount: 0 }), "TRANSIENT", 2000);
    expect(r.status).toBe("PENDING");
    expect(r.attemptCount).toBe(1);
    expect(r.lastAttemptAt).toBe(2000);
  });
  it("TRANSIENT na última tentativa → FAILED definitivo", () => {
    const r = applyResult(item({ attemptCount: MAX_ATTEMPTS - 1 }), "TRANSIENT", 2000);
    expect(r.status).toBe("FAILED");
    expect(isExhausted(r)).toBe(true);
  });
});

describe("nextBatch", () => {
  it("retorna vencidos, mais antigos primeiro, respeitando limite", () => {
    const items = [
      item({ id: "b", idempotencyKey: "b", createdAt: 3000 }),
      item({ id: "a", idempotencyKey: "a", createdAt: 1000 }),
      item({ id: "done", idempotencyKey: "d", status: "SYNCED" }),
    ];
    const batch = nextBatch(items, 5000, 10);
    expect(batch.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("pendingCount", () => {
  it("conta o que ainda não terminou", () => {
    const items = [item({ status: "SYNCED" }), item({ id: "2", status: "PENDING" }), item({ id: "3", status: "FAILED" })];
    expect(pendingCount(items)).toBe(2);
  });
});
