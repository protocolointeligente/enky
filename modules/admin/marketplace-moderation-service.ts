import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { AdminActor } from "./admin-service";
import {
  reasonRequired,
  transitionTarget,
  type ModerationAction,
  type ProductStatus,
} from "./marketplace-moderation-rules";

// Moderação de produtos (§16.1). Só ADMIN/SUPERADMIN chega aqui (guard na rota +
// admin-actor). Toda ação: valida a transição, muda o status, grava evento de
// histórico E AuditLog. Nada é apagado.

export interface QueueItem {
  id: string;
  title: string;
  slug: string;
  sellerName: string;
  productType: string;
  price: string;
  submittedAt: string;
}

export interface ModerationEventView {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  actorName: string | null;
  createdAt: string;
}

export async function listModerationQueue(): Promise<QueueItem[]> {
  const products = await prisma.marketplaceProduct.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { updatedAt: "asc" },
    include: { sellerProfile: { select: { displayName: true } } },
  });
  return products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    sellerName: p.sellerProfile?.displayName ?? "Vendedor",
    productType: p.productType,
    price: p.price.toString(),
    submittedAt: p.updatedAt.toISOString(),
  }));
}

export async function getProductModerationHistory(productId: string): Promise<ModerationEventView[]> {
  const events = await prisma.productModerationEvent.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
  return events.map((e) => ({
    id: e.id,
    action: e.action,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    reason: e.reason,
    actorName: e.actor?.name ?? null,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function moderateProduct(
  productId: string,
  action: ModerationAction,
  reason: string | undefined,
  actor: AdminActor,
): Promise<{ toStatus: ProductStatus }> {
  const product = await prisma.marketplaceProduct.findUnique({
    where: { id: productId },
    select: { id: true, status: true },
  });
  if (!product) throw new NotFoundError("Produto não encontrado.");

  const from = product.status as ProductStatus;
  const to = transitionTarget(action, from);
  if (!to) throw new ConflictError(`Ação ${action} não é válida para um produto em ${from}.`);
  if (reasonRequired(action) && !reason?.trim()) {
    throw new ValidationError("Justificativa obrigatória para esta ação.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.marketplaceProduct.update({ where: { id: productId }, data: { status: to } });
    await tx.productModerationEvent.create({
      data: {
        productId,
        actorUserId: actor.userId,
        action,
        fromStatus: from,
        toStatus: to,
        reason: reason?.trim() || null,
      },
    });
    await recordAuditLog(tx, {
      action: "MODERATE_PRODUCT",
      entityName: "MarketplaceProduct",
      entityId: productId,
      userId: actor.userId,
      reason: `${action} → ${to}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });

  return { toStatus: to };
}
