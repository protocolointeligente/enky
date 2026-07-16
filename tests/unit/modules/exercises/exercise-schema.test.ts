import { describe, expect, it } from "vitest";
import { createExerciseInputSchema } from "@/modules/exercises/exercise-schema";

const base = { category: "peito", targetMuscles: ["peitoral"] };

describe("exercise-schema — normalização de nome (Fase 5)", () => {
  // The stored name is normalized so that caixa/espaço variants collide on the
  // DB's LOWER("name") unique index instead of creating duplicate entries.
  it("remove espaços nas pontas e colapsa espaços internos", () => {
    const parsed = createExerciseInputSchema.parse({ ...base, name: "  Supino   reto  " });
    expect(parsed.name).toBe("Supino reto");
  });

  it("normaliza variantes de espaço para o mesmo nome", () => {
    const a = createExerciseInputSchema.parse({ ...base, name: "Supino reto" }).name;
    const b = createExerciseInputSchema.parse({ ...base, name: "Supino  reto" }).name;
    const c = createExerciseInputSchema.parse({ ...base, name: "\tSupino\treto\n" }).name;
    expect(new Set([a, b, c]).size).toBe(1);
  });

  it("preserva a caixa original para exibição (a unicidade é do índice LOWER)", () => {
    expect(createExerciseInputSchema.parse({ ...base, name: "Supino Reto" }).name).toBe(
      "Supino Reto",
    );
  });

  it("rejeita nome vazio ou só de espaços", () => {
    expect(() => createExerciseInputSchema.parse({ ...base, name: "   " })).toThrow();
  });

  it("aceita os metadados novos e rejeita modalidade inválida", () => {
    const parsed = createExerciseInputSchema.parse({
      ...base,
      name: "Supino",
      modality: "STRENGTH",
      equipment: "barra",
      level: "iniciante",
      videoUrl: "https://exemplo.com/v.mp4",
      videoSource: "gravação própria",
      videoLicense: "material próprio",
    });
    expect(parsed.modality).toBe("STRENGTH");
    expect(parsed.videoSource).toBe("gravação própria");

    expect(() =>
      createExerciseInputSchema.parse({ ...base, name: "X", modality: "YOGA" }),
    ).toThrow();
  });
});
