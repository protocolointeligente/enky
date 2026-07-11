import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/server/auth/password";

// Adversarial authorization/isolation suite (§13). Drives the REAL HTTP API
// through authenticated browser contexts (one per user/role/org) — the server,
// the guards, CSRF, and the database are all real. Seeding is done directly via
// Prisma (same rationale as workout-flow.spec.ts: no inbox for invites, and the
// identity modules import server-only). Everything created lives under the two
// demo orgs and is torn down in afterAll.
const PASSWORD = "correcthorse1";
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@e2e-test.enky.local`;
}
function hashInvitationToken(token: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ausente — necessário para o seed adversarial.");
  return createHmac("sha256", secret).update(token).digest("base64url");
}

interface OrgFixture {
  organizationId: string;
  trainerUserId: string;
  trainerProfileId: string;
  trainerEmail: string;
  athleteUserId: string;
  athleteProfileId: string;
  athleteEmail: string;
}

const orgIds: string[] = [];
const userIds: string[] = [];
const trainerProfileIds: string[] = [];
const athleteProfileIds: string[] = [];

async function createOrg(prefix: string, passwordHash: string): Promise<OrgFixture> {
  const trainerEmail = uniqueEmail(`${prefix}-trainer`);
  const trainerUser = await prisma.user.create({
    data: { email: trainerEmail, name: `${prefix} Trainer`, passwordHash, globalRole: "TRAINER" },
  });
  const trainerProfile = await prisma.trainerProfile.create({ data: { userId: trainerUser.id } });
  const org = await prisma.organization.create({
    data: { name: `${prefix} Org`, slug: `adv-${randomUUID()}` },
  });
  await prisma.organizationMembership.create({
    data: { userId: trainerUser.id, organizationId: org.id, role: "OWNER" },
  });

  const athleteEmail = uniqueEmail(`${prefix}-athlete`);
  const athleteUser = await prisma.user.create({
    data: { email: athleteEmail, name: `${prefix} Athlete`, passwordHash, globalRole: "ATHLETE" },
  });
  const athleteProfile = await prisma.athleteProfile.create({ data: { userId: athleteUser.id } });
  await prisma.coachAthleteRelationship.create({
    data: { organizationId: org.id, trainerId: trainerProfile.id, athleteId: athleteProfile.id },
  });

  orgIds.push(org.id);
  userIds.push(trainerUser.id, athleteUser.id);
  trainerProfileIds.push(trainerProfile.id);
  athleteProfileIds.push(athleteProfile.id);

  return {
    organizationId: org.id,
    trainerUserId: trainerUser.id,
    trainerProfileId: trainerProfile.id,
    trainerEmail,
    athleteUserId: athleteUser.id,
    athleteProfileId: athleteProfile.id,
    athleteEmail,
  };
}

async function createWorkout(
  org: OrgFixture,
  status: "DRAFT" | "PUBLISHED" | "COMPLETED",
  plannedDate: string,
) {
  const workout = await prisma.workout.create({
    data: {
      organizationId: org.organizationId,
      athleteId: org.athleteProfileId,
      trainerId: org.trainerProfileId,
      title: `Treino ${status}`,
      modality: "RUNNING",
      status,
      source: "MANUAL",
      plannedDate: new Date(`${plannedDate}T00:00:00.000Z`),
    },
  });
  const block = await prisma.workoutBlock.create({
    data: { workoutId: workout.id, sequence: 1, repetitions: 1 },
  });
  await prisma.workoutStep.create({
    data: { workoutBlockId: block.id, sequence: 1, stepType: "RODAGEM", durationSeconds: 1800 },
  });
  if (status === "COMPLETED") {
    await prisma.workoutFeedback.create({
      data: {
        workoutId: workout.id,
        actualDurationMinutes: 30,
        sessionRpe: 6,
        sessionRpeLoad: 180,
        loadStatus: "COMPLETE",
        completionSource: "ATHLETE_REPORTED",
        painLevel: 0,
      },
    });
  }
  return workout;
}

let baseURL = "";
let orgA: OrgFixture;
let orgB: OrgFixture;
const ids = {
  wDraftA: "",
  wPubA: "",
  wDoneA: "",
  exA: "",
  exB: "",
  tplA: "",
};

let trainerA: BrowserContext;
let athleteA: BrowserContext;
let trainerB: BrowserContext;
let anon: BrowserContext;

async function login(browser: Browser, email: string): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const res = await context.request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), `login ${email} → ${res.status()}`).toBeTruthy();
  return context;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  baseURL = process.env.APP_URL ?? "http://localhost:3000";
  const passwordHash = await hashPassword(PASSWORD);

  orgA = await createOrg("advA", passwordHash);
  orgB = await createOrg("advB", passwordHash);

  ids.wDraftA = (await createWorkout(orgA, "DRAFT", "2026-09-02")).id;
  ids.wPubA = (await createWorkout(orgA, "PUBLISHED", "2026-09-03")).id;
  ids.wDoneA = (await createWorkout(orgA, "COMPLETED", "2026-09-01")).id;

  ids.exA = (
    await prisma.exercise.create({
      data: {
        organizationId: orgA.organizationId,
        name: `ExA ${randomUUID()}`,
        category: "força",
        targetMuscles: [],
      },
    })
  ).id;
  ids.exB = (
    await prisma.exercise.create({
      data: {
        organizationId: orgB.organizationId,
        name: `ExB ${randomUUID()}`,
        category: "força",
        targetMuscles: [],
      },
    })
  ).id;

  ids.tplA = (
    await prisma.workoutTemplate.create({
      data: {
        organizationId: orgA.organizationId,
        trainerId: orgA.trainerProfileId,
        title: "Template Adv",
        modality: "STRENGTH",
        contentSnapshot: {
          blocks: [
            {
              repetitions: 1,
              steps: [],
              exercises: [
                { exerciseName: "Agachamento", exerciseCategory: "pernas", sets: 3, reps: 10 },
              ],
            },
          ],
          tags: [],
        },
      },
    })
  ).id;

  trainerA = await login(browser, orgA.trainerEmail);
  athleteA = await login(browser, orgA.athleteEmail);
  trainerB = await login(browser, orgB.trainerEmail);
  anon = await browser.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
});

test.afterAll(async () => {
  await Promise.all([trainerA?.close(), athleteA?.close(), trainerB?.close(), anon?.close()]);
  if (orgIds.length) {
    await prisma.workout.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.workoutTemplate.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.exercise.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.trainerProfile.deleteMany({ where: { id: { in: trainerProfileIds } } });
  await prisma.athleteProfile.deleteMany({ where: { id: { in: athleteProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("1: treinador vê o próprio calendário", async () => {
  const res = await trainerA.request.get("/api/trainer/calendar?from=2026-09-01&to=2026-09-30");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.workouts.some((w: { id: string }) => w.id === ids.wPubA)).toBe(true);
});

test("2: treinador cria um treino", async () => {
  const res = await trainerA.request.post("/api/trainer/workouts", {
    data: {
      athleteId: orgA.athleteProfileId,
      title: "Novo adv",
      modality: "RUNNING",
      plannedDate: "2026-09-10",
      blocks: [{ steps: [{ stepType: "RODAGEM", durationSeconds: 600 }] }],
    },
  });
  expect(res.status()).toBe(201);
});

test("3: treinador move um treino DRAFT", async () => {
  const res = await trainerA.request.post(`/api/trainer/workouts/${ids.wDraftA}/move`, {
    data: { plannedDate: "2026-09-05" },
  });
  expect(res.status()).toBe(200);
});

test("4: treinador duplica um treino", async () => {
  const res = await trainerA.request.post(`/api/trainer/workouts/${ids.wPubA}/duplicate`, {
    data: { plannedDate: "2026-09-20" },
  });
  expect(res.status()).toBe(201);
});

test("5: treinador aplica um template", async () => {
  const res = await trainerA.request.post(`/api/trainer/templates/${ids.tplA}/apply`, {
    data: { athleteId: orgA.athleteProfileId, plannedDate: "2026-09-21" },
  });
  expect(res.status()).toBe(201);
});

test("6: atleta vê o treino publicado", async () => {
  const res = await athleteA.request.get(`/api/athlete/workouts/${ids.wPubA}`);
  expect(res.status()).toBe(200);
});

test("7: atleta NÃO vê um DRAFT (404)", async () => {
  const res = await athleteA.request.get(`/api/athlete/workouts/${ids.wDraftA}`);
  expect(res.status()).toBe(404);
});

test("8: atleta NÃO pode mover treino (403 por papel)", async () => {
  const res = await athleteA.request.post(`/api/trainer/workouts/${ids.wPubA}/move`, {
    data: { plannedDate: "2026-09-06" },
  });
  expect(res.status()).toBe(403);
});

test("9: treinador B NÃO acessa treino da org A (404)", async () => {
  const res = await trainerB.request.get(`/api/trainer/workouts/${ids.wPubA}`);
  expect(res.status()).toBe(404);
});

test("10: treinador A NÃO edita exercício da org B (404) e não o lista", async () => {
  const patch = await trainerA.request.patch(`/api/trainer/exercises/${ids.exB}`, {
    data: { name: "hack", category: "x", targetMuscles: [] },
  });
  expect(patch.status()).toBe(404);
  const list = await trainerA.request.get("/api/trainer/exercises");
  const body = await list.json();
  expect(body.data.exercises.some((e: { id: string }) => e.id === ids.exB)).toBe(false);
});

test("11: treinador A NÃO aplica template em atleta de outra org (403)", async () => {
  const res = await trainerA.request.post(`/api/trainer/templates/${ids.tplA}/apply`, {
    data: { athleteId: orgB.athleteProfileId, plannedDate: "2026-09-22" },
  });
  expect(res.status()).toBe(403);
});

test("12: manipulação de ID entre orgs (treinador B move treino de A) → 404", async () => {
  const res = await trainerB.request.post(`/api/trainer/workouts/${ids.wPubA}/move`, {
    data: { plannedDate: "2026-09-07" },
  });
  expect(res.status()).toBe(404);
});

test("13: sem sessão → 401", async () => {
  const res = await anon.request.get("/api/trainer/workouts");
  expect(res.status()).toBe(401);
});

test("14: papel incorreto (atleta em rota de treinador) → 403", async () => {
  const res = await athleteA.request.get("/api/trainer/calendar?from=2026-09-01&to=2026-09-30");
  expect(res.status()).toBe(403);
});

test("15: treino com feedback NÃO pode ser movido (422)", async () => {
  const res = await trainerA.request.post(`/api/trainer/workouts/${ids.wDoneA}/move`, {
    data: { plannedDate: "2026-09-08" },
  });
  expect(res.status()).toBe(422);
});

test("16: aplicar template não altera o template original", async () => {
  const before = await (await trainerA.request.get(`/api/trainer/templates/${ids.tplA}`)).json();
  await trainerA.request.post(`/api/trainer/templates/${ids.tplA}/apply`, {
    data: { athleteId: orgA.athleteProfileId, plannedDate: "2026-09-23" },
  });
  const after = await (await trainerA.request.get(`/api/trainer/templates/${ids.tplA}`)).json();
  expect(after.data.template.content.blocks.length).toBe(
    before.data.template.content.blocks.length,
  );
  expect(after.data.template.title).toBe(before.data.template.title);
});

test("17: duplicação NÃO copia feedback", async () => {
  const dup = await trainerA.request.post(`/api/trainer/workouts/${ids.wDoneA}/duplicate`, {
    data: { plannedDate: "2026-09-24" },
  });
  expect(dup.status()).toBe(201);
  const { data } = await dup.json();
  const detail = await (
    await trainerA.request.get(`/api/trainer/workouts/${data.workoutId}`)
  ).json();
  expect(detail.data.workout.feedback).toBeNull();
  expect(detail.data.workout.status).toBe("DRAFT");
});

test("18: convite expirado é rejeitado", async () => {
  const rawToken = randomBytes(32).toString("base64url");
  const athlete = await prisma.athleteProfile.create({ data: {} });
  athleteProfileIds.push(athlete.id);
  await prisma.coachAthleteRelationship.create({
    data: {
      organizationId: orgA.organizationId,
      trainerId: orgA.trainerProfileId,
      athleteId: athlete.id,
    },
  });
  await prisma.athleteInvitation.create({
    data: {
      organizationId: orgA.organizationId,
      trainerId: orgA.trainerProfileId,
      athleteId: athlete.id,
      email: uniqueEmail("adv-expired"),
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const res = await anon.request.post("/api/athletes/invitations/activate", {
    data: { token: rawToken, name: "Expirado", password: PASSWORD },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("19: convite revogado é rejeitado", async () => {
  const rawToken = randomBytes(32).toString("base64url");
  const athlete = await prisma.athleteProfile.create({ data: {} });
  athleteProfileIds.push(athlete.id);
  await prisma.coachAthleteRelationship.create({
    data: {
      organizationId: orgA.organizationId,
      trainerId: orgA.trainerProfileId,
      athleteId: athlete.id,
    },
  });
  await prisma.athleteInvitation.create({
    data: {
      organizationId: orgA.organizationId,
      trainerId: orgA.trainerProfileId,
      athleteId: athlete.id,
      email: uniqueEmail("adv-revoked"),
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      isRevoked: true,
      revokedAt: new Date(),
    },
  });
  const res = await anon.request.post("/api/athletes/invitations/activate", {
    data: { token: rawToken, name: "Revogado", password: PASSWORD },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("20: resposta do convite não vaza token nem URL de ativação", async () => {
  const res = await trainerA.request.post("/api/athletes/invitations", {
    data: { email: uniqueEmail("adv-invite") },
  });
  expect(res.status()).toBe(201);
  const body = await res.text();
  expect(body).not.toContain("convite/ativar");
  expect(body.toLowerCase()).not.toContain("token");
  expect(body).not.toContain("http");
});
