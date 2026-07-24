import { NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  AddMembersInput,
  CreateGroupInput,
  ListGroupsQuery,
  UpdateGroupInput,
} from "./group-schemas";

// Grupos/turmas da assessoria (§20). CRUD + composição. Escopado por
// organizationId. Aplicar template / criar treino ou periodização PARA o grupo
// é cross-domínio de treino — fatia futura (o grupo já dá a base de composição).

export interface GroupActor {
  userId: string;
  organizationId: string;
}

// Matriz (docs/ENKY_CRM_PERMISSIONS.md): MANAGER/HEAD_COACH escrevem grupos
// (OWNER passa sozinho); COACH/SUPPORT/VIEWER leem.
export const GROUP_READ_ROLES = ["MANAGER", "HEAD_COACH", "COACH", "ASSISTANT_COACH", "SUPPORT", "VIEWER"] as const;
export const GROUP_WRITE_ROLES = ["MANAGER", "HEAD_COACH"] as const;

async function getOwnedGroup(groupId: string, organizationId: string) {
  const group = await prisma.coachGroup.findFirst({ where: { id: groupId, organizationId } });
  if (!group) throw new NotFoundError("Grupo não encontrado.");
  return group;
}

// Treinador do grupo precisa ser membro da organização.
async function assertCoachInOrg(coachId: string, organizationId: string): Promise<void> {
  const tp = await prisma.trainerProfile.findUnique({ where: { id: coachId }, select: { userId: true } });
  if (!tp) throw new ValidationError("Treinador inválido.");
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: tp.userId, organizationId } },
  });
  if (!membership) throw new ValidationError("Treinador não pertence à organização.");
}

async function assertAthleteInOrg(athleteId: string, organizationId: string): Promise<void> {
  const rel = await prisma.coachAthleteRelationship.findFirst({ where: { athleteId, organizationId } });
  if (!rel) throw new ValidationError("Atleta não pertence à organização.");
}

export async function createGroup(input: CreateGroupInput, actor: GroupActor) {
  if (input.coachId) await assertCoachInOrg(input.coachId, actor.organizationId);
  return prisma.coachGroup.create({
    data: {
      organizationId: actor.organizationId,
      name: input.name,
      description: input.description ?? null,
      modality: input.modality ?? null,
      level: input.level ?? null,
      coachId: input.coachId ?? null,
    },
  });
}

export async function updateGroup(groupId: string, input: UpdateGroupInput, actor: GroupActor) {
  await getOwnedGroup(groupId, actor.organizationId);
  if (input.coachId) await assertCoachInOrg(input.coachId, actor.organizationId);
  return prisma.coachGroup.update({
    where: { id: groupId },
    data: {
      name: input.name,
      description: input.description,
      modality: input.modality,
      level: input.level,
      coachId: input.coachId,
      status: input.status,
    },
  });
}

export async function addMembers(groupId: string, input: AddMembersInput, actor: GroupActor) {
  await getOwnedGroup(groupId, actor.organizationId);
  // Valida cada atleta pertence à org; ignora duplicados (skipDuplicates contra
  // @@unique([groupId, athleteId])) — reidempotente ao reenviar.
  for (const athleteId of input.athleteIds) {
    await assertAthleteInOrg(athleteId, actor.organizationId);
  }
  const result = await prisma.coachGroupMember.createMany({
    data: input.athleteIds.map((athleteId) => ({
      organizationId: actor.organizationId,
      groupId,
      athleteId,
      addedByUserId: actor.userId,
    })),
    skipDuplicates: true,
  });
  return { added: result.count };
}

export async function removeMember(groupId: string, athleteId: string, actor: GroupActor) {
  await getOwnedGroup(groupId, actor.organizationId);
  await prisma.coachGroupMember.deleteMany({
    where: { groupId, athleteId, organizationId: actor.organizationId },
  });
}

export async function getGroup(groupId: string, actor: GroupActor) {
  const group = await prisma.coachGroup.findFirst({
    where: { id: groupId, organizationId: actor.organizationId },
    include: {
      coach: { select: { id: true, user: { select: { name: true } } } },
      members: {
        include: { athlete: { select: { id: true, user: { select: { name: true } } } } },
        orderBy: { addedAt: "asc" },
      },
    },
  });
  if (!group) throw new NotFoundError("Grupo não encontrado.");
  return group;
}

export async function listGroups(filters: ListGroupsQuery, actor: GroupActor) {
  const groups = await prisma.coachGroup.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      coach: { select: { id: true, user: { select: { name: true } } } },
      _count: { select: { members: true } },
    },
  });
  return { groups };
}
