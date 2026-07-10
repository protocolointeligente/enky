import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/modules/identity/normalize-email";

describe("modules/identity/normalize-email", () => {
  it("trims and lowercases the email", () => {
    expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("Test@Example.COM");
    expect(normalizeEmail(once)).toBe(once);
  });
});
