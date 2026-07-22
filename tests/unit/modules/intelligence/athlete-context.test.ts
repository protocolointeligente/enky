import { describe, expect, it } from "vitest";
import { ageFromBirthDate } from "@/modules/intelligence/athlete-context";

// Idade no cabeçalho do atleta: o caso que erra sozinho é a fronteira do
// aniversário (ainda não fez aniversário este ano → um a menos).
describe("ageFromBirthDate", () => {
  const now = new Date("2026-07-18T00:00:00.000Z");

  it("conta o ano quando o aniversário já passou", () => {
    expect(ageFromBirthDate(new Date("2000-01-10T00:00:00.000Z"), now)).toBe(26);
  });

  it("desconta o ano quando o aniversário ainda não chegou", () => {
    expect(ageFromBirthDate(new Date("2000-12-31T00:00:00.000Z"), now)).toBe(25);
  });

  it("trata o próprio dia do aniversário como idade completa", () => {
    expect(ageFromBirthDate(new Date("2000-07-18T00:00:00.000Z"), now)).toBe(26);
  });

  it("retorna null para ausência ou data absurda", () => {
    expect(ageFromBirthDate(null, now)).toBeNull();
    expect(ageFromBirthDate(new Date("1850-01-01T00:00:00.000Z"), now)).toBeNull();
  });
});
