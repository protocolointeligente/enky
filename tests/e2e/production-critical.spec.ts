import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";

// E2E da etapa "fix/production-critical" (itens do briefing #7). Dirige a UI
// REAL contra o deployment de APP_URL (ou o dev server local). Segue o padrão
// do smoke.spec: convite é ação de UI, mas o token de ativação nunca volta por
// HTTP — re-carimbamos o tokenHash da linha criada (mesmo HMAC + AUTH_SECRET)
// para dirigir a ativação real logo em seguida. Requer que o processo do teste
// tenha DATABASE_URL/AUTH_SECRET do MESMO banco do deployment, JÁ MIGRADO
// (a criação de periodização depende das colunas da Fase 04).

const PASSWORD = "e2e-correcthorse1";

function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@e2e-test.enky.local`;
}

function hashInvitationToken(token: string): string {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) throw new Error("AUTH_SECRET ausente — necessário para re-carimbar o convite.");
  return createHmac("sha256", authSecret).update(token).digest("base64url");
}

async function registerTrainer(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/registrar");
  await page.locator("#name").fill("Treinador E2E");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/treinador$/);
}

async function loginAs(page: Page, email: string, expectUrl: RegExp): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(expectUrl);
}

// Convida (UI), re-carimba o token e ativa (UI). Retorna os ids criados.
async function inviteAndActivateAthlete(
  page: Page,
  athleteEmail: string,
): Promise<{ organizationId: string; athleteProfileId: string }> {
  await page.goto("/treinador/atletas");
  await page.locator("#inviteEmail").fill(athleteEmail);
  await page.locator("#inviteName").fill("Atleta E2E");
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByText("Convite pendente")).toBeVisible();

  const invitation = await prisma.athleteInvitation.findFirst({
    where: { email: { equals: athleteEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  expect(invitation, "convite não foi criado pela UI").not.toBeNull();
  const knownToken = randomUUID() + randomUUID();
  await prisma.athleteInvitation.update({
    where: { id: invitation!.id },
    data: { tokenHash: hashInvitationToken(knownToken) },
  });

  await page.context().clearCookies();
  await page.goto(`/convite/ativar?token=${knownToken}`);
  await page.locator("#name").fill("Atleta E2E");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ativar conta" }).click();
  await expect(page).toHaveURL(/\/atleta$/);

  return { organizationId: invitation!.organizationId, athleteProfileId: invitation!.athleteId };
}

async function cleanupOrg(organizationId: string, emails: string[]): Promise<void> {
  await prisma.periodizationPhase.deleteMany({
    where: { periodization: { organizationId } },
  });
  await prisma.trainingWeek.deleteMany({ where: { periodization: { organizationId } } });
  await prisma.periodization.deleteMany({ where: { organizationId } });
  await prisma.workout.deleteMany({ where: { organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });
  await prisma.athleteInvitation.deleteMany({ where: { organizationId } });
  await prisma.coachAthleteRelationship.deleteMany({ where: { organizationId } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId } });
  await prisma.athleteProfile.deleteMany({
    where: { user: { email: { in: emails, mode: "insensitive" } } },
  });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { email: { in: emails, mode: "insensitive" } } });
}

// ─────────────────────────────────────────────────────────────────────────
// Público / autenticação
// ─────────────────────────────────────────────────────────────────────────

test("Novidades é pública e acessível sem login", async ({ page }) => {
  await page.context().clearCookies();

  await page.goto("/novidades");
  await expect(page.getByRole("heading", { name: "Novidades", level: 1 })).toBeVisible();
  // Chamadas para login e cadastro na vitrine pública.
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar conta/ }).first()).toBeVisible();

  // Artigo institucional público (/novidades/[slug]).
  await page.goto("/novidades/o-que-e-enky");
  await expect(page.getByRole("heading", { name: "O que é a ENKY" })).toBeVisible();
});

test("rota do treinador sem sessão redireciona para /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/treinador/calendario");
  await expect(page).toHaveURL(/\/login/);
});

// ─────────────────────────────────────────────────────────────────────────
// Fluxo operacional do treinador (serial: cada passo depende do anterior)
// ─────────────────────────────────────────────────────────────────────────

test.describe("fluxo operacional do treinador", () => {
  test.describe.configure({ mode: "serial" });

  const trainerEmail = uniqueEmail("e2e-trainer");
  const athleteEmail = uniqueEmail("e2e-athlete");
  let organizationId = "";
  let athleteProfileId = "";

  test("setup + login redireciona por papel", async ({ page }) => {
    await registerTrainer(page, trainerEmail);
    ({ organizationId, athleteProfileId } = await inviteAndActivateAthlete(page, athleteEmail));

    // Papel ATLETA cai no ambiente do atleta…
    await loginAs(page, athleteEmail, /\/atleta$/);
    // …e o TREINADOR no ambiente do treinador.
    await loginAs(page, trainerEmail, /\/treinador$/);
  });

  test("sidebar recolhe e a preferência persiste", async ({ page }) => {
    await loginAs(page, trainerEmail, /\/treinador$/);

    const collapse = page.getByRole("button", { name: "Recolher menu" });
    await expect(collapse).toBeVisible();
    await collapse.click();
    // Recolhida: o botão passa a "Expandir menu".
    await expect(page.getByRole("button", { name: "Expandir menu" })).toBeVisible();

    // Persiste após recarregar (localStorage enky:sidebar-collapsed).
    await page.reload();
    await expect(page.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  });

  test("calendário: seleciona atleta, vê métricas e filtra", async ({ page }) => {
    await loginAs(page, trainerEmail, /\/treinador$/);
    await page.goto("/treinador/calendario");

    // Seletor pesquisável de atleta no cabeçalho de contexto.
    await page.getByRole("button", { name: /Todos os atletas/ }).click();
    await page.getByPlaceholder("Buscar atleta...").fill("Atleta E2E");
    await page.getByRole("option", { name: /Atleta E2E/ }).click();

    // Métricas vivas aparecem (sem exigir relatório) — CTL/ATL/TSB + fonte.
    await expect(page.getByText("CTL", { exact: true })).toBeVisible();
    await expect(page.getByText("ATL", { exact: true })).toBeVisible();
    await expect(page.getByText("TSB", { exact: true })).toBeVisible();
    await expect(page.getByText(/fórmula v/)).toBeVisible();

    // Filtros compactos em popover.
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByRole("combobox").first().selectOption("RUNNING");
    // O contador de filtros ativos aparece no botão.
    await expect(page.getByRole("button", { name: /Filtros · 1/ })).toBeVisible();
  });

  test("cria periodização (plano completo)", async ({ page }) => {
    await loginAs(page, trainerEmail, /\/treinador$/);
    await page.goto("/treinador/periodizacao");

    await page.getByRole("button", { name: /Criar periodização/ }).click();
    await page.locator("#p-title").fill("Base E2E 12 semanas");
    await page.locator("#p-modality").selectOption("RUNNING");
    await page.locator("#p-goal").fill("Concluir 21k");
    await page.getByRole("button", { name: "Criar plano" }).click();

    // O plano recém-criado aparece na lista do atleta.
    await expect(page.getByText("Base E2E 12 semanas")).toBeVisible();
  });

  test("página 360º mostra as métricas sempre visíveis", async ({ page }) => {
    await loginAs(page, trainerEmail, /\/treinador$/);
    await page.goto(`/treinador/atletas/${athleteProfileId}`);

    // Faixa de métricas acima das abas.
    await expect(page.getByText("CTL", { exact: true })).toBeVisible();
    await expect(page.getByText("Aderência", { exact: true })).toBeVisible();
    await expect(page.getByText("Prontidão", { exact: true })).toBeVisible();
    // Fonte + versão da fórmula (rastreabilidade).
    await expect(page.getByText(/Fonte:.*sRPE/)).toBeVisible();
    // Abas presentes.
    await expect(page.getByRole("button", { name: "Carga" })).toBeVisible();
  });

  test.afterAll(async () => {
    if (organizationId) await cleanupOrg(organizationId, [trainerEmail, athleteEmail]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Isolamento entre organizações
// ─────────────────────────────────────────────────────────────────────────

test("isolamento: treinador não acessa atleta de outra organização", async ({ page }) => {
  const trainerAEmail = uniqueEmail("e2e-iso-a");
  const athleteAEmail = uniqueEmail("e2e-iso-athlete");
  const trainerBEmail = uniqueEmail("e2e-iso-b");
  let orgA = "";
  let orgB = "";
  let athleteAId = "";

  try {
    // Org A: treinador + atleta.
    await registerTrainer(page, trainerAEmail);
    const a = await inviteAndActivateAthlete(page, athleteAEmail);
    orgA = a.organizationId;
    athleteAId = a.athleteProfileId;

    // Org B: outro treinador, sem vínculo com o atleta da org A.
    await registerTrainer(page, trainerBEmail);
    orgB = (
      await prisma.user.findFirstOrThrow({
        where: { email: { equals: trainerBEmail, mode: "insensitive" } },
        select: { memberships: { select: { organizationId: true }, take: 1 } },
      })
    ).memberships[0]!.organizationId;

    // Treinador B tenta abrir a 360º do atleta da org A — deve ser barrado.
    await loginAs(page, trainerBEmail, /\/treinador$/);
    await page.goto(`/treinador/atletas/${athleteAId}`);
    await expect(page.getByText(/Voltar aos atletas/)).toBeVisible();
    // Nenhuma métrica do atleta alheio vaza.
    await expect(page.getByText(/Fonte:.*sRPE/)).toHaveCount(0);
  } finally {
    if (orgA) await cleanupOrg(orgA, [trainerAEmail, athleteAEmail]);
    if (orgB) await cleanupOrg(orgB, [trainerBEmail]);
  }
});
