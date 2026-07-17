import { describe, expect, it } from "vitest";
import { FREE_LIMITS, parsePlanLimits } from "@/modules/subscriptions/plan-limits";

describe("plan-limits — parsing de featuresLimits (Fase 10)", () => {
  it("lê limites válidos do catálogo", () => {
    expect(parsePlanLimits({ maxAthletes: 25, features: ["templates"] })).toEqual({
      maxAthletes: 25,
      features: ["templates"],
    });
  });

  it("aceita maxAthletes null como ilimitado", () => {
    expect(parsePlanLimits({ maxAthletes: null, features: [] }).maxAthletes).toBeNull();
  });

  it("assume features vazias quando o campo não vem", () => {
    expect(parsePlanLimits({ maxAthletes: 10 })).toEqual({ maxAthletes: 10, features: [] });
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
