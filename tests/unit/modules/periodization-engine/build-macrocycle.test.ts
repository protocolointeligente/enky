import { describe, expect, it } from "vitest";
import {
  buildMacrocycle,
  toWeekContexts,
} from "@/modules/periodization-engine/build-macrocycle";
import { STRATEGY_VERSION } from "@/modules/periodization-engine/strategy-rules";
import { classifyPhase, planWeek } from "@/modules/periodization/generation-rules";
import type { StrategicInputs } from "@/modules/periodization-engine/periodization-engine-types";

// Motor estratégico — função pura, testada sem banco. Janela de referência:
// 2026-01-05 (segunda) até a prova, semanas alinhadas a segunda→domingo.

function inputs(overrides: Partial<StrategicInputs> = {}): StrategicInputs {
  return {
    modality: "RUNNING",
    goal: "Maratona de São Paulo",
    startDate: "2026-01-05",
    eventDate: "2026-04-26", // ~16 semanas
    level: "INTERMEDIATE",
    availableWeekdays: [1, 3, 5, 7],
    baseWeeklyVolumeKm: 45,
    includeStrength: true,
    ...overrides,
  };
}

function ok(result: ReturnType<typeof buildMacrocycle>) {
  if (!result.ok) throw new Error(`esperava ok, veio erro: ${result.error.message}`);
  return result;
}

describe("buildMacrocycle — janela e estrutura", () => {
  it("rejeita prova anterior ou igual ao início", () => {
    const r = buildMacrocycle(inputs({ eventDate: "2026-01-05" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_WINDOW");
  });

  it("rejeita janela absurdamente longa (> 104 semanas)", () => {
    const r = buildMacrocycle(inputs({ startDate: "2026-01-05", eventDate: "2029-01-05" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("WINDOW_TOO_LONG");
  });

  it("deriva o total de semanas da janela até a prova (inclusive)", () => {
    const r = ok(buildMacrocycle(inputs()));
    // 2026-01-05 → 2026-04-26 = 112 dias = 16 semanas.
    expect(r.macrocycle.totalWeeks).toBe(16);
    expect(r.weeks).toHaveLength(16);
  });

  it("cobre a janela sem buracos: cada semana começa 7 dias após a anterior", () => {
    const r = ok(buildMacrocycle(inputs()));
    expect(r.weeks[0]!.startDate).toBe("2026-01-05");
    for (let i = 1; i < r.weeks.length; i += 1) {
      const prev = Date.parse(`${r.weeks[i - 1]!.startDate}T00:00:00Z`);
      const cur = Date.parse(`${r.weeks[i]!.startDate}T00:00:00Z`);
      expect((cur - prev) / 86_400_000).toBe(7);
    }
    // Última semana é a da prova e não passa dela.
    const last = r.weeks[r.weeks.length - 1]!;
    expect(last.isEventWeek).toBe(true);
    expect(last.endDate).toBe("2026-04-26");
  });
});

describe("buildMacrocycle — modelo de fases", () => {
  it("afunila BASE → BUILD → PEAK → TAPER e o taper termina na prova", () => {
    const r = ok(buildMacrocycle(inputs()));
    const kinds = r.mesocycles.map((m) => m.kind);
    expect(kinds).toEqual(["BASE", "BUILD", "PEAK", "TAPER"]);
    // BASE é a fase mais longa (preparação geral).
    const base = r.mesocycles.find((m) => m.kind === "BASE")!;
    const build = r.mesocycles.find((m) => m.kind === "BUILD")!;
    const peak = r.mesocycles.find((m) => m.kind === "PEAK")!;
    expect(base.weeks).toBeGreaterThanOrEqual(build.weeks);
    expect(build.weeks).toBeGreaterThanOrEqual(peak.weeks);
    // O último mesociclo é o taper e fecha na data da prova.
    const lastMeso = r.mesocycles[r.mesocycles.length - 1]!;
    expect(lastMeso.kind).toBe("TAPER");
    expect(lastMeso.endDate).toBe("2026-04-26");
  });

  it("os mesociclos particionam exatamente as semanas do macrociclo", () => {
    const r = ok(buildMacrocycle(inputs()));
    const somaSemanas = r.mesocycles.reduce((s, m) => s + m.weeks, 0);
    expect(somaSemanas).toBe(r.macrocycle.totalWeeks);
    // Sem sobreposição nem buraco na numeração de semanas.
    let expected = 1;
    for (const m of r.mesocycles) {
      expect(m.startWeek).toBe(expected);
      expected = m.endWeek + 1;
    }
    expect(expected - 1).toBe(r.macrocycle.totalWeeks);
  });

  it("os rótulos de fase reclassificam de volta na MESMA PhaseKind (round-trip com planWeek)", () => {
    const r = ok(buildMacrocycle(inputs()));
    // Regressão do bug "afinamento" → TAPER: o rótulo de cada mesociclo tem de
    // voltar à própria PhaseKind quando o gerador de semana o reclassifica.
    for (const m of r.mesocycles) {
      expect(classifyPhase(m.focus)).toEqual({ kind: m.kind, matched: true });
    }
  });
});

describe("buildMacrocycle — deload e onda de carga", () => {
  it("insere deload na cadência do nível, nunca no taper nem na semana da prova", () => {
    const r = ok(buildMacrocycle(inputs({ level: "INTERMEDIATE" })));
    const deloads = r.weeks.filter((w) => w.isRecoveryWeek);
    expect(deloads.length).toBeGreaterThan(0);
    for (const w of deloads) {
      expect(w.phaseKind).not.toBe("TAPER");
      expect(w.isEventWeek).toBe(false);
    }
  });

  it("iniciante desloada mais cedo (3:1) que intermediário (4:1)", () => {
    const beg = ok(buildMacrocycle(inputs({ level: "BEGINNER" })));
    const int = ok(buildMacrocycle(inputs({ level: "INTERMEDIATE" })));
    const firstDeload = (r: typeof beg) => r.weeks.find((w) => w.isRecoveryWeek)?.sequence ?? Infinity;
    expect(firstDeload(beg)).toBeLessThan(firstDeload(int));
  });

  it("a semana de deload tem menos volume que a semana de carga anterior", () => {
    const r = ok(buildMacrocycle(inputs()));
    const deload = r.weeks.find((w) => w.isRecoveryWeek && w.sequence > 1)!;
    const prev = r.weeks.find((w) => w.sequence === deload.sequence - 1)!;
    expect(deload.targetVolumeKm!).toBeLessThan(prev.targetVolumeKm!);
  });
});

describe("buildMacrocycle — dados ausentes e confiança", () => {
  it("sem volume-base usa padrão, lista missingData e rebaixa confiança para LOW", () => {
    const r = ok(buildMacrocycle(inputs({ baseWeeklyVolumeKm: undefined })));
    expect(r.rationale.missingData).toContain("baseWeeklyVolumeKm");
    expect(r.confidence).toBe("LOW");
    expect(r.weeks.every((w) => (w.targetVolumeKm ?? 0) > 0)).toBe(true);
  });

  it("sem nível assume INTERMEDIATE e sinaliza", () => {
    const r = ok(buildMacrocycle(inputs({ level: undefined })));
    expect(r.macrocycle.level).toBe("INTERMEDIATE");
    expect(r.rationale.missingData).toContain("level");
  });

  it("carrega versão e referências científicas na racionalização", () => {
    const r = ok(buildMacrocycle(inputs()));
    expect(r.rationale.strategyVersion).toBe(STRATEGY_VERSION);
    expect(r.rationale.references.length).toBeGreaterThan(0);
    expect(r.rationale.rules.some((rule) => rule.id === "phase-model")).toBe(true);
  });

  it("CTL/ATL/TSB entram só como aviso, nunca cortam volume", () => {
    const semLoad = ok(buildMacrocycle(inputs()));
    const comLoad = ok(buildMacrocycle(inputs({ currentLoad: { ctl: 40, atl: 60, tsb: -20 } })));
    // Mesmo com TSB muito negativo, o volume gerado é idêntico — é contexto.
    expect(comLoad.weeks.map((w) => w.targetVolumeKm)).toEqual(
      semLoad.weeks.map((w) => w.targetVolumeKm),
    );
    expect(comLoad.rationale.caveats.some((c) => c.includes("TSB"))).toBe(true);
  });
});

describe("buildMacrocycle — modalidades", () => {
  it("força não gera volume em km (targetVolumeKm null)", () => {
    const r = ok(buildMacrocycle(inputs({ modality: "STRENGTH", baseWeeklyVolumeKm: undefined })));
    expect(r.weeks.every((w) => w.targetVolumeKm === null)).toBe(true);
    // Não pode reclamar de volume ausente numa modalidade sem volume em km.
    expect(r.rationale.missingData).not.toContain("baseWeeklyVolumeKm");
  });

  it("triathlon fica no máximo em confiança MODERATE, com aviso da divisão em km", () => {
    const r = ok(buildMacrocycle(inputs({ modality: "TRIATHLON" })));
    expect(r.confidence).not.toBe("HIGH");
    expect(r.rationale.caveats.some((c) => c.toLowerCase().includes("triathlon"))).toBe(true);
  });

  it("janela curta (< 4 semanas) colapsa as fases e avisa", () => {
    // 2026-01-05 → 2026-01-18 = 2 semanas.
    const r = ok(buildMacrocycle(inputs({ eventDate: "2026-01-18" })));
    expect(r.macrocycle.totalWeeks).toBe(2);
    expect(r.mesocycles.length).toBeLessThanOrEqual(2);
    expect(r.confidence).not.toBe("HIGH");
  });
});

describe("pipeline Fase 1 → Fase 3 (toWeekContexts + planWeek)", () => {
  it("cada microciclo alimenta o gerador de semana e produz sessões coerentes com a fase", () => {
    const r = ok(buildMacrocycle(inputs()));
    const contexts = toWeekContexts(r, { availableWeekdays: [1, 3, 5, 7], includeStrength: true });
    expect(contexts).toHaveLength(r.weeks.length);

    const plans = contexts.map(planWeek);
    // Toda semana com dias disponíveis gera ao menos uma sessão.
    expect(plans.every((p) => p.sessions.length > 0)).toBe(true);

    // Semana de taper: o gerador reconhece TAPER e mantém intensidade (RPE alto
    // possível) com volume reduzido — aqui só garantimos que classificou TAPER.
    const taperCtx = contexts.find((c) => c.phaseName?.toLowerCase().includes("taper"))!;
    expect(classifyPhase(taperCtx.phaseName).kind).toBe("TAPER");

    // Semana de deload vira semana regenerativa no gerador (sem qualidade).
    const deloadIdx = r.weeks.findIndex((w) => w.isRecoveryWeek);
    if (deloadIdx >= 0) {
      const plan = plans[deloadIdx]!;
      expect(plan.sessions.every((s) => s.kind !== "QUALITY")).toBe(true);
    }
  });
});
