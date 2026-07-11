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

// Explicitly-trusted origins for the rare cross-origin case: local dev APP_URL
// and the Vercel-injected deployment/production URLs (never user-controlled).
function getTrustedOrigins(): string[] {
  const origins = [new URL(env.APP_URL).origin];
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_BRANCH_URL) origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  return origins;
}

export function assertTrustedOrigin(request: Request): void {
  const requestOrigin =
    extractOrigin(request.headers.get("origin")) ?? extractOrigin(request.headers.get("referer"));
  if (!requestOrigin) {
    throw new AuthorizationError("Origem da requisição não confiável.");
  }

  // Primary check: the request is same-origin when the Origin/Referer host
  // matches the host the browser actually connected to (Host / X-Forwarded-Host).
  // This is robust across ANY deployment domain — production alias, preview
  // alias, or custom domain — without enumerating URLs, and a cross-site
  // request always carries the attacker's Origin against the target's Host.
  let originHost: string;
  try {
    originHost = new URL(requestOrigin).host;
  } catch {
    throw new AuthorizationError("Origem da requisição não confiável.");
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  if (originHost === forwardedHost || originHost === host) return;

  // Fallback: explicitly trusted origins (dev / Vercel env URLs).
  if (getTrustedOrigins().includes(requestOrigin)) return;

  throw new AuthorizationError("Origem da requisição não confiável.");
}
