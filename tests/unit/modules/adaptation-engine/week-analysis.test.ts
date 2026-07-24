import { describe, expect, it } from "vitest";
import {
  ANALYSIS_VERSION,
  analyzeWeek,
  type WeekSessionInput,
} from "@/modules/adaptation-engine/week-analysis";

function s(
  kind: WeekSessionInput["kind"],
  load: number,
  modality: WeekSessionInput["modality"] = "RUNNING",
  volumeKm?: number,
): WeekSessionInput {
  return { kind, load, modality, volumeKm };
}

describe("analyzeWeek — agregações", () => {
  it("soma carga, volume e conta sessões/qualidade/regenerativo", () => {
    const a = analyzeWeek([
      s("EASY", 30, "RUNNING", 8),
      s("QUALITY", 80, "RUNNING", 10),
      s("RECOVERY", 15, "RUNNING", 5),
    ]);
    expect(a.version).toBe(ANALYSIS_VERSION);
    expect(a.sessionCount).toBe(3);
    expect(a.qualityCount).toBe(1);
    expect(a.hasRecovery).toBe(true);
    expect(a.internalLoad).toBe(125);
    expect(a.volumeKmTotal).toBe(23);
  });

  it("volume é null quando nenhuma sessão informa km (força pura)", () => {
    const a = analyzeWeek([s("STRENGTH", 50, "STRENGTH"), s("STRENGTH", 50, "STRENGTH")]);
    expect(a.volumeKmTotal).toBeNull();
    // Força não entra na distribuição de endurance.
    expect(a.intensity.lowLoadPct).toBeNull();
    expect(a.intensity.qualityLoadPct).toBeNull();
  });

  it("distribui carga por modalidade (equilíbrio do triathlon)", () => {
    const a = analyzeWeek([
      s("EASY", 40, "SWIMMING"),
      s("LONG", 120, "CYCLING"),
      s("QUALITY", 40, "RUNNING"),
    ]);
    expect(a.loadByModality[0]!.modality).toBe("CYCLING"); // maior carga primeiro
    expect(a.loadByModality.reduce((sum, m) => sum + m.pct, 0)).toBeGreaterThanOrEqual(99);
  });
});

describe("analyzeWeek — distribuição polarizada", () => {
  it("semana polarizada (muito fácil, pouca qualidade) não alerta intensidade", () => {
    const a = analyzeWeek([s("EASY", 40), s("EASY", 40), s("LONG", 60), s("QUALITY", 30)]);
    expect(a.intensity.qualityLoadPct!).toBeLessThanOrEqual(35);
    expect(a.alerts.some((x) => x.code === "INTENSITY_TOO_HIGH")).toBe(false);
  });

  it("qualidade concentrada dispara INTENSITY_TOO_HIGH", () => {
    const a = analyzeWeek([s("EASY", 20), s("QUALITY", 80), s("QUALITY", 80)]);
    expect(a.alerts.some((x) => x.code === "INTENSITY_TOO_HIGH")).toBe(true);
  });

  it("sem baixa intensidade dispara NO_LOW_INTENSITY", () => {
    const a = analyzeWeek([s("QUALITY", 80), s("QUALITY", 70)]);
    expect(a.alerts.some((x) => x.code === "NO_LOW_INTENSITY")).toBe(true);
  });
});

describe("analyzeWeek — salto de carga e monotonia", () => {
  it("alerta LOAD_SPIKE quando a carga excede 1.5x a semana anterior", () => {
    const semanaAnterior = 100;
    const a = analyzeWeek([s("EASY", 60), s("QUALITY", 120)], semanaAnterior); // 180 > 150
    expect(a.alerts.some((x) => x.code === "LOAD_SPIKE")).toBe(true);
  });

  it("não alerta salto quando dentro da faixa", () => {
    const a = analyzeWeek([s("EASY", 60), s("EASY", 60)], 100); // 120 < 150
    expect(a.alerts.some((x) => x.code === "LOAD_SPIKE")).toBe(false);
  });

  it("sem semana anterior, não inventa o salto", () => {
    const a = analyzeWeek([s("EASY", 999)]);
    expect(a.alerts.some((x) => x.code === "LOAD_SPIKE")).toBe(false);
  });

  it("todas as sessões do mesmo tipo dispara SINGLE_KIND (info)", () => {
    const a = analyzeWeek([s("EASY", 30), s("EASY", 30), s("EASY", 30)]);
    const alert = a.alerts.find((x) => x.code === "SINGLE_KIND");
    expect(alert?.severity).toBe("info");
  });
});
