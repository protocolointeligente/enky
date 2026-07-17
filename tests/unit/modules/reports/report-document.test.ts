import { describe, expect, it } from "vitest";
import {
  buildReportDocument,
  REPORT_DISCLAIMER,
  type ReportDocumentInput,
} from "@/modules/reports/report-document";
import { REPORT_SNAPSHOT_VERSION, type ReportSnapshot } from "@/modules/reports/report-snapshot";

// Fase 8 — o documento é o CONTRATO de linguagem do relatório premium: o que o
// snapshot test trava aqui é literalmente o que o atleta lê na tela e no PDF.
// Um diff nestes snapshots é uma mudança de redação e precisa ser lida como
// tal: contexto sim, diagnóstico nunca, insuficiência declarada.

function snapshot(overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    version: REPORT_SNAPSHOT_VERSION,
    period: { start: "2026-06-01", end: "2026-06-28", days: 28 },
    adherence: { due: 16, completed: 11, partial: 3, missed: 2, pending: 0, pct: 88 },
    volume: {
      sessions: 14,
      minutes: 840,
      distanceKm: 62.4,
      byModality: [
        { modality: "RUNNING", sessions: 9, minutes: 540 },
        { modality: "STRENGTH", sessions: 5, minutes: 300 },
      ],
    },
    internalLoad: {
      total: 4200,
      weeklyAverage: 1050,
      sessionsWithLoad: 14,
      sessionsWithoutLoad: 0,
    },
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
    readiness: { count: 19, latestClass: "boa", latestScore: 78, averageScore: 74 },
    comments: [
      {
        date: "2026-06-18",
        workoutTitle: "Intervalado 6x800m",
        notes: "Senti a panturrilha direita apertada nas últimas séries.",
        painLevel: 4,
      },
      {
        date: "2026-06-24",
        workoutTitle: "Longão 18km",
        notes: "Ritmo confortável do início ao fim.",
        painLevel: 0,
      },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<ReportDocumentInput> = {}): ReportDocumentInput {
  return {
    report: {
      id: "report-1",
      status: "PUBLISHED",
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-28T00:00:00.000Z"),
      metricsSnapshot: snapshot(),
      insights: null,
      recommendations: null,
      limitations: null,
      createdAt: new Date("2026-06-29T10:30:00.000Z"),
    },
    athleteName: "Marina Duarte",
    trainerName: "Ricardo Pace",
    ...overrides,
  };
}

describe("buildReportDocument — período com dados suficientes", () => {
  it("monta o documento premium completo", () => {
    expect(buildReportDocument(input())).toMatchSnapshot();
  });

  it("cobre todas as seções exigidas pela Fase 8", () => {
    const document = buildReportDocument(input());
    expect(document.sections.map((s) => s.id)).toEqual([
      "resumo-executivo",
      "aderencia",
      "volume",
      "carga-interna",
      "estado-de-carga",
      "prontidao",
      "sessoes",
      "comentarios",
      "limitacoes",
    ]);
  });

  it("expõe CTL/ATL/TSB/ACWR quando o histórico sustenta a leitura", () => {
    const document = buildReportDocument(input());
    const load = document.sections.find((s) => s.id === "estado-de-carga");
    expect(load?.notice).toBeNull();
    expect(load?.stats.map((s) => s.label)).toEqual(["CTL", "ATL", "TSB", "ACWR"]);
    expect(load?.stats.find((s) => s.label === "ACWR")?.value).toBe("1,10");
  });

  it("transcreve os comentários do atleta sem reescrever", () => {
    const document = buildReportDocument(input());
    const comments = document.sections.find((s) => s.id === "comentarios");
    expect(comments?.rows[0]?.value).toBe(
      "Senti a panturrilha direita apertada nas últimas séries. (dor relatada: 4/10)",
    );
    expect(comments?.notice).toBeNull();
  });

  it("carrega a ressalva de não-diagnóstico em todo documento", () => {
    const document = buildReportDocument(input());
    expect(document.disclaimer).toBe(REPORT_DISCLAIMER);
    expect(document.sections.at(-1)?.paragraphs).toContain(REPORT_DISCLAIMER);
  });
});

describe("buildReportDocument — dados insuficientes", () => {
  const sparse = snapshot({
    adherence: { due: 0, completed: 0, partial: 0, missed: 0, pending: 0, pct: null },
    volume: { sessions: 0, minutes: 0, distanceKm: 0, byModality: [] },
    internalLoad: { total: 0, weeklyAverage: null, sessionsWithLoad: 0, sessionsWithoutLoad: 2 },
    load: {
      ctl: 0.4,
      atl: 0.9,
      tsb: -0.5,
      acwr: null,
      monotony: null,
      strain: null,
      rampPct: null,
      dataDays: 2,
    },
    readiness: { count: 1, latestClass: "insuficiente", latestScore: null, averageScore: null },
    comments: [],
  });

  it("monta o documento declarando cada lacuna", () => {
    expect(
      buildReportDocument(input({ report: { ...input().report, metricsSnapshot: sparse } })),
    ).toMatchSnapshot();
  });

  it("omite CTL/ATL/TSB/ACWR e explica por que, em vez de mostrar zero", () => {
    const document = buildReportDocument(
      input({ report: { ...input().report, metricsSnapshot: sparse } }),
    );
    const load = document.sections.find((s) => s.id === "estado-de-carga");
    expect(load?.stats).toEqual([]);
    expect(load?.notice).toContain("Dados insuficientes");
    expect(load?.notice).toContain("não porque são zero");
  });

  it("declara prontidão insuficiente abaixo do limiar de check-ins", () => {
    const document = buildReportDocument(
      input({ report: { ...input().report, metricsSnapshot: sparse } }),
    );
    const readiness = document.sections.find((s) => s.id === "prontidao");
    expect(readiness?.stats).toEqual([]);
    expect(readiness?.notice).toContain("Dados insuficientes");
  });

  it("nunca inventa interpretação: sem texto do treinador, sem seção de leitura", () => {
    const document = buildReportDocument(
      input({ report: { ...input().report, metricsSnapshot: sparse } }),
    );
    expect(document.sections.some((s) => s.id === "leitura-do-treinador")).toBe(false);
  });
});

describe("buildReportDocument — texto do treinador", () => {
  it("atribui a interpretação ao treinador, em seção própria", () => {
    const document = buildReportDocument(
      input({
        report: {
          ...input().report,
          insights: "Semana de choque planejada; a queda de aderência foi combinada.",
          recommendations: "Manter o volume e reavaliar na próxima segunda.",
          limitations: "Marina viajou na semana 3 e treinou sem relógio.",
        },
      }),
    );

    const trainer = document.sections.find((s) => s.id === "leitura-do-treinador");
    expect(trainer?.paragraphs).toEqual([
      "Semana de choque planejada; a queda de aderência foi combinada.",
      "Manter o volume e reavaliar na próxima segunda.",
    ]);
    expect(document.sections.find((s) => s.id === "limitacoes")?.paragraphs).toContain(
      "Marina viajou na semana 3 e treinou sem relógio.",
    );
  });
});

describe("buildReportDocument — snapshot legado", () => {
  it("recusa reinterpretar formato antigo e pede regeneração", () => {
    const legacy = {
      period: { start: "2026-06-01", end: "2026-06-28" },
      adherence: { due: 10, completed: 8, partial: 1, missed: 1, pct: 90 },
      load: { ctl: 40, acwr: 1.2, dataDays: 20 },
      readiness: { count: 5, latestClass: "boa" },
    };
    const document = buildReportDocument(
      input({ report: { ...input().report, metricsSnapshot: legacy } }),
    );

    expect(document.sections).toHaveLength(1);
    expect(document.sections[0]?.notice).toContain("versão anterior do formato");
    // Nenhum número do snapshot antigo vaza para o documento novo.
    expect(JSON.stringify(document)).not.toContain("90");
  });
});

describe("buildReportDocument — identificação", () => {
  it("usa rótulos neutros quando o perfil não tem nome", () => {
    const document = buildReportDocument(input({ athleteName: null, trainerName: "  " }));
    expect(document.athleteName).toBe("Atleta");
    expect(document.trainerName).toBe("Treinador");
    expect(document.periodLabel).toBe("01/06/2026 a 28/06/2026");
    expect(document.generatedLabel).toBe("Gerado em 29/06/2026");
  });
});
