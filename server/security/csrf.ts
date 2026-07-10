import { AuthorizationError } from "@/domain/errors";
import { env } from "@/lib/env";

// Same-origin check via Origin/Referer — the primary CSRF defense for a
// same-origin JSON API. See docs/adr/ADR-004-csrf-strategy.md for why this
// was chosen over a double-submit token, and why sameSite=lax alone isn't
// treated as sufficient.
function extractOrigin(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    return new URL(headerValue).origin;
  } catch {
    return null;
  }
}

// Vercel Preview Deployments each get a unique, unpredictable URL
// (exposed to the running deployment as VERCEL_URL) — APP_URL alone can
// only ever point at one fixed domain (production), so a preview's own
// same-origin requests would otherwise fail this check. VERCEL_URL is
// only ever set by Vercel itself, never user-controlled, so trusting it
// doesn't weaken the check.
function getTrustedOrigins(): string[] {
  const origins = [new URL(env.APP_URL).origin];
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  return origins;
}

export function assertTrustedOrigin(request: Request): void {
  const trustedOrigins = getTrustedOrigins();
  const requestOrigin =
    extractOrigin(request.headers.get("origin")) ?? extractOrigin(request.headers.get("referer"));

  if (!requestOrigin || !trustedOrigins.includes(requestOrigin)) {
    throw new AuthorizationError("Origem da requisição não confiável.");
  }
}
