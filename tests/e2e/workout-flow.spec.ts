import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/server/auth/password";

// Real end-to-end coverage of the Fase 02C operational flow: trainer logs
// in, prescribes a workout through the one canonical form, publishes it,
// the athlete logs in, sees it, submits feedback, and the trainer reviews
// that feedback — all driven through the actual rendered pages, not the
// API directly.
//
// Seeding the trainer+athlete pair is NOT done through the browser or
// through modules/identity/register-trainer.ts + modules/athletes/invite-
// athlete.ts, for two independent reasons:
//   1. There's no real inbox in this environment to receive
//      DevInvitationMailer's (dev-only, console-logged) activation link,
//      and the invite API deliberately never echoes the raw token back
//      over HTTP (it's a bearer credential).
//   2. Those modules transitively import lib/env.ts, which imports
//      "server-only" — a package whose real behavior (no-op on the server,
//      throw on the client) only works through Next.js's own webpack
//      resolve.alias. Vitest works around this with a config-level alias
//      (vitest.config.ts); Playwright has no equivalent hook that doesn't
//      also require touching the root tsconfig.json — which would weaken
//      Next's production client/server import boundary for the whole app,
//      not just tests. Not an acceptable trade for test convenience.
// So this spec seeds the identical rows those modules would create, via
// direct Prisma writes + the same hashing/token primitives (bcryptjs and
// node:crypto have no server-only dependency), then drives 100% real
// browser interaction from "trainer logs in" onward.
const VALID_PASSWORD = "correcthorse1";
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@e2e-test.enky.local`;
}

function hashInvitationToken(token: string): string {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret)
    throw new Error("AUTH_SECRET não está definido no .env — necessário para o seed do E2E.");
  return createHmac("sha256", authSecret).update(token).digest("base64url");
}

test.describe.configure({ mode: "serial" });

test("treinador prescreve, publica, atleta responde feedback, treinador revisa", async ({
  page,
}) => {
  const trainerEmail = uniqueEmail("e2e-trainer");
  const athleteEmail = uniqueEmail("e2e-athlete");

  const passwordHash = await hashPassword(VALID_PASSWORD);

  const trainerUser = await prisma.user.create({
    data: { email: trainerEmail, name: "Treinador E2E", passwordHash, globalRole: "TRAINER" },
  });
  const trainerProfile = await prisma.trainerProfile.create({ data: { userId: trainerUser.id } });
  const organization = await prisma.organization.create({
    data: { name: "Treinador E2E", slug: `e2e-${randomUUID()}` },
  });
  await prisma.organizationMembership.create({
    data: { userId: trainerUser.id, organizationId: organization.id, role: "OWNER" },
  });

  const athleteProfile = await prisma.athleteProfile.create({ data: {} });
  await prisma.coachAthleteRelationship.create({
    data: {
      organizationId: organization.id,
      trainerId: trainerProfile.id,
      athleteId: athleteProfile.id,
    },
  });

  const rawToken = randomBytes(32).toString("base64url");
  await prisma.athleteInvitation.create({
    data: {
      organizationId: organization.id,
      trainerId: trainerProfile.id,
      athleteId: athleteProfile.id,
      email: athleteEmail,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  const trainerResult = { userId: trainerUser.id, organizationId: organization.id };
  const invitation = { athleteProfileId: athleteProfile.id, rawToken };

  let workoutId = "";

  await test.step("treinador entra e prescreve um treino de corrida", async () => {
    await page.goto("/login");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/treinador$/);

    await page.getByRole("link", { name: "Criar treino" }).click();
    await expect(page).toHaveURL(/\/treinador\/treinos\/novo$/);

    await page.locator("#athleteId").selectOption(invitation.athleteProfileId);
    await page.locator("#title").fill("Rodagem E2E — 10km");
    const plannedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.locator("#plannedDate").fill(plannedDate);

    await page.getByRole("button", { name: "+ Adicionar passo" }).click();
    await page.getByPlaceholder("Duração (s)").fill("1800");

    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page).toHaveURL(/\/treinador\/treinos\/[0-9a-f-]{36}$/);
    workoutId = page.url().split("/").pop() as string;

    await expect(page.getByText("Rascunho")).toBeVisible();
  });

  await test.step("treinador revisa e publica o treino", async () => {
    // Novo fluxo 02E: Revisar e publicar -> tela de revisão -> modal de confirmação.
    await page.getByRole("button", { name: "Revisar e publicar" }).click();
    await expect(page.getByText("Revisão antes de publicar")).toBeVisible();
    // Botão da tela de revisão abre o modal de confirmação.
    await page.getByRole("button", { name: "Publicar treino" }).click();
    // Botão de confirmação dentro do modal (dialog) efetiva a publicação.
    await page.getByRole("dialog").getByRole("button", { name: "Publicar treino" }).click();
    await expect(page.getByText("Publicado")).toBeVisible();
  });

  await test.step("atleta ativa o convite e vê o treino publicado", async () => {
    // No logout button exists in the UI yet (flagged in the Fase 02C
    // report) — clearing the session cookie directly is the browser-side
    // equivalent for the purposes of switching identities in this test.
    await page.context().clearCookies();

    await page.goto(`/convite/ativar?token=${invitation.rawToken}`);
    await page.locator("#name").fill("Atleta E2E");
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Ativar conta" }).click();
    await expect(page).toHaveURL(/\/atleta$/);

    await expect(page.getByText("Rodagem E2E — 10km")).toBeVisible();
    await page.getByText("Rodagem E2E — 10km").click();
    await expect(page).toHaveURL(new RegExp(`/atleta/treinos/${workoutId}$`));
    await expect(page.getByText("RODAGEM — 1800s")).toBeVisible();
  });

  await test.step("atleta envia feedback e a carga de Session-RPE é calculada", async () => {
    const durationInput = page.getByLabel("Duração real (min)");
    await expect(durationInput).toBeVisible();
    await durationInput.fill("30");
    await page.getByLabel("RPE da sessão (1-10)").fill("6");

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/feedback") && res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Enviar feedback" }).click(),
    ]);
    expect(
      response.ok(),
      `POST /feedback returned ${response.status()}: ${await response.text()}`,
    ).toBe(true);

    await expect(page.getByText("Seu feedback")).toBeVisible();
    await expect(page.getByText(/180.*COMPLETE/)).toBeVisible();
  });

  await test.step("treinador revisa o feedback do atleta", async () => {
    // No logout button exists in the UI yet (flagged in the Fase 02C
    // report) — clearing the session cookie directly is the browser-side
    // equivalent for the purposes of switching identities in this test.
    await page.context().clearCookies();

    await page.goto("/login");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/treinador$/);

    await page.goto(`/treinador/treinos/${workoutId}`);
    await expect(page.getByText("Concluído")).toBeVisible();
    await expect(page.getByText(/180.*Completo/)).toBeVisible();
  });

  await test.step("limpeza", async () => {
    await prisma.workout.deleteMany({ where: { organizationId: trainerResult.organizationId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: trainerResult.organizationId },
    });
    await prisma.organization.delete({ where: { id: trainerResult.organizationId } });
    await prisma.trainerProfile.delete({ where: { id: trainerProfile.id } });
    await prisma.athleteProfile.delete({ where: { id: invitation.athleteProfileId } });
    await prisma.user.deleteMany({
      where: { email: { in: [trainerEmail, athleteEmail], mode: "insensitive" } },
    });
  });
});
