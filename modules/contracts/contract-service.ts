import { ContractStatus, type ContractAcceptanceMethod } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  AcceptContractInput,
  ChangeContractStatusInput,
  CreateContractInput,
  ListContractsQuery,
  UpdateContractInput,
} from "./contract-schemas";

// Contratos assessoria↔cliente (§10–11). Congela o preço do plano na assinatura;
// é a origem do vínculo cliente↔atleta↔pagador. Tudo escopado por organizationId;
// ações sensíveis auditadas (§32).

export interface ContractActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Matriz (docs/ENKY_CRM_PERMISSIONS.md): MANAGER/SUPPORT montam/editam (OWNER
// passa sozinho); HEAD_COACH/FINANCE/VIEWER leem. Nota: "SUPPORT não altera preço
// travado" (§4) é nuance de campo — hoje o freeze pós-aceite já protege o valor;
// restrição fina fica para fatia futura.
export const CONTRACT_READ_ROLES = ["MANAGER", "HEAD_COACH", "FINANCE", "SUPPORT", "VIEWER"] as const;
export const CONTRACT_WRITE_ROLES = ["MANAGER", "SUPPORT"] as const;

const TEMPLATE_CODE = "standard";
const TEMPLATE_VERSION = 1;
// Estados em que o valor ainda pode ser mexido. Depois do aceite/ativação o
// preço está congelado (§10) — editar valor vira erro de regra.
const EDITABLE_PRICE_STATUSES: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.PENDING_SIGNATURE];
// Contratos "vivos" que travam a criação de um duplicado involuntário do mesmo
// par cliente+plano.
const NON_TERMINAL_STATUSES: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_SIGNATURE,
  ContractStatus.ACTIVE,
  ContractStatus.PAUSED,
  ContractStatus.OVERDUE,
];

// finalPrice = price - discount, clampeado a 0, em centavos (evita drift de
// ponto flutuante do dinheiro). Função pura — ponto único do cálculo.
export function computeFinalPrice(price: number, discount: number): number {
  const cents = Math.round(price * 100) - Math.round(discount * 100);
  return Math.max(0, cents) / 100;
}

// Campos de cancelamento derivados do status-alvo, sempre consistentes: só
// CANCELLED carrega cancelledAt/reason; qualquer outro estado os zera.
export function resolveCancellationFields(
  status: ContractStatus,
  reason: string | null | undefined,
  existing: { cancelledAt: Date | null },
  now: Date,
): { cancelledAt: Date | null; cancellationReason: string | null } {
  if (status === ContractStatus.CANCELLED) {
    return { cancelledAt: existing.cancelledAt ?? now, cancellationReason: reason ?? null };
  }
  return { cancelledAt: null, cancellationReason: null };
}

async function getOwnedContract(contractId: string, organizationId: string) {
  const contract = await prisma.coachClientContract.findFirst({
    where: { id: contractId, organizationId },
  });
  if (!contract) throw new NotFoundError("Contrato não encontrado.");
  return contract;
}

async function assertClientInOrg(clientId: string, organizationId: string): Promise<void> {
  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) throw new ValidationError("Cliente não pertence à organização.");
}

async function assertAthleteInOrg(athleteId: string, organizationId: string): Promise<void> {
  const rel = await prisma.coachAthleteRelationship.findFirst({
    where: { athleteId, organizationId },
  });
  if (!rel) throw new ValidationError("Atleta não pertence à organização.");
}

export async function createContract(input: CreateContractInput, actor: ContractActor) {
  const plan = await prisma.coachServicePlan.findFirst({
    where: { id: input.servicePlanId, organizationId: actor.organizationId },
  });
  if (!plan) throw new ValidationError("Plano não pertence à organização.");
  await assertClientInOrg(input.clientId, actor.organizationId);

  const payerClientId = input.payerClientId ?? input.clientId;
  if (payerClientId !== input.clientId) await assertClientInOrg(payerClientId, actor.organizationId);
  if (input.athleteId) await assertAthleteInOrg(input.athleteId, actor.organizationId);

  // Duplicado involuntário: já existe contrato vivo para o mesmo cliente+plano.
  const existing = await prisma.coachClientContract.findFirst({
    where: {
      organizationId: actor.organizationId,
      clientId: input.clientId,
      servicePlanId: input.servicePlanId,
      status: { in: NON_TERMINAL_STATUSES },
    },
  });
  if (existing) {
    throw new ConflictError("Já existe um contrato ativo deste cliente para este plano.");
  }

  const price = input.price ?? Number(plan.price);
  const discount = input.discount ?? 0;
  if (discount > price) throw new ValidationError("Desconto não pode ser maior que o preço.");
  const finalPrice = computeFinalPrice(price, discount);

  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.coachClientContract.create({
      data: {
        organizationId: actor.organizationId,
        clientId: input.clientId,
        athleteId: input.athleteId ?? null,
        servicePlanId: input.servicePlanId,
        payerClientId,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        billingStartDate: input.billingStartDate ?? null,
        billingDay: input.billingDay ?? 1,
        price,
        discount,
        finalPrice,
        currency: input.currency ?? plan.currency,
        autoRenew: input.autoRenew ?? false,
        gracePeriodDays: input.gracePeriodDays ?? 0,
        cancellationNoticeDays: input.cancellationNoticeDays ?? 0,
        templateCode: TEMPLATE_CODE,
        templateVersion: TEMPLATE_VERSION,
      },
    });
    await recordAuditLog(tx, {
      action: "CREATE_CONTRACT",
      entityName: "CoachClientContract",
      entityId: created.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      changedFields: discount > 0 ? ["discount"] : [],
    });
    return created;
  });
  return contract;
}

export async function updateContract(
  contractId: string,
  input: UpdateContractInput,
  actor: ContractActor,
) {
  const contract = await getOwnedContract(contractId, actor.organizationId);

  const changingPrice = input.price !== undefined || input.discount !== undefined;
  if (changingPrice && !EDITABLE_PRICE_STATUSES.includes(contract.status)) {
    throw new BusinessRuleError("Contrato já assinado/ativo — o valor está congelado.");
  }
  if (input.payerClientId) await assertClientInOrg(input.payerClientId, actor.organizationId);
  if (input.athleteId) await assertAthleteInOrg(input.athleteId, actor.organizationId);

  const price = input.price ?? Number(contract.price);
  const discount = input.discount ?? Number(contract.discount);
  if (discount > price) throw new ValidationError("Desconto não pode ser maior que o preço.");
  const finalPrice = computeFinalPrice(price, discount);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coachClientContract.update({
      where: { id: contractId },
      data: {
        athleteId: input.athleteId,
        payerClientId: input.payerClientId,
        startDate: input.startDate,
        endDate: input.endDate,
        billingStartDate: input.billingStartDate,
        billingDay: input.billingDay,
        price: input.price,
        discount: input.discount,
        finalPrice: changingPrice ? finalPrice : undefined,
        currency: input.currency,
        autoRenew: input.autoRenew,
        gracePeriodDays: input.gracePeriodDays,
        cancellationNoticeDays: input.cancellationNoticeDays,
      },
    });
    await recordAuditLog(tx, {
      action: "UPDATE_CONTRACT",
      entityName: "CoachClientContract",
      entityId: contractId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      changedFields: changingPrice ? ["price", "discount"] : [],
    });
    return updated;
  });
}

export async function changeContractStatus(
  contractId: string,
  input: ChangeContractStatusInput,
  actor: ContractActor,
) {
  const contract = await getOwnedContract(contractId, actor.organizationId);
  const fields = resolveCancellationFields(input.status, input.cancellationReason, contract, new Date());
  const isCancel = input.status === ContractStatus.CANCELLED;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coachClientContract.update({
      where: { id: contractId },
      data: { status: input.status, ...fields },
    });
    await recordAuditLog(tx, {
      action: isCancel ? "CANCEL_CONTRACT" : "CHANGE_CONTRACT_STATUS",
      entityName: "CoachClientContract",
      entityId: contractId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      changedFields: ["status"],
    });
    return updated;
  });
}

export async function acceptContract(
  contractId: string,
  input: AcceptContractInput,
  actor: ContractActor,
) {
  const contract = await getOwnedContract(contractId, actor.organizationId);
  if (!EDITABLE_PRICE_STATUSES.includes(contract.status)) {
    throw new ConflictError("Contrato já foi aceito ou não está em estado de aceite.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coachClientContract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.ACTIVE,
        acceptedAt: new Date(),
        acceptedBy: input.acceptedBy,
        acceptanceMethod: (input.method ?? "CHECKBOX") as ContractAcceptanceMethod,
        acceptanceIp: actor.ipAddress ?? null,
        templateCode: contract.templateCode ?? TEMPLATE_CODE,
        templateVersion: contract.templateVersion ?? TEMPLATE_VERSION,
      },
    });
    await recordAuditLog(tx, {
      action: "ACCEPT_CONTRACT",
      entityName: "CoachClientContract",
      entityId: contractId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      reason: `method=${input.method ?? "CHECKBOX"}`,
    });
    return updated;
  });
}

export async function getContract(contractId: string, actor: ContractActor) {
  const contract = await prisma.coachClientContract.findFirst({
    where: { id: contractId, organizationId: actor.organizationId },
    include: {
      client: { select: { id: true, name: true } },
      payer: { select: { id: true, name: true } },
      athlete: { select: { id: true, user: { select: { name: true } } } },
      servicePlan: { select: { id: true, name: true } },
    },
  });
  if (!contract) throw new NotFoundError("Contrato não encontrado.");
  return contract;
}

export async function listContracts(filters: ListContractsQuery, actor: ContractActor) {
  const take = filters.take ?? 50;
  const where = {
    organizationId: actor.organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.q ? { client: { name: { contains: filters.q, mode: "insensitive" as const } } } : {}),
  };
  const rows = await prisma.coachClientContract.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: {
      client: { select: { id: true, name: true } },
      servicePlan: { select: { id: true, name: true } },
    },
  });
  const hasMore = rows.length > take;
  const contracts = hasMore ? rows.slice(0, take) : rows;
  return { contracts, nextCursor: hasMore ? contracts[contracts.length - 1]!.id : null };
}
