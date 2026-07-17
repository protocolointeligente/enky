import { describe, expect, it } from "vitest";
import { evaluate, type AthleteBucket } from "@/modules/intelligence/attention";

function bucket(overrides: Partial<AthleteBucket> = {}): AthleteBucket {
  return {
    athleteId: "a1",
    athleteName: "Atleta",
    feedbackCount: 1,
    maxPain: 0,
    painRegion: null,
    maxRpe: 0,
    missed: 0,
    publishedPast: 0,
    awaitingReview: 0,
    state: null,
    readinessCount: 0,
    readiness: null,
    ...overrides,
  };
}

const HIGH_ACWR_STATE = {
  ctl: 100,
  atl: 170,
  tsb: -70,
  acwr: 1.7,
  monotony: 1.5,
  strain: 800,
  rampPct: 0.1,
  dataDays: 20,
};

describe("attention engine — evaluate", () => {
  it("dor moderada+ vira risco urgente e nunca diagnostica", () => {
    const insight = evaluate(bucket({ maxPain: 5, painRegion: "joelho" }));
    expect(insight?.risk).toBe("urgente");
    expect(insight?.regras).toContain("seguranca:dor-relatada");
    expect(insight?.limitacoes.toLowerCase()).toContain("não é um diagnóstico");
  });

  it("segurança (dor) sobrepõe outros sinais", () => {
    const insight = evaluate(bucket({ maxPain: 6, missed: 3, maxRpe: 10 }));
    expect(insight?.risk).toBe("urgente");
    expect(insight?.regras).toContain("seguranca:dor-relatada");
  });

  it("carga aguda elevada (ACWR alto) vira risco revisar", () => {
    const i = evaluate(bucket({ state: HIGH_ACWR_STATE }));
    expect(i?.risk).toBe("revisar");
    expect(i?.regras).toContain("carga:acwr-alto");
  });

  it("dor (segurança) sobrepõe a carga aguda elevada", () => {
    const i = evaluate(bucket({ maxPain: 5, state: HIGH_ACWR_STATE }));
    expect(i?.risk).toBe("urgente");
    expect(i?.regras).toContain("seguranca:dor-relatada");
  });

  it("carga elevada mas histórico insuficiente não gera insight de carga", () => {
    const i = evaluate(bucket({ state: { ...HIGH_ACWR_STATE, dataDays: 5 } }));
    expect(i).toBeNull();
  });

  it("treinos perdidos viram risco revisar", () => {
    const insight = evaluate(bucket({ missed: 3 }));
    expect(insight?.risk).toBe("revisar");
    expect(insight?.regras).toContain("adesao:treinos-perdidos");
  });

  it("RPE muito alto vira risco revisar", () => {
    const insight = evaluate(bucket({ maxRpe: 9, feedbackCount: 2 }));
    expect(insight?.risk).toBe("revisar");
    expect(insight?.regras).toContain("carga:rpe-alto");
  });

  it("retorno pendente é apenas atenção operacional", () => {
    const insight = evaluate(bucket({ awaitingReview: 1 }));
    expect(insight?.risk).toBe("atencao");
    expect(insight?.regras).toContain("operacional:retorno-pendente");
  });

  it("sem sinais relevantes não gera insight", () => {
    expect(evaluate(bucket())).toBeNull();
  });

  it("confiança escala com a quantidade de dados", () => {
    expect(evaluate(bucket({ maxRpe: 9, feedbackCount: 1 }))?.confianca).toBe("BAIXA");
    expect(evaluate(bucket({ maxRpe: 9, feedbackCount: 3 }))?.confianca).toBe("MEDIA");
    expect(evaluate(bucket({ maxRpe: 9, feedbackCount: 6 }))?.confianca).toBe("ALTA");
  });

  it("declara os sinais ausentes em vez de silenciar a lacuna", () => {
    // Zero retorno, zero carga, zero prontidão — o pior caso de dado.
    const i = evaluate(bucket({ missed: 3, feedbackCount: 0 }));
    expect(i?.sinaisAusentes).toContain("Nenhum retorno do atleta nos últimos 28 dias");
    expect(i?.sinaisAusentes).toContain("Prontidão diária não respondida pelo atleta");
    expect(i?.sinaisAusentes.some((s) => s.includes("wearable"))).toBe(true);
    expect(i?.confianca).toBe("BAIXA"); // sem dados ⇒ nunca conclusão forte
  });

  it("prontidão respondida vira sinal usado, nunca regra própria", () => {
    const readiness = { class: "baixa", score: 30, signalsUsed: 5 } as const;
    // Prontidão baixa sozinha não gera insight — segue experimental.
    expect(evaluate(bucket({ readinessCount: 4, readiness }))).toBeNull();
    // Mas aparece como sinal usado quando outra regra dispara.
    const i = evaluate(bucket({ maxPain: 5, readinessCount: 4, readiness }));
    expect(i?.dadosUsados).toContainEqual({ label: "Prontidão (auto-relato)", value: "baixa" });
    expect(i?.sinaisAusentes).not.toContain("Prontidão diária não respondida pelo atleta");
  });

  it("todo insight declara o período analisado", () => {
    expect(evaluate(bucket({ maxPain: 5 }))?.janela).toBe("Últimos 28 dias");
    expect(evaluate(bucket({ state: HIGH_ACWR_STATE }))?.janela).toContain("90 dias");
  });
});
