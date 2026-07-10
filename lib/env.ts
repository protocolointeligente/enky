import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres."),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
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
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
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
