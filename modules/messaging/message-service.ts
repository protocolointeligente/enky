import type { Role } from "@prisma/client";
import { AuthorizationError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { MessagePageInput } from "./message-schema";

// Serviço de mensagens (§13). Conversa 1:1 por (org, treinador, atleta). O vínculo
// ativo é verificado nas rotas (guards). Sem exclusão — a tabela Message é a
// trilha (append-only). Arquivamento é por lado; enviar reativa a conversa.

export interface ConversationView {
  id: string;
  /** athleteProfileId — presente nas views do treinador (chave para abrir a conversa). */
  athleteProfileId?: string;
  counterpartName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
}

export interface MessageView {
  id: string;
  senderRole: Role;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// Treinador ativo do atleta (a conversa deriva do vínculo). Recusa se não houver.
export async function resolveAthleteTrainer(
  organizationId: string,
  athleteProfileId: string,
): Promise<string> {
  const rel = await prisma.coachAthleteRelationship.findFirst({
    where: { organizationId, athleteId: athleteProfileId, isActive: true },
    select: { trainerId: true },
  });
  if (!rel) throw new AuthorizationError("Sem treinador vinculado para conversar.");
  return rel.trainerId;
}

async function getOrCreateConversation(
  organizationId: string,
  trainerProfileId: string,
  athleteProfileId: string,
) {
  return prisma.conversation.upsert({
    where: {
      organizationId_trainerProfileId_athleteProfileId: {
        organizationId,
        trainerProfileId,
        athleteProfileId,
      },
    },
    update: {},
    create: { organizationId, trainerProfileId, athleteProfileId },
  });
}

async function requireParticipantConversation(
  conversationId: string,
  organizationId: string,
  side: { trainerProfileId?: string; athleteProfileId?: string },
) {
  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, ...side },
  });
  if (!convo) throw new NotFoundError("Conversa não encontrada.");
  return convo;
}

export async function sendMessage(args: {
  organizationId: string;
  trainerProfileId: string;
  athleteProfileId: string;
  senderRole: Role;
  senderUserId: string;
  body: string;
}): Promise<MessageView> {
  const convo = await getOrCreateConversation(
    args.organizationId,
    args.trainerProfileId,
    args.athleteProfileId,
  );
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: convo.id,
        senderUserId: args.senderUserId,
        senderRole: args.senderRole,
        body: args.body,
      },
    });
    // Reativa a conversa nos dois lados (uma mensagem nova ressurge a caixa).
    await tx.conversation.update({
      where: { id: convo.id },
      data: { lastMessageAt: created.createdAt, trainerArchivedAt: null, athleteArchivedAt: null },
    });
    return created;
  });
  return {
    id: message.id,
    senderRole: message.senderRole,
    body: message.body,
    readAt: null,
    createdAt: message.createdAt.toISOString(),
  };
}

// Lista mensagens (mais recentes primeiro) e marca como lidas as recebidas pelo
// viewer. Retorna em ordem cronológica (asc) para a UI.
export async function listMessages(
  conversationId: string,
  organizationId: string,
  viewerRole: Role,
  side: { trainerProfileId?: string; athleteProfileId?: string },
  page: MessagePageInput,
): Promise<{ messages: MessageView[]; hasMore: boolean }> {
  await requireParticipantConversation(conversationId, organizationId, side);

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(page.before ? { createdAt: { lt: new Date(page.before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: page.limit + 1,
  });
  const hasMore = rows.length > page.limit;
  const pageRows = rows.slice(0, page.limit);

  // Marca recebidas (do outro papel) como lidas.
  await prisma.message.updateMany({
    where: { conversationId, senderRole: { not: viewerRole }, readAt: null },
    data: { readAt: new Date() },
  });

  return {
    hasMore,
    messages: pageRows
      .reverse()
      .map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        body: m.body,
        readAt: m.readAt ? m.readAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      })),
  };
}

export async function archiveConversation(
  conversationId: string,
  organizationId: string,
  viewerRole: Role,
  side: { trainerProfileId?: string; athleteProfileId?: string },
): Promise<void> {
  await requireParticipantConversation(conversationId, organizationId, side);
  await prisma.conversation.update({
    where: { id: conversationId },
    data: viewerRole === "TRAINER" ? { trainerArchivedAt: new Date() } : { athleteArchivedAt: new Date() },
  });
}

// Caixa de entrada do treinador: conversas não arquivadas por ele, com prévia e
// contagem de não lidas (mensagens do atleta ainda não lidas).
export async function listTrainerConversations(
  organizationId: string,
  trainerProfileId: string,
): Promise<ConversationView[]> {
  const convos = await prisma.conversation.findMany({
    where: { organizationId, trainerProfileId, trainerArchivedAt: null, lastMessageAt: { not: null } },
    orderBy: { lastMessageAt: "desc" },
    include: {
      athlete: { select: { user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { senderRole: "ATHLETE", readAt: null } } } },
    },
  });
  return convos.map((c) => ({
    id: c.id,
    athleteProfileId: c.athleteProfileId,
    counterpartName: c.athlete.user?.name ?? "Atleta",
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
    lastMessagePreview: c.messages[0]?.body.slice(0, 120) ?? null,
    unread: c._count.messages,
  }));
}

// Conversa de um par visto pelo treinador (counterpart = atleta). Cria on-demand.
export async function getTrainerConversation(
  organizationId: string,
  trainerProfileId: string,
  athleteProfileId: string,
): Promise<ConversationView> {
  const convo = await getOrCreateConversation(organizationId, trainerProfileId, athleteProfileId);
  const [athlete, unread, lastMsg] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { id: athleteProfileId },
      select: { user: { select: { name: true } } },
    }),
    prisma.message.count({ where: { conversationId: convo.id, senderRole: "ATHLETE", readAt: null } }),
    prisma.message.findFirst({ where: { conversationId: convo.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    id: convo.id,
    counterpartName: athlete?.user?.name ?? "Atleta",
    lastMessageAt: convo.lastMessageAt ? convo.lastMessageAt.toISOString() : null,
    lastMessagePreview: lastMsg?.body.slice(0, 120) ?? null,
    unread,
  };
}

// Conversa única do atleta (com seu treinador). Cria on-demand para o atleta
// poder iniciar. Retorna também o id p/ a UI carregar as mensagens.
export async function getAthleteConversation(
  organizationId: string,
  athleteProfileId: string,
  trainerProfileId: string,
): Promise<ConversationView> {
  const convo = await getOrCreateConversation(organizationId, trainerProfileId, athleteProfileId);
  const [trainer, unread, lastMsg] = await Promise.all([
    prisma.trainerProfile.findUnique({
      where: { id: trainerProfileId },
      select: { user: { select: { name: true } } },
    }),
    prisma.message.count({ where: { conversationId: convo.id, senderRole: "TRAINER", readAt: null } }),
    prisma.message.findFirst({ where: { conversationId: convo.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    id: convo.id,
    counterpartName: trainer?.user?.name ?? "Treinador",
    lastMessageAt: convo.lastMessageAt ? convo.lastMessageAt.toISOString() : null,
    lastMessagePreview: lastMsg?.body.slice(0, 120) ?? null,
    unread,
  };
}
