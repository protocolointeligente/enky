import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getCycleBatchStatus } from "@/modules/periodization/generate-cycle-async";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

async function trainerActor(userId: string) {
  const { organizationId } = await resolveActiveOrganization(userId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
  return { organizationId, trainerProfileId: trainerProfile.id };
}

// Status do job de geração em segundo plano (Fase 9). Só leitura; escopo
// org+treinador via o próprio batch.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> },
) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { batchId } = await params;

    const status = await getCycleBatchStatus(batchId, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
    });

    return apiSuccess(status);
  } catch (error) {
    return apiError(error);
  }
}
