/* eslint-disable */
// Valida a cadeia de migrations contra um banco LIMPO — Fase 12, item 5.
//
// Prova que `prisma migrate deploy` sobe do zero, na ordem, SEM drift e sem
// depender de nenhum passo manual. É o ensaio do que o bootstrap de produção
// fará num banco novo. Roda contra o banco apontado por DIRECT_URL/DATABASE_URL
// — que DEVE ser um banco DESCARTÁVEL (branch Neon efêmera, Postgres local,
// container). Nunca aponte para um banco com dado real: o modo padrão faz
// `migrate reset`, que APAGA tudo.
//
//   # banco descartável local (docker-compose up db):
//   DATABASE_URL='postgresql://enky:enky@localhost:5432/enky_verify' \
//   DIRECT_URL='postgresql://enky:enky@localhost:5432/enky_verify' \
//   node scripts/verify-migrations.cjs --confirm
//
//   # só conferir status (não destrói nada) contra Preview:
//   node scripts/verify-migrations.cjs --status-only
//
// Passos (modo completo):
//   1. migrate reset --force  → derruba e recria o schema a partir das migrations
//   2. migrate status         → confirma "Database schema is up to date"
//   3. prisma validate        → schema.prisma coerente
//   4. migrate deploy         → idempotência: rodar de novo não aplica nada

const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const STATUS_ONLY = args.includes("--status-only");
const CONFIRMED = args.includes("--confirm");

function describeTarget(raw) {
  try {
    const url = new URL(raw);
    return `${url.host}${url.pathname}`;
  } catch {
    return "(URL inválida)";
  }
}

function run(label, cmdArgs, { allowNonZero = false } = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync("npx", cmdArgs, {
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env },
    shell: process.platform === "win32",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !allowNonZero) {
    throw new Error(`"${label}" falhou (exit ${result.status}).`);
  }
  return result;
}

function main() {
  const target = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!target) throw new Error("DIRECT_URL (ou DATABASE_URL) é obrigatório.");

  // Guard forte: nunca reset num banco marcado como produção.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "BLOQUEADO: NODE_ENV/VERCEL_ENV=production. Este script apaga o banco — use um banco descartável.",
    );
  }

  console.log("ENKY — validação de migrations em banco limpo");
  console.log(`  Banco alvo : ${describeTarget(target)}`);
  console.log(
    `  Modo       : ${STATUS_ONLY ? "status-only (não destrutivo)" : "reset completo (DESTRUTIVO)"}`,
  );

  if (STATUS_ONLY) {
    run("prisma validate", ["prisma", "validate"]);
    run("prisma migrate status", ["prisma", "migrate", "status"]);
    console.log("\n✅ Status conferido. (Nenhum dado tocado.)");
    return;
  }

  if (!CONFIRMED) {
    console.log("\n⚠  O modo completo roda `migrate reset --force` e APAGA o banco acima.");
    console.log("   Se for mesmo um banco descartável, rode de novo com --confirm.");
    return;
  }

  run("Reset + replay das migrations", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
  const status = run("Status pós-reset", ["prisma", "migrate", "status"], { allowNonZero: true });
  if (!/up to date|em dia/i.test(status.stdout + status.stderr)) {
    throw new Error("migrate status não confirmou schema em dia após o reset.");
  }
  run("prisma validate", ["prisma", "validate"]);
  const redeploy = run("Idempotência (deploy de novo)", ["prisma", "migrate", "deploy"]);
  if (/following migration.* applied|Applying migration/i.test(redeploy.stdout)) {
    throw new Error(
      "migrate deploy aplicou migration numa segunda passada — a cadeia não é idempotente.",
    );
  }

  console.log("\n✅ Migrations validadas em banco limpo: sobem do zero, em dia, idempotentes.");
}

try {
  main();
} catch (error) {
  console.error(`\n❌ ${error.message}`);
  process.exitCode = 1;
}
