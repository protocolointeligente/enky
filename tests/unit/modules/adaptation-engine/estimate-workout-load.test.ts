import { describe, expect, it } from "vitest";
import {
  estimateWorkoutLoad,
  LOAD_ESTIMATOR_VERSION,
  type WorkoutInput,
} from "@/modules/adaptation-engine/estimate-workout-load";

describe("estimateWorkoutLoad", () => {
  it("expõe versão e marca tudo como estimativa", () => {
    expect(LOAD_ESTIMATOR_VERSION).toBe("load-estimator-v1");
    const est = estimateWorkoutLoad({ modality: "RUNNING", blocks: [] });
    expect(est.estimated).toBe(true);
    expect(est.load).toBe(0);
  });

  it("rodagem contínua leve por distância → EASY, carga baixa, volume em km", () => {
    const w: WorkoutInput = {
      modality: "RUNNING",
      blocks: [
        {
          repetitions: 1,
          steps: [
            { stepType: "RODAGEM", distanceMeters: 8000, targetType: "RPE", targetMin: 3, targetMax: 4 },
          ],
          exercises: [],
        },
      ],
    };
    const est = estimateWorkoutLoad(w);
    expect(est.kind).toBe("EASY");
    expect(est.volumeKm).toBe(8);
    expect(est.load).toBeGreaterThan(0);
  });

  it("série de tiros em RPE alto → QUALITY", () => {
    const w: WorkoutInput = {
      modality: "RUNNING",
      blocks: [
        {
          repetitions: 5,
          steps: [
            { stepType: "TIRO", distanceMeters: 400, targetType: "RPE", targetMin: 8, targetMax: 9 },
            { stepType: "PAUSA_ATIVA", durationSeconds: 90 },
          ],
          exercises: [],
        },
      ],
    };
    const est = estimateWorkoutLoad(w);
    expect(est.kind).toBe("QUALITY");
    // A pausa não puxa o tipo para cima (RPE da pausa é baixo).
    expect(est.load).toBeGreaterThan(0);
  });

  it("longão por duração → LONG", () => {
    const w: WorkoutInput = {
      modality: "RUNNING",
      blocks: [
        {
          repetitions: 1,
          steps: [{ stepType: "RODAGEM", durationSeconds: 90 * 60, targetType: "RPE", targetMin: 4, targetMax: 5 }],
          exercises: [],
        },
      ],
    };
    expect(estimateWorkoutLoad(w).kind).toBe("LONG");
  });

  it("bloco só de exercícios → STRENGTH, sem volume em km", () => {
    const w: WorkoutInput = {
      modality: "STRENGTH",
      blocks: [
        {
          repetitions: 1,
          steps: [],
          exercises: [
            { sets: 4, reps: 6, rir: 2 },
            { sets: 3, reps: 8, rpeTarget: 8 },
          ],
        },
      ],
    };
    const est = estimateWorkoutLoad(w);
    expect(est.kind).toBe("STRENGTH");
    expect(est.volumeKm).toBeNull();
    expect(est.load).toBeGreaterThan(0);
  });

  it("estima minutos por distância quando não há duração (velocidade nominal)", () => {
    const semDuracao = estimateWorkoutLoad({
      modality: "RUNNING",
      blocks: [{ repetitions: 1, steps: [{ stepType: "RODAGEM", distanceMeters: 10000 }], exercises: [] }],
    });
    // 10 km a ~175 m/min ≈ 57 min × RPE 4 ≈ 228 UA — só garantimos que é > 0.
    expect(semDuracao.load).toBeGreaterThan(0);
  });
});
