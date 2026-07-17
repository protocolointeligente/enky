import { describe, expect, it } from "vitest";
import { fingerprintOf, isoWeekKey, type Insight } from "@/modules/intelligence/insight";

// A identidade estável do Insight (02H → Fase 03): decide se uma situação já
// vista é a MESMA linha (preserva aceito/ignorado dentro da janela) ou uma NOVA.
// Puro e determinístico. Fase 03 acrescenta versão de regras e janela temporal.

const OPTS = { version: "1.0.0", windowKey: "2026-W29" };

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

const fp = (o: Partial<Insight> = {}, opts = OPTS) => fingerprintOf(insight(o), opts);

describe("fingerprintOf", () => {
  it("é estável: mesma situação + versão + janela ⇒ mesmo fingerprint", () => {
    expect(fp()).toBe(fp());
  });

  it("independe da ordem das regras (mesma situação disparada em ordem diferente)", () => {
    expect(fp({ regras: ["carga:acwr-alto", "carga:ramp-alto"] })).toBe(
      fp({ regras: ["carga:ramp-alto", "carga:acwr-alto"] }),
    );
  });

  it("muda quando o atleta muda", () => {
    expect(fp({ athleteId: "a2" })).not.toBe(fp());
  });

  it("muda quando a regra que dispara muda (dor ≠ carga) — nova situação", () => {
    const carga = fp({ regras: ["carga:acwr-alto"] });
    const dor = fp({ engine: "atencao", regras: ["seguranca:dor-relatada"] });
    expect(carga).not.toBe(dor);
  });

  it("não depende do texto: mesmo atleta/motor/regras com observação diferente ⇒ mesma linha", () => {
    expect(fp({ observacao: "ACWR 1.60" })).toBe(fp({ observacao: "ACWR 1.72" }));
  });

  it("não depende dos sinais ausentes ⇒ preserva a decisão do treinador", () => {
    expect(fp({ sinaisAusentes: ["Prontidão", "Wearable"] })).toBe(fp({ sinaisAusentes: ["Wearable"] }));
  });

  it("muda quando a JANELA temporal muda — mesma situação em semana nova é insight novo", () => {
    expect(fp({}, { version: "1.0.0", windowKey: "2026-W29" })).not.toBe(
      fp({}, { version: "1.0.0", windowKey: "2026-W30" }),
    );
  });

  it("muda quando a VERSÃO das regras muda — não reaproveita decisão de regra antiga", () => {
    expect(fp({}, { version: "1.0.0", windowKey: "2026-W29" })).not.toBe(
      fp({}, { version: "2.0.0", windowKey: "2026-W29" }),
    );
  });
});

describe("isoWeekKey", () => {
  it("mesma semana ISO ⇒ mesma chave; semana seguinte ⇒ chave diferente", () => {
    // 2026-07-13 (seg) e 2026-07-17 (sex) caem na mesma semana ISO.
    expect(isoWeekKey(new Date("2026-07-13T10:00:00Z"))).toBe(isoWeekKey(new Date("2026-07-17T23:00:00Z")));
    expect(isoWeekKey(new Date("2026-07-17T00:00:00Z"))).not.toBe(isoWeekKey(new Date("2026-07-27T00:00:00Z")));
  });

  it("formato AAAA-Www", () => {
    expect(isoWeekKey(new Date("2026-07-17T00:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});
