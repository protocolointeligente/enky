import { describe, expect, it } from "vitest";
import { fingerprintOf, type Insight } from "@/modules/intelligence/insight";

// A identidade estável do Insight (02H): decide se uma situação já vista é a
// MESMA linha (preserva aceito/ignorado) ou uma NOVA. Puro e determinístico.

function insight(overrides: Partial<Insight> = {}): Insight {
  return {
    athleteId: "a1",
    athleteName: "Atleta",
    engine: "atencao",
    risk: "revisar",
    observacao: "obs",
    interpretacao: "int",
    acoesSugeridas: ["x"],
    confianca: "MEDIA",
    limitacoes: "lim",
    dadosUsados: [{ label: "ACWR", value: "1.60" }],
    sinaisAusentes: ["Prontidão diária não respondida pelo atleta"],
    janela: "Últimos 28 dias",
    regras: ["carga:acwr-alto"],
    ...overrides,
  };
}

describe("fingerprintOf", () => {
  it("é estável: mesma situação ⇒ mesmo fingerprint", () => {
    expect(fingerprintOf(insight())).toBe(fingerprintOf(insight()));
  });

  it("independe da ordem das regras (mesma situação disparada em ordem diferente)", () => {
    const a = fingerprintOf(insight({ regras: ["carga:acwr-alto", "carga:ramp-alto"] }));
    const b = fingerprintOf(insight({ regras: ["carga:ramp-alto", "carga:acwr-alto"] }));
    expect(a).toBe(b);
  });

  it("muda quando o atleta muda", () => {
    expect(fingerprintOf(insight({ athleteId: "a2" }))).not.toBe(fingerprintOf(insight()));
  });

  it("muda quando a regra que dispara muda (dor ≠ carga) — nova situação", () => {
    const carga = fingerprintOf(insight({ regras: ["carga:acwr-alto"] }));
    const dor = fingerprintOf(insight({ engine: "atencao", regras: ["seguranca:dor-relatada"] }));
    expect(carga).not.toBe(dor);
  });

  it("não depende do texto: mesmo atleta/motor/regras com observação diferente ⇒ mesma linha", () => {
    const a = fingerprintOf(insight({ observacao: "ACWR 1.60" }));
    const b = fingerprintOf(insight({ observacao: "ACWR 1.72" }));
    expect(a).toBe(b);
  });

  // O atleta responder a prontidão muda os sinais ausentes, não a situação:
  // se isso virasse linha nova, o aceito/ignorado do treinador seria perdido.
  it("não depende dos sinais ausentes ⇒ preserva a decisão do treinador", () => {
    const semProntidao = fingerprintOf(insight({ sinaisAusentes: ["Prontidão", "Wearable"] }));
    const comProntidao = fingerprintOf(insight({ sinaisAusentes: ["Wearable"] }));
    expect(semProntidao).toBe(comProntidao);
  });
});
