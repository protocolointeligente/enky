import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import {
  getProductModerationHistory,
  moderateProduct,
} from "@/modules/admin/marketplace-moderation-service";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";

export const dynamic = "force-dynamic";

const moderateSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "SUSPEND", "REINSTATE", "ARCHIVE"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminActor(_request);
    const { id } = await params;
    const history = await getProductModerationHistory(id);
    return apiSuccess({ history });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const actor = await requireAdminActor(request);
    const { id } = await params;
    const { action, reason } = await parseJsonBody(request, moderateSchema);
    const result = await moderateProduct(id, action, reason, actor);
    return apiSuccess({ status: result.toStatus });
  } catch (error) {
    return apiError(error);
  }
}
