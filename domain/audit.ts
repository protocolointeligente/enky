import type { AuditActorType, Prisma } from "@prisma/client";

// Central catalog — every AuditLog write in the codebase uses one of these
// actions, never an ad-hoc string, so log queries stay filterable.
export type AuditAction =
  | "REGISTER_TRAINER"
  | "LOGIN_SUCCESS"
  | "LOGOUT"
  | "INVITE_ATHLETE"
  | "RESEND_INVITATION"
  | "REVOKE_INVITATION"
  | "ACTIVATE_INVITATION"
  | "SESSION_REVOKED"
  | "CREATE_WORKOUT_DRAFT"
  | "UPDATE_WORKOUT_DRAFT"
  | "PUBLISH_WORKOUT"
  | "SUBMIT_WORKOUT_FEEDBACK"
  | "UPDATE_WORKOUT_FEEDBACK"
  | "MOVE_WORKOUT"
  | "DUPLICATE_WORKOUT"
  | "COPY_WEEK"
  | "CANCEL_WORKOUT"
  | "ARCHIVE_WORKOUT"
  | "CREATE_EXERCISE"
  | "UPDATE_EXERCISE"
  | "ARCHIVE_EXERCISE"
  | "REACTIVATE_EXERCISE"
  | "CREATE_WORKOUT_TEMPLATE"
  | "UPDATE_WORKOUT_TEMPLATE"
  | "ARCHIVE_WORKOUT_TEMPLATE"
  | "APPLY_WORKOUT_TEMPLATE"
  | "DUPLICATE_WORKOUT_TEMPLATE"
  | "RESOLVE_INSIGHT"
  | "SUBMIT_READINESS_CHECKIN"
  | "GENERATE_REPORT"
  | "SHARE_REPORT"
  | "REVOKE_REPORT"
  | "CREATE_PERIODIZATION"
  | "DELETE_PERIODIZATION"
  | "GENERATE_WEEK"
  | "GENERATE_CYCLE"
  // ENKY Intelligence 2.0 (Fase 1) — geração do macrociclo pelo motor
  // estratégico. Nasce como periodização-RASCUNHO; nada publica sozinho.
  | "GENERATE_PERIODIZATION_STRATEGY"
  // Etapa de avaliações e zonas. Dados de saúde/performance do atleta —
  // sempre auditados. Notas livres e valores clínicos NÃO entram no log
  // (só ids/ação), conforme a regra de redação da etapa.
  | "CREATE_ASSESSMENT"
  | "UPDATE_ASSESSMENT_DRAFT"
  | "VALIDATE_ASSESSMENT"
  // Fase 9 — Admin Operacional. Toda ação do ADMIN/SUPERADMIN é cross-tenant
  // e por isso sempre auditada, inclusive a LEITURA de detalhes de uma
  // organização: quem inspecionou os dados de qual tenant é exatamente o que
  // uma investigação de privacidade/LGPD precisa reconstruir depois. As
  // listagens (usuários/orgs/treinadores/atletas) não são auditadas — não têm
  // sujeito específico e gerariam ruído que afogaria a trilha real.
  | "ADMIN_VIEW_ORGANIZATION"
  | "ADMIN_BLOCK_USER"
  | "ADMIN_UNBLOCK_USER"
  // Fase 05/06 (WIP admin) — feature flags e LGPD (exportar/anonimizar dados).
  | "ADMIN_SET_FEATURE_FLAG"
  | "ADMIN_EXPORT_USER_DATA"
  | "ADMIN_ANONYMIZE_USER"
  | "ADMIN_SUSPEND_ORGANIZATION"
  | "ADMIN_REACTIVATE_ORGANIZATION"
  // Fase 10 — Planos e Pagamentos. As ações iniciadas pelo treinador
  // (checkout, pedido de cancelamento) são `USER`; as confirmações vindas do
  // gateway são `SYSTEM` — não há usuário na requisição de webhook, e
  // atribuí-las ao treinador falsificaria a trilha.
  | "START_SUBSCRIPTION_CHECKOUT"
  | "REQUEST_SUBSCRIPTION_CANCELLATION"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_PAYMENT_FAILED"
  | "SUBSCRIPTION_CANCELLED"
  // Fase 11 — Integração Strava. Conectar e desconectar são atos do ATLETA
  // (`USER`): é ele quem autoriza um terceiro a ler seus dados e quem revoga,
  // e a trilha precisa mostrar quando o consentimento começou e terminou.
  // A importação é `SYSTEM` — ela também chega por webhook, sem sessão, e a
  // trilha não pode depender de qual via trouxe a atividade.
  | "CONNECT_EXTERNAL_PROVIDER"
  | "DISCONNECT_EXTERNAL_PROVIDER"
  | "IMPORT_EXTERNAL_ACTIVITY"
  // Etapa 4 §10–11/§32 — contratos da assessoria. Ações comerciais sensíveis
  // (preço/desconto/cancelamento/aceite) são sempre auditadas. Nunca passar o
  // preço/nota livre em `reason` — só ids e ação.
  | "CREATE_CONTRACT"
  | "UPDATE_CONTRACT"
  | "CHANGE_CONTRACT_STATUS"
  | "CANCEL_CONTRACT"
  | "ACCEPT_CONTRACT"
  // Etapa 4 §12–14/§32 — mensalidades e pagamentos da assessoria. Pagamento,
  // cancelamento e desconto/juros/multa são sempre auditados.
  | "GENERATE_INVOICES"
  | "UPDATE_INVOICE"
  | "CANCEL_INVOICE"
  | "REGISTER_PAYMENT"
  // Etapa 4 §7 — conversão de lead em cliente (cria cliente/contrato/atleta/
  // cobrança numa transação). O lead vira WON, nunca é apagado.
  | "CONVERT_LEAD"
  // Etapa 4 §18–19/§32 — gestão de equipe e carteiras. Mudança de papel e
  // transferência de atleta são sempre auditadas.
  | "CHANGE_MEMBER_ROLE"
  | "SET_MEMBER_ACTIVE"
  | "ASSIGN_ATHLETE"
  | "UNASSIGN_ATHLETE"
  | "TRANSFER_ATHLETE";

export interface AuditLogInput {
  action: AuditAction;
  entityName: string;
  entityId?: string;
  userId?: string;
  organizationId?: string;
  reason?: string;
  changedFields?: string[];
  correlationId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  // Default USER. O webhook de pagamento (Fase 10) grava como SYSTEM: a
  // requisição vem do gateway, sem sessão — ver modules/payments/webhook-service.ts.
  actorType?: AuditActorType;
}

// Never pass password, token (raw or hash), cookie, or other sensitive
// payload fields into `reason`/`changedFields` — this helper does not
// redact, the caller is responsible for only passing safe values.
export async function recordAuditLog(
  tx: Prisma.TransactionClient,
  input: AuditLogInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: input.action,
      entityName: input.entityName,
      entityId: input.entityId,
      userId: input.userId,
      organizationId: input.organizationId,
      reason: input.reason,
      changedFields: input.changedFields ?? [],
      correlationId: input.correlationId,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      actorType: input.actorType ?? "USER",
    },
  });
}
