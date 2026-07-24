import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { Preferences, UpdateProfileInput } from "./profile-schema";

// Perfil do atleta (§12). Edição dos próprios dados NÃO é auditada (self-service)
// e dado de saúde nunca entra em log. Só privacidade/segurança geram AuditLog.

export interface ProfileView {
  name: string;
  email: string;
  birthDate: string | null;
  gender: string | null;
  weightKg: number | null;
  heightCm: number | null;
  preferences: Preferences;
}

export interface SecurityActor {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function getAthleteProfile(userId: string): Promise<ProfileView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, preferences: true, athleteProfile: true },
  });
  if (!user) throw new NotFoundError("Perfil não encontrado.");
  const a = user.athleteProfile;
  return {
    name: user.name,
    email: user.email,
    birthDate: a?.birthDate ? a.birthDate.toISOString().slice(0, 10) : null,
    gender: a?.gender ?? null,
    weightKg: a?.weightKg != null ? Number(a.weightKg) : null,
    heightCm: a?.heightCm != null ? Number(a.heightCm) : null,
    preferences: (user.preferences as Preferences | null) ?? {},
  };
}

export async function updateAthleteProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileView> {
  const userData: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) userData.name = input.name;
  if (input.preferences !== undefined)
    userData.preferences = input.preferences as Prisma.InputJsonValue;

  const athleteData: Prisma.AthleteProfileUpdateInput = {};
  if (input.birthDate !== undefined)
    athleteData.birthDate = input.birthDate ? new Date(input.birthDate) : null;
  if (input.gender !== undefined) athleteData.gender = input.gender ?? null;
  if (input.weightKg !== undefined) athleteData.weightKg = input.weightKg ?? null;
  if (input.heightCm !== undefined) athleteData.heightCm = input.heightCm ?? null;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: userId }, data: userData });
    }
    if (Object.keys(athleteData).length > 0) {
      // Só o atleta tem AthleteProfile — atualiza o próprio, escopado por userId.
      const profile = await tx.athleteProfile.findUnique({ where: { userId } });
      if (!profile) throw new NotFoundError("Perfil de atleta não encontrado.");
      await tx.athleteProfile.update({ where: { userId }, data: athleteData });
    }
  });

  return getAthleteProfile(userId);
}

export async function requestDataExport(actor: SecurityActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await recordAuditLog(tx, {
      action: "REQUEST_DATA_EXPORT",
      entityName: "User",
      entityId: actor.userId,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });
}

export async function requestAccountDeletion(actor: SecurityActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await recordAuditLog(tx, {
      action: "REQUEST_ACCOUNT_DELETION",
      entityName: "User",
      entityId: actor.userId,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });
}

export interface SessionView {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export async function listUserSessions(
  userId: string,
  currentTokenHash: string,
): Promise<SessionView[]> {
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, tokenHash: true, userAgent: true, createdAt: true, expiresAt: true },
  });
  return sessions.map((s) => ({
    id: s.id,
    current: s.tokenHash === currentTokenHash,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));
}

// Encerra todas as outras sessões (mantém a atual). Ação de segurança auditada.
export async function revokeOtherSessions(
  currentTokenHash: string,
  actor: SecurityActor,
): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    const revoked = await tx.session.updateMany({
      where: { userId: actor.userId, tokenHash: { not: currentTokenHash }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuditLog(tx, {
      action: "REVOKE_OTHER_SESSIONS",
      entityName: "User",
      entityId: actor.userId,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return revoked.count;
  });
  return result;
}
