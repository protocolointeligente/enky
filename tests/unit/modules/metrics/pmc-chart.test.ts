import { describe, expect, it } from "vitest";
import { buildPmcChart, pmcSummaryText, pmcTrend, type ChartPoint } from "@/modules/metrics/pmc-chart";

function series(vals: Array<Partial<ChartPoint>>): ChartPoint[] {
  return vals.map((v, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    ctl: 0,
    atl: 0,
    tsb: 0,
    load: 0,
    ...v,
  }));
}

describe("buildPmcChart", () => {
  it("returns null with fewer than 2 points (empty state, no degenerate chart)", () => {
    expect(buildPmcChart([])).toBeNull();
    expect(buildPmcChart(series([{ ctl: 10 }]))).toBeNull();
  });

  it("builds one path per series with a coordinate per point", () => {
    const g = buildPmcChart(series([{ ctl: 10, atl: 8, tsb: 2 }, { ctl: 12, atl: 9, tsb: 3 }, { ctl: 14, atl: 7, tsb: 7 }]))!;
    expect(g).not.toBeNull();
    // 3 points → path starts with M and has 2 L segments each.
    for (const key of ["ctl", "atl", "tsb"] as const) {
      expect(g.paths[key].startsWith("M")).toBe(true);
      expect(g.paths[key].match(/L/g)?.length).toBe(2);
    }
  });

  it("places TSB=0 line inside the plot when TSB goes negative", () => {
    const g = buildPmcChart(series([{ ctl: 20, atl: 25, tsb: -5 }, { ctl: 22, atl: 20, tsb: 2 }]))!;
    expect(g.zeroY).not.toBeNull();
    expect(g.zeroY!).toBeGreaterThanOrEqual(g.plot.y);
    expect(g.zeroY!).toBeLessThanOrEqual(g.plot.y + g.plot.h);
  });

  it("has no zero line when all values are non-negative", () => {
    const g = buildPmcChart(series([{ ctl: 5, atl: 4, tsb: 1 }, { ctl: 6, atl: 4, tsb: 2 }]))!;
    expect(g.zeroY).toBeNull();
  });

  it("caps x-axis labels for long series and always includes the last date", () => {
    const long = series(Array.from({ length: 365 }, (_, i) => ({ ctl: i % 50, atl: i % 30, tsb: (i % 20) - 10 })));
    const g = buildPmcChart(long)!;
    expect(g.xTicks.length).toBeLessThanOrEqual(7);
    expect(g.xTicks[g.xTicks.length - 1]!.x).toBeCloseTo(g.xAt[364]!, 1);
  });

  it("draws a bar only for days with load (never fabricates load for gaps)", () => {
    const g = buildPmcChart(series([{ ctl: 10, load: 100 }, { ctl: 11, load: 0 }, { ctl: 12, load: 50 }]))!;
    expect(g.loadBars.length).toBe(2); // the zero-load day gets no bar
  });
});

describe("pmcTrend", () => {
  it("reports rising chronic load", () => {
    const pts = series(Array.from({ length: 10 }, (_, i) => ({ ctl: 10 + i })));
    expect(pmcTrend(pts)!.direction).toBe("subindo");
  });
  it("reports falling chronic load", () => {
    const pts = series(Array.from({ length: 10 }, (_, i) => ({ ctl: 30 - i })));
    expect(pmcTrend(pts)!.direction).toBe("descendo");
  });
  it("reports stable when change is within the deadband", () => {
    const pts = series(Array.from({ length: 10 }, () => ({ ctl: 20 })));
    expect(pmcTrend(pts)!.direction).toBe("estavel");
  });
  it("returns null with insufficient points", () => {
    expect(pmcTrend(series([{ ctl: 10 }]))).toBeNull();
  });
});

describe("pmcSummaryText", () => {
  const BANNED = /prontid|risco|lesão|lesao|diagn|pronto para/i;
  it("never uses diagnostic/readiness language across cases", () => {
    for (const dir of ["subindo", "descendo", "estavel"] as const) {
      for (const tsb of [-30, -5, 12]) {
        const text = pmcSummaryText({ direction: dir, deltaCtl: 0 }, tsb);
        expect(text).not.toMatch(BANNED);
        expect(text.length).toBeGreaterThan(20);
      }
    }
  });
  it("flags recovery only when form is deeply negative, non-prescriptively", () => {
    expect(pmcSummaryText({ direction: "subindo", deltaCtl: 3 }, -20)).toMatch(/recupera/i);
    expect(pmcSummaryText({ direction: "estavel", deltaCtl: 0 }, 10)).toMatch(/positiva/i);
  });
});
