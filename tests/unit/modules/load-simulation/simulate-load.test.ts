import { describe, expect, it } from "vitest";
import { computeLoadState } from "@/modules/intelligence/load-state";
import {
  projectLoad,
  seedFromHistory,
  type ProposedLoad,
} from "@/modules/load-simulation/simulate-load";

// Motor de simulação (Fase 6) — projeção pura. Deve usar a MESMA matemática do
// load-state: o seed do histórico tem de bater com o CTL/ATL que o computeLoadState
// deriva para a mesma série.

describe("seedFromHistory", () => {
  it("bate com o CTL/ATL do computeLoadState para a mesma série", () => {
    const history = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 50 : 0));
    const seed = seedFromHistory(history);
    const state = computeLoadState(history);
    expect(seed.ctl).toBeCloseTo(state.ctl, 6);
    expect(seed.atl).toBeCloseTo(state.atl, 6);
  });

  it("série vazia parte do zero", () => {
    expect(seedFromHistory([])).toEqual({ ctl: 0, atl: 0 });
  });
});

describe("projectLoad", () => {
  const steadyHistory = Array.from({ length: 42 }, () => 60); // carga constante

  function week(startISO: string, dailyLoad: number, days: number[]): ProposedLoad[] {
    // days = dias ISO (1=seg…7=dom) relativos à semana começando em startISO (segunda).
    const base = Date.parse(`${startISO}T00:00:00.000Z`);
    return days.map((d) => ({
      date: new Date(base + (d - 1) * 86_400_000).toISOString().slice(0, 10),
      load: dailyLoad,
    }));
  }

  it("sem sessões futuras, a carga aguda decai e o TSB sobe (repouso)", () => {
    const sim = projectLoad(steadyHistory, [{ date: "2026-03-02", load: 0 }]);
    // Um único dia de carga 0: ATL cai mais rápido que CTL ⇒ TSB do fim ≥ do início.
    expect(sim.end.tsb).toBeGreaterThanOrEqual(sim.start.tsb);
  });

  it("carga alta sustentada derruba o TSB (fadiga acumulada)", () => {
    // 3 semanas de carga pesada.
    const proposed: ProposedLoad[] = [
      ...week("2026-03-02", 120, [1, 3, 5, 7]),
      ...week("2026-03-09", 120, [1, 3, 5, 7]),
      ...week("2026-03-16", 120, [1, 3, 5, 7]),
    ];
    const sim = projectLoad(steadyHistory, proposed);
    expect(sim.peak.tsbMin).toBeLessThan(sim.start.tsb);
    // CTL sobe com a carga crônica maior que a de partida.
    expect(sim.peak.ctl).toBeGreaterThan(sim.start.ctl);
  });

  it("agrega a carga semanal por segunda-feira ISO", () => {
    const proposed = week("2026-03-02", 50, [1, 3, 5]); // seg/qua/sex da mesma semana
    const sim = projectLoad(steadyHistory, proposed);
    expect(sim.weekly).toHaveLength(1);
    expect(sim.weekly[0]!.weekStart).toBe("2026-03-02");
    expect(sim.weekly[0]!.load).toBe(150);
  });

  it("a trajetória cobre todos os dias entre a primeira e a última sessão", () => {
    const proposed = week("2026-03-02", 40, [1, 7]); // segunda e domingo
    const sim = projectLoad(steadyHistory, proposed);
    expect(sim.days).toHaveLength(7); // seg…dom inclusive, mesmo com carga só em 2 dias
    expect(sim.days[0]!.date).toBe("2026-03-02");
    expect(sim.days[6]!.date).toBe("2026-03-08");
  });

  it("sem histórico e sem futuro, tudo parte do zero", () => {
    const sim = projectLoad([], []);
    expect(sim.start).toEqual({ ctl: 0, atl: 0, tsb: 0 });
    expect(sim.days).toHaveLength(0);
    expect(sim.weekly).toHaveLength(0);
  });
});
