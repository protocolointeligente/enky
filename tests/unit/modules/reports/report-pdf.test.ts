import { describe, expect, it } from "vitest";
import { buildReportDocument } from "@/modules/reports/report-document";
import { renderReportPdf, reportPdfFilename } from "@/modules/reports/report-pdf";
import { REPORT_SNAPSHOT_VERSION } from "@/modules/reports/report-snapshot";

// O PDF é o entregável da Fase 8. Não travamos os BYTES em snapshot (o pdfkit
// carimba estado interno e qualquer ajuste de layout quebraria o teste sem
// nenhum ganho de sinal) — travamos que ele é um PDF válido, que renderiza sem
// explodir nos dois extremos de dado, e que o nome do arquivo é previsível.

const SNAPSHOT = {
  version: REPORT_SNAPSHOT_VERSION,
  period: { start: "2026-06-01", end: "2026-06-28", days: 28 },
  adherence: { due: 16, completed: 11, partial: 3, missed: 2, pending: 0, pct: 88 },
  volume: {
    sessions: 14,
    minutes: 840,
    distanceKm: 62.4,
    byModality: [{ modality: "RUNNING", sessions: 14, minutes: 840 }],
  },
  internalLoad: { total: 4200, weeklyAverage: 1050, sessionsWithLoad: 14, sessionsWithoutLoad: 0 },
  load: {
    ctl: 48.2,
    atl: 52.9,
    tsb: -4.7,
    acwr: 1.1,
    monotony: 1.42,
    strain: 1490,
    rampPct: 0.063,
    dataDays: 22,
  },
  readiness: { count: 19, latestClass: "boa" as const, latestScore: 78, averageScore: 74 },
  comments: [
    {
      date: "2026-06-18",
      workoutTitle: "Intervalado 6x800m",
      notes: "Senti a panturrilha direita apertada nas últimas séries.",
      painLevel: 4,
    },
  ],
};

function documentFrom(metricsSnapshot: unknown) {
  return buildReportDocument({
    report: {
      id: "report-1",
      status: "PUBLISHED",
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-28T00:00:00.000Z"),
      metricsSnapshot,
      insights: "Bloco de base fechado como planejado.",
      recommendations: null,
      limitations: null,
      createdAt: new Date("2026-06-29T10:30:00.000Z"),
    },
    athleteName: "Marina Duarte",
    trainerName: "Ricardo Pace",
  });
}

describe("renderReportPdf", () => {
  it("produz um PDF válido a partir do documento", async () => {
    const pdf = await renderReportPdf(documentFrom(SNAPSHOT));

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
  });

  it("renderiza também quando o período não tem dado suficiente", async () => {
    const sparse = {
      ...SNAPSHOT,
      adherence: { due: 0, completed: 0, partial: 0, missed: 0, pending: 0, pct: null },
      volume: { sessions: 0, minutes: 0, distanceKm: 0, byModality: [] },
      internalLoad: { total: 0, weeklyAverage: null, sessionsWithLoad: 0, sessionsWithoutLoad: 0 },
      load: {
        ...SNAPSHOT.load,
        acwr: null,
        monotony: null,
        strain: null,
        rampPct: null,
        dataDays: 1,
      },
      readiness: { count: 0, latestClass: null, latestScore: null, averageScore: null },
      comments: [],
    };
    const pdf = await renderReportPdf(documentFrom(sparse));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renderiza o relatório legado sem tentar reinterpretá-lo", async () => {
    const pdf = await renderReportPdf(documentFrom({ period: { start: "x", end: "y" } }));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("nomeia o arquivo sem acento nem espaço", () => {
    expect(reportPdfFilename(documentFrom(SNAPSHOT))).toBe(
      "enky-relatorio-marina-duarte-01-06-2026_28-06-2026.pdf",
    );
  });
});
