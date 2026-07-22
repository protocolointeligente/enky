import { describe, expect, it } from "vitest";
import { FREE_LIMITS, parsePlanLimits } from "@/modules/subscriptions/plan-limits";

describe("plan-limits — parsing de featuresLimits (Fase 10 → 05)", () => {
  it("lê limites válidos do catálogo, incluindo as dimensões da Fase 05", () => {
    expect(
      parsePlanLimits({
        maxAthletes: 25,
        maxTrainers: 1,
        maxTemplates: 50,
        maxStorageMb: 2048,
        features: ["templates"],
      }),
    ).toEqual({
      maxAthletes: 25,
      maxTrainers: 1,
      maxTemplates: 50,
      maxStorageMb: 2048,
      features: ["templates"],
    });
  });

  it("aceita maxAthletes null como ilimitado", () => {
    expect(parsePlanLimits({ maxAthletes: null, features: [] }).maxAthletes).toBeNull();
  });

  it("dimensões novas ausentes viram null (ilimitado) sem quebrar catálogos antigos", () => {
    const parsed = parsePlanLimits({ maxAthletes: 10 });
    expect(parsed.maxAthletes).toBe(10);
    expect(parsed.maxTemplates).toBeNull();
    expect(parsed.maxTrainers).toBeNull();
    expect(parsed.maxStorageMb).toBeNull();
    expect(parsed.features).toEqual([]);
  });

  // A regra que mais importa: Json malformado NÃO pode virar acesso ilimitado.
  // `maxAthletes` ausente não é "sem limite" — é catálogo quebrado, e a
  // resposta segura é o plano grátis.
  it.each([
    ["objeto vazio", {}],
    ["maxAthletes ausente", { features: ["templates"] }],
    ["maxAthletes negativo", { maxAthletes: -1, features: [] }],
    ["maxAthletes não numérico", { maxAthletes: "ilimitado", features: [] }],
    ["null", null],
    ["string", "qualquer coisa"],
  ])("cai para o plano grátis quando os limites são inválidos (%s)", (_label, raw) => {
    expect(parsePlanLimits(raw)).toEqual(FREE_LIMITS);
  });

  it("o fallback em código é restritivo, nunca ilimitado", () => {
    expect(FREE_LIMITS.maxAthletes).toBeTypeOf("number");
    expect(FREE_LIMITS.features).toEqual([]);
  });
});
