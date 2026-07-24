import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";

// E2E da etapa de avaliações e zonas (item #24). Dirige a UI real; requer o
// mesmo banco do deployment JÁ MIGRADO (tabela Assessment + WorkoutExercise.metadata).
// Mesmo padrão de convite/ativação do smoke.spec (re-carimbo do token).

const PASSWORD = "e2e-zones-correcthorse1";

function uniqueEmail(p: string): string {
  return `${p}+${randomUUID()}@e2e-zones.enky.local`;
}
function hashInvitationToken(token: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ausente.");
  return createHmac("sha256", secret).update(token).digest("base64url");
}

async function registerTrainer(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/registrar");
  await page.locator("#name").fill("Treinador Zonas");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/treinador$/);
}
async function loginTrainer(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/treinador$/);
}
async function inviteAndActivate(page: Page, athleteEmail: string) {
  await page.goto("/treinador/atletas");
  await page.locator("#inviteEmail").fill(athleteEmail);
  await page.locator("#inviteName").fill("Atleta Zonas");
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByText("Convite pendente")).toBeVisible();

  const invitation = await prisma.athleteInvitation.findFirst({
    where: { email: { equals: athleteEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  expect(invitation).not.toBeNull();
  const token = randomUUID() + randomUUID();
  await prisma.athleteInvitation.update({
    where: { id: invitation!.id },
    data: { tokenHash: hashInvitationToken(token) },
  });
  await page.context().clearCookies();
  await page.goto(`/convite/ativar?token=${token}`);
  await page.locator("#name").fill("Atleta Zonas");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ativar conta" }).click();
  await expect(page).toHaveURL(/\/atleta$/);
  return { organizationId: invitation!.organizationId, athleteProfileId: invitation!.athleteId };
}

async function cleanupOrg(organizationId: string, emails: string[]): Promise<void> {
  await prisma.assessment.deleteMany({ where: { organizationId } });
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

test.describe("avaliações → zonas", () => {
  test.describe.configure({ mode: "serial" });

  const trainerEmail = uniqueEmail("trainer");
  const athleteEmail = uniqueEmail("athlete");
  let organizationId = "";
  let athleteProfileId = "";

  test("cadastra e valida uma avaliação de FC (aba Avaliações)", async ({ page }) => {
    await registerTrainer(page, trainerEmail);
    ({ organizationId, athleteProfileId } = await inviteAndActivate(page, athleteEmail));
    await loginTrainer(page, trainerEmail);

    await page.goto(`/treinador/atletas/${athleteProfileId}`);
    await page.getByRole("button", { name: "Avaliações" }).click();
    await page.getByRole("button", { name: "Nova avaliação" }).click();

    // Tipo padrão = Frequência cardíaca; preenche FC máx + repouso.
    await page.getByLabel("FC máxima (bpm)").fill("188");
    await page.getByLabel("FC repouso (bpm)").fill("56");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();

    // Aparece como rascunho e pode ser validada → vira "Atual".
    await expect(page.getByText("Rascunho")).toBeVisible();
    await page.getByRole("button", { name: "Validar" }).click();
    await expect(page.getByText("Atual")).toBeVisible();
  });

  test("modal de prescrição calcula a zona de FC a partir da avaliação", async ({ page }) => {
    await loginTrainer(page, trainerEmail);
    await page.goto("/treinador/treinos/novo");
    await page.locator("#athleteId").selectOption(athleteProfileId);
    await page.locator("#title").fill("Rodagem por zona");
    const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.locator("#plannedDate").fill(date);

    await page.getByRole("button", { name: "+ Adicionar passo" }).click();
    // Alvo por FC, depois abre o cálculo por zona.
    await page.getByLabel("Intensidade").selectOption("HEART_RATE_ZONE");
    await page.getByRole("button", { name: "Calcular por zona" }).click();
    // Escolhe uma zona (Z2) → a proveniência aplicada aparece.
    await page.getByRole("button", { name: "Z2", exact: true }).click();
    await expect(page.getByText(/Zona Z2 aplicada/)).toBeVisible();
  });

  test.afterAll(async () => {
    if (organizationId) await cleanupOrg(organizationId, [trainerEmail, athleteEmail]);
  });
});

test("dados insuficientes: sem avaliação, a zona de FC informa e oferece alternativa", async ({
  page,
}) => {
  const trainerEmail = uniqueEmail("trainer-empty");
  const athleteEmail = uniqueEmail("athlete-empty");
  let organizationId = "";
  let athleteProfileId = "";
  try {
    await registerTrainer(page, trainerEmail);
    const r = await inviteAndActivate(page, athleteEmail);
    organizationId = r.organizationId;
    athleteProfileId = r.athleteProfileId;
    await loginTrainer(page, trainerEmail);

    await page.goto("/treinador/treinos/novo");
    await page.locator("#athleteId").selectOption(athleteProfileId);
    await page.getByRole("button", { name: "+ Adicionar passo" }).click();
    await page.getByLabel("Intensidade").selectOption("HEART_RATE_ZONE");
    await page.getByRole("button", { name: "Calcular por zona" }).click();
    await expect(
      page.getByText(/ainda não possui os dados necessários/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastrar avaliação" })).toBeVisible();
  } finally {
    if (organizationId) await cleanupOrg(organizationId, [trainerEmail, athleteEmail]);
  }
});
