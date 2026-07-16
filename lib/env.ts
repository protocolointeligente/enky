import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres."),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Optional so `next build` and local dev without a real mailer still work —
  // the mailer factory (infrastructure/mail/get-invitation-mailer.ts) is the
  // single place that decides what to do when they're absent, and refuses to
  // fall back to the dev (log-only) mailer in production.
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  // Sender identity for transactional e-mail. Resend accepts either a bare
  // address or the "Nome <endereco@dominio>" form; the domain must be
  // verified in the Resend dashboard.
  EMAIL_FROM: z.string().optional(),
  // Distributed rate-limit store (Upstash Redis REST). Optional so `next build`
  // and local dev/test still work — the rate-limit factory
  // (server/security/rate-limit.ts) uses the in-memory fallback when absent,
  // but ONLY outside production. Both are required in production.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

// Validated lazily, on first property access, NOT at import time. Next.js
// executes route modules during its build-time "Collecting page data" step
// even for routes marked `dynamic = "force-dynamic"` — an eager
// `envSchema.parse()` at module scope used to throw there, breaking the
// production build for every route that imported this file (even
// transitively via the logger), regardless of whether that route actually
// needed the missing variable. A build must succeed without secrets; only
// an actual request that reads a specific variable should fail if it's
// missing, and only for that variable's caller.
let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Variáveis de ambiente inválidas:\n${issues.join("\n")}`);
  }

  cached = parsed.data;
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});

const LOCALHOST_DEFAULT = "http://localhost:3000";

// Public, user-facing base URL for links we put in e-mails (invitation
// activation, etc.). Must resolve to the deployment the recipient can reach —
// never `localhost`. Priority:
//   1. An explicit APP_URL (a real custom domain the operator configured).
//   2. On Vercel Production, the stable production domain.
//   3. On any other Vercel deployment (Preview), this deployment's URL.
//   4. Local dev fallback.
// Vercel injects VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL automatically, so
// e-mail links work on Preview and Production even when APP_URL is unset — the
// bug this fixes was activation links pointing at http://localhost:3000.
export function getPublicBaseUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit && explicit !== LOCALHOST_DEFAULT) return explicit.replace(/\/+$/, "");

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return env.APP_URL.replace(/\/+$/, "");
}
