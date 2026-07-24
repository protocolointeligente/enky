import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from "./client-schemas";

// Cliente = registro comercial da assessoria (§8), separado de Atleta e Pagador.
// Tudo escopado por `organizationId` (tenant isolation): cliente de outra
// organização é NotFound. O vínculo cliente↔atleta↔pagador é do Contrato (§10),
// não daqui — por isso não há athleteProfileId neste serviço.

export interface ClientActor {
  userId: string;
  organizationId: string;
}

// Matriz de permissões (docs/ENKY_CRM_PERMISSIONS.md). OWNER passa sozinho.
// COACH/ASSISTANT_COACH ficam de fora da leitura por ora: sem o vínculo
// cliente↔atleta (§10) não há como escopar a carteira deles, e expor a base
// comercial inteira seria vazamento. Entram quando o contrato existir.
export const CLIENT_READ_ROLES = ["MANAGER", "HEAD_COACH", "FINANCE", "SUPPORT", "VIEWER"] as const;
export const CLIENT_WRITE_ROLES = ["MANAGER", "SUPPORT"] as const;

async function getOwnedClient(clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  return client;
}

export async function createClient(input: CreateClientInput, actor: ClientActor) {
  return prisma.client.create({
    data: {
      organizationId: actor.organizationId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      document: input.document ?? null,
      birthDate: input.birthDate ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
  });
}

export async function updateClient(clientId: string, input: UpdateClientInput, actor: ClientActor) {
  await getOwnedClient(clientId, actor.organizationId);
  // undefined = não altera; null = limpa. `status` é campo comum aqui (sem
  // efeito colateral de timestamp como no Lead), então entra no mesmo PATCH.
  return prisma.client.update({
    where: { id: clientId },
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      document: input.document,
      birthDate: input.birthDate,
      status: input.status,
      notes: input.notes,
    },
  });
}

export async function getClient(clientId: string, actor: ClientActor) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: actor.organizationId },
    include: { sourceLead: { select: { id: true, name: true } } },
  });
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  return client;
}

export async function listClients(filters: ListClientsQuery, actor: ClientActor) {
  const take = filters.take ?? 50;
  const where = {
    organizationId: actor.organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { email: { contains: filters.q, mode: "insensitive" as const } },
            { phone: { contains: filters.q } },
            { document: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.client.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const clients = hasMore ? rows.slice(0, take) : rows;
  return { clients, nextCursor: hasMore ? clients[clients.length - 1]!.id : null };
}
