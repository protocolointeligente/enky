import type { NextRequest } from "next/server";
import { disconnectProvider, getConnection } from "@/modules/integrations/external-connection";
import {
  getActivityProvider,
  isStravaConfigured,
} from "@/modules/integrations/get-activity-provider";
import { listAthleteActivities } from "@/modules/integrations/planned-vs-actual";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, integrationWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Estado da integração do atleta + as atividades já importadas.
//
// `connection` é um ConnectionView — não tem campo de token, por construção do
// tipo (ver external-connection.ts). Um `select` esquecido não consegue vazar
// token por esta rota porque o token nunca chega até aqui.
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const connection = await getConnection(athleteProfileId);
    // As atividades sobrevivem à desconexão (são histórico do atleta, não "dados
    // do Strava" — ver disconnectProvider), então são listadas mesmo sem conexão
    // ativa. `configured` deixa a UI dizer "indisponível nesta instalação" em
    // vez de oferecer um botão que só falharia ao ser clicado.
    const activities = await listAthleteActivities(athleteProfileId);

    return apiSuccess({ configured: isStravaConfigured(), connection, activities });
  } catch (error) {
    return apiError(error);
  }
}

// Desconectar. SEMPRE disponível para o atleta — "atleta pode revogar acesso" é
// uma regra da fase, e ela não pode depender nem do Strava estar no ar nem de
// uma variável de ambiente do servidor.
//
// Por isso o provedor é resolvido de forma tolerante: se a instalação perdeu a
// credencial (ex.: rotação de um segredo vazado), a revogação remota é pulada e
// os tokens são apagados localmente do mesmo jeito — que é o que o atleta pediu.
// Fazer o contrário o prenderia numa integração que ele mandou encerrar.
function optionalProvider() {
  try {
    return getActivityProvider();
  } catch {
    return null;
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(integrationWriteRateLimiter, `strava-disconnect:${identity.userId}`);

    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    await disconnectProvider("STRAVA", optionalProvider(), {
      userId: identity.userId,
      organizationId,
      athleteProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ disconnected: true });
  } catch (error) {
    return apiError(error);
  }
}
