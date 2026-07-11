import { describe, expect, it } from "vitest";
import { loadStatusLabel, modalityLabel, statusLabel, stepTypeLabel } from "@/app/_lib/labels";

// Guards Objective 4: the UI must never surface a raw enum. These mirror the
// Prisma enums in prisma/schema.prisma — if a new member is added there, add
// it here (and to the labels map) so the test fails loudly until it's mapped.
const MODALITIES = ["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"];
const STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
  "MISSED",
  "ARCHIVED",
  "CANCELLED",
];
const STEP_TYPES = ["TIRO", "RODAGEM", "PAUSA_ATIVA", "PAUSA_PASSIVA", "PROGRESSIVO", "SUBIDA"];
const LOAD_STATUSES = ["COMPLETE", "PARTIAL", "NOT_AVAILABLE", "INVALID"];

describe("enum labels", () => {
  it("traduz toda modalidade para português (nenhum enum cru)", () => {
    for (const value of MODALITIES) {
      const label = modalityLabel(value);
      expect(label).not.toBe(value);
      expect(label).toMatch(/[a-záéíóúçã]/i);
    }
    expect(modalityLabel("RUNNING")).toBe("Corrida");
  });

  it("traduz todo status de treino", () => {
    for (const value of STATUSES) {
      expect(statusLabel(value)).not.toBe(value);
    }
    expect(statusLabel("DRAFT")).toBe("Rascunho");
    expect(statusLabel("PUBLISHED")).toBe("Publicado");
  });

  it("traduz tipos de passo e status de carga", () => {
    for (const value of STEP_TYPES) expect(stepTypeLabel(value)).not.toBe(value);
    for (const value of LOAD_STATUSES) expect(loadStatusLabel(value)).not.toBe(value);
    expect(loadStatusLabel("COMPLETE")).toBe("Completo");
  });

  it("cai para o valor cru em membros desconhecidos (não quebra a UI)", () => {
    expect(modalityLabel("UNKNOWN_XYZ")).toBe("UNKNOWN_XYZ");
    expect(statusLabel("UNKNOWN_XYZ")).toBe("UNKNOWN_XYZ");
  });
});
