import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/infrastructure/database/prisma";

// Opaque, DB-backed sessions — see docs/adr/ADR-002-authentication.md for
// why this replaced a stateless HMAC-signed cookie (no revocation path).
export const SESSION_COOKIE_NAME = "enky_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CreateSessionInput {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface ActiveSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// AUTH_SECRET is used as an HMAC pepper: the DB only ever sees this hash,
// never the raw token, and rotating AUTH_SECRET invalidates every session
// at once (a deliberate full-compromise recovery mechanism).
export function hashSessionToken(token: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("base64url");
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });

  return { token, expiresAt };
}

export async function verifySessionByToken(token: string): Promise<ActiveSession | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  return { id: session.id, userId: session.userId, expiresAt: session.expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Called on password change / suspected compromise — invalidates every
// device the user is logged in on, not just the current one.
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
