import { describe, expect, it } from "vitest";
import { computePmcSeries } from "@/modules/intelligence/load-state";

describe("computePmcSeries — Performance Management Chart", () => {
  it("série vazia devolve vazio", () => {
    expect(computePmcSeries([])).toEqual([]);
  });

  it("um ponto por dia", () => {
    expect(computePmcSeries([100, 0, 50])).toHaveLength(3);
  });

  it("carga constante converge CTL e ATL para o nível; TSB → ~0", () => {
    const s = computePmcSeries(Array(300).fill(100));
    const last = s[s.length - 1]!;
    expect(last.ctl).toBeGreaterThan(95);
    expect(last.atl).toBeGreaterThan(95);
    expect(Math.abs(last.tsb)).toBeLessThan(1);
  });

  it("após um pico, ATL sobe mais que CTL e o TSB do dia seguinte fica negativo (fadiga)", () => {
    const s = computePmcSeries([0, 0, 0, 0, 0, 0, 0, 300, 0]);
    const spike = s[7]!;
    expect(spike.atl).toBeGreaterThan(spike.ctl); // fadiga aguda > fitness
    expect(s[8]!.tsb).toBeLessThan(0); // forma negativa no dia após o pico
  });
});
