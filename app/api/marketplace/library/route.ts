import { listBuyerLibrary } from "@/modules/marketplace-orders/library";
import { requireAuthenticatedUser } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Biblioteca do comprador: entitlements do usuário autenticado (qualquer papel).
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    const items = await listBuyerLibrary(identity.userId);
    return apiSuccess({ items });
  } catch (error) {
    return apiError(error);
  }
}
