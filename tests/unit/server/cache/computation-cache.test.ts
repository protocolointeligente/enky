import { describe, expect, it } from "vitest";
import {
  ComputationCache,
  stableKey,
  type Clock,
} from "@/server/cache/computation-cache";

function fakeClock(start = 0): Clock & { advance: (ms: number) => void } {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe("ComputationCache", () => {
  it("guarda e devolve valores; miss vira undefined", () => {
    const c = new ComputationCache<number>({ maxEntries: 10, ttlMs: 1000, clock: fakeClock() });
    expect(c.get("a")).toBeUndefined();
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("expira por TTL", () => {
    const clock = fakeClock();
    const c = new ComputationCache<number>({ maxEntries: 10, ttlMs: 1000, clock });
    c.set("a", 1);
    clock.advance(999);
    expect(c.get("a")).toBe(1);
    clock.advance(1); // agora t = 1000 = expiresAt → expirado
    expect(c.get("a")).toBeUndefined();
    expect(c.size).toBe(0); // a entrada expirada foi removida na leitura
  });

  it("despeja a entrada MENOS recentemente usada ao estourar o teto", () => {
    const c = new ComputationCache<number>({ maxEntries: 2, ttlMs: 10_000, clock: fakeClock() });
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // 'a' vira a mais recente; 'b' passa a ser a mais antiga
    c.set("c", 3); // estoura → despeja 'b'
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });

  it("getOrCompute computa uma vez e reaproveita", () => {
    const c = new ComputationCache<number>({ maxEntries: 10, ttlMs: 1000, clock: fakeClock() });
    let calls = 0;
    const compute = () => {
      calls += 1;
      return 42;
    };
    expect(c.getOrCompute("k", compute)).toBe(42);
    expect(c.getOrCompute("k", compute)).toBe(42);
    expect(calls).toBe(1); // segundo acesso veio do cache
  });

  it("registra hits e misses", () => {
    const c = new ComputationCache<number>({ maxEntries: 10, ttlMs: 1000, clock: fakeClock() });
    c.get("x"); // miss
    c.set("x", 1);
    c.get("x"); // hit
    const s = c.stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(1);
  });
});

describe("stableKey", () => {
  it("independe da ordem dos campos", () => {
    expect(stableKey({ a: 1, b: 2 })).toBe(stableKey({ b: 2, a: 1 }));
  });

  it("distingue entradas diferentes", () => {
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }));
    expect(stableKey({ days: [1, 3, 5] })).not.toBe(stableKey({ days: [1, 3] }));
  });
});
