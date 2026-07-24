import type { NextRequest } from "next/server";
import { z } from "zod";
import { removeSubscription, saveSubscription } from "@/modules/push/push-service";
import { requireAuthenticatedUser } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});
const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    const sub = await parseJsonBody(request, subscribeSchema);
    await saveSubscription(identity.userId, sub, request.headers.get("user-agent") ?? undefined);
    return apiSuccess({ subscribed: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    const { endpoint } = await parseJsonBody(request, unsubscribeSchema);
    await removeSubscription(identity.userId, endpoint);
    return apiSuccess({ unsubscribed: true });
  } catch (error) {
    return apiError(error);
  }
}
