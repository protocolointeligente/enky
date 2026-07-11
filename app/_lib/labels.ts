// Single source of human-facing Portuguese labels for domain enums. UI must
// never render a raw enum (RUNNING, DRAFT, ...) — always go through these
// helpers so terminology stays consistent everywhere. Values mirror the Prisma
// enums in prisma/schema.prisma; the `?? value` fallback keeps unknown/new
// enum members from crashing the UI (they render as the raw code until mapped).

export const MODALITY_LABELS: Record<string, string> = {
  RUNNING: "Corrida",
  STRENGTH: "Musculação",
  FUNCTIONAL: "Funcional",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  PARTIAL: "Parcial",
  MISSED: "Não realizado",
  ARCHIVED: "Arquivado",
  CANCELLED: "Cancelado",
};

export const STEP_TYPE_LABELS: Record<string, string> = {
  TIRO: "Tiro",
  RODAGEM: "Rodagem",
  PAUSA_ATIVA: "Pausa ativa",
  PAUSA_PASSIVA: "Pausa passiva",
  PROGRESSIVO: "Progressivo",
  SUBIDA: "Subida",
};

export const LOAD_STATUS_LABELS: Record<string, string> = {
  COMPLETE: "Completo",
  PARTIAL: "Parcial",
  NOT_AVAILABLE: "Não informado",
  INVALID: "Inválido",
};

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  PERIODIZATION_GENERATED: "Periodização",
  TEMPLATE: "Template",
  MARKETPLACE: "Marketplace",
  IMPORTED: "Importado",
};

export const modalityLabel = (value: string): string => MODALITY_LABELS[value] ?? value;
export const statusLabel = (value: string): string => STATUS_LABELS[value] ?? value;
export const stepTypeLabel = (value: string): string => STEP_TYPE_LABELS[value] ?? value;
export const loadStatusLabel = (value: string): string => LOAD_STATUS_LABELS[value] ?? value;
export const sourceLabel = (value: string): string => SOURCE_LABELS[value] ?? value;
