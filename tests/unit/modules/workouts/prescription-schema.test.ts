import { describe, expect, it } from "vitest";
import {
  createWorkoutDraftInputSchema,
  updateWorkoutDraftInputSchema,
} from "@/modules/workouts/prescription-schema";

const validAthleteId = "550e8400-e29b-41d4-a716-446655440000";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    athleteId: validAthleteId,
    title: "Treino de rodagem",
    modality: "RUNNING",
    plannedDate: "2026-07-15",
    blocks: [],
    ...overrides,
  };
}

describe("modules/workouts/prescription-schema — createWorkoutDraftInputSchema", () => {
  it("accepts a minimal valid draft with defaults applied", () => {
    const result = createWorkoutDraftInputSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/Sao_Paulo");
      expect(result.data.blocks).toEqual([]);
    }
  });

  it("rejects a missing athleteId", () => {
    const withoutAthlete: Record<string, unknown> = baseInput();
    delete withoutAthlete.athleteId;
    const result = createWorkoutDraftInputSchema.safeParse(withoutAthlete);
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID athleteId", () => {
    const result = createWorkoutDraftInputSchema.safeParse(baseInput({ athleteId: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = createWorkoutDraftInputSchema.safeParse(baseInput({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid modality", () => {
    const result = createWorkoutDraftInputSchema.safeParse(baseInput({ modality: "SURFING" }));
    expect(result.success).toBe(false);
  });

  it("rejects a plannedDate that isn't AAAA-MM-DD", () => {
    const result = createWorkoutDraftInputSchema.safeParse(baseInput({ plannedDate: "15/07/2026" }));
    expect(result.success).toBe(false);
  });

  it("accepts plannedStartAt before plannedEndAt", () => {
    const result = createWorkoutDraftInputSchema.safeParse(
      baseInput({
        plannedStartAt: "2026-07-15T08:00:00.000Z",
        plannedEndAt: "2026-07-15T09:00:00.000Z",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects plannedEndAt at or before plannedStartAt", () => {
    const result = createWorkoutDraftInputSchema.safeParse(
      baseInput({
        plannedStartAt: "2026-07-15T09:00:00.000Z",
        plannedEndAt: "2026-07-15T09:00:00.000Z",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("derives step/exercise sequence from array order, never from client input", () => {
    const result = createWorkoutDraftInputSchema.safeParse(
      baseInput({
        blocks: [
          {
            steps: [{ stepType: "RODAGEM" }, { stepType: "TIRO", repetitions: 6 }],
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks[0]?.steps).toHaveLength(2);
      // No `sequence` field anywhere in the accepted shape — it's not part
      // of the client-facing contract at all.
      expect(result.data.blocks[0]?.steps[0]).not.toHaveProperty("sequence");
    }
  });

  it("accepts a strength block built from exercises instead of steps", () => {
    const result = createWorkoutDraftInputSchema.safeParse(
      baseInput({
        modality: "STRENGTH",
        blocks: [
          {
            exercises: [{ exerciseName: "Agachamento", sets: 4, reps: 8, loadKg: 80 }],
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an exercise with zero sets", () => {
    const result = createWorkoutDraftInputSchema.safeParse(
      baseInput({
        modality: "STRENGTH",
        blocks: [{ exercises: [{ exerciseName: "Agachamento", sets: 0 }] }],
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe("modules/workouts/prescription-schema — updateWorkoutDraftInputSchema", () => {
  it("requires lockVersion", () => {
    const result = updateWorkoutDraftInputSchema.safeParse(baseInput());
    expect(result.success).toBe(false);
  });

  it("accepts a valid update payload with lockVersion", () => {
    const result = updateWorkoutDraftInputSchema.safeParse(baseInput({ lockVersion: 1 }));
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive lockVersion", () => {
    const result = updateWorkoutDraftInputSchema.safeParse(baseInput({ lockVersion: 0 }));
    expect(result.success).toBe(false);
  });

  it("also enforces the end-after-start rule on updates", () => {
    const result = updateWorkoutDraftInputSchema.safeParse(
      baseInput({
        lockVersion: 2,
        plannedStartAt: "2026-07-15T09:00:00.000Z",
        plannedEndAt: "2026-07-15T08:00:00.000Z",
      }),
    );
    expect(result.success).toBe(false);
  });
});
