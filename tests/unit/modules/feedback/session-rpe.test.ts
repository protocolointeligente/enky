import { describe, expect, it } from "vitest";
import { calculateSessionRpeLoad } from "@/modules/feedback/session-rpe";

describe("modules/feedback/session-rpe", () => {
  it("returns COMPLETE with the computed load when duration and RPE are both present", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "COMPLETED",
      actualDurationMinutes: 60,
      sessionRpe: 7,
    });
    expect(result).toEqual({ loadStatus: "COMPLETE", sessionRpeLoad: 420 });
  });

  it("rounds the computed load to two decimal places", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "COMPLETED",
      actualDurationMinutes: 33,
      sessionRpe: 6.5,
    });
    expect(result.sessionRpeLoad).toBe(214.5);
  });

  it("returns PARTIAL when only duration is present", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "PARTIAL",
      actualDurationMinutes: 45,
      sessionRpe: null,
    });
    expect(result).toEqual({ loadStatus: "PARTIAL", sessionRpeLoad: null });
  });

  it("returns PARTIAL when only session RPE is present", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "COMPLETED",
      actualDurationMinutes: undefined,
      sessionRpe: 8,
    });
    expect(result).toEqual({ loadStatus: "PARTIAL", sessionRpeLoad: null });
  });

  it("returns NOT_AVAILABLE when neither duration nor RPE are present and the workout wasn't missed", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "COMPLETED",
      actualDurationMinutes: null,
      sessionRpe: null,
    });
    expect(result).toEqual({ loadStatus: "NOT_AVAILABLE", sessionRpeLoad: null });
  });

  it("returns NOT_AVAILABLE for a MISSED workout with no duration/RPE reported", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "MISSED",
      actualDurationMinutes: null,
      sessionRpe: null,
    });
    expect(result).toEqual({ loadStatus: "NOT_AVAILABLE", sessionRpeLoad: null });
  });

  it("returns INVALID for a MISSED workout that also reports a duration", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "MISSED",
      actualDurationMinutes: 20,
      sessionRpe: null,
    });
    expect(result).toEqual({ loadStatus: "INVALID", sessionRpeLoad: null });
  });

  it("returns INVALID for a MISSED workout that also reports a session RPE", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "MISSED",
      actualDurationMinutes: null,
      sessionRpe: 5,
    });
    expect(result).toEqual({ loadStatus: "INVALID", sessionRpeLoad: null });
  });

  it("returns INVALID for a MISSED workout that reports both duration and RPE", () => {
    const result = calculateSessionRpeLoad({
      completionStatus: "MISSED",
      actualDurationMinutes: 20,
      sessionRpe: 5,
    });
    expect(result).toEqual({ loadStatus: "INVALID", sessionRpeLoad: null });
  });
});
