/* eslint-disable */
// Provisiona acessos de operação (idempotente):
//   - 1 SUPERADMIN
//   - Treinador Ricardo com organização própria + assinatura ACTIVE do plano
//     "assessoria" (maxAthletes: null => atletas ILIMITADOS)
//
//   node scripts/provision-access.cjs            # usa o DATABASE_URL atual
//   ACCESS_PASSWORD=xxxx node scripts/provision-access.cjs   # senha custom
//
// Em produção exige confirmação explícita: adicione o argumento `--prod`.
// Reexecutar converge para o mesmo estado (upserts nas chaves únicas).
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const IS_PROD =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
if (IS_PROD && !process.argv.includes("--prod")) {
  throw new Error("Banco de PRODUÇÃO detectado. Reexecute com `--prod` para confirmar.");
}

const PASSWORD = process.env.ACCESS_PASSWORD || "EnkyDemo2026";
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "admin@enky.local";
const RICARDO_EMAIL = process.env.RICARDO_EMAIL || "ricardo.pace.jr@gmail.com";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // 1. SUPERADMIN
  await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { passwordHash, globalRole: "SUPERADMIN", isActive: true },
    create: {
      email: SUPERADMIN_EMAIL,
      name: "Superadmin ENKY",
      passwordHash,
      globalRole: "SUPERADMIN",
    },
  });

  // 2. Ricardo — TRAINER + organização + assinatura ilimitada
  const ricardo = await prisma.user.upsert({
    where: { email: RICARDO_EMAIL },
    update: { passwordHash, globalRole: "TRAINER", isActive: true, name: "Ricardo" },
    create: { email: RICARDO_EMAIL, name: "Ricardo", passwordHash, globalRole: "TRAINER" },
  });

  await prisma.trainerProfile.upsert({
    where: { userId: ricardo.id },
    update: {},
    create: { userId: ricardo.id },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "ricardo" },
    update: { name: "Assessoria Ricardo" },
    create: { name: "Assessoria Ricardo", slug: "ricardo" },
  });

  const existingMembership = await prisma.organizationMembership.findFirst({
    where: { userId: ricardo.id, organizationId: org.id },
  });
  if (!existingMembership) {
    await prisma.organizationMembership.create({
      data: { userId: ricardo.id, organizationId: org.id, role: "OWNER" },
    });
  }

  // Plano "assessoria" vem da migração 20260717120000. Sem ele, o limite não é
  // ilimitado — então falhamos alto em vez de dar um plano errado em silêncio.
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "assessoria" } });
  if (!plan) {
    throw new Error(
      "Plano 'assessoria' ausente. Rode as migrações (npx prisma migrate deploy) antes.",
    );
  }

  // Uma assinatura viva por organização (índice parcial). Converge a existente
  // para ACTIVE + assessoria, ou cria uma nova.
  const NON_TERMINAL = ["INCOMPLETE", "TRIALING", "ACTIVE", "PAST_DUE"];
  const period = { start: new Date(), end: new Date(Date.now() + 3650 * 24 * 3600 * 1000) };
  const existingSub = await prisma.subscription.findFirst({
    where: { organizationId: org.id, status: { in: NON_TERMINAL } },
  });
  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        subscriptionPlanId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        subscriptionPlanId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    });
  }

  console.log("Acessos provisionados:");
  console.log("  SUPERADMIN :", SUPERADMIN_EMAIL, "/", PASSWORD);
  console.log("  TREINADOR  :", RICARDO_EMAIL, "/", PASSWORD, "(plano Assessoria — atletas ILIMITADOS)");
  console.log("  ATLETA     : atleta.demo.dev@enky.local / EnkyDemo2026  (via `npm run seed:dev`)");
}

main()
  .catch((e) => {
    console.error("Provisionamento FALHOU:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
