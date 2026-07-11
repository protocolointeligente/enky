import { describe, expect, it } from "vitest";
import { computeLoadState } from "@/modules/intelligence/load-state";

// Série diária constante de tamanho n.
function flat(value: number, days: number): number[] {
  return Array.from({ length: days }, () => value);
}

describe("load-state (CTL/ATL/TSB/ACWR/monotony/ramp)", () => {
  it("carga constante estabilizada (série longa) → CTL≈ATL≈carga, ACWR≈1, TSB≈0", () => {
    // A CTL (tc 42d) leva ~4× a constante para convergir — por isso 200 dias.
    const s = computeLoadState(flat(100, 200));
    expect(s.ctl).toBeGreaterThan(95);
    expect(s.ctl).toBeLessThan(101);
    expect(s.atl).toBeGreaterThan(95);
    expect(s.acwr as number).toBeGreaterThan(0.95);
    expect(s.acwr as number).toBeLessThan(1.05);
    expect(Math.abs(s.tsb)).toBeLessThan(3);
    expect(s.dataDays).toBe(200);
  });

  it("pico agudo recente → ATL sobe acima da CTL (ACWR alto, TSB negativo)", () => {
    const s = computeLoadState([...flat(50, 60), ...flat(220, 10)]);
    expect(s.acwr as number).toBeGreaterThan(1.3);
    expect(s.tsb).toBeLessThan(0);
    expect(s.rampPct as number).toBeGreaterThan(0);
  });

  it("carga constante tem desvio zero → monotonia indefinida (null)", () => {
    const s = computeLoadState(flat(100, 30));
    expect(s.monotony).toBeNull();
  });

  it("sem treino → CTL/ATL zerados e dataDays 0", () => {
    const s = computeLoadState(flat(0, 40));
    expect(s.ctl).toBe(0);
    expect(s.acwr).toBeNull();
    expect(s.dataDays).toBe(0);
  });

  it("monotonia = média/desvio da última semana", () => {
    // últimos 7 dias: 100,0,100,0,100,0,100 → média ~57, DP > 0 → monotonia finita
    const s = computeLoadState([...flat(80, 30), 100, 0, 100, 0, 100, 0, 100]);
    expect(s.monotony).not.toBeNull();
    expect(s.monotony as number).toBeGreaterThan(0);
  });
});
