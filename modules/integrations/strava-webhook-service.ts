import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/server/observability/logger";
import type { ActivityProvider } from "./activity-provider";
import { ConnectionUnusableError, withFreshAccessToken } from "./external-connection";
import { importActivity } from "./import-activities";

// Webhook do Strava.
//
// A DIFERENÇA ESSENCIAL para o webhook de pagamento (Fase 10), e a razão de
// este arquivo não se parecer com aquele: o Asaas AUTENTICA cada POST com um
// segredo compartilhado no header. O Strava NÃO. Ele não assina o corpo, não
// manda segredo nenhum no evento — o `hub.verify_token` só existe no handshake
// GET que cria a inscrição. Qualquer um que descubra a URL pode POSTar aqui.
//
// A regra da fase diz "webhook deve validar assinatura/verify token". Onde há
// verify token (o GET), ele é validado. Onde o provedor não oferece assinatura
// (o POST), fingir que validamos algo seria pior que inútil — seria uma falsa
// garantia. O desenho abaixo torna a ausência dela IRRELEVANTE:
//
//   1. O evento é tratado como AVISO, nunca como dado. Nada do corpo é
//      gravado — nem nome, nem distância, nem tipo.
//   2. `owner_id` só serve para procurar uma conexão ATIVA nossa. Desconhecido
//      → descartado.
//   3. O dado vem da API do Strava, buscado com o NOSSO token, e a posse é
//      reconferida (import-activities.ts) contra o dono da conexão.
//
// Resultado: o pior que um POST forjado consegue é nos fazer gastar uma
// chamada de API atrás de uma atividade que não existe ou não é daquele
// atleta. Não existe caminho para ele injetar uma linha de dado falso. O rate
// limit da rota cuida do resto (flood).

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export interface HandleWebhookResult {
  outcome: WebhookOutcome;
}

const PROVIDER_LEDGER_NAME = "strava";

function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export async function handleStravaWebhook(
  provider: ActivityProvider,
  rawBody: string,
): Promise<HandleWebhookResult> {
  const event = provider.parseWebhookEvent(rawBody);
  if (!event) return { outcome: "ignored" };

  // Reserva o evento no livro-razão ANTES de processar — a mesma trava de
  // idempotência da Fase 10 (`uq_webhook_provider_event`). O Strava reenvia
  // eventos, e duas entregas simultâneas do mesmo `create` chegariam às duas
  // vias de importação ao mesmo tempo.
  //
  // Diferente do webhook de pagamento, o registro é uma transação SEPARADA do
  // efeito: o efeito aqui envolve uma chamada HTTP ao Strava (buscar a
  // atividade), que pode levar segundos, e mantê-la dentro de uma transação
  // de banco seguraria uma conexão do pool esperando a rede de um terceiro.
  // A troca é consciente: se o processo morrer entre o registro e o efeito, o
  // evento fica marcado como processado sem ter sido — e a importação manual
  // (ou o `update` seguinte) recupera a atividade. Perder uma atividade
  // recuperável é melhor que estourar o pool de conexões.
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: PROVIDER_LEDGER_NAME,
        eventId: event.eventId,
        eventType: event.rawType,
        payloadHash: hashPayload(rawBody),
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logger.info({ eventId: event.eventId }, "webhook do Strava duplicado — ignorado");
      return { outcome: "duplicate" };
    }
    throw error;
  }

  const connection = await prisma.externalConnection.findFirst({
    where: {
      provider: "STRAVA",
      providerAthleteId: event.providerAthleteId,
      status: "ACTIVE",
    },
    select: { id: true, organizationId: true, athleteId: true, providerAthleteId: true },
  });

  if (!connection) {
    // Nem sempre é ataque: o mesmo aplicativo Strava serve preview e produção,
    // e um atleta que revogou continua gerando eventos por um tempo. Nada a
    // fazer — 200 e segue (erro faria o Strava desativar a inscrição inteira,
    // silenciando TODOS os atletas).
    await markIgnored(event.eventId, "conexão ativa não encontrada");
    return { outcome: "ignored" };
  }

  if (event.type === "ACTIVITY_DELETED") {
    // O atleta apagou a atividade no Strava. Apagamos a nossa: manter o
    // "realizado" de um treino que a fonte diz não ter existido faria o
    // treinador comparar o planejado com um fantasma. O treino planejado não é
    // tocado (`onDelete: SetNull` no FK) — ele volta a estar sem realizado.
    const deleted = await prisma.externalActivity.deleteMany({
      where: {
        provider: "STRAVA",
        providerActivityId: event.providerActivityId,
        athleteId: connection.athleteId,
      },
    });
    logger.info(
      { providerActivityId: event.providerActivityId, deleted: deleted.count },
      "atividade removida no Strava — realizado descartado",
    );
    return { outcome: "processed" };
  }

  try {
    const activity = await withFreshAccessToken(provider, connection.id, (accessToken) =>
      provider.getActivity(accessToken, event.providerActivityId),
    );

    // O Strava não conhece essa atividade (apagada entre o evento e a busca —
    // ou o evento era forjado). Nada é gravado: exatamente o comportamento que
    // torna a falta de assinatura no POST inofensiva.
    if (!activity) {
      await markIgnored(event.eventId, "atividade não encontrada no provedor");
      return { outcome: "ignored" };
    }

    await importActivity(
      {
        connectionId: connection.id,
        organizationId: connection.organizationId,
        athleteProfileId: connection.athleteId,
        providerAthleteId: connection.providerAthleteId,
      },
      activity,
    );

    return { outcome: "processed" };
  } catch (error) {
    if (error instanceof ConnectionUnusableError) {
      await markIgnored(event.eventId, "conexão inutilizável");
      return { outcome: "ignored" };
    }
    // O evento fica marcado FAILED na trilha, mas a ROTA ainda responde 200
    // (ver app/api/webhooks/strava/route.ts): um 5xx repetido faz o Strava
    // desativar a inscrição, o que silenciaria a integração de todos os
    // atletas por causa da falha de um.
    await markFailed(event.eventId, error);
    return { outcome: "ignored" };
  }
}

async function markIgnored(eventId: string, reason: string): Promise<void> {
  logger.info({ eventId, reason }, "evento do Strava ignorado");
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: PROVIDER_LEDGER_NAME, eventId } },
    data: { status: "IGNORED", error: reason },
  });
}

async function markFailed(eventId: string, cause: unknown): Promise<void> {
  const message = cause instanceof Error ? cause.message : "erro desconhecido";
  logger.error({ eventId, err: cause }, "falha ao processar evento do Strava");
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: PROVIDER_LEDGER_NAME, eventId } },
    data: { status: "FAILED", error: message.slice(0, 500) },
  });
}
