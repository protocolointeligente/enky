import { describe, expect, it } from "vitest";
import {
  createPeriodizationInputSchema,
  periodizationParametersSchema,
} from "@/modules/periodization/periodization-schema";

// Fase 04 — camada estratégica rica. A regra de negócio do formulário vive no
// Zod: rascunho pode ficar incompleto; um plano "completo" exige objetivo e
// modalidade; parâmetros por modalidade são validados (multiesporte ≠ genérico).

const base = {
  title: "Base 21k",
  startDate: "2026-08-01",
  endDate: "2026-10-24",
};

describe("createPeriodizationInputSchema", () => {
  it("aceita um plano completo com modalidade, objetivo e parâmetros", () => {
    const r = createPeriodizationInputSchema.safeParse({
      ...base,
      goal: "Concluir meia maratona",
      modality: "RUNNING",
      level: "INTERMEDIARIO",
      loadControlMethod: "PACE",
      difficultyDistribution: "POLARIZADA",
      mesocycleCount: 3,
      microcycleCount: 12,
      parameters: { vdot: 48, pace: "05:20", distanceKm: 320 },
    });
    expect(r.success).toBe(true);
  });

  it("rejeita plano NÃO-rascunho sem modalidade", () => {
    const r = createPeriodizationInputSchema.safeParse({ ...base, goal: "x", isDraft: false });
    expect(r.success).toBe(false);
  });

  it("rejeita plano NÃO-rascunho sem objetivo", () => {
    const r = createPeriodizationInputSchema.safeParse({ ...base, modality: "RUNNING" });
    expect(r.success).toBe(false);
  });

  it("aceita RASCUNHO incompleto (sem objetivo nem modalidade)", () => {
    const r = createPeriodizationInputSchema.safeParse({ ...base, isDraft: true });
    expect(r.success).toBe(true);
  });

  it("rejeita janela invertida", () => {
    const r = createPeriodizationInputSchema.safeParse({
      ...base,
      startDate: "2026-10-24",
      endDate: "2026-08-01",
      isDraft: true,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita modalidade fora do enum", () => {
    const r = createPeriodizationInputSchema.safeParse({
      ...base,
      goal: "x",
      modality: "CROSSFIT",
    });
    expect(r.success).toBe(false);
  });
});

describe("periodizationParametersSchema", () => {
  it("aceita parâmetros de musculação (séries/RIR/tonelagem/grupos)", () => {
    const r = periodizationParametersSchema.safeParse({
      sets: 4,
      rir: 2,
      tonnage: 12000,
      muscleGroups: ["peito", "tríceps"],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita chave desconhecida (strict) e valores impossíveis", () => {
    expect(periodizationParametersSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(periodizationParametersSchema.safeParse({ rpeTarget: 99 }).success).toBe(false);
  });
});
