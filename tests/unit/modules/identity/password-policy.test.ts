import { describe, expect, it } from "vitest";
import { passwordSchema } from "@/modules/identity/password-policy";

describe("modules/identity/password-policy", () => {
  it("accepts a password with letters, numbers, and at least 10 characters", () => {
    expect(passwordSchema.safeParse("correcthorse1").success).toBe(true);
  });

  it("rejects passwords shorter than 10 characters", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
  });

  it("rejects passwords without a number", () => {
    expect(passwordSchema.safeParse("onlylettershere").success).toBe(false);
  });

  it("rejects passwords without a letter", () => {
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
  });

  it("rejects passwords longer than 128 characters", () => {
    expect(passwordSchema.safeParse("a1".repeat(70)).success).toBe(false);
  });
});
