import { getCurrentSession } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getCurrentSession();
    return apiSuccess({ authenticated: identity !== null, user: identity });
  } catch (error) {
    return apiError(error);
  }
}
