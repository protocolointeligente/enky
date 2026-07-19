import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/server/auth/password";

// ENKY Intelligence 2.0 pela tela: o treinador abre "✨ Gerar com ENKY", o motor
// PROPÕE o macrociclo (Fase 1), mostra o porquê (Fase 7), as sessões-exemplo
// enriquecidas pelo catálogo (Fases 2/3), o recálculo da semana (Fase 4) e a
// simulação de carga CTL/ATL/TSB (Fase 6) — e só então salva como RASCUNHO.
// Nada é publicado aqui.
//
// Seed direto no Prisma pelos mesmos motivos de periodization-generation.spec.ts
// (sem inbox real; `server-only` não resolve fora do webpack do Next). Do login
// em diante é browser de verdade.

const VALID_PASSWORD = "correcthorse1";

test.describe.configure({ mode: "serial" });

test("treinador gera o plano com o motor estratégico, vê o porquê/sessões/carga e salva rascunho", async ({
  page,
}) => {
  const suffix = randomUUID();
  const passwordHash = await hashPassword(VALID_PASSWORD);
  const trainerEmail = `e2e-intel+${suffix}@e2e-test.enky.local`;

  const trainerUser = await prisma.user.create({
    data: { email: trainerEmail, name: "Treinador Intel", passwordHash, globalRole: "TRAINER" },
  });
  const trainerProfile = await prisma.trainerProfile.create({ data: { userId: trainerUser.id } });
  const organization = await prisma.organization.create({
    data: { name: "Intel E2E", slug: `e2e-intel-${suffix}` },
  });
  await prisma.organizationMembership.create({
    data: { userId: trainerUser.id, organizationId: organization.id, role: "OWNER" },
  });

  const athleteUser = await prisma.user.create({
    data: {
      email: `e2e-intel-athlete+${suffix}@e2e-test.enky.local`,
      name: "Atleta Intel",
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

  await test.step("treinador entra e abre o motor estratégico", async () => {
    await page.goto("/login");
    await page.locator("#email").fill(trainerEmail);
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/treinador$/, { timeout: 60_000 });

    await page.goto("/treinador/periodizacao");
    await page.getByRole("button", { name: /Gerar com ENKY/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  await test.step("preenche o objetivo e simula: proposta + o porquê", async () => {
    const dialog = page.getByRole("dialog");
    await dialog.locator("#s-goal").fill("Maratona sub-4h");
    await dialog.locator("#s-level").selectOption("INTERMEDIARIO");
    await dialog.locator("#s-vol").fill("45");

    await dialog.getByRole("button", { name: "Simular" }).click();

    // A estrutura proposta aparece (nº de semanas/fases vem da janela padrão do
    // formulário — asserimos a forma, não um número mágico).
    await expect(dialog.getByText(/Proposta · \d+ semanas · \d+ fases/)).toBeVisible({
      timeout: 60_000,
    });
    // Fase 7 — o "porquê" fica à vista, não escondido.
    await expect(dialog.getByText(/Por que este plano\?/)).toBeVisible();
    await expect(dialog.getByText(/Preparação geral/)).toBeVisible();
    // Com objetivo + nível + volume + dias, a confiança não tem o que rebaixar.
    await expect(dialog.getByText(/Confiança alta/)).toBeVisible();
  });

  await test.step("vê as sessões-exemplo (Fases 2/3) e o recálculo da semana (Fase 4)", async () => {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Ver sessões da semana de maior carga/ }).click();

    // Sessão enriquecida pelo catálogo + recálculo da semana.
    await expect(dialog.getByText(/Evidência|Ev\. [ABC]|Sistema/).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(dialog.getByText(/Carga da semana/)).toBeVisible();
    await expect(dialog.getByText(/Polarização/)).toBeVisible();
  });

  await test.step("projeta a carga CTL/ATL/TSB do plano (Fase 6)", async () => {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Projetar carga do plano/ }).click();

    await expect(dialog.getByText("Hoje")).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("Pico do ciclo")).toBeVisible();
    await expect(dialog.getByText("Na prova")).toBeVisible();
  });

  await test.step("salva como rascunho e o plano aparece na lista (nada publicado)", async () => {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();

    // Sem título informado, o plano nasce "Plano Corrida" (modalidade padrão).
    await expect(page.getByRole("heading", { name: "Plano Corrida" })).toBeVisible({
      timeout: 60_000,
    });

    // Persistiu como rascunho, com a racionalização congelada, e nenhum treino
    // foi publicado (o motor só propõe estrutura — sessões são um passo à parte).
    const plan = await prisma.periodization.findFirst({
      where: { organizationId: organization.id, athleteId: athleteProfile.id },
      select: { isDraft: true, autoGenerate: true, strategyRationale: true },
    });
    expect(plan?.isDraft).toBe(true);
    expect(plan?.autoGenerate).toBe(true);
    expect(plan?.strategyRationale).not.toBeNull();
    const published = await prisma.workout.count({
      where: { organizationId: organization.id, status: "PUBLISHED" },
    });
    expect(published).toBe(0);
  });

  // Limpeza: fases/semanas caem por cascade; o resto na ordem do Restrict.
  await prisma.periodization.deleteMany({ where: { organizationId: organization.id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.coachAthleteRelationship.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });
  await prisma.trainerProfile.deleteMany({ where: { id: trainerProfile.id } });
  await prisma.athleteProfile.deleteMany({ where: { id: athleteProfile.id } });
  await prisma.user.deleteMany({ where: { id: { in: [trainerUser.id, athleteUser.id] } } });
});
