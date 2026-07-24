import { describe, expect, it } from "vitest";
import { selectBestMetric, type MetricCandidate } from "@/modules/assessments/performance-profile";

// Núcleo de seleção do perfil consolidado (fatia B). Regras versionadas:
// não-expirado > expirado; medido > estimado; depois o mais recente. Ausência
// é null (nunca um valor inventado); expirado volta COM aviso, nunca escondido.

const REF = "2026-07-18";

function cand(over: Partial<MetricCandidate>): MetricCandidate {
  return {
    value: 100,
    source: "MEASURED",
    estimated: false,
    assessmentId: "a",
    assessmentDate: "2026-07-01",
    protocolCode: "FIELD_TEST",
    protocolVersion: "1.0.0",
    confidence: "HIGH",
    validUntil: null,
    ...over,
  };
}

describe("selectBestMetric", () => {
  it("retorna null quando não há candidatos (ausência explícita)", () => {
    expect(selectBestMetric([], REF)).toBeNull();
  });

  it("prefere medido a estimado, mesmo que o estimado seja mais recente", () => {
    const measured = cand({ value: 188, estimated: false, assessmentDate: "2026-06-01", assessmentId: "m" });
    const estimated = cand({ value: 190, estimated: true, assessmentDate: "2026-07-10", assessmentId: "e" });
    const best = selectBestMetric([estimated, measured], REF);
    expect(best?.assessmentId).toBe("m");
    expect(best?.expired).toBe(false);
  });

  it("entre medidos, escolhe o mais recente", () => {
    const older = cand({ assessmentDate: "2026-01-01", assessmentId: "old" });
    const newer = cand({ assessmentDate: "2026-07-01", assessmentId: "new" });
    expect(selectBestMetric([older, newer], REF)?.assessmentId).toBe("new");
  });

  it("prefere não-expirado a expirado, mesmo estimado vs medido", () => {
    const expiredMeasured = cand({ validUntil: "2026-01-01", assessmentId: "exp", estimated: false });
    const validEstimated = cand({ validUntil: "2027-01-01", assessmentId: "val", estimated: true });
    const best = selectBestMetric([expiredMeasured, validEstimated], REF);
    expect(best?.assessmentId).toBe("val");
    expect(best?.expired).toBe(false);
  });

  it("quando só há expirado, devolve-o com expired=true (com aviso)", () => {
    const only = cand({ validUntil: "2026-01-01", assessmentId: "old" });
    const best = selectBestMetric([only], REF);
    expect(best?.assessmentId).toBe("old");
    expect(best?.expired).toBe(true);
  });
});
