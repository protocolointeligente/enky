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

// Fase 9 — Admin Operacional.

export const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  TRAINER: "Treinador",
  ATHLETE: "Atleta",
};

export const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  COACH: "Treinador",
  ADMIN: "Administrador",
  SUPPORT: "Suporte",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  INCOMPLETE: "Incompleta",
  TRIALING: "Em teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Em atraso",
  UNPAID: "Não paga",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  MENSAL: "Mensal",
  ANUAL: "Anual",
};

export const ACTOR_TYPE_LABELS: Record<string, string> = {
  USER: "Usuário",
  SYSTEM: "Sistema",
  CRON: "Rotina",
  SUPPORT_AGENT: "Suporte",
};

// Trilha de auditoria: espelha o catálogo `AuditAction` de domain/audit.ts.
// Uma trilha que exibe ADMIN_BLOCK_USER obriga quem investiga a traduzir
// código de cabeça — e o painel existe justamente para quem não abre o banco.
// Ações novas caem no fallback `?? value` e aparecem como o código cru até
// serem mapeadas aqui.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  REGISTER_TRAINER: "Cadastro de treinador",
  LOGIN_SUCCESS: "Login",
  LOGOUT: "Logout",
  SESSION_REVOKED: "Sessão revogada",
  INVITE_ATHLETE: "Convite enviado",
  RESEND_INVITATION: "Convite reenviado",
  REVOKE_INVITATION: "Convite revogado",
  ACTIVATE_INVITATION: "Convite ativado",
  CREATE_WORKOUT_DRAFT: "Rascunho de treino criado",
  UPDATE_WORKOUT_DRAFT: "Rascunho de treino editado",
  PUBLISH_WORKOUT: "Treino publicado",
  SUBMIT_WORKOUT_FEEDBACK: "Feedback enviado",
  UPDATE_WORKOUT_FEEDBACK: "Feedback editado",
  MOVE_WORKOUT: "Treino movido",
  DUPLICATE_WORKOUT: "Treino duplicado",
  COPY_WEEK: "Semana copiada",
  CANCEL_WORKOUT: "Treino cancelado",
  ARCHIVE_WORKOUT: "Treino arquivado",
  CREATE_EXERCISE: "Exercício criado",
  UPDATE_EXERCISE: "Exercício editado",
  ARCHIVE_EXERCISE: "Exercício arquivado",
  REACTIVATE_EXERCISE: "Exercício reativado",
  CREATE_WORKOUT_TEMPLATE: "Template criado",
  UPDATE_WORKOUT_TEMPLATE: "Template editado",
  ARCHIVE_WORKOUT_TEMPLATE: "Template arquivado",
  APPLY_WORKOUT_TEMPLATE: "Template aplicado",
  DUPLICATE_WORKOUT_TEMPLATE: "Template duplicado",
  RESOLVE_INSIGHT: "Insight resolvido",
  SUBMIT_READINESS_CHECKIN: "Check-in de prontidão",
  GENERATE_REPORT: "Relatório gerado",
  SHARE_REPORT: "Relatório compartilhado",
  REVOKE_REPORT: "Relatório revogado",
  DOWNLOAD_REPORT_PDF: "PDF de relatório baixado",
  CREATE_PERIODIZATION: "Periodização criada",
  DELETE_PERIODIZATION: "Periodização excluída",
  GENERATE_WEEK: "Semana gerada",
  ADMIN_VIEW_ORGANIZATION: "Organização consultada",
  ADMIN_BLOCK_USER: "Usuário bloqueado",
  ADMIN_UNBLOCK_USER: "Usuário desbloqueado",
  ADMIN_SUSPEND_ORGANIZATION: "Organização suspensa",
  ADMIN_REACTIVATE_ORGANIZATION: "Organização reativada",
  START_SUBSCRIPTION_CHECKOUT: "Checkout iniciado",
  REQUEST_SUBSCRIPTION_CANCELLATION: "Cancelamento solicitado",
  SUBSCRIPTION_ACTIVATED: "Assinatura ativada",
  SUBSCRIPTION_RENEWED: "Assinatura renovada",
  SUBSCRIPTION_PAYMENT_FAILED: "Pagamento falhou",
  SUBSCRIPTION_CANCELLED: "Assinatura cancelada",
  CONNECT_EXTERNAL_PROVIDER: "Integração conectada",
  DISCONNECT_EXTERNAL_PROVIDER: "Integração desconectada",
  IMPORT_EXTERNAL_ACTIVITY: "Atividade importada",
};

export const modalityLabel = (value: string): string => MODALITY_LABELS[value] ?? value;
export const statusLabel = (value: string): string => STATUS_LABELS[value] ?? value;
export const stepTypeLabel = (value: string): string => STEP_TYPE_LABELS[value] ?? value;
export const loadStatusLabel = (value: string): string => LOAD_STATUS_LABELS[value] ?? value;
export const sourceLabel = (value: string): string => SOURCE_LABELS[value] ?? value;
export const roleLabel = (value: string): string => ROLE_LABELS[value] ?? value;
export const organizationRoleLabel = (value: string): string =>
  ORGANIZATION_ROLE_LABELS[value] ?? value;
export const subscriptionStatusLabel = (value: string): string =>
  SUBSCRIPTION_STATUS_LABELS[value] ?? value;
export const billingCycleLabel = (value: string): string => BILLING_CYCLE_LABELS[value] ?? value;
export const actorTypeLabel = (value: string): string => ACTOR_TYPE_LABELS[value] ?? value;
export const auditActionLabel = (value: string): string => AUDIT_ACTION_LABELS[value] ?? value;
