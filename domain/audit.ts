import type { Prisma } from "@prisma/client";

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
  | "WORKOUT_EXECUTION_STARTED"
  | "WORKOUT_EXECUTION_COMPLETED"
  | "WORKOUT_EXECUTION_ABANDONED"
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
  | "CREATE_PERIODIZATION"
  | "DELETE_PERIODIZATION";

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
      actorType: "USER",
    },
  });
}
