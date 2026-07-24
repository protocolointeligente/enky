import type { NextRequest } from "next/server";
import {
  CATALOG_VERSION,
  querySessions,
} from "@/modules/training-library/session-catalog";
import type { SessionQuery } from "@/modules/training-library/session-catalog-types";
import { MODALITIES } from "@/modules/periodization/periodization-schema";
import { requireAuthenticatedUser, requireGlobalRole } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

const PHASES = ["BASE", "BUILD", "PEAK", "TAPER", "TRANSITION"] as const;
const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const KINDS = ["EASY", "LONG", "QUALITY", "RECOVERY", "STRENGTH"] as const;

function pick<T extends readonly string[]>(
  value: string | null,
  allowed: T,
): T[number] | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

// Biblioteca científica de sessões (Fase 2) — leitura pura de dado de
// referência ESTÁTICO, igual para toda a plataforma (sem escopo de org). Só
// exige papel de treinador. GET, sem CSRF.
export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);

    const sp = request.nextUrl.searchParams;
    const query: SessionQuery = {
      modality: pick(sp.get("modality"), MODALITIES),
      phase: pick(sp.get("phase"), PHASES),
      level: pick(sp.get("level"), LEVELS),
      sessionKind: pick(sp.get("sessionKind"), KINDS),
    };

    return apiSuccess({ version: CATALOG_VERSION, sessions: querySessions(query) });
  } catch (error) {
    return apiError(error);
  }
}
