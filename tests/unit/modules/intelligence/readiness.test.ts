import { describe, expect, it } from "vitest";
import { classifyReadiness } from "@/modules/intelligence/readiness";

// Índice de prontidão (Fase II) — função pura. Testa os gates (dados
// insuficientes), a direção dos sinais (ruins invertidos) e as classes.

describe("classifyReadiness", () => {
  it("marca insuficiente com menos de 3 sinais", () => {
    const r = classifyReadiness({ sleepHours: 8, motivation: 9 });
    expect(r.class).toBe("insuficiente");
    expect(r.score).toBeNull();
    expect(r.signalsUsed).toBe(2);
  });

  it("classifica boa quando tudo está favorável", () => {
    const r = classifyReadiness({
      sleepHours: 8,
      sleepQuality: 9,
      motivation: 9,
      fatigue: 1,
      soreness: 1,
      stress: 1,
    });
    expect(r.class).toBe("boa");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.signalsUsed).toBe(6);
  });

  it("classifica baixa quando os sinais ruins estão altos", () => {
    const r = classifyReadiness({ fatigue: 9, soreness: 8, stress: 9, sleepHours: 4 });
    expect(r.class).toBe("baixa");
    expect(r.score).toBeLessThan(50);
  });

  it("trata sinais 'ruins' de forma invertida (fadiga alta derruba a prontidão)", () => {
    const rested = classifyReadiness({ sleepHours: 8, sleepQuality: 8, fatigue: 1 });
    const tired = classifyReadiness({ sleepHours: 8, sleepQuality: 8, fatigue: 9 });
    expect(rested.score).toBeGreaterThan(tired.score!);
  });

  it("satura o sono acima da referência (não passa de 100)", () => {
    const r = classifyReadiness({ sleepHours: 14, sleepQuality: 10, motivation: 10 });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.class).toBe("boa");
  });
});
