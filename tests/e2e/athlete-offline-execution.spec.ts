import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/server/auth/password";

// E2E da execução offline (Etapa 6, §57): o atleta abre um treino publicado
// (online, o detalhe é cacheado), FICA OFFLINE, inicia a execução, marca a etapa
// e conclui — tudo sem rede —, volta a ficar online e a fila sincroniza UMA vez,
// deixando a WorkoutExecution como COMPLETED no servidor.
//
// Requisitos de execução:
//   - Migração 20260719160000_athlete_workout_execution aplicada (senão pula).
//   - Rodado contra `npm run dev` (webServer do playwright.config). Em dev o
//     service worker não registra (só em produção), então a NAVEGAÇÃO offline
//     (servir o shell pelo SW) não é coberta aqui — isso exige um run em modo
//     produção. Este teste cobre a execução+sync offline dentro da página já
//     carregada, que é o miolo da fatia.
//
// Seeding é feito por Prisma direto (mesma justificativa do workout-flow.spec.ts:
// sem inbox real para o convite e para não cruzar o boundary server-only).
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

test("atleta executa e conclui um treino offline e sincroniza ao reconectar", async ({ page }) => {
  // A migração da Etapa 6 é aditiva e ainda não aplicada por padrão — sem as
  // tabelas, a API de execução falha. Pular com mensagem clara em vez de red-fail.
  const migrated = await prisma.workoutExecution
    .count()
    .then(() => true)
    .catch(() => false);
  test.skip(!migrated, "Migração 20260719160000 não aplicada — tabelas de execução ausentes.");

  const trainerEmail = uniqueEmail("e2e-trainer");
  const athleteEmail = uniqueEmail("e2e-athlete");
  const passwordHash = await hashPassword(VALID_PASSWORD);

  const trainerUser = await prisma.user.create({
    data: { email: trainerEmail, name: "Treinador Offline E2E", passwordHash, globalRole: "TRAINER" },
  });
  const trainerProfile = await prisma.trainerProfile.create({ data: { userId: trainerUser.id } });
  const organization = await prisma.organization.create({
    data: { name: "Treinador Offline E2E", slug: `e2e-off-${randomUUID()}` },
  });
  await prisma.organizationMembership.create({
    data: { userId: trainerUser.id, organizationId: organization.id, role: "OWNER" },
  });
  const athleteProfile = await prisma.athleteProfile.create({ data: {} });
  await prisma.coachAthleteRelationship.create({
    data: { organizationId: organization.id, trainerId: trainerProfile.id, athleteId: athleteProfile.id },
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

  const plannedDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const workout = await prisma.workout.create({
    data: {
      organizationId: organization.id,
      athleteId: athleteProfile.id,
      trainerId: trainerProfile.id,
      title: "Rodagem Offline E2E",
      modality: "RUNNING",
      status: "PUBLISHED",
      plannedDate,
      blocks: {
        create: [
          {
            sequence: 1,
            name: "Bloco 1",
            steps: { create: [{ sequence: 1, stepType: "RODAGEM", durationSeconds: 600 }] },
          },
        ],
      },
    },
  });

  await test.step("atleta ativa o convite e abre o treino (online: cacheia o detalhe)", async () => {
    await page.goto(`/convite/ativar?token=${rawToken}`);
    await page.locator("#name").fill("Atleta Offline E2E");
    await page.locator("#password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Ativar conta" }).click();
    await expect(page).toHaveURL(/\/atleta$/);

    await page.getByText("Rodagem Offline E2E").click();
    await expect(page).toHaveURL(new RegExp(`/atleta/treinos/${workout.id}$`));
    await expect(page.getByText(/Rodagem.*600s/)).toBeVisible();
  });

  await test.step("OFFLINE: inicia, marca a etapa e conclui", async () => {
    await page.context().setOffline(true);

    await page.getByRole("button", { name: "Iniciar treino" }).click();
    await expect(page.getByText("Treino em andamento")).toBeVisible();

    // Marca a etapa (emite STEP_COMPLETED, enfileirado offline).
    await page.getByRole("button", { name: /Rodagem.*600s/ }).click();

    await page.getByRole("button", { name: "Concluir treino" }).click();
    // Vai para o fluxo de feedback; o evento COMPLETE já está na fila.
    await expect(page.getByRole("heading", { name: "Como foi o treino?" })).toBeVisible();

    // Nada sincronizou ainda: não há execução no servidor.
    expect(await prisma.workoutExecution.count({ where: { workoutId: workout.id } })).toBe(0);
  });

  await test.step("ONLINE: reconecta e a fila sincroniza a execução concluída", async () => {
    await page.context().setOffline(false);

    // O evento 'online' dispara o flush; aguarda a execução aparecer COMPLETED.
    await expect
      .poll(
        () =>
          prisma.workoutExecution.count({
            where: { workoutId: workout.id, status: "COMPLETED" },
          }),
        { timeout: 30000 },
      )
      .toBe(1);

    const execution = await prisma.workoutExecution.findFirstOrThrow({
      where: { workoutId: workout.id },
      include: { events: true },
    });
    // START é sintetizado no servidor; os eventos enviados incluem STEP_COMPLETED e COMPLETE.
    const types = execution.events.map((e) => e.type);
    expect(types).toContain("STEP_COMPLETED");
    expect(types).toContain("COMPLETE");
  });

  await test.step("limpeza", async () => {
    await prisma.workout.deleteMany({ where: { organizationId: organization.id } });
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.trainerProfile.delete({ where: { id: trainerProfile.id } });
    await prisma.athleteProfile.delete({ where: { id: athleteProfile.id } });
    await prisma.user.deleteMany({
      where: { email: { in: [trainerEmail, athleteEmail], mode: "insensitive" } },
    });
  });
});
