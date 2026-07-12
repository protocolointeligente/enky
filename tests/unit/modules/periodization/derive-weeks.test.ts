import { describe, expect, it } from "vitest";
import { deriveWeeks } from "@/modules/periodization/periodization-service";

// Derivação de semanas — função pura. Janelas de 7 dias a partir do início,
// última semana aparada na data final, sem drift de fuso.

describe("deriveWeeks", () => {
  it("gera semanas de 7 dias e apara a última na data final", () => {
    const weeks = deriveWeeks("2026-01-05", "2026-01-25"); // 21 dias => 3 semanas
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toEqual({ sequence: 1, startDate: "2026-01-05", endDate: "2026-01-11" });
    expect(weeks[1]).toEqual({ sequence: 2, startDate: "2026-01-12", endDate: "2026-01-18" });
    expect(weeks[2]).toEqual({ sequence: 3, startDate: "2026-01-19", endDate: "2026-01-25" });
  });

  it("apara a última semana parcial", () => {
    const weeks = deriveWeeks("2026-01-05", "2026-01-15"); // 11 dias => 2 semanas (a 2ª parcial)
    expect(weeks).toHaveLength(2);
    expect(weeks[1]).toEqual({ sequence: 2, startDate: "2026-01-12", endDate: "2026-01-15" });
  });

  it("um único dia vira uma semana de um dia", () => {
    const weeks = deriveWeeks("2026-01-05", "2026-01-05");
    expect(weeks).toEqual([{ sequence: 1, startDate: "2026-01-05", endDate: "2026-01-05" }]);
  });
});
