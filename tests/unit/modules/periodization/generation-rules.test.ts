import { describe, expect, it } from "vitest";
import {
  ALGORITHM_VERSION,
  classifyPhase,
  planWeek,
  type WeekContext,
} from "@/modules/periodization/generation-rules";

// Motor de geração assistida — função pura, testada sem banco.
// A semana de referência 2026-01-05 (segunda) a 2026-01-11 (domingo) permite
// mapear dia ISO -> data de forma direta.

function context(overrides: Partial<WeekContext> = {}): WeekContext {
  return {
    goal: "Maratona de São Paulo",
    modality: "RUNNING",
    level: "INTERMEDIATE",
    availableWeekdays: [1, 3, 5, 7],
    phaseName: "Base",
    isRecoveryWeek: false,
    targetVolumeKm: 40,
    weekStartDate: "2026-01-05",
    weekEndDate: "2026-01-11",
    includeStrength: false,
    ...overrides,
  };
}

function totalDistanceM(plan: ReturnType<typeof planWeek>): number {
  return plan.sessions
    .flatMap((s) => s.blocks)
    .flatMap((b) => b.steps.map((step) => (step.distanceMeters ?? 0) * b.repetitions))
    .reduce((sum, value) => sum + value, 0);
}

describe("classifyPhase", () => {
  it("reconhece as fases do ciclo por palavra-chave, ignorando acento e caixa", () => {
    expect(classifyPhase("Base aeróbica")).toEqual({ kind: "BASE", matched: true });
    expect(classifyPhase("Específico")).toEqual({ kind: "BUILD", matched: true });
    expect(classifyPhase("PICO / Competição")).toEqual({ kind: "PEAK", matched: true });
    expect(classifyPhase("Polimento")).toEqual({ kind: "TAPER", matched: true });
    expect(classifyPhase("Transição")).toEqual({ kind: "TRANSITION", matched: true });
  });

  it("cai em BASE sem casar quando a fase é desconhecida ou ausente", () => {
    // Chutar BUILD num nome desconhecido inventaria intensidade — o motor
    // escolhe a fase mais conservadora e sinaliza que não reconheceu.
    expect(classifyPhase("Mesociclo Alfa")).toEqual({ kind: "BASE", matched: false });
    expect(classifyPhase(undefined)).toEqual({ kind: "BASE", matched: false });
  });
});

describe("planWeek — invariantes de produto", () => {
  it("agenda somente nos dias disponíveis, dentro da janela da semana", () => {
    const plan = planWeek(context({ availableWeekdays: [2, 4] }));
    // 2026-01-06 = terça, 2026-01-08 = quinta
    expect(plan.sessions.map((s) => s.plannedDate)).toEqual(["2026-01-06", "2026-01-08"]);
  });

  it("respeita a janela parcial da última semana do plano", () => {
    const plan = planWeek(
      context({ availableWeekdays: [1, 3, 5, 7], weekEndDate: "2026-01-07" }), // seg..qua
    );
    expect(plan.sessions.map((s) => s.plannedDate)).toEqual(["2026-01-05", "2026-01-07"]);
  });

  it("carimba a versão do algoritmo e do rationale em todo plano", () => {
    const plan = planWeek(context());
    expect(plan.rationale.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(plan.rationale.rules.every((r) => r.version.length > 0)).toBe(true);
  });

  it("explica cada regra aplicada em vez de só entregar números", () => {
    const plan = planWeek(context());
    const ids = plan.rationale.rules.map((r) => r.id);
    expect(ids).toContain("phase-classification");
    expect(ids).toContain("week-volume");
    expect(ids).toContain("confidence");
    expect(plan.rationale.rules.every((r) => r.explanation.length > 20)).toBe(true);
  });

  it("nunca usa ACWR para decidir carga e diz isso explicitamente", () => {
    const plan = planWeek(context());
    expect(plan.rationale.caveats.join(" ")).toMatch(/ACWR/);
  });
});

describe("planWeek — confiança e dados ausentes", () => {
  it("gera com confiança LOW e pede o dado quando falta volume alvo", () => {
    const plan = planWeek(context({ targetVolumeKm: undefined }));
    // Regra do produto: faltou dado => gera mesmo assim, rebaixado e explícito.
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.confidence).toBe("LOW");
    expect(plan.rationale.missingData).toContain("targetVolume");
    expect(plan.rationale.caveats.join(" ")).toMatch(/Volume alvo ausente/);
  });

  it("rebaixa para MODERATE quando o nível do atleta não é informado", () => {
    const plan = planWeek(context({ level: undefined }));
    expect(plan.confidence).toBe("MODERATE");
    expect(plan.rationale.missingData).toContain("level");
  });

  it("rebaixa para MODERATE quando a fase não é reconhecida", () => {
    const plan = planWeek(context({ phaseName: "Mesociclo Alfa" }));
    expect(plan.confidence).toBe("MODERATE");
    expect(plan.rationale.missingData).toContain("phaseName");
  });

  it("só chega a HIGH com todos os dados presentes", () => {
    expect(planWeek(context()).confidence).toBe("HIGH");
  });

  it("mantém o menor teto quando faltam vários dados", () => {
    const plan = planWeek(context({ level: undefined, targetVolumeKm: undefined }));
    expect(plan.confidence).toBe("LOW");
  });
});

describe("planWeek — fase do ciclo e semana regenerativa", () => {
  it("base não prescreve mais de uma sessão de qualidade", () => {
    const plan = planWeek(context({ phaseName: "Base", availableWeekdays: [1, 2, 3, 4, 5, 6] }));
    expect(plan.sessions.filter((s) => s.kind === "QUALITY")).toHaveLength(1);
  });

  it("build sobe a densidade de qualidade em relação à base", () => {
    const days = [1, 2, 3, 4, 5, 6];
    const base = planWeek(context({ phaseName: "Base", availableWeekdays: days }));
    const build = planWeek(context({ phaseName: "Específico", availableWeekdays: days }));
    expect(build.sessions.filter((s) => s.kind === "QUALITY").length).toBeGreaterThan(
      base.sessions.filter((s) => s.kind === "QUALITY").length,
    );
  });

  it("taper corta volume mas preserva intensidade", () => {
    const base = planWeek(context({ phaseName: "Base" }));
    const taper = planWeek(context({ phaseName: "Polimento" }));
    expect(taper.rationale.weekVolumeKm!).toBeLessThan(base.rationale.weekVolumeKm!);
    // Reduzir volume E intensidade juntos desmontaria a adaptação do ciclo.
    expect(taper.sessions.some((s) => s.kind === "QUALITY")).toBe(true);
  });

  it("semana regenerativa zera a qualidade e reduz o volume", () => {
    const normal = planWeek(context());
    const recovery = planWeek(context({ isRecoveryWeek: true }));
    expect(recovery.sessions.every((s) => s.kind === "RECOVERY")).toBe(true);
    expect(recovery.sessions.some((s) => s.kind === "QUALITY" || s.kind === "LONG")).toBe(false);
    expect(recovery.rationale.weekVolumeKm!).toBeCloseTo(normal.rationale.weekVolumeKm! * 0.6, 5);
  });
});

describe("planWeek — nível e disponibilidade", () => {
  it("limita o iniciante mesmo com agenda cheia", () => {
    const plan = planWeek(context({ level: "BEGINNER", availableWeekdays: [1, 2, 3, 4, 5, 6, 7] }));
    expect(plan.sessions).toHaveLength(4);
    expect(plan.sessions.filter((s) => s.kind === "QUALITY").length).toBeLessThanOrEqual(1);
  });

  it("o avançado usa toda a disponibilidade", () => {
    const plan = planWeek(
      context({
        level: "ADVANCED",
        phaseName: "Específico",
        availableWeekdays: [1, 2, 3, 4, 5, 6, 7],
      }),
    );
    expect(plan.sessions).toHaveLength(7);
  });

  it("um único dia disponível gera uma sessão com confiança LOW", () => {
    const plan = planWeek(context({ availableWeekdays: [3] }));
    expect(plan.sessions).toHaveLength(1);
    expect(plan.confidence).toBe("LOW");
  });
});

// ---------------------------------------------------------------------------
// Especificidade por modalidade — um bloco por modalidade obrigatória.
// ---------------------------------------------------------------------------

describe("modalidade: corrida", () => {
  it("distribui o volume alvo em km entre as sessões", () => {
    const plan = planWeek(context({ modality: "RUNNING", targetVolumeKm: 40 }));
    expect(plan.sessions.every((s) => s.modality === "RUNNING")).toBe(true);
    // Sessões contínuas somam o volume da semana; a de qualidade aproxima.
    expect(totalDistanceM(plan)).toBeGreaterThan(30_000);
    expect(totalDistanceM(plan)).toBeLessThan(55_000);
  });

  it("prescreve intensidade em RPE, nunca em pace inventado", () => {
    const plan = planWeek(context({ modality: "RUNNING" }));
    const targets = plan.sessions.flatMap((s) =>
      s.blocks.flatMap((b) => b.steps.map((step) => step.targetType)),
    );
    expect(targets.filter(Boolean)).not.toContain("PACE");
    expect(targets).toContain("RPE");
  });

  it("a série principal da corrida usa tiros curtos no build e longos na base", () => {
    const build = planWeek(context({ modality: "RUNNING", phaseName: "Específico" }));
    const base = planWeek(context({ modality: "RUNNING", phaseName: "Base" }));
    const mainOf = (plan: typeof build) =>
      plan.sessions
        .find((s) => s.kind === "QUALITY")!
        .blocks.find((b) => b.name?.includes("Série"))!;
    expect(mainOf(build).steps[0]?.distanceMeters).toBe(400);
    expect(mainOf(base).steps[0]?.distanceMeters).toBe(1000);
  });

  it("monta a sessão de qualidade com aquecimento, série e volta à calma", () => {
    const plan = planWeek(context({ modality: "RUNNING", phaseName: "Específico" }));
    const quality = plan.sessions.find((s) => s.kind === "QUALITY")!;
    expect(quality.blocks.map((b) => b.name)).toEqual([
      "Aquecimento",
      expect.stringContaining("Série principal"),
      "Volta à calma",
    ]);
    expect(quality.blocks[1]?.steps.map((s) => s.stepType)).toEqual(["TIRO", "PAUSA_ATIVA"]);
  });
});

describe("modalidade: natação", () => {
  it("converte o volume em km para metros de piscina", () => {
    const plan = planWeek(context({ modality: "SWIMMING", targetVolumeKm: 8 }));
    expect(plan.sessions.every((s) => s.modality === "SWIMMING")).toBe(true);
    expect(totalDistanceM(plan)).toBeGreaterThan(6_000);
    expect(totalDistanceM(plan)).toBeLessThan(11_000);
  });

  it("usa repetições e pausa curta próprias do nado", () => {
    const plan = planWeek(
      context({ modality: "SWIMMING", phaseName: "Específico", targetVolumeKm: 8 }),
    );
    const main = plan.sessions
      .find((s) => s.kind === "QUALITY")!
      .blocks.find((b) => b.name?.includes("Série"))!;
    expect(main.steps[0]?.distanceMeters).toBe(100);
    expect(main.steps[1]?.durationSeconds).toBe(20); // pausa na borda
  });
});

describe("modalidade: ciclismo", () => {
  it("trabalha com o volume maior típico do pedal", () => {
    const plan = planWeek(context({ modality: "CYCLING", targetVolumeKm: 200 }));
    expect(plan.sessions.every((s) => s.modality === "CYCLING")).toBe(true);
    expect(totalDistanceM(plan)).toBeGreaterThan(150_000);
  });

  it("usa repetições longas e pausa ampla no pedal", () => {
    const plan = planWeek(
      context({ modality: "CYCLING", phaseName: "Específico", targetVolumeKm: 200 }),
    );
    const main = plan.sessions
      .find((s) => s.kind === "QUALITY")!
      .blocks.find((b) => b.name?.includes("Série"))!;
    expect(main.steps[0]?.distanceMeters).toBe(2000);
    expect(main.steps[1]?.durationSeconds).toBe(180);
  });
});

describe("modalidade: triathlon", () => {
  it("gera sessões nas três disciplinas, cada treino na sua modalidade", () => {
    const plan = planWeek(
      context({
        modality: "TRIATHLON",
        availableWeekdays: [1, 2, 3, 4, 5, 6],
        targetVolumeKm: 150,
      }),
    );
    const modalities = new Set(plan.sessions.map((s) => s.modality));
    expect(modalities).toEqual(new Set(["SWIMMING", "CYCLING", "RUNNING"]));
    // Nenhum treino sai rotulado TRIATHLON: o atleta abre "Natação", não um
    // treino genérico que ele não sabe onde fazer.
    expect(plan.sessions.some((s) => s.modality === "TRIATHLON")).toBe(false);
  });

  it("põe o longão no pedal", () => {
    const plan = planWeek(
      context({
        modality: "TRIATHLON",
        availableWeekdays: [1, 2, 3, 4, 5, 6],
        targetVolumeKm: 150,
      }),
    );
    expect(plan.sessions.find((s) => s.kind === "LONG")!.modality).toBe("CYCLING");
  });

  it("dá ao pedal a maior fatia do volume e ao nado a menor", () => {
    const plan = planWeek(
      context({
        modality: "TRIATHLON",
        availableWeekdays: [1, 2, 3, 4, 5, 6],
        targetVolumeKm: 150,
      }),
    );
    const kmBy = (modality: string) =>
      plan.sessions
        .filter((s) => s.modality === modality)
        .flatMap((s) => s.blocks)
        .flatMap((b) => b.steps.map((step) => (step.distanceMeters ?? 0) * b.repetitions))
        .reduce((sum, value) => sum + value, 0);
    expect(kmBy("CYCLING")).toBeGreaterThan(kmBy("RUNNING"));
    expect(kmBy("RUNNING")).toBeGreaterThan(kmBy("SWIMMING"));
  });

  it("nunca promete confiança HIGH — dividir um km escalar entre disciplinas é suposição", () => {
    const plan = planWeek(
      context({
        modality: "TRIATHLON",
        availableWeekdays: [1, 2, 3, 4, 5, 6],
        targetVolumeKm: 150,
      }),
    );
    expect(plan.confidence).toBe("MODERATE");
    expect(plan.rationale.caveats.join(" ")).toMatch(/não são equivalentes entre disciplinas/);
    expect(plan.rationale.rules.map((r) => r.id)).toContain("triathlon-split");
  });
});

describe("modalidade: força/funcional como complemento", () => {
  it("não adiciona força quando o treinador não pede", () => {
    const plan = planWeek(context({ includeStrength: false }));
    expect(plan.sessions.some((s) => s.modality === "FUNCTIONAL")).toBe(false);
  });

  it("complementa o endurance sem colidir com qualidade nem véspera de longão", () => {
    const plan = planWeek(
      context({ phaseName: "Base", availableWeekdays: [1, 2, 3, 4, 5, 6], includeStrength: true }),
    );
    const strength = plan.sessions.filter((s) => s.modality === "FUNCTIONAL");
    expect(strength.length).toBeGreaterThan(0);

    const longDate = plan.sessions.find((s) => s.kind === "LONG")!.plannedDate;
    const qualityDates = plan.sessions
      .filter((s) => s.kind === "QUALITY")
      .map((s) => s.plannedDate);
    for (const session of strength) {
      expect(session.plannedDate).not.toBe(longDate);
      expect(qualityDates).not.toContain(session.plannedDate);
    }
  });

  it("prescreve força em séries/reps/RIR, nunca em %1RM sem teste de 1RM", () => {
    const plan = planWeek(context({ includeStrength: true }));
    const exercises = plan.sessions
      .filter((s) => s.modality === "FUNCTIONAL")
      .flatMap((s) => s.blocks)
      .flatMap((b) => b.exercises);
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((e) => e.sets > 0)).toBe(true);
    expect(exercises.some((e) => e.rir !== undefined)).toBe(true);
  });

  it("ajusta a força à fase: força máxima no build, resistência na base", () => {
    const base = planWeek(context({ phaseName: "Base", includeStrength: true }));
    const build = planWeek(context({ phaseName: "Específico", includeStrength: true }));
    const mainSets = (plan: typeof base) =>
      plan.sessions.find((s) => s.modality === "FUNCTIONAL")!.blocks[0]!.exercises[0]!;
    expect(mainSets(base).reps).toBe(12);
    expect(mainSets(build).reps).toBe(6);
  });

  it("a semana regenerativa também alivia a força", () => {
    const plan = planWeek(
      context({ phaseName: "Específico", includeStrength: true, isRecoveryWeek: true }),
    );
    const exercise = plan.sessions.find((s) => s.modality === "FUNCTIONAL")!.blocks[0]!
      .exercises[0]!;
    // Não adianta cortar corrida e manter 4x6 pesado.
    expect(exercise.reps).toBe(12);
    expect(exercise.rir).toBe(4);
  });

  it("funciona como modalidade principal do plano, sem exigir volume em km", () => {
    const plan = planWeek(context({ modality: "STRENGTH", targetVolumeKm: undefined }));
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.every((s) => s.modality === "STRENGTH")).toBe(true);
    // Volume em km não se aplica: a ausência dele não pode rebaixar a confiança.
    expect(plan.rationale.missingData).not.toContain("targetVolume");
    expect(plan.confidence).toBe("HIGH");
  });
});
