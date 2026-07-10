import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { revokeSession } from "@/server/auth/session";

export interface LogoutContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Idempotent by design: revoking an already-revoked or expired session is
// a no-op in server/auth/session.ts, never an error.
export async function logout(token: string, context: LogoutContext = {}): Promise<void> {
  await revokeSession(token);

  if (context.userId) {
    await recordAuditLog(prisma, {
      action: "LOGOUT",
      entityName: "Session",
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}
