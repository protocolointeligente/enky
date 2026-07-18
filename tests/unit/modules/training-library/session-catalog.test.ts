import { describe, expect, it } from "vitest";
import {
  CATALOG_VERSION,
  allSessions,
  getSession,
  querySessions,
  recommendSessions,
} from "@/modules/training-library/session-catalog";

describe("catálogo — integridade", () => {
  it("expõe uma versão e um conjunto não vazio", () => {
    expect(CATALOG_VERSION).toBe("library-v1");
    expect(allSessions().length).toBeGreaterThan(0);
  });

  it("todo id é único e todo campo obrigatório está preenchido", () => {
    const sessions = allSessions();
    const ids = new Set(sessions.map((s) => s.id));
    expect(ids.size).toBe(sessions.length);
    for (const s of sessions) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.objective.length).toBeGreaterThan(0);
      expect(s.idealPhases.length).toBeGreaterThan(0);
      expect(s.levels.length).toBeGreaterThan(0);
      expect(s.references.length).toBeGreaterThan(0);
      expect(["A", "B", "C"]).toContain(s.evidenceLevel);
      expect(s.durationMin[0]).toBeLessThanOrEqual(s.durationMin[1]);
      expect(s.estimatedLoadPerHour).toBeGreaterThan(0);
    }
  });

  it("allSessions devolve uma cópia — mutar o retorno não afeta o catálogo", () => {
    const a = allSessions();
    a.pop();
    expect(allSessions().length).toBe(a.length + 1);
  });
});

describe("querySessions — filtros", () => {
  it("filtra por modalidade", () => {
    const runs = querySessions({ modality: "RUNNING" });
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((s) => s.modality === "RUNNING")).toBe(true);
  });

  it("triathlon une nado/pedal/corrida", () => {
    const tri = querySessions({ modality: "TRIATHLON" });
    const modalities = new Set(tri.map((s) => s.modality));
    expect(modalities.has("RUNNING")).toBe(true);
    expect(modalities.has("SWIMMING")).toBe(true);
    expect(modalities.has("CYCLING")).toBe(true);
    // Nunca traz força pura numa consulta de triathlon.
    expect(modalities.has("STRENGTH")).toBe(false);
  });

  it("combina fase + nível", () => {
    const baseBeginner = querySessions({ phase: "BASE", level: "BEGINNER" });
    expect(baseBeginner.every((s) => s.idealPhases.includes("BASE"))).toBe(true);
    expect(baseBeginner.every((s) => s.levels.includes("BEGINNER"))).toBe(true);
  });

  it("sem critérios devolve tudo", () => {
    expect(querySessions()).toHaveLength(allSessions().length);
  });
});

describe("recommendSessions — ordenação por especificidade", () => {
  it("prioriza a sessão mais específica para a fase (menos fases ideais primeiro)", () => {
    const recs = recommendSessions({ modality: "RUNNING", phase: "PEAK" });
    expect(recs.length).toBeGreaterThan(1);
    for (let i = 1; i < recs.length; i += 1) {
      expect(recs[i - 1]!.idealPhases.length).toBeLessThanOrEqual(recs[i]!.idealPhases.length);
    }
  });

  it("respeita o tipo de sessão quando informado", () => {
    const quality = recommendSessions({
      modality: "CYCLING",
      phase: "BUILD",
      sessionKind: "QUALITY",
    });
    expect(quality.length).toBeGreaterThan(0);
    expect(quality.every((s) => s.sessionKind === "QUALITY")).toBe(true);
  });
});

describe("getSession", () => {
  it("resolve por id e devolve null para desconhecido", () => {
    expect(getSession("run-long")?.modality).toBe("RUNNING");
    expect(getSession("inexistente")).toBeNull();
  });
});
