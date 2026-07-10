import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { createSession, revokeSession, verifySessionByToken } from "@/server/auth/session";
import { uniqueEmail, uniqueSlug } from "./helpers";

// Tracks everything created across the suite so afterAll can clean it up in
// one FK-safe pass: Workout → Organization (cascades most operational
// tables) → TrainerProfile → AthleteProfile → User. See the comment above
// the afterAll block for why this specific order is required.
const createdWorkoutIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];
const createdUserIds: string[] = [];

async function createTrainerUser(namePrefix: string) {
  const user = await prisma.user.create({
    data: { email: uniqueEmail(namePrefix), name: `${namePrefix} User`, globalRole: "TRAINER" },
  });
  createdUserIds.push(user.id);
  return user;
}

/** Mirrors the atomic creation pattern from ADR-001 (scenario 1 also
 * exercises this same transaction directly, this helper is for tests that
 * just need a valid trainer+org fixture without re-asserting the pattern). */
async function createTrainerWithPersonalOrg(namePrefix: string) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: uniqueEmail(namePrefix), name: `${namePrefix} User`, globalRole: "TRAINER" },
    });
    const trainerProfile = await tx.trainerProfile.create({ data: { userId: user.id } });
    const organization = await tx.organization.create({
      data: { name: `${namePrefix} Org`, slug: uniqueSlug(namePrefix) },
    });
    await tx.organizationMembership.create({
      data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
    });
    return { user, trainerProfile, organization };
  });

  createdUserIds.push(result.user.id);
  createdTrainerProfileIds.push(result.trainerProfile.id);
  createdOrganizationIds.push(result.organization.id);
  return result;
}

describe("Fase 02A — testes de persistência", () => {
  // ---------------------------------------------------------------------
  // 1. Criação atômica de treinador (ADR-001): User + TrainerProfile +
  //    Organization + OrganizationMembership(OWNER) na mesma transação.
  // ---------------------------------------------------------------------
  it("cria atomicamente User, TrainerProfile, Organization pessoal e OrganizationMembership(OWNER)", async () => {
    const { user, trainerProfile, organization } = await createTrainerWithPersonalOrg("atomic");

    const membership = await prisma.organizationMembership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    });

    expect(trainerProfile.userId).toBe(user.id);
    expect(membership.role).toBe("OWNER");
    expect(membership.organizationId).toBe(organization.id);
  });

  // ---------------------------------------------------------------------
  // 2. Criação de atleta sem User durante convite — AthleteProfile nasce
  //    com userId null; o User só existe quando o convite é ativado.
  // ---------------------------------------------------------------------
  it("cria AthleteProfile sem User vinculado (fluxo de convite)", async () => {
    const athleteProfile = await prisma.athleteProfile.create({ data: {} });
    createdAthleteProfileIds.push(athleteProfile.id);

    expect(athleteProfile.userId).toBeNull();
  });

  // ---------------------------------------------------------------------
  // 3. Vínculo CoachAthleteRelationship
  // ---------------------------------------------------------------------
  it("vincula treinador e atleta via CoachAthleteRelationship", async () => {
    const { trainerProfile, organization } = await createTrainerWithPersonalOrg("coach");
    const athleteProfile = await prisma.athleteProfile.create({ data: {} });
    createdAthleteProfileIds.push(athleteProfile.id);

    const relationship = await prisma.coachAthleteRelationship.create({
      data: {
        organizationId: organization.id,
        trainerId: trainerProfile.id,
        athleteId: athleteProfile.id,
      },
    });

    expect(relationship.isActive).toBe(true);

    const found = await prisma.coachAthleteRelationship.findUnique({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: organization.id,
          trainerId: trainerProfile.id,
          athleteId: athleteProfile.id,
        },
      },
    });
    expect(found).not.toBeNull();
  });

  // ---------------------------------------------------------------------
  // 4. Bloqueio de e-mail duplicado sem distinção de caixa
  //    (uq_user_email_lowercase — índice nativo do §13, não conhecido
  //    pelo @unique case-sensitive do Prisma).
  // ---------------------------------------------------------------------
  it("rejeita e-mails duplicados que só diferem em maiúsculas/minúsculas", async () => {
    const base = `casesensitive+${randomUUID()}@integration-test.enky.local`;
    const first = await prisma.user.create({ data: { email: base, name: "Case A" } });
    createdUserIds.push(first.id);

    await expect(
      prisma.user.create({ data: { email: base.toUpperCase(), name: "Case B" } }),
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------
  // 5. Isolamento entre organizações
  // ---------------------------------------------------------------------
  it("isola dados operacionais entre organizações diferentes", async () => {
    const orgA = await createTrainerWithPersonalOrg("isoA");
    const orgB = await createTrainerWithPersonalOrg("isoB");
    const athleteA = await prisma.athleteProfile.create({ data: {} });
    createdAthleteProfileIds.push(athleteA.id);

    const workoutA = await prisma.workout.create({
      data: {
        organizationId: orgA.organization.id,
        athleteId: athleteA.id,
        trainerId: orgA.trainerProfile.id,
        title: "Treino isolado A",
        modality: "RUNNING",
        plannedDate: new Date("2026-08-01"),
      },
    });
    createdWorkoutIds.push(workoutA.id);

    const workoutsVisibleFromOrgB = await prisma.workout.findMany({
      where: { organizationId: orgB.organization.id },
    });

    expect(workoutsVisibleFromOrgB).toHaveLength(0);

    const workoutsVisibleFromOrgA = await prisma.workout.findMany({
      where: { organizationId: orgA.organization.id },
    });
    expect(workoutsVisibleFromOrgA.map((w) => w.id)).toContain(workoutA.id);
  });

  // ---------------------------------------------------------------------
  // Fixture compartilhado para os cenários 6, 8 e 9 (precisam de um
  // Workout válido para anexar feedback ou testar violações de FK).
  // ---------------------------------------------------------------------
  let fixture: Awaited<ReturnType<typeof createTrainerWithPersonalOrg>>;
  let fixtureAthleteId: string;

  beforeAll(async () => {
    fixture = await createTrainerWithPersonalOrg("fixture");
    const athlete = await prisma.athleteProfile.create({ data: {} });
    createdAthleteProfileIds.push(athlete.id);
    fixtureAthleteId = athlete.id;
  });

  // ---------------------------------------------------------------------
  // 6. Criação de Workout DRAFT
  // ---------------------------------------------------------------------
  it("cria Workout com status DRAFT por padrão", async () => {
    const workout = await prisma.workout.create({
      data: {
        organizationId: fixture.organization.id,
        athleteId: fixtureAthleteId,
        trainerId: fixture.trainerProfile.id,
        title: "Rodagem leve",
        modality: "RUNNING",
        plannedDate: new Date("2026-08-03"),
      },
    });
    createdWorkoutIds.push(workout.id);

    expect(workout.status).toBe("DRAFT");
    expect(workout.source).toBe("MANUAL");
  });

  // ---------------------------------------------------------------------
  // 7. Session: criação com token hash, expiração e revogação — exercita
  //    as funções reais de server/auth/session.ts contra o Postgres real.
  // ---------------------------------------------------------------------
  it("cria, verifica e revoga uma Session opaca contra o banco real", async () => {
    const user = await createTrainerUser("session");

    const { token, expiresAt } = await createSession({ userId: user.id });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const active = await verifySessionByToken(token);
    expect(active).not.toBeNull();
    expect(active?.userId).toBe(user.id);

    await revokeSession(token);
    const afterRevoke = await verifySessionByToken(token);
    expect(afterRevoke).toBeNull();
  });

  // ---------------------------------------------------------------------
  // 8. Constraint de Session-RPE (chk_workload_consistency, §13) —
  //    loadStatus COMPLETE exige sessionRpeLoad não nulo.
  // ---------------------------------------------------------------------
  it("rejeita WorkoutFeedback COMPLETE sem sessionRpeLoad (chk_workload_consistency)", async () => {
    const workout = await prisma.workout.create({
      data: {
        organizationId: fixture.organization.id,
        athleteId: fixtureAthleteId,
        trainerId: fixture.trainerProfile.id,
        title: "Treino para constraint de carga",
        modality: "RUNNING",
        plannedDate: new Date("2026-08-04"),
      },
    });
    createdWorkoutIds.push(workout.id);

    await expect(
      prisma.workoutFeedback.create({
        data: {
          workoutId: workout.id,
          loadStatus: "COMPLETE",
          actualDurationMinutes: 40,
          sessionRpe: 6,
          // sessionRpeLoad omitido de propósito — deve violar chk_workload_consistency.
        },
      }),
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------
  // 9. Impossibilidade de criar treino com relação inválida (FK protegida
  //    pelo banco) — athleteId inexistente.
  // ---------------------------------------------------------------------
  it("rejeita Workout com athleteId que não existe (violação de foreign key)", async () => {
    await expect(
      prisma.workout.create({
        data: {
          organizationId: fixture.organization.id,
          athleteId: randomUUID(), // nunca existiu
          trainerId: fixture.trainerProfile.id,
          title: "Treino inválido",
          modality: "RUNNING",
          plannedDate: new Date("2026-08-05"),
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  // ---------------------------------------------------------------------
  // Limpeza — ordem segura para FKs Restrict: Workout (cascata seus
  // filhos) → Organization (cascata OrganizationMembership,
  // CoachAthleteRelationship, etc. do lado organization) →
  // TrainerProfile/AthleteProfile (agora sem nada os referenciando) → User.
  // ---------------------------------------------------------------------
  afterAll(async () => {
    if (createdWorkoutIds.length > 0) {
      await prisma.workout.deleteMany({ where: { id: { in: createdWorkoutIds } } });
    }
    if (createdOrganizationIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    }
    if (createdTrainerProfileIds.length > 0) {
      await prisma.trainerProfile.deleteMany({ where: { id: { in: createdTrainerProfileIds } } });
    }
    if (createdAthleteProfileIds.length > 0) {
      await prisma.athleteProfile.deleteMany({ where: { id: { in: createdAthleteProfileIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
});
