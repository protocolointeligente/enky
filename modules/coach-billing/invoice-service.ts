import { CoachInvoiceStatus } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import {
  computeBillingPeriods,
  computeInvoiceFinalAmount,
  reconcileInvoiceStatus,
} from "./invoice-math";
import type {
  GenerateInvoicesInput,
  ListInvoicesQuery,
  RegisterPaymentInput,
  UpdateInvoiceInput,
} from "./invoice-schemas";

// Mensalidades e pagamentos (§12–14). Cobrança manual (sem gateway nesta etapa).
// A matemática mora em invoice-math (pura, testada); aqui só orquestra I/O,
// transações e auditoria. Tudo escopado por organizationId.

export interface BillingActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Matriz (docs/ENKY_CRM_PERMISSIONS.md): Mensalidades/Pagamentos — MANAGER/FINANCE
// escrevem (OWNER passa sozinho); SUPPORT/VIEWER leem.
export const INVOICE_READ_ROLES = ["MANAGER", "FINANCE", "SUPPORT", "VIEWER"] as const;
export const INVOICE_WRITE_ROLES = ["MANAGER", "FINANCE"] as const;

async function getOwnedInvoice(invoiceId: string, organizationId: string) {
  const invoice = await prisma.coachInvoice.findFirst({ where: { id: invoiceId, organizationId } });
  if (!invoice) throw new NotFoundError("Fatura não encontrada.");
  return invoice;
}

// Geração determinística e IDEMPOTENTE (§14): createMany + skipDuplicates contra
// @@unique([contractId, referencePeriod]) — rodar de novo no mesmo intervalo não
// duplica competência. Só gera para contrato vivo (ACTIVE/OVERDUE).
export async function generateContractInvoices(input: GenerateInvoicesInput, actor: BillingActor) {
  const contract = await prisma.coachClientContract.findFirst({
    where: { id: input.contractId, organizationId: actor.organizationId },
  });
  if (!contract) throw new NotFoundError("Contrato não encontrado.");
  if (contract.status !== "ACTIVE" && contract.status !== "OVERDUE") {
    return { created: 0, skipped: "Contrato não está ativo." as const };
  }

  const anchor = contract.billingStartDate ?? contract.startDate;
  const periods = computeBillingPeriods({
    billingDay: contract.billingDay,
    start: anchor,
    end: contract.endDate,
    from: input.fromDate,
    to: input.toDate,
  });
  if (periods.length === 0) return { created: 0 };

  const amount = Number(contract.finalPrice);
  const data = periods.map((p) => ({
    organizationId: actor.organizationId,
    contractId: contract.id,
    clientId: contract.clientId,
    payerClientId: contract.payerClientId,
    referencePeriod: p.referencePeriod,
    dueDate: p.dueDate,
    amount,
    finalAmount: amount,
    currency: contract.currency,
    status: CoachInvoiceStatus.PENDING,
  }));

  const result = await prisma.$transaction(async (tx) => {
    const res = await tx.coachInvoice.createMany({ data, skipDuplicates: true });
    await recordAuditLog(tx, {
      action: "GENERATE_INVOICES",
      entityName: "CoachClientContract",
      entityId: contract.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      reason: `count=${res.count}`,
    });
    return res;
  });
  return { created: result.count };
}

export async function registerPayment(
  invoiceId: string,
  input: RegisterPaymentInput,
  actor: BillingActor,
) {
  const invoice = await getOwnedInvoice(invoiceId, actor.organizationId);
  if (invoice.status === CoachInvoiceStatus.CANCELLED) {
    throw new BusinessRuleError("Fatura cancelada não recebe pagamento.");
  }
  const paidAt = input.paidAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    await tx.coachPayment.create({
      data: {
        organizationId: actor.organizationId,
        invoiceId,
        amount: input.amount,
        paidAt,
        method: input.method,
        externalReference: input.externalReference ?? null,
        notes: input.notes ?? null,
        createdByUserId: actor.userId,
      },
    });
    // Recalcula o status a partir da SOMA de todas as baixas — nunca do valor
    // de um pagamento isolado (uma fatura tem vários).
    const agg = await tx.coachPayment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
      _max: { paidAt: true },
    });
    const totalPaid = Number(agg._sum.amount ?? 0);
    const rec = reconcileInvoiceStatus({
      finalAmount: Number(invoice.finalAmount),
      totalPaid,
      dueDate: invoice.dueDate,
      now: new Date(),
      cancelled: false,
    });
    const updated = await tx.coachInvoice.update({
      where: { id: invoiceId },
      data: {
        status: rec.status,
        paidAt: rec.fullyPaid ? (agg._max.paidAt ?? paidAt) : null,
        paymentMethod: input.method,
      },
    });
    await recordAuditLog(tx, {
      action: "REGISTER_PAYMENT",
      entityName: "CoachInvoice",
      entityId: invoiceId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
    });
    return updated;
  });
}

export async function updateInvoice(invoiceId: string, input: UpdateInvoiceInput, actor: BillingActor) {
  const invoice = await getOwnedInvoice(invoiceId, actor.organizationId);
  if (invoice.status === CoachInvoiceStatus.CANCELLED) {
    throw new BusinessRuleError("Fatura cancelada não pode ser editada.");
  }
  const discount = input.discount ?? Number(invoice.discount);
  const interest = input.interest ?? Number(invoice.interest);
  const penalty = input.penalty ?? Number(invoice.penalty);
  const finalAmount = computeInvoiceFinalAmount(Number(invoice.amount), discount, interest, penalty);
  const dueDate = input.dueDate ?? invoice.dueDate;

  const changedFields = (["discount", "interest", "penalty", "dueDate"] as const).filter(
    (f) => input[f] !== undefined,
  );

  return prisma.$transaction(async (tx) => {
    const agg = await tx.coachPayment.aggregate({ where: { invoiceId }, _sum: { amount: true }, _max: { paidAt: true } });
    const totalPaid = Number(agg._sum.amount ?? 0);
    const rec = reconcileInvoiceStatus({ finalAmount, totalPaid, dueDate, now: new Date(), cancelled: false });
    const updated = await tx.coachInvoice.update({
      where: { id: invoiceId },
      data: {
        dueDate: input.dueDate,
        discount: input.discount,
        interest: input.interest,
        penalty: input.penalty,
        notes: input.notes,
        finalAmount,
        status: rec.status,
        paidAt: rec.fullyPaid ? (agg._max.paidAt ?? new Date()) : null,
      },
    });
    await recordAuditLog(tx, {
      action: "UPDATE_INVOICE",
      entityName: "CoachInvoice",
      entityId: invoiceId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      changedFields,
    });
    return updated;
  });
}

export async function cancelInvoice(invoiceId: string, actor: BillingActor) {
  const invoice = await getOwnedInvoice(invoiceId, actor.organizationId);
  if (invoice.status === CoachInvoiceStatus.CANCELLED) return invoice; // idempotente

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coachInvoice.update({
      where: { id: invoiceId },
      data: { status: CoachInvoiceStatus.CANCELLED, cancelledAt: new Date() },
    });
    await recordAuditLog(tx, {
      action: "CANCEL_INVOICE",
      entityName: "CoachInvoice",
      entityId: invoiceId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
    });
    return updated;
  });
}

export async function getInvoice(invoiceId: string, actor: BillingActor) {
  const invoice = await prisma.coachInvoice.findFirst({
    where: { id: invoiceId, organizationId: actor.organizationId },
    include: {
      client: { select: { id: true, name: true } },
      payer: { select: { id: true, name: true } },
      contract: { select: { id: true, servicePlan: { select: { name: true } } } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) throw new NotFoundError("Fatura não encontrada.");
  return invoice;
}

export async function listInvoices(filters: ListInvoicesQuery, actor: BillingActor) {
  const take = filters.take ?? 50;
  const where = {
    organizationId: actor.organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.contractId ? { contractId: filters.contractId } : {}),
    ...(filters.payerClientId ? { payerClientId: filters.payerClientId } : {}),
    ...(filters.q ? { client: { name: { contains: filters.q, mode: "insensitive" as const } } } : {}),
  };
  const rows = await prisma.coachInvoice.findMany({
    where,
    orderBy: [{ dueDate: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { client: { select: { id: true, name: true } } },
  });
  const hasMore = rows.length > take;
  const invoices = hasMore ? rows.slice(0, take) : rows;
  return { invoices, nextCursor: hasMore ? invoices[invoices.length - 1]!.id : null };
}
