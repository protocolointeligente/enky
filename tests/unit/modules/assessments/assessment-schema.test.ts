import { describe, expect, it } from "vitest";
import { createAssessmentInputSchema } from "@/modules/assessments/assessment-schema";

// Contrato de dados das avaliações (fatia A). A regra de negócio do formulário
// vive no Zod: cada tipo exige o(s) indicador(es) mínimo(s) e rejeita chave
// desconhecida (strict). As FÓRMULAS de zona são a fatia C — aqui só entradas.

const base = { assessmentDate: "2026-07-10", protocolCode: "FIELD_TEST" };

describe("createAssessmentInputSchema", () => {
  it("aceita FC com máxima e repouso", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "HEART_RATE",
      measurements: { maximumHeartRate: 188, restingHeartRate: 56 },
    });
    expect(r.success).toBe(true);
  });

  it("rejeita FC sem máxima nem limiar", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "HEART_RATE",
      measurements: { restingHeartRate: 56 },
    });
    expect(r.success).toBe(false);
  });

  it("rejeita chave desconhecida nas medições (strict)", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "HEART_RATE",
      measurements: { maximumHeartRate: 188, foo: 1 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // O erro é roteado para dentro de measurements.
      expect(r.error.issues.some((i) => i.path[0] === "measurements")).toBe(true);
    }
  });

  it("rejeita FC fora de faixa fisiológica", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "HEART_RATE",
      measurements: { maximumHeartRate: 400 },
    });
    expect(r.success).toBe(false);
  });

  it("corrida exige ao menos um indicador", () => {
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "RUNNING",
        measurements: { testDistanceMeters: 5000 },
      }).success,
    ).toBe(false);
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "RUNNING",
        measurements: { vdot: 52, pace5k: 258 },
      }).success,
    ).toBe(true);
  });

  it("ciclismo exige FTP ou potência crítica", () => {
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "CYCLING",
        measurements: { maxPower: 900 },
      }).success,
    ).toBe(false);
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "CYCLING",
        measurements: { ftp: 292 },
      }).success,
    ).toBe(true);
  });

  it("força aceita 1RM direto ou carga+reps, mas não carga sozinha", () => {
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "STRENGTH",
        measurements: { testLoadKg: 90 },
      }).success,
    ).toBe(false);
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "STRENGTH",
        measurements: { testLoadKg: 90, testRepetitions: 5, formulaCode: "EPLEY" },
      }).success,
    ).toBe(true);
    expect(
      createAssessmentInputSchema.safeParse({
        ...base,
        assessmentType: "STRENGTH",
        measurements: { oneRepMax: 100 },
      }).success,
    ).toBe(true);
  });

  it("natação aceita CSS em segundos por 100 m", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "SWIMMING",
      measurements: { css: 105 },
    });
    expect(r.success).toBe(true);
  });

  it("aplica defaults (source MANUAL, confidence NOT_ASSESSED, versão 1.0.0)", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "HEART_RATE",
      measurements: { maximumHeartRate: 188 },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe("MANUAL");
      expect(r.data.confidence).toBe("NOT_ASSESSED");
      expect(r.data.protocolVersion).toBe("1.0.0");
    }
  });

  it("rejeita validade anterior à data da avaliação", () => {
    const r = createAssessmentInputSchema.safeParse({
      ...base,
      assessmentType: "HEART_RATE",
      validUntil: "2026-07-01",
      measurements: { maximumHeartRate: 188 },
    });
    expect(r.success).toBe(false);
  });
});
