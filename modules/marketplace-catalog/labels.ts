import type { MarketplaceProductType } from "@prisma/client";

// Rótulos pt-BR dos tipos de produto e formatação de preço. Puro.

export const productTypeLabel: Record<MarketplaceProductType, string> = {
  TRAINING_PLAN: "Plano de treino",
  COACHING_SERVICE: "Consultoria",
  ASSESSMENT_SERVICE: "Avaliação",
  PERIODIZATION_TEMPLATE: "Periodização",
  WORKOUT_TEMPLATE_PACK: "Pacote de templates",
  EXERCISE_LIBRARY_PACK: "Pacote de exercícios",
  EDUCATIONAL_CONTENT: "Conteúdo educacional",
  CONSULTATION: "Consulta",
  EVENT_PROGRAM: "Evento",
};

export function formatPriceCents(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}
