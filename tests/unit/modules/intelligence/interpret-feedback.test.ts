import { describe, expect, it } from "vitest";
import {
  interpretFeedback,
  type FeedbackInterpretationInput,
} from "@/modules/intelligence/interpret-feedback";

function make(
  status: string,
  feedback: Partial<FeedbackInterpretationInput["feedback"]> = {},
  plannedDurationMinutes: number | null = 60,
): FeedbackInterpretationInput {
  return {
    athleteId: "a1",
    athleteName: "Atleta",
    status,
    plannedDurationMinutes,
    feedback: {
      actualDurationMinutes: 60,
      sessionRpe: 6,
      sessionRpeLoad: "360",
      loadStatus: "COMPLETE",
      fatigueLevel: 4,
      recoveryLevel: 7,
      painLevel: 0,
      painRegion: null,
      ...feedback,
    },
  };
}

describe("interpret feedback engine", () => {
  it("dor vira urgente e nunca diagnostica", () => {
    const i = interpretFeedback(make("COMPLETED", { painLevel: 5, painRegion: "joelho" }));
    expect(i.risk).toBe("urgente");
    expect(i.regras).toContain("seguranca:dor-relatada");
    expect(i.limitacoes.toLowerCase()).toContain("não é um diagnóstico");
  });

  it("dor sobrepõe não realizado", () => {
    const i = interpretFeedback(make("MISSED", { painLevel: 5 }));
    expect(i.risk).toBe("urgente");
  });

  it("não realizado vira atenção", () => {
    const i = interpretFeedback(make("MISSED", { actualDurationMinutes: null, sessionRpe: null }));
    expect(i.risk).toBe("atencao");
    expect(i.regras).toContain("adesao:nao-realizado");
  });

  it("RPE muito alto vira revisar", () => {
    const i = interpretFeedback(make("COMPLETED", { sessionRpe: 9 }));
    expect(i.risk).toBe("revisar");
    expect(i.regras).toContain("carga:rpe-alto");
  });

  it("parcial vira atenção", () => {
    const i = interpretFeedback(make("PARTIAL"));
    expect(i.risk).toBe("atencao");
    expect(i.regras).toContain("adesao:parcial");
  });

  it("duração bem abaixo do planejado vira atenção", () => {
    const i = interpretFeedback(make("COMPLETED", { actualDurationMinutes: 30 }, 60));
    expect(i.risk).toBe("atencao");
    expect(i.regras).toContain("execucao:duracao-abaixo");
  });

  it("sessão normal concluída é positiva", () => {
    const i = interpretFeedback(make("COMPLETED"));
    expect(i.risk).toBe("positivo");
    expect(i.regras).toContain("execucao:conforme-planejado");
  });
});
