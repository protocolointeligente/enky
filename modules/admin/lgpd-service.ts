import { recordAuditLog } from "@/domain/audit";
import { AuthorizationError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { revokeAllSessionsForUser } from "@/server/auth/session";
import type { AdminActor } from "./admin-service";

// Fase 06 — LGPD operacional. Duas operações do titular dos dados, executadas
// pelo operador a pedido: EXPORTAÇÃO (portabilidade/acesso) e ANONIMIZAÇÃO
// (direito ao esquecimento). Ambas ADMIN/SUPERADMIN e ambas AUDITADAS — a
// trilha de auditoria NUNCA é apagada, nem na anonimização: é o registro legal
// de que o pedido foi atendido, e é pseudônima por construção (guarda ids, não
// dados de saúde em texto).

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"] as const;

function assertAdmin(actor: AdminActor): void {
  if (!ADMIN_ROLES.includes(actor.globalRole as (typeof ADMIN_ROLES)[number])) {
    throw new AuthorizationError("Papel do usuário não autorizado para esta ação.");
  }
}

// -----------------------------------------------------------------------------
// Exportação — reúne os dados pessoais do titular num objeto único (o operador
// entrega como JSON). Inclui identificação, biometria, treino, feedback,
// prontidão e relatórios do titular. NÃO inclui dados de terceiros.
// -----------------------------------------------------------------------------
export async function exportUserData(actor: AdminActor, userId: string) {
  assertAdmin(actor);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      globalRole: true,
      isActive: true,
      createdAt: true,
      athleteProfile: {
        select: {
          id: true,
          birthDate: true,
          gender: true,
          weightKg: true,
          heightCm: true,
          createdAt: true,
        },
      },
      memberships: {
        select: { role: true, organization: { select: { id: true, name: true } } },
      },
    },
  });

  if (!user) throw new NotFoundError("Usuário não encontrado.");

  const athleteId = user.athleteProfile?.id ?? null;

  const [workouts, feedback, readiness, reports] = athleteId
    ? await Promise.all([
        prisma.workout.findMany({
          where: { athleteId },
          select: { id: true, title: true, plannedDate: true, status: true, modality: true },
          orderBy: { plannedDate: "desc" },
        }),
        prisma.workoutFeedback.findMany({
          where: { workout: { athleteId } },
          select: {
            workoutId: true,
            sessionRpe: true,
            actualDurationMinutes: true,
            painLevel: true,
            painRegion: true,
            painLaterality: true,
            notes: true,
            createdAt: true,
          },
        }),
        prisma.readinessCheckIn.findMany({
          where: { athleteId },
          orderBy: { checkInDate: "desc" },
        }),
        prisma.report.findMany({
          where: { athleteId },
          select: { id: true, periodStart: true, periodEnd: true, status: true, createdAt: true },
        }),
      ])
    : [[], [], [], []];

  await recordAuditLog(prisma, {
    action: "ADMIN_EXPORT_USER_DATA",
    entityName: "User",
    entityId: userId,
    userId: actor.userId,
    organizationId: user.memberships[0]?.organization.id,
    reason: "LGPD — pedido de portabilidade/acesso",
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return {
    exportedAt: new Date().toISOString(),
    subject: user,
    training: { workouts, feedback, readiness, reports },
  };
}

// -----------------------------------------------------------------------------
// Anonimização (direito ao esquecimento). Pseudonimiza a identidade e apaga
// dados de saúde em texto livre e biometria, mantendo a estrutura de treino
// (que é método, não pessoa) e a trilha de auditoria. Revoga as sessões vivas.
// Idempotente: reexecutar sobre um titular já anonimizado converge.
// -----------------------------------------------------------------------------
export interface AnonymizeInput {
  reason: string;
}

export async function anonymizeUserData(
  actor: AdminActor,
  userId: string,
  input: AnonymizeInput,
) {
  assertAdmin(actor);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      globalRole: true,
      athleteProfile: { select: { id: true } },
      memberships: { take: 1, select: { organizationId: true } },
    },
  });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  if (user.globalRole === "SUPERADMIN") {
    throw new AuthorizationError("Uma conta SUPERADMIN não pode ser anonimizada por esta via.");
  }

  const athleteId = user.athleteProfile?.id ?? null;
  const placeholderEmail = `anon+${userId}@enky.invalid`;

  await prisma.$transaction(async (tx) => {
    // 1. Identidade → pseudônimo. Conta desativada; senha invalidada.
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Titular removido (LGPD)",
        email: placeholderEmail,
        passwordHash: null,
        isActive: false,
      },
    });

    if (athleteId) {
      // 2. Biometria (dado sensível) fora.
      await tx.athleteProfile.update({
        where: { id: athleteId },
        data: { birthDate: null, gender: null, weightKg: null, heightCm: null },
      });
      // 3. Saúde em texto livre fora (dor, sintomas, observações).
      await tx.workoutFeedback.updateMany({
        where: { workout: { athleteId } },
        data: { painRegion: null, painLaterality: null, notes: null },
      });
      await tx.readinessCheckIn.updateMany({
        where: { athleteId },
        data: { localizedPain: null, notes: null },
      });
    }

    // 4. Derruba sessões vivas.
    await revokeAllSessionsForUser(userId, tx);

    // 5. Trilha do atendimento — NUNCA apagada. É a prova de que o direito foi
    //    exercido, e é pseudônima (guarda o id, não os dados removidos).
    await recordAuditLog(tx, {
      action: "ADMIN_ANONYMIZE_USER",
      entityName: "User",
      entityId: userId,
      userId: actor.userId,
      organizationId: user.memberships[0]?.organizationId,
      reason: input.reason,
      changedFields: ["name", "email", "passwordHash", "isActive", "biometrics", "health_free_text"],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });

  return { userId, anonymized: true };
}
