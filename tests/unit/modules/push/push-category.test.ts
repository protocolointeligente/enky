import { describe, expect, it } from "vitest";
import { isCategoryEnabled } from "@/modules/push/push-category";

describe("isCategoryEnabled", () => {
  it("always sends accountAlert, even with no prefs or explicitly false", () => {
    expect(isCategoryEnabled("accountAlert", null)).toBe(true);
    expect(isCategoryEnabled("accountAlert", { accountAlert: false })).toBe(true);
  });

  it("is opt-in for other categories (undefined = off)", () => {
    expect(isCategoryEnabled("coachMessage", null)).toBe(false);
    expect(isCategoryEnabled("coachMessage", {})).toBe(false);
    expect(isCategoryEnabled("coachMessage", { coachMessage: false })).toBe(false);
    expect(isCategoryEnabled("coachMessage", { coachMessage: true })).toBe(true);
  });

  it("does not leak enablement across categories", () => {
    expect(isCategoryEnabled("payment", { coachMessage: true })).toBe(false);
  });
});
