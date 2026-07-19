import { prisma } from "@/infrastructure/database/prisma";

// Busca global da Gestão (§24). Consulta as entidades comerciais por termo,
// escopada por organizationId (tenant isolation), com teto de resultados por
// tipo. Sem dados de saúde — só o comercial.

export interface SearchActor {
  userId: string;
  organizationId: string;
}

// Qualquer membro pode buscar (OWNER passa sozinho). O detalhe de cada recurso
// ainda passa pela permissão da sua própria rota.
export const SEARCH_ROLES = [
  "MANAGER",
  "HEAD_COACH",
  "COACH",
  "ASSISTANT_COACH",
  "FINANCE",
  "SUPPORT",
  "VIEWER",
] as const;

const PER_TYPE = 8;

export async function globalSearch(term: string, actor: SearchActor) {
  const q = term.trim();
  if (q.length < 2) return { leads: [], clients: [], groups: [], trainers: [] };

  const org = actor.organizationId;
  const ci = { contains: q, mode: "insensitive" as const };

  const [leads, clients, groups, members] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId: org, OR: [{ name: ci }, { email: ci }, { phone: { contains: q } }] },
      take: PER_TYPE,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true, email: true },
    }),
    prisma.client.findMany({
      where: {
        organizationId: org,
        OR: [{ name: ci }, { email: ci }, { phone: { contains: q } }, { document: { contains: q } }],
      },
      take: PER_TYPE,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true, email: true },
    }),
    prisma.coachGroup.findMany({
      where: { organizationId: org, name: ci },
      take: PER_TYPE,
      select: { id: true, name: true, status: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: org, user: { OR: [{ name: ci }, { email: ci }] } },
      take: PER_TYPE,
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  return {
    leads,
    clients,
    groups,
    trainers: members.map((m) => ({ userId: m.userId, role: m.role, name: m.user.name, email: m.user.email })),
  };
}
