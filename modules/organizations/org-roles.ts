import type { OrganizationRole } from "@prisma/client";

// Fonte única dos papéis organizacionais da assessoria (Etapa 4 §4).
// - A imposição em runtime é `requireOrgRole` (server/auth/guards.ts).
// - A matriz de permissões (papel × recurso) vive em docs/ENKY_CRM_PERMISSIONS.md.
//
// `ORG_ROLES` é a ordem de AUTORIDADE (decrescente) e a lista ATRIBUÍVEL — é
// contra ela que o fluxo de convite/membership valida o papel escolhido. O
// enum no banco tem outra ordem (valores novos foram anexados para manter a
// migração aditiva); não confie na ordem do enum para autoridade.
//
// `ADMIN` NÃO está aqui de propósito: é legado, nunca é oferecido para
// atribuição, e `requireOrgRole` já o trata como MANAGER onde aparecer.
export const ORG_ROLES = [
  "OWNER",
  "MANAGER",
  "HEAD_COACH",
  "COACH",
  "ASSISTANT_COACH",
  "FINANCE",
  "SUPPORT",
  "VIEWER",
] as const satisfies readonly OrganizationRole[];

export const ORG_ROLE_LABELS: Record<OrganizationRole, string> = {
  OWNER: "Proprietário",
  MANAGER: "Gestor",
  HEAD_COACH: "Treinador-chefe",
  COACH: "Treinador",
  ASSISTANT_COACH: "Treinador assistente",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
  VIEWER: "Visualizador",
  ADMIN: "Administrador (legado)",
};
