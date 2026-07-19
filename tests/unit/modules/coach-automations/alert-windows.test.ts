import { describe, expect, it } from "vitest";
import { addDays, alertWindows, utcDayStart } from "@/modules/coach-automations/alert-windows";

describe("alert-windows", () => {
  it("utcDayStart zera a hora em UTC", () => {
    expect(utcDayStart(new Date("2026-07-19T18:30:00Z")).toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("addDays soma dias exatos", () => {
    expect(addDays(new Date("2026-07-19T00:00:00Z"), 7).toISOString()).toBe("2026-07-26T00:00:00.000Z");
  });

  it("as janelas batem com hoje/amanhã/+7 e o corte de 24h", () => {
    const w = alertWindows(new Date("2026-07-19T12:00:00Z"));
    expect(w.today.toISOString()).toBe("2026-07-19T00:00:00.000Z");
    expect(w.tomorrow.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(w.dayAfter.toISOString()).toBe("2026-07-21T00:00:00.000Z");
    expect(w.in8days.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(w.cutoff24h.toISOString()).toBe("2026-07-18T12:00:00.000Z");
  });
});
