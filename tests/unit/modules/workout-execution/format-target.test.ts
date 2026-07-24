import { describe, expect, it } from "vitest";
import { formatTarget, formatVolume, secToClock, type TargetStep } from "@/modules/workout-execution/format-target";

function step(p: Partial<TargetStep>): TargetStep {
  return {
    stepType: "TIRO",
    repetitions: null,
    durationSeconds: null,
    distanceMeters: null,
    targetType: null,
    targetMin: null,
    targetMax: null,
    ...p,
  };
}

describe("secToClock", () => {
  it("formats mm:ss and h:mm:ss", () => {
    expect(secToClock(300)).toBe("5:00");
    expect(secToClock(305)).toBe("5:05");
    expect(secToClock(3725)).toBe("1:02:05");
  });
});

describe("formatTarget", () => {
  it("formats PACE as clock with per-km for running and per-100m for swimming", () => {
    expect(formatTarget(step({ targetType: "PACE", targetMin: "300", targetMax: "320" }), "RUNNING")).toBe("5:00–5:20 /km");
    expect(formatTarget(step({ targetType: "PACE", targetMin: "100", targetMax: "105" }), "SWIMMING")).toBe("1:40–1:45 /100m");
  });

  it("formats POWER in watts and CADENCE per modality", () => {
    expect(formatTarget(step({ targetType: "POWER", targetMin: "250", targetMax: "280" }), "CYCLING")).toBe("250–280 W");
    expect(formatTarget(step({ targetType: "CADENCE", targetMin: "85", targetMax: "95" }), "CYCLING")).toBe("85–95 rpm");
  });

  it("formats HR zone and RPE, and collapses equal min/max", () => {
    expect(formatTarget(step({ targetType: "HEART_RATE_ZONE", targetMin: "3", targetMax: "4" }), "RUNNING")).toBe("Zona 3–4");
    expect(formatTarget(step({ targetType: "RPE", targetMin: "7", targetMax: "7" }), "CYCLING")).toBe("RPE 7");
  });

  it("returns null when there is no target", () => {
    expect(formatTarget(step({}), "RUNNING")).toBeNull();
  });
});

describe("formatVolume", () => {
  it("uses km for running/cycling and meters for swimming", () => {
    expect(formatVolume(step({ distanceMeters: 5000 }), "RUNNING")).toBe("5 km");
    expect(formatVolume(step({ distanceMeters: 400 }), "RUNNING")).toBe("400 m");
    expect(formatVolume(step({ distanceMeters: 400 }), "SWIMMING")).toBe("400 m");
  });
  it("falls back to duration and null when neither is set", () => {
    expect(formatVolume(step({ durationSeconds: 600 }), "CYCLING")).toBe("10:00");
    expect(formatVolume(step({}), "RUNNING")).toBeNull();
  });
});
