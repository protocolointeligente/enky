import { CoachBillingType, type CoachBillingInterval } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { CreatePlanInput, ListPlansQuery, UpdatePlanInput } from "./plan-schemas";

// Planos e serviços da assessoria (§9). O contrato (§10) congela o preço do
// plano no momento da assinatura — por isso editar/desativar um plano aqui
// NUNCA retroage sobre contratos já feitos. Tudo escopado por organizationId.

export interface ServicePlanActor {
  userId: string;
  organizationId: string;
}

// Matriz (docs/ENKY_CRM_PERMISSIONS.md): só MANAGER edita plano comercial
// (OWNER passa sozinho); COACH não vê. FINANCE/SUPPORT/VIEWER leem.
export const PLAN_READ_ROLES = ["MANAGER", "HEAD_COACH", "FINANCE", "SUPPORT", "VIEWER"] as const;
export const PLAN_WRITE_ROLES = ["MANAGER"] as const;

// Invariante do §9: intervalo de cobrança só existe em RECURRING (e é
// obrigatório nele); nos demais tipos é sempre null. Função pura — ponto único
// que impõe a regra em create e update.
export function normalizeBillingInterval(
  type: CoachBillingType,
  interval: CoachBillingInterval | null | undefined,
): CoachBillingInterval | null {
  if (type === CoachBillingType.RECURRING) {
    if (!interval) throw new ValidationError("Plano recorrente exige um intervalo de cobrança.");
    return interval;
  }
  return null;
}

async function getOwnedPlan(planId: string, organizationId: string) {
  const plan = await prisma.coachServicePlan.findFirst({ where: { id: planId, organizationId } });
  if (!plan) throw new NotFoundError("Plano não encontrado.");
  return plan;
}

export async function createPlan(input: CreatePlanInput, actor: ServicePlanActor) {
  const billingType = input.billingType ?? CoachBillingType.RECURRING;
  const billingInterval = normalizeBillingInterval(billingType, input.billingInterval);
  return prisma.coachServicePlan.create({
    data: {
      organizationId: actor.organizationId,
      name: input.name,
      description: input.description ?? null,
      modality: input.modality ?? null,
      billingType,
      price: input.price ?? 0,
      currency: input.currency ?? "BRL",
      billingInterval,
      durationMonths: input.durationMonths ?? null,
      trialDays: input.trialDays ?? 0,
      maxSessionsPerWeek: input.maxSessionsPerWeek ?? null,
      includedAssessments: input.includedAssessments ?? null,
      includedReports: input.includedReports ?? false,
      includedCommunication: input.includedCommunication ?? false,
      includedFeatures: input.includedFeatures ?? [],
      isPublic: input.isPublic ?? false,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updatePlan(planId: string, input: UpdatePlanInput, actor: ServicePlanActor) {
  const plan = await getOwnedPlan(planId, actor.organizationId);
  // Tipo/intervalo efetivos = patch quando presente, senão o valor atual. O
  // intervalo é sempre renormalizado contra o tipo efetivo (troca de tipo pode
  // exigir/zerar o intervalo).
  const billingType = input.billingType ?? plan.billingType;
  const nextInterval = "billingInterval" in input ? input.billingInterval : plan.billingInterval;
  const billingInterval = normalizeBillingInterval(billingType, nextInterval);
  return prisma.coachServicePlan.update({
    where: { id: planId },
    data: {
      name: input.name,
      description: input.description,
      modality: input.modality,
      billingType: input.billingType,
      price: input.price,
      currency: input.currency,
      billingInterval,
      durationMonths: input.durationMonths,
      trialDays: input.trialDays,
      maxSessionsPerWeek: input.maxSessionsPerWeek,
      includedAssessments: input.includedAssessments,
      includedReports: input.includedReports,
      includedCommunication: input.includedCommunication,
      includedFeatures: input.includedFeatures,
      isPublic: input.isPublic,
      isActive: input.isActive,
    },
  });
}

// Duplicar (§9): cópia inativa, para o gestor ajustar antes de publicar.
export async function duplicatePlan(planId: string, actor: ServicePlanActor) {
  const p = await getOwnedPlan(planId, actor.organizationId);
  return prisma.coachServicePlan.create({
    data: {
      organizationId: actor.organizationId,
      name: `${p.name} (cópia)`,
      description: p.description,
      modality: p.modality,
      billingType: p.billingType,
      price: p.price,
      currency: p.currency,
      billingInterval: p.billingInterval,
      durationMonths: p.durationMonths,
      trialDays: p.trialDays,
      maxSessionsPerWeek: p.maxSessionsPerWeek,
      includedAssessments: p.includedAssessments,
      includedReports: p.includedReports,
      includedCommunication: p.includedCommunication,
      includedFeatures: p.includedFeatures,
      isPublic: false,
      isActive: false,
    },
  });
}

export async function getPlan(planId: string, actor: ServicePlanActor) {
  return getOwnedPlan(planId, actor.organizationId);
}

export async function listPlans(filters: ListPlansQuery, actor: ServicePlanActor) {
  // Planos são poucos (dezenas) — lista simples sem cursor. Se um dia escalar,
  // paginar aqui.
  const plans = await prisma.coachServicePlan.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(filters.activeOnly ? { isActive: true } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return { plans };
}
