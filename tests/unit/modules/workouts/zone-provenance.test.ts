import { describe, expect, it } from "vitest";
import { zoneProvenanceSchema } from "@/modules/workouts/zone-provenance";

// Proveniência da zona na prescrição (fatia D). Congela método/zona/limites/
// fórmula+versão/avaliação. Sobrescrita manual exige justificativa.

const base = {
  intensityMethod: "HR_RESERVE",
  zoneCode: "Z2",
  calculatedLowerBound: 132,
  calculatedUpperBound: 148,
  unit: "bpm",
  formulaCode: "HR_RESERVE",
  formulaVersion: "1.0.0",
  assessmentId: "11111111-1111-1111-1111-111111111111",
  assessmentDate: "2026-07-10",
};

describe("zoneProvenanceSchema", () => {
  it("aceita proveniência calculada (sem override)", () => {
    const r = zoneProvenanceSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.wasManuallyOverridden).toBe(false);
  });

  it("exige justificativa quando sobrescrito manualmente", () => {
    expect(
      zoneProvenanceSchema.safeParse({ ...base, wasManuallyOverridden: true }).success,
    ).toBe(false);
    expect(
      zoneProvenanceSchema.safeParse({
        ...base,
        wasManuallyOverridden: true,
        overrideReason: "Atleta relatou fadiga; reduzi a faixa.",
      }).success,
    ).toBe(true);
  });

  it("rejeita chave desconhecida (strict)", () => {
    expect(zoneProvenanceSchema.safeParse({ ...base, foo: 1 }).success).toBe(false);
  });

  it("aceita avaliação ausente (assessmentId/date nulos)", () => {
    const r = zoneProvenanceSchema.safeParse({
      ...base,
      assessmentId: null,
      assessmentDate: null,
    });
    expect(r.success).toBe(true);
  });
});
