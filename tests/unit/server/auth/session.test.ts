import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionCreate = vi.fn();
const sessionFindUnique = vi.fn();
const sessionUpdateMany = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    session: {
      create: sessionCreate,
      findUnique: sessionFindUnique,
      updateMany: sessionUpdateMany,
    },
  },
}));

const {
  createSession,
  generateSessionToken,
  getSessionCookieOptions,
  hashSessionToken,
  revokeAllSessionsForUser,
  revokeSession,
  verifySessionByToken,
} = await import("@/server/auth/session");

beforeEach(() => {
  sessionCreate.mockReset();
  sessionFindUnique.mockReset();
  sessionUpdateMany.mockReset();
});

describe("server/auth/session", () => {
  it("generates a unique, high-entropy opaque token on each call", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();

    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it("hashes the same token deterministically", () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("hashes different tokens to different values", () => {
    expect(hashSessionToken("token-a")).not.toBe(hashSessionToken("token-b"));
  });

  it("persists only the token's hash, never the raw token", async () => {
    sessionCreate.mockResolvedValue({});

    const { token, expiresAt } = await createSession({ userId: "user-1" });

    expect(sessionCreate).toHaveBeenCalledTimes(1);
    const { data } = sessionCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.userId).toBe("user-1");
    expect(data.tokenHash).toBe(hashSessionToken(token));
    expect(data.tokenHash).not.toBe(token);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a token with no matching session", async () => {
    sessionFindUnique.mockResolvedValue(null);

    expect(await verifySessionByToken("unknown")).toBeNull();
  });

  it("rejects a revoked session", async () => {
    sessionFindUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });

    expect(await verifySessionByToken("token")).toBeNull();
  });

  it("rejects an expired session", async () => {
    sessionFindUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await verifySessionByToken("token")).toBeNull();
  });

  it("accepts a valid, unrevoked, unexpired session", async () => {
    const expiresAt = new Date(Date.now() + 1000);
    sessionFindUnique.mockResolvedValue({ id: "s1", userId: "user-1", revokedAt: null, expiresAt });

    expect(await verifySessionByToken("token")).toEqual({ id: "s1", userId: "user-1", expiresAt });
  });

  it("revokes a single session by its token hash", async () => {
    sessionUpdateMany.mockResolvedValue({ count: 1 });

    await revokeSession("token");

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("token"), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("revokes every session for a user (password change / compromise)", async () => {
    sessionUpdateMany.mockResolvedValue({ count: 3 });

    await revokeAllSessionsForUser("user-1");

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("returns httpOnly, sameSite=lax cookie options", () => {
    expect(getSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
