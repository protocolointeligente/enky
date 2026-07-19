import { describe, expect, it } from "vitest";
import { resolveStatusFields } from "@/modules/crm/lead-service";

// Efeito colateral da mudança de etapa: os timestamps precisam ficar SEMPRE
// consistentes com o status-alvo — senão um lead "reaberto" carrega um lostAt
// fantasma e a inadimplência/relatórios contam errado.
const now = new Date("2026-07-19T12:00:00Z");
const clean = { convertedAt: null, lostAt: null };

describe("resolveStatusFields", () => {
  it("marca convertedAt ao ganhar e zera o resto", () => {
    expect(resolveStatusFields("WON", null, clean, now)).toEqual({
      convertedAt: now,
      lostAt: null,
      lostReason: null,
    });
  });

  it("preserva o convertedAt já existente (idempotente ao reprocessar WON)", () => {
    const earlier = new Date("2026-01-01T00:00:00Z");
    expect(resolveStatusFields("WON", null, { convertedAt: earlier, lostAt: null }, now).convertedAt).toBe(
      earlier,
    );
  });

  it("marca lostAt + motivo ao perder", () => {
    expect(resolveStatusFields("LOST", "sem orçamento", clean, now)).toEqual({
      convertedAt: null,
      lostAt: now,
      lostReason: "sem orçamento",
    });
  });

  it("ao reabrir (voltar para uma etapa ativa) limpa convertedAt/lostAt/lostReason", () => {
    const lost = { convertedAt: null, lostAt: new Date("2026-02-02T00:00:00Z") };
    expect(resolveStatusFields("NEGOTIATION", "ignorado", lost, now)).toEqual({
      convertedAt: null,
      lostAt: null,
      lostReason: null,
    });
  });

  it("não vaza lostReason quando o status não é LOST", () => {
    expect(resolveStatusFields("QUALIFIED", "motivo qualquer", clean, now).lostReason).toBeNull();
  });
});
