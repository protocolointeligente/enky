import { beforeEach, describe, expect, it, vi } from "vitest";

const invitationFindUnique = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    athleteInvitation: { findUnique: invitationFindUnique },
  },
}));

const { activateAthleteInvitation } = await import("@/modules/athletes/activate-invitation");

const validInput = { token: "raw-token", name: "Athlete Name", password: "correcthorse1" };

beforeEach(() => {
  invitationFindUnique.mockReset();
});

describe("modules/athletes/activate-invitation — pre-transaction state checks", () => {
  it("rejects an unknown token", async () => {
    invitationFindUnique.mockResolvedValue(null);
    await expect(activateAthleteInvitation(validInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects a revoked invitation", async () => {
    invitationFindUnique.mockResolvedValue({
      isRevoked: true,
      isConsumed: false,
      expiresAt: new Date(Date.now() + 10_000),
    });
    await expect(activateAthleteInvitation(validInput)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects an already-consumed invitation", async () => {
    invitationFindUnique.mockResolvedValue({
      isRevoked: false,
      isConsumed: true,
      expiresAt: new Date(Date.now() + 10_000),
    });
    await expect(activateAthleteInvitation(validInput)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects an expired invitation", async () => {
    invitationFindUnique.mockResolvedValue({
      isRevoked: false,
      isConsumed: false,
      expiresAt: new Date(Date.now() - 10_000),
    });
    await expect(activateAthleteInvitation(validInput)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
