import type { NextRequest } from "next/server";
import { requireAuthenticatedUser, requireGlobalRole } from "@/server/auth/guards";
import { getClientIp } from "@/server/security/ip";
import type { AdminActor } from "./admin-service";

// Sessão + papel + procedência, num passo só. Toda rota /api/admin/* entra por
// aqui: assim é impossível montar um AdminActor sem antes passar pelo guard de
// papel — o erro clássico de "esqueci o requireGlobalRole nesta rota nova" não
// tem como acontecer, porque não existe caminho alternativo até o actor.
// (O serviço ainda revalida com `assertAdmin`; ver modules/admin/README.md.)
export async function requireAdminActor(request: NextRequest): Promise<AdminActor> {
  const identity = await requireAuthenticatedUser();
  requireGlobalRole(identity, ["ADMIN", "SUPERADMIN"]);

  return {
    userId: identity.userId,
    globalRole: identity.globalRole,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
