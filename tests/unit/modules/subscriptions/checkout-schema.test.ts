import { describe, expect, it } from "vitest";
import { startCheckoutInputSchema } from "@/modules/subscriptions/subscription-service";

describe("startCheckoutInputSchema — o cliente nunca envia preço (Fase 10)", () => {
  it("aceita slug e CPF", () => {
    const parsed = startCheckoutInputSchema.parse({
      planSlug: "trainer_pro",
      taxId: "123.456.789-09",
    });
    expect(parsed.planSlug).toBe("trainer_pro");
    // Normalizado para dígitos antes de ir ao gateway.
    expect(parsed.taxId).toBe("12345678909");
  });

  it("aceita CNPJ com máscara", () => {
    expect(
      startCheckoutInputSchema.parse({ planSlug: "trainer_basic", taxId: "12.345.678/0001-95" })
        .taxId,
    ).toBe("12345678000195");
  });

  it.each([["1234567890"], ["123456789012"], [""], ["abcdefghijk"]])(
    "rejeita documento com tamanho inválido (%s)",
    (taxId) => {
      expect(() => startCheckoutInputSchema.parse({ planSlug: "trainer_pro", taxId })).toThrow();
    },
  );

  // A regra "nunca confiar em preço vindo do cliente" só é verificável se o
  // schema DESCARTAR campos de dinheiro. Se um `price` enviado sobrevivesse ao
  // parse, alguém acabaria lendo — e cobraria o valor do atacante.
  it("descarta qualquer campo de preço/valor enviado pelo cliente", () => {
    const parsed = startCheckoutInputSchema.parse({
      planSlug: "trainer_pro",
      taxId: "12345678909",
      price: 0.01,
      amount: 0.01,
      currency: "USD",
      discount: 99,
    });

    expect(parsed).toEqual({ planSlug: "trainer_pro", taxId: "12345678909" });
    expect(Object.keys(parsed)).toEqual(["planSlug", "taxId"]);
  });

  it("exige o slug", () => {
    expect(() => startCheckoutInputSchema.parse({ taxId: "12345678909" })).toThrow();
    expect(() => startCheckoutInputSchema.parse({ planSlug: "  ", taxId: "12345678909" })).toThrow();
  });
});
