import { describe, expect, it } from "vitest";
import {
  submitWorkoutFeedbackInputSchema,
  updateWorkoutFeedbackInputSchema,
} from "@/modules/feedback/feedback-schema";

describe("modules/feedback/feedback-schema", () => {
  it("accepts a minimal COMPLETED submission", () => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      actualDurationMinutes: 45,
      sessionRpe: 6,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MISSED submission with no other fields", () => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({ completionStatus: "MISSED" });
    expect(result.success).toBe(true);
  });

  it.each([-1, 11])("rejects sessionRpe out of the 1-10 range (%s)", (sessionRpe) => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      sessionRpe,
    });
    expect(result.success).toBe(false);
  });

  it.each([-1, 11])("rejects painLevel out of the 0-10 range (%s)", (painLevel) => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      painLevel,
    });
    expect(result.success).toBe(false);
  });

  it.each([-1, 11])("rejects fatigueLevel out of the 0-10 range (%s)", (fatigueLevel) => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      fatigueLevel,
    });
    expect(result.success).toBe(false);
  });

  it.each([-1, 11])("rejects recoveryLevel out of the 0-10 range (%s)", (recoveryLevel) => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      recoveryLevel,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid completionStatus", () => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({ completionStatus: "DONE" });
    expect(result.success).toBe(false);
  });

  // The backend computes sessionRpeLoad itself (see session-rpe.ts) — a
  // client-supplied value must be silently dropped, never trusted.
  it("strips a client-supplied sessionRpeLoad instead of accepting it", () => {
    const result = submitWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      sessionRpeLoad: 999999,
    });
    expect(result.success).toBe(true);
    expect(result.success && "sessionRpeLoad" in result.data).toBe(false);
  });

  it("requires knownUpdatedAt for the update schema", () => {
    const result = updateWorkoutFeedbackInputSchema.safeParse({ completionStatus: "COMPLETED" });
    expect(result.success).toBe(false);
  });

  it("accepts the update schema when knownUpdatedAt is a valid ISO datetime", () => {
    const result = updateWorkoutFeedbackInputSchema.safeParse({
      completionStatus: "COMPLETED",
      knownUpdatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});
