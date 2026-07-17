import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/server/auth/password";

// Fase 6 pela tela: o treinador desenha o macrociclo, gera as sessões de uma
// semana e recebe rascunhos + a explicação da regra. Nada é publicado aqui —
// a publicação já tem cobertura em workout-flow.spec.ts.
//
// O seed vai direto no Prisma pelos mesmos motivos documentados em
// workout-flow.spec.ts (sem inbox real; `server-only` não resolve fora do
// webpack do Next). Do login em diante é browser de verdade.

const VALID_PASSWORD = "correcthorse1";

test.describe.configure({ mode: "serial" });

test("treinador cria periodização, gera a semana em rascunho e vê a regra aplicada", async ({
  page,
}) => {
  const trainerEmail = `e2e-gen+${randomUUID()}@e2e-test.enky.local`;
  const passwordHash = await hashPassword(VALID_PASSWORD);

  const trainerUser = await prisma.user.create({
    data: { email: trainerEmail, name: "Treinador Geração", passwordHash, globalRole: "TRAINER" },
  });
  const trainerProfile = await prisma.trainerProfile.create({ data: { userId: trainerUser.id } });
  const organization = await prisma.organization.create({
    data: { name: "Geração E2E", slug: `e2e-gen-${randomUUID()}` },
  });
  await prisma.organizationMembership.create({
    data: { userId: trainerUser.id, organizationId: organization.id, role: "OWNER" },
  });

  const athleteUser = await prisma.user.create({
    data: {
      email: `e2e-gen-athlete+${randomUUID()}@e2e-test.enky.local`,
      name: "Atleta Geração",
      passwordHash,
      globalRole: "ATHLETE",
    },
  });
  const athleteProfile = await prisma.athleteProfile.create({ data: { userId: athleteUser.id } });
  await prisma.coachAthleteRelationship.create({
    data: {
      organizationId: organization.id,
      trainerId: trainerProfile.id,
      athleteId: athleteProfile.id,
    },
  });

  await test.step("treinador entra e cria o plano com uma fase de base", async () => {
    await page.goto("/login");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    // bcrypt + primeira query no Neon (que auto-suspende) passam dos 20s
    // padrão com folga quando o compute está frio.
    await expect(page).toHaveURL(/\/treinador$/, { timeout: 60_000 });

    await page.goto("/treinador/periodizacao");
    await page.locator("#title").fill("Maratona E2E");
    await page.locator("#goal").fill("Concluir a maratona");

    // A fase precisa de nome reconhecível ("base") e volume alvo — é o que
    // leva a geração a confiança alta.
    await page.getByRole("button", { name: "+ Adicionar fase" }).click();
    await page.getByPlaceholder("Nome (base, build, pico, taper…)").fill("Base aeróbica");
    await page.getByPlaceholder("Volume alvo (km)").fill("45");

    await page.getByRole("button", { name: "Criar plano" }).click();
    await expect(page.getByRole("heading", { name: "Maratona E2E" })).toBeVisible({
      timeout: 60_000,
    });
  });

  await test.step("gera a primeira semana e recebe rascunhos explicados", async () => {
    await page.getByRole("button", { name: "Gerar" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Base aeróbica")).toBeVisible();

    await dialog.locator("#gen-modality").selectOption("RUNNING");
    await dialog.locator("#gen-level").selectOption("INTERMEDIATE");
    // Seg/Qua/Sex — o padrão já é Ter/Qui/Sáb, então trocamos para provar que
    // os toggles de fato mandam no resultado.
    await dialog.getByRole("button", { name: "Ter", pressed: true }).click();
    await dialog.getByRole("button", { name: "Qui", pressed: true }).click();
    await dialog.getByRole("button", { name: "Sáb", pressed: true }).click();
    await dialog.getByRole("button", { name: "Seg", pressed: false }).click();
    await dialog.getByRole("button", { name: "Qua", pressed: false }).click();
    await dialog.getByRole("button", { name: "Sex", pressed: false }).click();

    await dialog.getByRole("button", { name: "Gerar rascunhos" }).click();

    // Com fase reconhecida + volume alvo + nível, o motor não tem o que
    // rebaixar.
    // .first(): a frase aparece 2x de propósito — no selo e dentro da própria
    // explicação da regra "confidence@1" ("Confiança alta significa que o motor
    // tinha os dados que a regra pede — não que a prescrição está certa").
    await expect(dialog.getByText("Confiança alta").first()).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("3 rascunho(s) criado(s)")).toBeVisible();
    await expect(dialog.getByText(/só enxerga depois que você revisar/)).toBeVisible();

    // A regra aplicada fica disponível, não escondida num log.
    await dialog.getByText(/Por que o motor decidiu assim/).click();
    await expect(dialog.getByText(/week-volume@1/)).toBeVisible();
    await expect(dialog.getByText(/45 km × 1/)).toBeVisible();
  });

  await test.step("os rascunhos linkam para a revisão e a semana passa a contar treinos", async () => {
    const dialog = page.getByRole("dialog");
    const firstDraft = dialog.getByRole("link", { name: /Corrida/ }).first();
    await expect(firstDraft).toBeVisible();

    await dialog.getByRole("button", { name: "Concluir" }).click();
    // A tabela recarregou: a semana 1 agora mostra os treinos gerados.
    await expect(page.locator("tbody tr").first()).toContainText("3");
  });

  await test.step("regerar a mesma semana exige decisão explícita de substituir", async () => {
    await page.getByRole("button", { name: "Gerar" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Gerar rascunhos" }).click();

    await expect(dialog.getByText(/já tem 3 rascunho/i)).toBeVisible();
    // Só depois da recusa aparece a substituição — e ela avisa o que preserva.
    await expect(
      dialog.getByRole("button", { name: "Substituir rascunhos e gerar" }),
    ).toBeVisible();
    await expect(dialog.getByText(/não.*serão tocados/i)).toBeVisible();
  });

  // Limpeza: workouts e batches caem antes do plano por causa do Restrict.
  await prisma.workout.deleteMany({ where: { organizationId: organization.id } });
  await prisma.generationBatch.deleteMany({ where: { organizationId: organization.id } });
  await prisma.periodization.deleteMany({ where: { organizationId: organization.id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.coachAthleteRelationship.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });
  await prisma.trainerProfile.deleteMany({ where: { id: trainerProfile.id } });
  await prisma.athleteProfile.deleteMany({ where: { id: athleteProfile.id } });
  await prisma.user.deleteMany({ where: { id: { in: [trainerUser.id, athleteUser.id] } } });
});
