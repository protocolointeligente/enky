import { Prisma, type ExternalConnection, type ExternalProvider } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/server/observability/logger";
import { decryptSecret, DecryptionError, encryptSecret } from "@/server/security/crypto";
import { ProviderAuthorizationError, type ActivityProvider, type OAuthTokens } from "./activity-provider";

// Ciclo de vida da conexão externa do atleta: conectar, manter o token vivo,
// desconectar.
//
// REGRA CENTRAL DO MÓDULO: token não sai daqui. Nenhuma outra camada lê
// `accessToken`/`refreshToken` — quem precisa falar com o provedor chama
// `withFreshAccessToken`, que entrega o token já renovado para um callback e
// não o devolve. Isso não é cerimônia: é o que impede um token de virar campo
// de resposta de API por um `select` esquecido, ou de aparecer num log por
// alguém logar o objeto da conexão inteiro.

export interface ConnectionContext {
  userId: string;
  organizationId: string;
  athleteProfileId: string;
  ipAddress?: string;
  userAgent?: string;
}

// A conexão como o resto do sistema pode vê-la. Repare no que NÃO existe aqui:
// nenhum campo de token. É este o tipo que chega às rotas e à UI.
export interface ConnectionView {
  id: string;
  provider: "STRAVA";
  status: "ACTIVE" | "REVOKED";
  connectedAt: string;
  lastSyncedAt: string | null;
  scope: string | null;
}

export function toConnectionView(connection: ExternalConnection): ConnectionView {
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    connectedAt: connection.connectedAt.toISOString(),
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    scope: connection.scope,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Conecta (ou RECONECTA) o atleta ao provedor.
//
// Upsert e não create: reconectar depois de revogar tem de reaproveitar a
// linha — `uq_external_connection_athlete_provider` garante uma conexão por
// atleta/provedor, e acumular linhas mortas só criaria ambiguidade sobre qual
// vale.
export async function connectProvider(
  provider: ActivityProvider,
  tokens: OAuthTokens,
  context: ConnectionContext,
): Promise<ConnectionView> {
  const encrypted = {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken: encryptSecret(tokens.refreshToken),
    tokenExpiresAt: tokens.expiresAt,
    scope: tokens.scope,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const connection = await tx.externalConnection.upsert({
        where: {
          athleteId_provider: {
            athleteId: context.athleteProfileId,
            provider: provider.providerEnum,
          },
        },
        create: {
          organizationId: context.organizationId,
          athleteId: context.athleteProfileId,
          provider: provider.providerEnum,
          providerAthleteId: tokens.providerAthleteId,
          status: "ACTIVE",
          connectedAt: new Date(),
          ...encrypted,
        },
        update: {
          // A organização é reafirmada: o atleta pode ter trocado de treinador
          // entre a revogação e a reconexão.
          organizationId: context.organizationId,
          providerAthleteId: tokens.providerAthleteId,
          status: "ACTIVE",
          connectedAt: new Date(),
          revokedAt: null,
          ...encrypted,
        },
      });

      await recordAuditLog(tx, {
        action: "CONNECT_EXTERNAL_PROVIDER",
        entityName: "ExternalConnection",
        entityId: connection.id,
        userId: context.userId,
        organizationId: context.organizationId,
        // `providerAthleteId` é um id público do Strava, não segredo. O token
        // NUNCA entra aqui — `recordAuditLog` não redige nada, quem escolhe o
        // que é seguro passar é o chamador (ver domain/audit.ts).
        reason: `provedor=${provider.name} atletaProvedor=${tokens.providerAthleteId}`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return toConnectionView(connection);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Colidiu em `uq_active_external_connection_provider_athlete`: esta conta
      // do provedor já está ACTIVE em OUTRO atleta. Recusar é o certo — se
      // permitíssemos, um evento de webhook com aquele `owner_id` resolveria
      // para dois atletas e a atividade seria atribuída a um deles de forma
      // não-determinística.
      throw new ConflictError(
        "Esta conta do Strava já está conectada a outro atleta. Desconecte-a lá primeiro.",
      );
    }
    throw error;
  }
}

export async function getConnection(
  athleteProfileId: string,
  provider: "STRAVA" = "STRAVA",
): Promise<ConnectionView | null> {
  const connection = await prisma.externalConnection.findUnique({
    where: { athleteId_provider: { athleteId: athleteProfileId, provider } },
  });
  if (!connection || connection.status !== "ACTIVE") return null;
  return toConnectionView(connection);
}

// Desconecta: revoga no provedor E apaga os tokens localmente.
//
// A ORDEM importa e a assimetria é deliberada. Revogar no provedor é
// best-effort — se o Strava estiver fora do ar, ou o atleta já tiver revogado
// por lá, a chamada falha. Isso NÃO pode impedir a desconexão local: o atleta
// clicou em "desconectar" e o resultado que ele pediu — a ENKY não ter mais
// acesso — é garantido pelo apagamento local, que sempre acontece. Falhar a
// desconexão porque um terceiro está indisponível deixaria o atleta preso a
// uma integração que ele revogou. Regra da fase: "atleta pode revogar acesso".
//
// `provider` é NULO quando a instalação não tem mais credencial configurada
// (ex.: o operador tirou o STRAVA_CLIENT_SECRET do ar para rotacionar um
// segredo vazado). Pelo mesmo princípio: revogar é direito do atleta e não
// pode depender de uma variável de ambiente do servidor. Sem provedor,
// pulamos a revogação remota e apagamos os tokens do mesmo jeito.
//
// As atividades JÁ IMPORTADAS permanecem. São o histórico de treino do atleta,
// já confrontadas com o planejado e possivelmente citadas em relatórios — não
// são "dados do Strava", são o registro do que ele fez. Apagá-las aqui seria
// destruição silenciosa de dado clínico por um clique cujo texto diz apenas
// "desconectar".
export async function disconnectProvider(
  providerEnum: ExternalProvider,
  provider: ActivityProvider | null,
  context: ConnectionContext,
): Promise<void> {
  const connection = await prisma.externalConnection.findUnique({
    where: {
      athleteId_provider: { athleteId: context.athleteProfileId, provider: providerEnum },
    },
  });

  if (!connection || connection.status !== "ACTIVE") {
    throw new NotFoundError("Nenhuma conexão ativa com este provedor.");
  }

  if (provider && connection.accessToken) {
    try {
      await provider.deauthorize(decryptSecret(connection.accessToken));
    } catch (error) {
      // Best-effort, e é por isso que só logamos: o apagamento abaixo é o que
      // o atleta pediu, e ele acontece. (`err` carrega a exceção do provedor,
      // nunca o token — o `decryptSecret` acima não aparece em log nenhum.)
      logger.warn(
        { connectionId: connection.id, err: error },
        "revogação no provedor falhou — conexão local será apagada mesmo assim",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.externalConnection.update({
      where: { id: connection.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        // Os tokens somem do banco. Guardá-los "por via das dúvidas" numa
        // conexão revogada seria guardar credencial viva de um acesso que o
        // atleta acabou de retirar.
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    });

    await recordAuditLog(tx, {
      action: "DISCONNECT_EXTERNAL_PROVIDER",
      entityName: "ExternalConnection",
      entityId: connection.id,
      userId: context.userId,
      organizationId: connection.organizationId,
      reason: `provedor=${providerEnum}`,
      changedFields: ["status", "accessToken", "refreshToken"],
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  });
}

// Margem de renovação: um token que vence em menos de 5 minutos é renovado
// antes do uso. Sem ela, uma chamada iniciada com token "ainda válido por 3s"
// chegaria no Strava expirada.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export class ConnectionUnusableError extends Error {}

// O ÚNICO caminho para usar o token de uma conexão.
//
// Renova quando está perto de vencer, GRAVA o par renovado (o Strava rotaciona
// o refresh token — guardar só o access quebraria a conexão na renovação
// seguinte) e entrega o access token ao callback. O token não é retornado:
// sai do módulo apenas dentro do escopo de quem precisa dele.
//
// `ConnectionUnusableError` é lançado quando a conexão não tem mais como ser
// usada — token indecifrável (AUTH_SECRET rotacionado) ou autorização revogada
// pelo atleta no site do provedor. Nos dois casos a conexão é marcada REVOKED:
// deixá-la ACTIVE faria toda importação futura falhar do mesmo jeito, só que
// mostrando ao atleta uma integração "conectada" que não funciona.
export async function withFreshAccessToken<T>(
  provider: ActivityProvider,
  connectionId: string,
  run: (accessToken: string) => Promise<T>,
): Promise<T> {
  const connection = await prisma.externalConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.status !== "ACTIVE" || !connection.refreshToken) {
    throw new ConnectionUnusableError("Conexão inexistente ou revogada.");
  }

  let accessToken: string;
  try {
    const expiresSoon =
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

    if (!expiresSoon && connection.accessToken) {
      accessToken = decryptSecret(connection.accessToken);
    } else {
      const refreshed = await provider.refreshTokens(decryptSecret(connection.refreshToken));
      await prisma.externalConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encryptSecret(refreshed.accessToken),
          refreshToken: encryptSecret(refreshed.refreshToken),
          tokenExpiresAt: refreshed.expiresAt,
          scope: refreshed.scope ?? connection.scope,
        },
      });
      accessToken = refreshed.accessToken;
    }
  } catch (error) {
    if (error instanceof DecryptionError || error instanceof ProviderAuthorizationError) {
      await markUnusable(connection.id, error);
      throw new ConnectionUnusableError("Conexão com o provedor precisa ser refeita.");
    }
    throw error;
  }

  try {
    return await run(accessToken);
  } catch (error) {
    // O token era válido ao renovar mas o provedor o recusou agora: revogação
    // durante a operação. Mesmo tratamento.
    if (error instanceof ProviderAuthorizationError) {
      await markUnusable(connection.id, error);
      throw new ConnectionUnusableError("Conexão com o provedor precisa ser refeita.");
    }
    throw error;
  }
}

async function markUnusable(connectionId: string, cause: unknown): Promise<void> {
  logger.warn(
    { connectionId, reason: cause instanceof Error ? cause.message : "desconhecido" },
    "conexão externa marcada como revogada — token inutilizável",
  );
  await prisma.externalConnection.update({
    where: { id: connectionId },
    data: { status: "REVOKED", revokedAt: new Date(), accessToken: null, refreshToken: null },
  });
}
