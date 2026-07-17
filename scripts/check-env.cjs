/* eslint-disable */
// Preflight de variáveis de ambiente — Fase 12.
//
//   node scripts/check-env.cjs                 # infere o alvo de NODE_ENV/VERCEL_ENV
//   node scripts/check-env.cjs --env production
//   node scripts/check-env.cjs --env preview
//
// NUNCA imprime o VALOR de nenhuma variável — só nome, presença e o comprimento
// mascarado. É seguro colar a saída num chat/PR. Espelha as regras de
// lib/env.ts, mas roda ANTES do app subir (Node puro, sem "server-only"/ESM),
// para que um deploy quebrado seja pego no CI/no terminal, não em runtime.
//
// Sai com código 1 se houver QUALQUER erro bloqueante. Avisos (amarelo) não
// bloqueiam, mas contam para o go/no-go do piloto.
//
// Também roda um scan rápido do git: nenhum .env* pode estar versionado
// (critério de aceite "nenhuma variável sensível versionada").

const { execFileSync } = require("node:child_process");

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const TARGET =
  flag("env") ||
  (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
    ? "production"
    : process.env.VERCEL_ENV === "preview"
      ? "preview"
      : "development");

const IS_LIVE = TARGET === "production" || TARGET === "preview";

const errors = [];
const warns = [];
const oks = [];

function mask(value) {
  if (!value) return "(vazio)";
  return `presente (${value.length} chars)`;
}

// value existe e não-vazio?
function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function requireVar(name, extra) {
  if (!present(name)) {
    errors.push(`${name} é obrigatório em ${TARGET} — ausente ou vazio.`);
    return;
  }
  if (extra) {
    const problem = extra(process.env[name].trim());
    if (problem) {
      errors.push(`${name}: ${problem}`);
      return;
    }
  }
  oks.push(`${name}: ${mask(process.env[name])}`);
}

function recommendVar(name, why) {
  if (present(name)) {
    oks.push(`${name}: ${mask(process.env[name])}`);
  } else {
    warns.push(`${name} ausente — ${why}`);
  }
}

// ── Sempre obrigatórias ────────────────────────────────────────────────────
requireVar("DATABASE_URL", (v) => {
  if (!/^postgres(ql)?:\/\//.test(v)) return "não parece uma URL PostgreSQL.";
  if (IS_LIVE && /localhost|127\.0\.0\.1/.test(v))
    return "aponta para localhost em ambiente remoto.";
  return null;
});

requireVar("DIRECT_URL", (v) => {
  if (!/^postgres(ql)?:\/\//.test(v)) return "não parece uma URL PostgreSQL.";
  if (/-pooler/.test(v))
    return "usa o host -pooler; DIRECT_URL deve ser a conexão DIRETA (migrations não passam pelo pooler).";
  if (IS_LIVE && /channel_binding=require/.test(v)) {
    // Documentado na memória do projeto: quebra o Prisma nesta stack.
    warns.push(
      "DIRECT_URL contém channel_binding=require — já quebrou o Prisma nesta stack (P1001). Confirme que o deploy tolera.",
    );
  }
  return null;
});

requireVar("AUTH_SECRET", (v) => {
  if (v.length < 32) return "deve ter pelo menos 32 caracteres.";
  const WEAK = new Set(["", "changeme", "secret", "dev", "test", "enky", "your-secret-here"]);
  if (WEAK.has(v.toLowerCase()))
    return "é um valor de exemplo/fraco — gere um aleatório com randomBytes(48).";
  return null;
});

requireVar("APP_URL", (v) => {
  let url;
  try {
    url = new URL(v);
  } catch {
    return "não é uma URL válida.";
  }
  if (IS_LIVE && url.protocol !== "https:")
    return "deve ser HTTPS em ambiente remoto (CSRF/origin + links de e-mail).";
  if (IS_LIVE && /localhost|127\.0\.0\.1/.test(url.host))
    return "aponta para localhost — links de convite/e-mail ficariam inalcançáveis.";
  return null;
});

// ── Obrigatórias em produção (bloqueiam o piloto) ──────────────────────────
if (TARGET === "production") {
  requireVar("EMAIL_PROVIDER_API_KEY");
  requireVar("EMAIL_FROM");
  requireVar("PAYMENT_PROVIDER_SECRET_KEY");
  requireVar("PAYMENT_PROVIDER_WEBHOOK_SECRET", (v) => {
    if (v === process.env.PAYMENT_PROVIDER_SECRET_KEY)
      return "é igual à API key — o webhook secret DEVE ser um valor distinto e aleatório.";
    return null;
  });
} else if (TARGET === "preview") {
  // Preview roda com NODE_ENV=production; e-mail/pagamento podem usar sandbox.
  recommendVar(
    "EMAIL_PROVIDER_API_KEY",
    "convites falharão com erro explícito até configurar (use uma key de teste).",
  );
  recommendVar("EMAIL_FROM", "necessário junto com EMAIL_PROVIDER_API_KEY.");
}

// ── Recomendadas em produção (não bloqueiam, degradam) ─────────────────────
if (IS_LIVE) {
  recommendVar(
    "UPSTASH_REDIS_REST_URL",
    "rate limit cai para memória por instância (brute-force fica pior).",
  );
  recommendVar("UPSTASH_REDIS_REST_TOKEN", "par do UPSTASH_REDIS_REST_URL.");
}

// ── Strava: periférico, só informa ─────────────────────────────────────────
if (IS_LIVE && !present("STRAVA_CLIENT_ID")) {
  oks.push("Strava não configurado — instalação válida; rotas de integração respondem 422.");
}

// ── Scan git: nenhum .env* versionado ──────────────────────────────────────
let trackedSecrets = [];
try {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  trackedSecrets = tracked
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /(^|\/)\.env($|\.)/.test(l) && !l.endsWith(".env.example"));
} catch {
  warns.push("Não foi possível rodar `git ls-files` para checar segredos versionados.");
}
if (trackedSecrets.length > 0) {
  errors.push(
    `Arquivos de segredo VERSIONADOS no git: ${trackedSecrets.join(", ")}. Remova com \`git rm --cached\`.`,
  );
} else {
  oks.push("Nenhum .env* versionado (só .env.example, que é esperado).");
}

// ── Relatório ──────────────────────────────────────────────────────────────
console.log(`\nENKY — preflight de ambiente (alvo: ${TARGET})\n`);
for (const line of oks) console.log(`  ✅ ${line}`);
for (const line of warns) console.log(`  ⚠️  ${line}`);
for (const line of errors) console.log(`  ❌ ${line}`);

console.log("");
if (errors.length > 0) {
  console.error(
    `❌ ${errors.length} erro(s) bloqueante(s). Ambiente NÃO está pronto para ${TARGET}.`,
  );
  process.exitCode = 1;
} else if (warns.length > 0) {
  console.log(`✅ Sem erros bloqueantes. ${warns.length} aviso(s) — revise antes do piloto.`);
} else {
  console.log(`✅ Ambiente validado para ${TARGET}.`);
}
