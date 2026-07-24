import { describe, expect, it } from "vitest";
import {
  averageTicket,
  monthlyFromCycle,
  takeRatePct,
} from "@/modules/admin/marketplace-dashboard-math";

describe("takeRatePct", () => {
  it("computes commission share of GMV, 0 when no GMV", () => {
    expect(takeRatePct(1000, 100)).toBe(10);
    expect(takeRatePct(0, 0)).toBe(0);
    expect(takeRatePct(300, 30)).toBe(10);
  });
});

describe("averageTicket", () => {
  it("divides GMV by sales, 0 without sales", () => {
    expect(averageTicket(1000, 4)).toBe(250);
    expect(averageTicket(0, 0)).toBe(0);
  });
});

describe("monthlyFromCycle", () => {
  it("keeps monthly and divides annual by 12", () => {
    expect(monthlyFromCycle(99, "MENSAL")).toBe(99);
    expect(monthlyFromCycle(1200, "ANUAL")).toBe(100);
  });
});
