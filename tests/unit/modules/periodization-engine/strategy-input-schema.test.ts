import { describe, expect, it } from "vitest";
import {
  strategyInputSchema,
  toEngineLevel,
  toEngineModality,
} from "@/modules/periodization-engine/strategy-input-schema";

describe("strategyInputSchema", () => {
  const base = {
    title: "Ciclo Maratona",
    goal: "Maratona sub-4h",
    modality: "RUNNING" as const,
    startDate: "2026-01-05",
    eventDate: "2026-04-26",
  };

  it("aceita o mínimo e aplica defaults", () => {
    const parsed = strategyInputSchema.parse(base);
    expect(parsed.availableWeekdays).toEqual([]);
    expect(parsed.includeStrength).toBe(false);
  });

  it("rejeita prova anterior ou igual ao início", () => {
    expect(strategyInputSchema.safeParse({ ...base, eventDate: "2026-01-05" }).success).toBe(false);
    expect(strategyInputSchema.safeParse({ ...base, eventDate: "2025-12-31" }).success).toBe(false);
  });

  it("exige objetivo não vazio", () => {
    expect(strategyInputSchema.safeParse({ ...base, goal: "  " }).success).toBe(false);
  });

  it("valida os dias da semana no intervalo ISO 1–7", () => {
    expect(strategyInputSchema.safeParse({ ...base, availableWeekdays: [1, 7] }).success).toBe(true);
    expect(strategyInputSchema.safeParse({ ...base, availableWeekdays: [0] }).success).toBe(false);
    expect(strategyInputSchema.safeParse({ ...base, availableWeekdays: [8] }).success).toBe(false);
  });

  it("rejeita volume-base não positivo", () => {
    expect(strategyInputSchema.safeParse({ ...base, baseWeeklyVolumeKm: 0 }).success).toBe(false);
    expect(strategyInputSchema.safeParse({ ...base, baseWeeklyVolumeKm: 45 }).success).toBe(true);
  });
});

describe("mapeamento de nível PT → motor", () => {
  it("mapeia as quatro faixas PT, com ELITE caindo em ADVANCED", () => {
    expect(toEngineLevel("INICIANTE")).toBe("BEGINNER");
    expect(toEngineLevel("INTERMEDIARIO")).toBe("INTERMEDIATE");
    expect(toEngineLevel("AVANCADO")).toBe("ADVANCED");
    expect(toEngineLevel("ELITE")).toBe("ADVANCED");
  });

  it("nível ausente vira undefined (o motor assume INTERMEDIATE com aviso)", () => {
    expect(toEngineLevel(undefined)).toBeUndefined();
  });

  it("a modalidade da API é a mesma Modality do motor", () => {
    expect(toEngineModality("TRIATHLON")).toBe("TRIATHLON");
    expect(toEngineModality("STRENGTH")).toBe("STRENGTH");
  });
});
