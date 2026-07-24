import { describe, expect, it } from "vitest";
import { planWeek, type WeekContext } from "@/modules/periodization/generation-rules";
import {
  enrichSession,
  enrichWeekPlan,
} from "@/modules/session-generator/enrich-week";

// Motor de sugestão (Fase 3) — enriquecimento puro. Combina planWeek (Fase 1/6)
// com o catálogo (Fase 2). Testado sem banco.

function context(overrides: Partial<WeekContext> = {}): WeekContext {
  return {
    goal: "Maratona",
    modality: "RUNNING",
    level: "INTERMEDIATE",
    availableWeekdays: [1, 3, 5, 7],
    phaseName: "Construção específica",
    isRecoveryWeek: false,
    targetVolumeKm: 50,
    weekStartDate: "2026-01-05",
    weekEndDate: "2026-01-11",
    includeStrength: false,
    ...overrides,
  };
}

describe("enrichWeekPlan — invariantes", () => {
  it("enriquece toda sessão do plano e carrega a versão do catálogo", () => {
    const ctx = context();
    const plan = planWeek(ctx);
    const enriched = enrichWeekPlan(plan, ctx);
    expect(enriched.sessions).toHaveLength(plan.sessions.length);
    expect(enriched.catalogVersion).toBe("library-v1");
    // Preserva confiança e rationale do gerador (não os reinventa).
    expect(enriched.confidence).toBe(plan.confidence);
    expect(enriched.rationale).toBe(plan.rationale);
  });

  it("uma sessão de qualidade na fase BUILD casa com objetivo, sistema energético e evidência", () => {
    const ctx = context();
    const plan = planWeek(ctx);
    const quality = plan.sessions.find((s) => s.kind === "QUALITY");
    expect(quality).toBeDefined();
    const s = enrichSession(quality!, ctx);
    expect(s.matched).toBe(true);
    expect(s.objective).toBeTruthy();
    expect(s.energySystem).toBeTruthy();
    expect(s.adaptation).toBeTruthy();
    expect(s.evidenceLevel).toMatch(/[ABC]/);
    expect(s.references.length).toBeGreaterThan(0);
    expect(s.predictedLoad).toBeGreaterThan(0);
    expect(s.why).toContain("fase BUILD");
  });

  it("sessão fácil casa com a base aeróbica", () => {
    const ctx = context();
    const easy = planWeek(ctx).sessions.find((s) => s.kind === "EASY");
    const s = enrichSession(easy!, ctx);
    expect(s.matched).toBe(true);
    expect(s.energySystem).toBe("AEROBIC_BASE");
  });
});

describe("enrichSession — casamento e fallback", () => {
  it("triathlon: cada disciplina casa com o catálogo da própria modalidade", () => {
    const ctx = context({ modality: "TRIATHLON", availableWeekdays: [1, 2, 4, 6, 7] });
    const plan = planWeek(ctx);
    const enriched = plan.sessions.map((s) => enrichSession(s, ctx));
    // Toda sessão de nado/pedal/corrida deve ter casado com uma entrada de catálogo.
    for (const s of enriched) {
      if (["SWIMMING", "CYCLING", "RUNNING"].includes(s.modality)) {
        expect(s.catalogId).not.toBeNull();
      }
    }
  });

  it("marca matched=false quando não há sessão da fase, mas ainda carrega um análogo", () => {
    // Força no TAPER: o catálogo de força tem hipertrofia (BASE) e força máxima
    // (BUILD), nenhuma marcada para TAPER → análogo, matched=false.
    const ctx = context({ modality: "STRENGTH", phaseName: "Taper", targetVolumeKm: undefined });
    const plan = planWeek(ctx);
    const strength = plan.sessions.find((s) => s.kind === "STRENGTH");
    expect(strength).toBeDefined();
    const s = enrichSession(strength!, ctx);
    expect(s.matched).toBe(false);
    expect(s.catalogId).not.toBeNull(); // análogo carregado
    expect(s.why.toLowerCase()).toContain("análogo");
  });

  it("carga prevista é positiva e proporcional à carga/hora do catálogo", () => {
    const ctx = context();
    const quality = planWeek(ctx).sessions.find((s) => s.kind === "QUALITY")!;
    const easy = planWeek(ctx).sessions.find((s) => s.kind === "EASY")!;
    const q = enrichSession(quality, ctx);
    const e = enrichSession(easy, ctx);
    // Sessão de qualidade tem carga/hora maior que rodagem leve.
    expect(q.predictedLoad!).toBeGreaterThan(e.predictedLoad!);
  });
});
