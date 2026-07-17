import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const userFindUnique = vi.fn();
const membershipFindFirst = vi.fn();
const membershipFindUnique = vi.fn();
const relationshipFindUnique = vi.fn();
const relationshipFindMany = vi.fn();
const athleteProfileFindUnique = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    organizationMembership: { findFirst: membershipFindFirst, findUnique: membershipFindUnique },
    coachAthleteRelationship: {
      findUnique: relationshipFindUnique,
      findMany: relationshipFindMany,
    },
    athleteProfile: { findUnique: athleteProfileFindUnique },
  },
}));

const sessionVerify = vi.fn();
vi.mock("@/server/auth/session", () => ({
  SESSION_COOKIE_NAME: "enky_session",
  verifySessionByToken: sessionVerify,
}));

const {
  getCurrentSession,
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrganizationMembership,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
  resolveAthleteOrganization,
} = await import("@/server/auth/guards");

beforeEach(() => {
  cookieStore.get.mockReset();
  userFindUnique.mockReset();
  membershipFindFirst.mockReset();
  membershipFindUnique.mockReset();
  relationshipFindUnique.mockReset();
  relationshipFindMany.mockReset();
  athleteProfileFindUnique.mockReset();
  sessionVerify.mockReset();
});

describe("server/auth/guards", () => {
  it("getCurrentSession returns null when there is no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getCurrentSession()).toBeNull();
  });

  it("getCurrentSession returns null when the session token doesn't verify", async () => {
    cookieStore.get.mockReturnValue({ value: "bad-token" });
    sessionVerify.mockResolvedValue(null);
    expect(await getCurrentSession()).toBeNull();
  });

  it("getCurrentSession returns null for an inactive user", async () => {
    cookieStore.get.mockReturnValue({ value: "token" });
    sessionVerify.mockResolvedValue({ id: "s1", userId: "u1", expiresAt: new Date() });
    userFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      globalRole: "ATHLETE",
      isActive: false,
    });
    expect(await getCurrentSession()).toBeNull();
  });

  it("getCurrentSession returns the identity for a valid, active session", async () => {
    cookieStore.get.mockReturnValue({ value: "token" });
    sessionVerify.mockResolvedValue({ id: "s1", userId: "u1", expiresAt: new Date() });
    userFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      globalRole: "TRAINER",
      isActive: true,
    });
    expect(await getCurrentSession()).toEqual({
      userId: "u1",
      email: "a@b.com",
      name: "A",
      globalRole: "TRAINER",
    });
  });

  it("requireAuthenticatedUser throws when unauthenticated", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(requireAuthenticatedUser()).rejects.toThrow();
  });

  it("requireGlobalRole throws for a disallowed role", () => {
    const identity = { userId: "u1", email: "a@b.com", name: "A", globalRole: "ATHLETE" as const };
    expect(() => requireGlobalRole(identity, ["TRAINER"])).toThrow();
  });

  it("requireGlobalRole allows an allowed role", () => {
    const identity = { userId: "u1", email: "a@b.com", name: "A", globalRole: "TRAINER" as const };
    expect(() => requireGlobalRole(identity, ["TRAINER"])).not.toThrow();
  });

  it("resolveActiveOrganization throws when the user has no membership", async () => {
    membershipFindFirst.mockResolvedValue(null);
    await expect(resolveActiveOrganization("u1")).rejects.toThrow();
  });

  it("resolveActiveOrganization returns the membership's organization and role", async () => {
    membershipFindFirst.mockResolvedValue({
      organizationId: "org1",
      role: "OWNER",
      organization: { isActive: true },
    });
    expect(await resolveActiveOrganization("u1")).toEqual({
      organizationId: "org1",
      organizationRole: "OWNER",
    });
  });

  // Fase 9: suspender a organização no /admin é aplicado aqui, no ponto único
  // que resolve tenant — não em cada rota.
  it("resolveActiveOrganization throws when the organization is suspended", async () => {
    membershipFindFirst.mockResolvedValue({
      organizationId: "org1",
      role: "OWNER",
      organization: { isActive: false },
    });
    await expect(resolveActiveOrganization("u1")).rejects.toThrow("Organização suspensa");
  });

  it("resolveAthleteOrganization throws when the user has no athlete profile", async () => {
    athleteProfileFindUnique.mockResolvedValue(null);
    await expect(resolveAthleteOrganization("u1")).rejects.toThrow();
  });

  it("resolveAthleteOrganization throws when there is no active relationship", async () => {
    athleteProfileFindUnique.mockResolvedValue({ id: "ath1" });
    relationshipFindMany.mockResolvedValue([]);
    await expect(resolveAthleteOrganization("u1")).rejects.toThrow();
  });

  it("resolveAthleteOrganization returns the single active organization", async () => {
    athleteProfileFindUnique.mockResolvedValue({ id: "ath1" });
    relationshipFindMany.mockResolvedValue([
      { organizationId: "org1", organization: { isActive: true } },
    ]);
    expect(await resolveAthleteOrganization("u1")).toEqual({
      organizationId: "org1",
      athleteProfileId: "ath1",
    });
  });

  // A suspensão corta o atleta também, não só o treinador — senão seria
  // meia-suspensão e o tenant seguiria operando pela metade.
  it("resolveAthleteOrganization throws when the organization is suspended", async () => {
    athleteProfileFindUnique.mockResolvedValue({ id: "ath1" });
    relationshipFindMany.mockResolvedValue([
      { organizationId: "org1", organization: { isActive: false } },
    ]);
    await expect(resolveAthleteOrganization("u1")).rejects.toThrow("Organização suspensa");
  });

  // MVP invariant: an athlete has at most one active organization. If the DB
  // ever holds more than one, resolving a tenant would be non-deterministic
  // and could leak the wrong organization's workouts — so it fails loudly
  // instead of silently picking one.
  it("resolveAthleteOrganization throws when the athlete has multiple active organizations", async () => {
    athleteProfileFindUnique.mockResolvedValue({ id: "ath1" });
    relationshipFindMany.mockResolvedValue([
      { organizationId: "org1", organization: { isActive: true } },
      { organizationId: "org2", organization: { isActive: true } },
    ]);
    await expect(resolveAthleteOrganization("u1")).rejects.toThrow();
  });

  it("requireOrganizationMembership throws when the user isn't a member", async () => {
    membershipFindUnique.mockResolvedValue(null);
    await expect(requireOrganizationMembership("u1", "org1")).rejects.toThrow();
  });

  it("requireTrainerAccessToAthlete throws when there is no relationship", async () => {
    relationshipFindUnique.mockResolvedValue(null);
    await expect(requireTrainerAccessToAthlete("org1", "trainer1", "athlete1")).rejects.toThrow();
  });

  it("requireTrainerAccessToAthlete throws when the relationship exists but is inactive", async () => {
    relationshipFindUnique.mockResolvedValue({ isActive: false });
    await expect(requireTrainerAccessToAthlete("org1", "trainer1", "athlete1")).rejects.toThrow();
  });

  it("requireTrainerAccessToAthlete resolves when the relationship is active", async () => {
    relationshipFindUnique.mockResolvedValue({ isActive: true });
    await expect(
      requireTrainerAccessToAthlete("org1", "trainer1", "athlete1"),
    ).resolves.toBeUndefined();
  });
});
