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
  // Gateway de pagamento (Asaas) — Fase 10. Opcionais pelo mesmo motivo das
  // credenciais de e-mail: `next build` e o dev local sem gateway precisam
  // funcionar. A fábrica (modules/payments/get-payment-provider.ts) é o único
  // lugar que decide o que fazer na ausência delas, e se recusa a cair para o
  // provedor falso fora de development/test.
  //   - PAYMENT_PROVIDER_SECRET_KEY: API key do Asaas. O prefixo `$aact_hmlg_`
  //     seleciona sandbox automaticamente.
  //   - PAYMENT_PROVIDER_WEBHOOK_SECRET: segredo compartilhado que o Asaas
  //     devolve no header `asaas-access-token`. NUNCA pode ser a API key.
  // São strings opacas (sem formato validável como URL), então validá-las aqui
  // não corre o risco descrito no comentário de UPSTASH_* abaixo.
  PAYMENT_PROVIDER_SECRET_KEY: z.string().optional(),
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().optional(),
  // Integração Strava (Fase 11). Opcionais pelo mesmo motivo das anteriores —
  // e aqui a regra é mais forte que "o build precisa passar": a integração é um
  // PERIFÉRICO. Uma instalação sem credencial do Strava é uma instalação
  // válida, com todo o fluxo manual intacto; só as rotas de integração
  // recusam, com erro explícito (modules/integrations/get-strava-provider.ts é
  // o único ponto que decide isso).
  //   - STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET: credenciais da aplicação
  //     registrada em https://www.strava.com/settings/api.
  //   - STRAVA_WEBHOOK_VERIFY_TOKEN: segredo NOSSO, escolhido por nós e
  //     devolvido pelo Strava no handshake GET de criação da inscrição. É a
  //     única prova que o endpoint tem de que quem assinou fomos nós; não
  //     autentica os POSTs de evento (o Strava não os assina — ver
  //     modules/integrations/strava-webhook-service.ts).
  //   - STRAVA_WEBHOOK_SUBSCRIPTION_ID: id da inscrição devolvido pelo Strava
  //     na criação. Opcional; quando presente, eventos de outra inscrição são
  //     descartados.
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  STRAVA_WEBHOOK_SUBSCRIPTION_ID: z.string().optional(),
  // Web Push / VAPID (§14). Opcionais pelo mesmo motivo dos periféricos acima:
  // sem as chaves, o push é desligado e o app segue funcionando (a fábrica
  // modules/push/get-push-provider.ts é o único ponto que decide isso). São
  // strings opacas (base64url), sem risco de malformação como URL.
  //   - VAPID_PRIVATE_KEY: chave privada VAPID (par da NEXT_PUBLIC_VAPID_PUBLIC_KEY).
  //   - VAPID_SUBJECT: contato do remetente exigido pelo protocolo — "mailto:..."
  //     ou uma URL https. A chave PÚBLICA é NEXT_PUBLIC_* (exposta ao cliente).
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // UPSTASH_REDIS_REST_URL/TOKEN NÃO entram aqui de propósito. Este schema é
  // validado inteiro no primeiro acesso a qualquer variável, então declarar uma
  // config opcional aqui faz um valor malformado derrubar TODA rota que toca
  // `env` — inclusive /api/health e /api/auth/session, que não têm relação com
  // rate limit. Foi exatamente o que aconteceu em produção. Quem consome essas
  // duas é server/security/rate-limit.ts, lendo process.env direto e validando
  // lá, onde a falha atinge só o rate limit. Documentação delas: .env.example.
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
