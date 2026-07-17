import { describe, expect, it } from "vitest";
import { evaluate, type AthleteBucket } from "@/modules/intelligence/attention";
import { computeLoadState } from "@/modules/intelligence/load-state";
import { interpretFeedback } from "@/modules/intelligence/interpret-feedback";
import type { Insight } from "@/modules/intelligence/insight";

// Homologação controlada dos motores 02G (ENKY Intelligence). Exercita o
// cálculo, a prioridade, a confiança e — principalmente — a QUALIDADE e a
// LINGUAGEM das mensagens. Serve de evidência para ENKY_02F_02G_HOMOLOGATION_REPORT.md.

function bucket(overrides: Partial<AthleteBucket> = {}): AthleteBucket {
  return {
    athleteId: "a1",
    athleteName: "Atleta",
    feedbackCount: 6,
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

function flat(value: number, days: number): number[] {
  return Array.from({ length: days }, () => value);
}

// Todo insight relevante precisa explicar a própria origem: motivo, sinais
// usados, sinais ausentes, confiança, período, recomendação e limitação.
// E nunca usar linguagem de certeza, diagnóstico ou previsão de lesão.
function assertWellFormed(insight: Insight) {
  expect(insight.observacao.length).toBeGreaterThan(0);
  expect(insight.interpretacao.length).toBeGreaterThan(0);
  expect(insight.limitacoes.length).toBeGreaterThan(0);
  expect(insight.acoesSugeridas.length).toBeGreaterThan(0);
  expect(insight.dadosUsados.length).toBeGreaterThan(0);
  expect(insight.sinaisAusentes.length).toBeGreaterThan(0); // sempre há ponto cego
  expect(insight.janela.length).toBeGreaterThan(0); // contexto temporal explícito
  expect(["BAIXA", "MEDIA", "ALTA"]).toContain(insight.confianca);

  // Vocabulário proibido — a Fase 7 vale para TODO texto exposto ao treinador,
  // inclusive limitações. "risco de lesão"/"prever lesão" nunca como afirmação;
  // o vocabulário é "sinal de atenção", "carga elevada", "contexto de cautela".
  const shown =
    `${insight.observacao} ${insight.interpretacao} ${insight.acoesSugeridas.join(" ")} ${insight.limitacoes}`.toLowerCase();
  for (const forbidden of [
    "certamente",
    "com certeza",
    "garantid",
    "vai lesionar",
    "está lesionad",
    "prever lesão",
    "previsão de lesão",
    "risco de lesão",
    "prevê lesão",
    "predizer lesão",
    "propenso a lesão",
    "iminente",
  ]) {
    expect(shown, `linguagem proibida: "${forbidden}"`).not.toContain(forbidden);
  }
}

describe("02G homologação — cenários controlados", () => {
  it("1. sem histórico mínimo de carga → nenhum alerta de carga", () => {
    const state = computeLoadState([...flat(300, 5), ...flat(0, 40)]); // 5 dias de treino
    expect(state.dataDays).toBe(5);
    expect(evaluate(bucket({ state }))).toBeNull();
  });

  it("2. carga estável → sem recomendação alarmista", () => {
    const state = computeLoadState(flat(100, 120));
    expect(state.acwr as number).toBeGreaterThan(0.9);
    expect(state.acwr as number).toBeLessThan(1.2);
    expect(evaluate(bucket({ state }))).toBeNull();
  });

  it("3. ACWR ≥ 1,5 (calculado da série) → marcar para revisão", () => {
    const state = computeLoadState([...flat(50, 60), ...flat(220, 10)]);
    expect(state.acwr as number).toBeGreaterThanOrEqual(1.5);
    const i = evaluate(bucket({ state }));
    expect(i?.risk).toBe("revisar");
    expect(i?.regras).toContain("carga:acwr-alto");
    assertWellFormed(i as Insight);
    // Vocabulário da Fase 7: "carga elevada" + "contexto de cautela", jamais
    // previsão. A limitação precisa negar diagnóstico E estimativa de lesão.
    expect((i as Insight).observacao.toLowerCase()).toContain("carga elevada");
    expect((i as Insight).interpretacao.toLowerCase()).toContain("contexto de cautela");
    expect((i as Insight).limitacoes.toLowerCase()).toContain("não diagnosticam nem estimam lesão");
  });

  it("4. rampa semanal ≥ 30% → marcar para revisão", () => {
    const state = {
      ctl: 90,
      atl: 110,
      tsb: -20,
      acwr: 1.2,
      monotony: 1.4,
      strain: 700,
      rampPct: 0.35,
      dataDays: 20,
    };
    const i = evaluate(bucket({ state }));
    expect(i?.risk).toBe("revisar");
    expect(i?.regras).toContain("carga:ramp-alto");
    assertWellFormed(i as Insight);
  });

  it("5. dor + carga elevada → dor aparece primeiro", () => {
    const state = {
      ctl: 100,
      atl: 180,
      tsb: -80,
      acwr: 1.8,
      monotony: 1.5,
      strain: 900,
      rampPct: 0.2,
      dataDays: 20,
    };
    const i = evaluate(bucket({ maxPain: 5, painRegion: "joelho", state }));
    expect(i?.risk).toBe("urgente");
    expect(i?.regras).toContain("seguranca:dor-relatada");
    assertWellFormed(i as Insight);
  });

  it("6. ACWR alto mas amostra pequena → sem alerta de carga", () => {
    const state = {
      ctl: 100,
      atl: 180,
      tsb: -80,
      acwr: 1.8,
      monotony: 1.5,
      strain: 900,
      rampPct: 0.2,
      dataDays: 5,
    };
    expect(evaluate(bucket({ state }))).toBeNull();
  });

  it("7. treino perdido + carga elevada → prioridade documentada (carga antes de perdidos)", () => {
    const state = {
      ctl: 100,
      atl: 170,
      tsb: -70,
      acwr: 1.7,
      monotony: 1.5,
      strain: 800,
      rampPct: 0.2,
      dataDays: 20,
    };
    const i = evaluate(bucket({ missed: 3, state }));
    expect(i?.risk).toBe("revisar");
    expect(i?.regras).toContain("carga:acwr-alto"); // carga > adesão na ordem
  });

  it("8. dados incompletos → confiança reduzida + limitação explícita, sem inventar conclusão", () => {
    const i = evaluate(bucket({ maxRpe: 9, feedbackCount: 1 }));
    expect(i?.confianca).toBe("BAIXA");
    expect(i?.limitacoes.length).toBeGreaterThan(0);
    assertWellFormed(i as Insight);
  });

  it("9. múltiplos atletas → prioridade urgente > revisar > atenção", () => {
    const insights = [
      evaluate(bucket({ athleteId: "b", awaitingReview: 1 })), // atencao
      evaluate(bucket({ athleteId: "c", maxPain: 6 })), // urgente
      evaluate(bucket({ athleteId: "d", missed: 3 })), // revisar
    ].filter(Boolean) as Insight[];
    const order: Record<string, number> = { urgente: 3, revisar: 2, atencao: 1, positivo: 0 };
    insights.sort((a, b) => order[b.risk]! - order[a.risk]!);
    expect(insights.map((i) => i.risk)).toEqual(["urgente", "revisar", "atencao"]);
  });

  it("10. feedback interpretado + estado de carga coexistem sem conflito", () => {
    // Superfície 1 (detalhe do treino): feedback da sessão.
    const fb = interpretFeedback({
      athleteId: "a1",
      athleteName: "Atleta",
      status: "COMPLETED",
      plannedDurationMinutes: 60,
      feedback: {
        actualDurationMinutes: 60,
        sessionRpe: 9,
        sessionRpeLoad: "540",
        loadStatus: "COMPLETE",
        fatigueLevel: 7,
        recoveryLevel: 4,
        painLevel: 0,
        painRegion: null,
      },
    });
    expect(fb.risk).toBe("revisar");
    assertWellFormed(fb);

    // Superfície 2 (dashboard): estado de carga do atleta.
    const state = computeLoadState([...flat(50, 60), ...flat(220, 10)]);
    const att = evaluate(bucket({ state }));
    expect(att?.risk).toBe("revisar");
    assertWellFormed(att as Insight);
  });
});
