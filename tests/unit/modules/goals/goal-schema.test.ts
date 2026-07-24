import { describe, expect, it } from "vitest";
import { createGoalSchema, goalTargetsSchema, updateGoalSchema } from "@/modules/goals/goal-schema";

describe("createGoalSchema", () => {
  it("accepts a minimal valid goal and defaults priority", () => {
    const r = createGoalSchema.parse({ title: "Maratona SP", type: "RACE" });
    expect(r.priority).toBe("MEDIUM");
  });

  it("rejects too-short title and unknown type", () => {
    expect(createGoalSchema.safeParse({ title: "x", type: "RACE" }).success).toBe(false);
    expect(createGoalSchema.safeParse({ title: "Meta", type: "NOPE" }).success).toBe(false);
  });

  it("rejects a bad target date format", () => {
    expect(createGoalSchema.safeParse({ title: "Meta", type: "RACE", targetDate: "01/2026" }).success).toBe(false);
  });
});

describe("goalTargetsSchema", () => {
  it("accepts known metrics and rejects unknown keys (strict)", () => {
    expect(goalTargetsSchema.safeParse({ distanceKm: 42.2, timeSeconds: 12600 }).success).toBe(true);
    expect(goalTargetsSchema.safeParse({ heartbeats: 999 }).success).toBe(false);
  });
});

describe("updateGoalSchema", () => {
  it("requires lockVersion", () => {
    expect(updateGoalSchema.safeParse({ progress: 50 }).success).toBe(false);
  });

  it("rejects an update carrying only lockVersion (nothing to change)", () => {
    expect(updateGoalSchema.safeParse({ lockVersion: 1 }).success).toBe(false);
  });

  it("clamps progress to 0..100", () => {
    expect(updateGoalSchema.safeParse({ lockVersion: 1, progress: 150 }).success).toBe(false);
    expect(updateGoalSchema.safeParse({ lockVersion: 1, progress: 100 }).success).toBe(true);
  });

  it("allows clearing a nullable field", () => {
    expect(updateGoalSchema.safeParse({ lockVersion: 2, targetDate: null }).success).toBe(true);
  });
});
