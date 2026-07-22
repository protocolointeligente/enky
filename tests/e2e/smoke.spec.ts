import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";

// SMOKE de produção — Fase 12, item 9. É o gate go/no-go do piloto: os seis
// fluxos que um treinador percorre no primeiro dia, dirigidos pela UI REAL
// contra o deployment apontado por APP_URL (Preview ou Production).
//
//   1. registrar treinador     — tela pública /registrar
//   2. convidar atleta         — /treinador/atletas (ação real, com auditoria)
//   3. ativar atleta           — /convite/ativar
//   4. criar treino            — /treinador/treinos/novo, publicar
//   5. atleta enviar feedback  — /atleta/treinos/[id]
//   6. treinador gerar relatório — /treinador/relatorios, compartilhar
//
// Rodar:
//   APP_URL=https://<preview>.vercel.app npx playwright test smoke.spec.ts
//   (local: só `npm run test:smoke`, sobe o dev server sozinho)
//
// Por que ainda toca o banco direto em UM ponto: o convite (passo 2) é uma ação
// real de UI, mas o token de ativação NUNCA volta por HTTP (é credencial
// bearer) e em produção sai por e-mail real (Resend), que este ambiente não lê.
// Em vez de burlar a ação de convite, deixamos o treinador convidar de verdade
// e então RE-CARIMBAMOS o tokenHash da linha criada com um token que
// conhecemos (mesmo HMAC + AUTH_SECRET), para dirigir a ativação real logo em
// seguida. Assim os passos 2 e 3 são ambos a UI de verdade. Requer que o
// processo do teste tenha DATABASE_URL/AUTH_SECRET do MESMO banco do
// deployment (ver tests/e2e/global-setup.ts). NÃO rode contra um banco de
// produção sem intenção — o passo de limpeza remove o que este teste criou.

const PASSWORD = "smoke-correcthorse1";

function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@smoke-test.enky.local`;
}

function hashInvitationToken(token: string): string {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) throw new Error("AUTH_SECRET ausente — necessário para re-carimbar o convite.");
  return createHmac("sha256", authSecret).update(token).digest("base64url");
}

test.describe.configure({ mode: "serial" });

test("smoke: registro → convite → ativação → treino → feedback → relatório", async ({ page }) => {
  const trainerEmail = uniqueEmail("smoke-trainer");
  const athleteEmail = uniqueEmail("smoke-athlete");
  const knownToken = randomUUID() + randomUUID();

  let organizationId = "";
  let athleteProfileId = "";
  let workoutId = "";

  await test.step("1. treinador se registra pela tela pública", async () => {
    await page.goto("/registrar");
    await page.locator("#name").fill("Treinador Smoke");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/treinador$/);
  });

  await test.step("2. treinador convida um atleta", async () => {
    await page.goto("/treinador/atletas");
    await page.locator("#inviteEmail").fill(athleteEmail);
    await page.locator("#inviteName").fill("Atleta Smoke");
    await page.getByRole("button", { name: "Convidar" }).click();
    // A carteira mostra o convite pendente.
    await expect(page.getByText("Convite pendente")).toBeVisible();
  });

  await test.step("re-carimba o token do convite recém-criado (ver cabeçalho)", async () => {
    const invitation = await prisma.athleteInvitation.findFirst({
      where: { email: { equals: athleteEmail, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
    expect(invitation, "convite não foi criado pela UI").not.toBeNull();
    organizationId = invitation!.organizationId;
    athleteProfileId = invitation!.athleteId;
    await prisma.athleteInvitation.update({
      where: { id: invitation!.id },
      data: { tokenHash: hashInvitationToken(knownToken) },
    });
  });

  await test.step("3. atleta ativa a conta pelo link", async () => {
    await page.context().clearCookies();
    await page.goto(`/convite/ativar?token=${knownToken}`);
    await page.locator("#name").fill("Atleta Smoke");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Ativar conta" }).click();
    await expect(page).toHaveURL(/\/atleta$/);
  });

  await test.step("4. treinador cria e publica um treino", async () => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/treinador$/);

    await page.goto("/treinador/treinos/novo");
    await page.locator("#athleteId").selectOption(athleteProfileId);
    await page.locator("#title").fill("Rodagem Smoke — 8km");
    const plannedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.locator("#plannedDate").fill(plannedDate);
    await page.getByRole("button", { name: "+ Adicionar passo" }).click();
    await page.getByPlaceholder("Duração (s)").fill("1800");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page).toHaveURL(/\/treinador\/treinos\/[0-9a-f-]{36}$/);
    workoutId = page.url().split("/").pop() as string;

    await page.getByRole("button", { name: "Revisar e publicar" }).click();
    await expect(page.getByText("Revisão antes de publicar")).toBeVisible();
    await page.getByRole("button", { name: "Publicar treino" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publicar treino" }).click();
    await expect(page.getByText("Publicado")).toBeVisible();
  });

  await test.step("5. atleta envia feedback", async () => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator("#email").fill(athleteEmail);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/atleta$/);

    await page.goto(`/atleta/treinos/${workoutId}`);
    await page.getByRole("button", { name: "Registrar feedback" }).click();
    await page.getByLabel("Duração real (min)").fill("30");
    await page.getByLabel("RPE da sessão (1-10)").fill("6");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/feedback") && res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Enviar feedback" }).click(),
    ]);
    expect(response.ok(), `POST /feedback devolveu ${response.status()}`).toBe(true);
    await expect(page.getByText("Seu feedback")).toBeVisible();
  });

  await test.step("6. treinador gera e compartilha o relatório", async () => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/treinador$/);

    await page.goto("/treinador/relatorios");
    // O rótulo do botão é dinâmico ("Gerar relatório de <nome>").
    await page.getByRole("button", { name: /^Gerar relatório/ }).click();
    await expect(page.getByText("Rascunho")).toBeVisible();
    await page.getByRole("button", { name: "Compartilhar com o atleta" }).click();
    // Relatório PUBLISHED aparece rotulado como "Compartilhado" (report-document.ts).
    await expect(page.getByText("Compartilhado")).toBeVisible();
  });

  await test.step("limpeza", async () => {
    if (!organizationId) return;
    await prisma.workout.deleteMany({ where: { organizationId } });
    await prisma.report.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.athleteInvitation.deleteMany({ where: { organizationId } });
    await prisma.coachAthleteRelationship.deleteMany({ where: { organizationId } });
    await prisma.organizationMembership.deleteMany({ where: { organizationId } });
    if (athleteProfileId) {
      await prisma.athleteProfile.deleteMany({ where: { id: athleteProfileId } });
    }
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({
      where: { email: { in: [trainerEmail, athleteEmail], mode: "insensitive" } },
    });
  });
});
