// Seed idempotente dos planos de assinatura da ENKY.
// Uso: DATABASE_URL=... node prisma/seed-plans.mjs
// Só o plano Grátis é definitivo (1 atleta). Os pagos serão ajustados conforme
// os docs (Fase 3 — marketplace/pagamentos), por isso ainda não entram aqui.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
  {
    name: "Grátis",
    price: 0,
    billingCycle: "MENSAL",
    featuresLimits: { maxAthletes: 1, intelligence: true, reports: true, periodization: true },
    isActive: true,
  },
];

async function main() {
  for (const plan of PLANS) {
    const saved = await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        price: plan.price,
        billingCycle: plan.billingCycle,
        featuresLimits: plan.featuresLimits,
        isActive: plan.isActive,
      },
      create: plan,
      select: { id: true, name: true, price: true, featuresLimits: true, isActive: true },
    });
    console.log(JSON.stringify(saved, null, 2));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FALHOU:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
