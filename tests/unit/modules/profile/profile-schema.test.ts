import { describe, expect, it } from "vitest";
import {
  accountDeletionSchema,
  preferencesSchema,
  updateProfileSchema,
} from "@/modules/profile/profile-schema";

describe("preferencesSchema", () => {
  it("accepts a valid subset and rejects unknown keys (strict)", () => {
    expect(preferencesSchema.safeParse({ units: "METRIC", language: "pt-BR" }).success).toBe(true);
    expect(preferencesSchema.safeParse({ nope: 1 }).success).toBe(false);
  });
  it("rejects an invalid timezone shape and out-of-range sports", () => {
    expect(preferencesSchema.safeParse({ timezone: "not a tz!!" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ sports: ["ROWING"] }).success).toBe(false);
  });
  it("validates notification categories are booleans", () => {
    expect(preferencesSchema.safeParse({ notifications: { coachMessage: true } }).success).toBe(true);
    expect(preferencesSchema.safeParse({ notifications: { coachMessage: "yes" } }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("requires at least one field", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
  it("allows clearing health fields with null but rejects impossible weights", () => {
    expect(updateProfileSchema.safeParse({ weightKg: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ weightKg: -5 }).success).toBe(false);
  });
});

describe("accountDeletionSchema", () => {
  it("demands explicit confirm:true", () => {
    expect(accountDeletionSchema.safeParse({ confirm: true }).success).toBe(true);
    expect(accountDeletionSchema.safeParse({ confirm: false }).success).toBe(false);
    expect(accountDeletionSchema.safeParse({}).success).toBe(false);
  });
});
