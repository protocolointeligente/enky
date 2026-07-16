/* eslint-disable */
// Bootstrap de PRODUÇÃO — deixa um banco novo pronto para uso, em quatro passos
// idempotentes. Rode LOCAL, apontando as URLs para produção:
//
//   DATABASE_URL='...' DIRECT_URL='...' \
//   ADMIN_EMAIL='admin@enky.com.br' ADMIN_PASSWORD='...' \
//   node scripts/bootstrap-production.cjs --confirm
//
// Precisa ser local porque o passo dos vídeos lê o catálogo .xlsx, que não é
// versionado (a pasta de mídia está no .gitignore e contém o token OAuth do
// canal). A Vercel não dá shell para one-off e o editor do Neon só roda SQL.
//
// Passos (todos podem rodar de novo sem duplicar nada):
//   1. migrate  — prisma migrate deploy (usa DIRECT_URL, sem pooler)
//   2. plans    — plano Grátis (upsert por nome)
//   3. admin    — usuário ADMIN (upsert por e-mail)
//   4. videos   — biblioteca de vídeos ENKY (upsert global por nome)
//
// Pule passos com --skip-<nome>, ex.: --skip-videos.

const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const CONFIRMED = args.includes("--confirm");
const skipped = (name) => args.includes(`--skip-${name}`);

// Nunca imprime credencial: só host e nome do banco.
function describeTarget(raw) {
  try {
    const url = new URL(raw);
    return `${url.host}${url.pathname}`;
  } catch {
    return "(URL inválida)";
  }
}

function run(label, command, commandArgs) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    // Autoriza explicitamente a escrita em produção nos scripts filhos: o
    // guard deles olha o ambiente do processo, não o banco de destino.
    env: { ...process.env, ENKY_ALLOW_PRODUCTION_WRITE: "1" },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`"${label}" falhou (exit ${result.status}). Nada além deste passo foi aplicado.`);
  }
}

const STEPS = [
  { name: "migrate", label: "Migrations (prisma migrate deploy)", exec: () => run("Migrations", "npx", ["prisma", "migrate", "deploy"]) },
  { name: "plans", label: "Planos de assinatura (Grátis)", exec: () => run("Planos", "node", ["prisma/seed-plans.mjs"]) },
  { name: "admin", label: "Usuário ADMIN", exec: () => run("Admin", "node", ["scripts/create-admin.cjs"]) },
  { name: "videos", label: "Biblioteca de vídeos ENKY", exec: () => run("Vídeos", "node", ["scripts/import-enky-videos.cjs"]) },
];

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório.");
  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL é obrigatório — prisma migrate deploy não usa o pooler.");
  }

  const plan = STEPS.filter((step) => !skipped(step.name));

  console.log("ENKY — bootstrap de produção");
  console.log(`  Banco alvo : ${describeTarget(databaseUrl)}`);
  console.log(`  Direto     : ${describeTarget(process.env.DIRECT_URL)}`);
  console.log(`  Passos     : ${plan.map((s) => s.name).join(" → ") || "(nenhum)"}`);
  const off = STEPS.filter((step) => skipped(step.name)).map((s) => s.name);
  if (off.length) console.log(`  Pulados    : ${off.join(", ")}`);

  if (!CONFIRMED) {
    console.log(
      "\nNada foi executado. Confira o banco alvo acima e, se estiver certo, rode de novo com --confirm.",
    );
    return;
  }
  if (!plan.length) {
    console.log("\nNenhum passo a executar.");
    return;
  }

  console.log("\n⚠  Escrevendo em PRODUÇÃO (autorizado por --confirm).");
  for (const step of plan) step.exec();

  console.log("\n✅ Bootstrap concluído.");
  console.log("   Confira: login do admin, /treinador/exercicios com vídeos, e o plano Grátis.");
}

try {
  main();
} catch (error) {
  console.error(`\n❌ ${error.message}`);
  process.exitCode = 1;
}
