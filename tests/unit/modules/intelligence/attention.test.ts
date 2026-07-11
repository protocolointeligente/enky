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
    ...overrides,
  };
}

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
});
