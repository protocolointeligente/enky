import { describe, expect, it } from "vitest";
import { inferFromHistory } from "@/modules/periodization/infer-generation-input";

// Modo AUTOMATIC — dedução a partir do histórico. Função pura, sem banco.
// Semana de referência: 2026-01-05 é uma segunda-feira.

function workout(modality: string, iso: string) {
  return { modality, plannedDate: new Date(`${iso}T00:00:00.000Z`) };
}

describe("inferFromHistory", () => {
  it("não deduz nada com histórico curto — prefere pedir o dado a adivinhar", () => {
    const result = inferFromHistory([workout("RUNNING", "2026-01-05")]);
    expect(result.modality).toBeUndefined();
    expect(result.availableWeekdays).toBeUndefined();
    expect(result.inferred).toEqual([]);
    expect(result.notes.join(" ")).toMatch(/Histórico insuficiente/);
  });

  it("deduz a modalidade mais frequente e diz de onde tirou", () => {
    const result = inferFromHistory([
      workout("RUNNING", "2026-01-05"),
      workout("RUNNING", "2026-01-07"),
      workout("RUNNING", "2026-01-12"),
      workout("CYCLING", "2026-01-14"),
    ]);
    expect(result.modality).toBe("RUNNING");
    expect(result.inferred).toContain("modality");
    expect(result.notes.join(" ")).toMatch(/RUNNING \(3 de 4/);
  });

  it("deduz a disponibilidade dos dias que se repetem", () => {
    // Segundas (05, 12) e quartas (07, 14) se repetem.
    const result = inferFromHistory([
      workout("RUNNING", "2026-01-05"),
      workout("RUNNING", "2026-01-07"),
      workout("RUNNING", "2026-01-12"),
      workout("RUNNING", "2026-01-14"),
    ]);
    expect(result.availableWeekdays).toEqual([1, 3]);
    expect(result.inferred).toContain("availableWeekdays");
  });

  it("ignora o dia solto — um treino avulso não é rotina", () => {
    // Terça (06) aparece uma vez só; segundas e quartas se repetem.
    const result = inferFromHistory([
      workout("RUNNING", "2026-01-05"),
      workout("RUNNING", "2026-01-06"),
      workout("RUNNING", "2026-01-07"),
      workout("RUNNING", "2026-01-12"),
      workout("RUNNING", "2026-01-14"),
    ]);
    expect(result.availableWeekdays).toEqual([1, 3]);
    expect(result.availableWeekdays).not.toContain(2);
  });

  it("não deduz disponibilidade quando nenhum dia se repete", () => {
    const result = inferFromHistory([
      workout("RUNNING", "2026-01-05"),
      workout("RUNNING", "2026-01-06"),
      workout("RUNNING", "2026-01-07"),
      workout("RUNNING", "2026-01-08"),
    ]);
    expect(result.availableWeekdays).toBeUndefined();
    expect(result.inferred).not.toContain("availableWeekdays");
    expect(result.notes.join(" ")).toMatch(/Nenhum dia da semana se repetiu/);
  });

  it("nunca deduz nível: frequência não é nível", () => {
    const result = inferFromHistory([
      workout("RUNNING", "2026-01-05"),
      workout("RUNNING", "2026-01-06"),
      workout("RUNNING", "2026-01-07"),
      workout("RUNNING", "2026-01-08"),
      workout("RUNNING", "2026-01-09"),
      workout("RUNNING", "2026-01-12"),
    ]);
    // Seis treinos numa semana não fazem de ninguém um atleta avançado.
    expect(result.level).toBeUndefined();
    expect(result.inferred).not.toContain("level");
    expect(result.notes.join(" ")).toMatch(/frequência não é nível/i);
  });
});
