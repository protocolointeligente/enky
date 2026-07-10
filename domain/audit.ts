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
  | "SESSION_REVOKED";

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
