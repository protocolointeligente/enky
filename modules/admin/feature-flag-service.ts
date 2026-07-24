import { recordAuditLog } from "@/domain/audit";
import { AuthorizationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { AdminActor } from "./admin-service";

// Fase 06/08 — feature flags globais. Só SUPERADMIN altera (matriz de permissões
// §3, Interface Architecture v1.4 §9). Ligar/desligar recurso sem deploy é
// exatamente o que um beta controlado precisa: abrir Garmin/marketplace para uma
// organização-canário sem expor a todo mundo.

// Chaves conhecidas — união fechada. Um typo em `isFeatureEnabled("markeplace")`
// vira erro de compilação, e a UI de admin lista só flags que significam algo.
export const FEATURE_FLAGS = {
  marketplace: "Marketplace de planos (venda de método pelo treinador).",
  garmin_integration: "Integração Garmin Connect (além do Strava).",
  file_import: "Importação de arquivo de treino (FIT/TCX/GPX).",
  athlete_groups: "Grupos de atletas / periodização de grupo (Fase 6 assessoria).",
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

function assertSuperadmin(actor: AdminActor): void {
  if (actor.globalRole !== "SUPERADMIN") {
    throw new AuthorizationError("Apenas SUPERADMIN pode alterar feature flags.");
  }
}

// Leitura — segura por padrão: flag ausente/desligada = recurso indisponível.
// Uma organização pode estar na lista de canário mesmo com `enabled` global
// falso (rollout gradual). Chamável de qualquer módulo, sem gate de admin: só
// LER uma flag não é uma ação privilegiada.
export async function isFeatureEnabled(
  key: FeatureFlagKey,
  organizationId?: string,
): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) return false;
  if (flag.enabled) return true;
  return organizationId != null && flag.enabledOrganizationIds.includes(organizationId);
}

export interface FeatureFlagView {
  key: string;
  description: string;
  enabled: boolean;
  enabledOrganizationIds: string[];
  updatedAt: Date | null;
}

// Lista TODAS as flags conhecidas, tenham ou não linha no banco (uma flag nunca
// tocada aparece como desligada, não some da tela). SUPERADMIN.
export async function listFeatureFlags(actor: AdminActor): Promise<FeatureFlagView[]> {
  assertSuperadmin(actor);
  const rows = await prisma.featureFlag.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => {
    const row = byKey.get(key);
    return {
      key,
      description: FEATURE_FLAGS[key],
      enabled: row?.enabled ?? false,
      enabledOrganizationIds: row?.enabledOrganizationIds ?? [],
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export interface SetFeatureFlagInput {
  enabled: boolean;
  enabledOrganizationIds?: string[];
}

export async function setFeatureFlag(
  actor: AdminActor,
  key: FeatureFlagKey,
  input: SetFeatureFlagInput,
): Promise<FeatureFlagView> {
  assertSuperadmin(actor);
  if (!(key in FEATURE_FLAGS)) {
    throw new AuthorizationError("Feature flag desconhecida.");
  }
  const description = FEATURE_FLAGS[key];
  const orgIds = input.enabledOrganizationIds ?? [];

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.featureFlag.upsert({
      where: { key },
      create: {
        key,
        description,
        enabled: input.enabled,
        enabledOrganizationIds: orgIds,
        updatedById: actor.userId,
      },
      update: {
        enabled: input.enabled,
        enabledOrganizationIds: orgIds,
        updatedById: actor.userId,
      },
    });
    await recordAuditLog(tx, {
      action: "ADMIN_SET_FEATURE_FLAG",
      entityName: "FeatureFlag",
      entityId: key,
      userId: actor.userId,
      reason: `enabled=${input.enabled}`,
      changedFields: ["enabled", "enabledOrganizationIds"],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return saved;
  });

  return {
    key: row.key,
    description: row.description,
    enabled: row.enabled,
    enabledOrganizationIds: row.enabledOrganizationIds,
    updatedAt: row.updatedAt,
  };
}
