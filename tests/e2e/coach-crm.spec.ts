import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";

// §35 — E2E da área de Gestão (CRM comercial), dirigido pela UI real. Foco:
// (1) toda subárea carrega para um treinador de verdade (pega página que quebra
// no load) e (2) um fluxo interativo mínimo (criar um plano e vê-lo na lista).
// A lógica de negócio profunda (conversão/faturas/pagamento) é coberta pelo
// teste de integração coach-crm.test.ts, que roda contra o mesmo banco.
//
// Requer DATABASE_URL/AUTH_SECRET do mesmo banco do deployment (ver
// tests/e2e/global-setup.ts). A limpeza remove o que este teste criou.

const PASSWORD = "gestao-correcthorse1";
const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@gestao-test.enky.local`;
}

async function registerTrainerViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/registrar");
  await page.locator("#name").fill("Treinador Gestão");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/treinador$/);

  const user = await prisma.user.findFirstOrThrow({ where: { email: { equals: email, mode: "insensitive" } } });
  createdUserIds.push(user.id);
  const membership = await prisma.organizationMembership.findFirstOrThrow({ where: { userId: user.id } });
  createdOrganizationIds.push(membership.organizationId);
}

test.describe.configure({ mode: "serial" });

test("Gestão — todas as subáreas carregam para um treinador", async ({ page }) => {
  await registerTrainerViaUi(page, uniqueEmail("gestao-nav"));

  const areas: [string, RegExp][] = [
    ["/treinador/gestao", /Gestão da assessoria/],
    ["/treinador/gestao/leads", /Funil de leads/],
    ["/treinador/gestao/clientes", /Clientes/],
    ["/treinador/gestao/servicos", /Planos e serviços/],
    ["/treinador/gestao/contratos", /Contratos/],
    ["/treinador/gestao/mensalidades", /Mensalidades/],
    ["/treinador/gestao/financeiro", /Financeiro/],
    ["/treinador/gestao/treinadores", /Treinadores/],
    ["/treinador/gestao/grupos", /Grupos/],
    ["/treinador/gestao/comunicacao", /Comunicação/],
    ["/treinador/gestao/busca", /Busca global/],
    ["/treinador/configuracoes", /Configurações/],
  ];

  for (const [path, heading] of areas) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("Gestão — cria um plano de serviço e ele aparece na lista", async ({ page }) => {
  await registerTrainerViaUi(page, uniqueEmail("gestao-plan"));

  await page.goto("/treinador/gestao/servicos");
  await page.getByRole("button", { name: "Novo plano" }).click();
  await page.getByLabel(/Nome/).first().fill("Corrida Online E2E");
  await page.getByLabel(/Preço/).fill("197");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByRole("heading", { name: "Corrida Online E2E" })).toBeVisible();
});

test.afterAll(async () => {
  const orgs = createdOrganizationIds;
  if (orgs.length > 0) {
    await prisma.coachServicePlan.deleteMany({ where: { organizationId: { in: orgs } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgs } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  }
  if (orgs.length > 0) {
    await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: orgs } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.trainerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});
