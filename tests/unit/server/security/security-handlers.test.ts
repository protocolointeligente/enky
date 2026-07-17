import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { loginRateLimiter, inviteRateLimiter } from "@/server/security/rate-limit";
import { AuthenticationError } from "@/domain/errors";

// Mock the modules called inside route handlers to avoid database and email calls.
vi.mock("@/modules/identity/login", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/identity/login")>();
  return {
    ...original,
    login: vi.fn(),
  };
});

vi.mock("@/modules/athletes/invite-athlete", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/athletes/invite-athlete")>();
  return {
    ...original,
    inviteAthlete: vi.fn(),
  };
});

vi.mock("@/server/auth/guards", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/guards")>();
  return {
    ...original,
    requireAuthenticatedUser: vi.fn(),
    resolveActiveOrganization: vi.fn(),
  };
});

vi.mock("@/infrastructure/mail/get-invitation-mailer", () => ({
  getInvitationMailer: vi.fn(() => ({
    sendInvitation: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    trainerProfile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "trainer-profile-1" }),
    },
  },
}));

// Import target API route handlers
import { POST as handleLogin } from "@/app/api/auth/login/route";
import { POST as handleInvite } from "@/app/api/athletes/invitations/route";
import { login } from "@/modules/identity/login";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { requireAuthenticatedUser, resolveActiveOrganization } from "@/server/auth/guards";

describe("Route Security Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set mock implementations on every test run
    vi.mocked(login).mockResolvedValue({
      userId: "user-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    vi.mocked(inviteAthlete).mockResolvedValue({
      invitationId: "invite-1",
      athleteProfileId: "athlete-profile-1",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      rawToken: "raw-token",
    });

    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      userId: "trainer-user-1",
      email: "trainer@enky.com.br",
      name: "Trainer One",
      globalRole: "TRAINER",
    });

    vi.mocked(resolveActiveOrganization).mockResolvedValue({
      organizationId: "org-1",
      organizationRole: "OWNER",
    });

    // Default mock behavior for rate limiters (always allow)
    vi.spyOn(loginRateLimiter, "consume").mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    vi.spyOn(inviteRateLimiter, "consume").mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CSRF / Origin Validation", () => {
    it("allows a request with a trusted Origin header matching APP_URL", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "test@enky.com.br", password: "password123" }),
      });

      const response = await handleLogin(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    it("allows a request with a trusted Referer header when Origin is absent", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          referer: "http://localhost:3000/login",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "test@enky.com.br", password: "password123" }),
      });

      const response = await handleLogin(request);
      if (response.status !== 200) {
        console.error("Referer test failed with body:", await response.json());
      }
      expect(response.status).toBe(200);
    });

    it("rejects a request with an untrusted Origin header", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://evil.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "test@enky.com.br", password: "password123" }),
      });

      const response = await handleLogin(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("AUTHORIZATION_ERROR");
      expect(body.error.message).toContain("Origem da requisição não confiável");
    });

    it("rejects a request when both Origin and Referer are absent", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "test@enky.com.br", password: "password123" }),
      });

      const response = await handleLogin(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("AUTHORIZATION_ERROR");
    });
  });

  describe("Rate Limiting", () => {
    it("returns HTTP 429 and Retry-After header when login rate limit is exceeded", async () => {
      // Simulate rate limiter blocking the request
      vi.spyOn(loginRateLimiter, "consume").mockResolvedValue({
        allowed: false,
        retryAfterMs: 120_000, // 2 minutes
      });

      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "test@enky.com.br", password: "password123" }),
      });

      const response = await handleLogin(request);
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("120");
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(body.error.message).toContain("Muitas tentativas");
    });

    it("returns HTTP 429 and Retry-After header when invite rate limit is exceeded", async () => {
      // Simulate rate limiter blocking the request
      vi.spyOn(inviteRateLimiter, "consume").mockResolvedValue({
        allowed: false,
        retryAfterMs: 60_000, // 1 minute
      });

      const request = new NextRequest("http://localhost:3000/api/athletes/invitations", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "athlete@enky.com.br", athleteName: "Athlete One" }),
      });

      const response = await handleInvite(request);
      if (response.status !== 429) {
        console.error("Invite rate limit test failed with body:", await response.json());
      }
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("RATE_LIMITED");
    });
  });

  describe("Revoked Session / Authentication", () => {
    it("returns HTTP 401 and AUTHENTICATION_ERROR when user session is revoked or invalid", async () => {
      // Simulate guards throwing AuthenticationError because the session was revoked/invalid
      vi.mocked(requireAuthenticatedUser).mockRejectedValueOnce(
        new AuthenticationError("Sessão ausente, expirada ou revogada."),
      );

      const request = new NextRequest("http://localhost:3000/api/athletes/invitations", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "athlete@enky.com.br", athleteName: "Athlete One" }),
      });

      const response = await handleInvite(request);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("AUTHENTICATION_ERROR");
      expect(body.error.message).toContain("Sessão ausente, expirada ou revogada.");
    });
  });
});
