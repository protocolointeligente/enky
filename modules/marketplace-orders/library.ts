import type { MarketplaceEntitlementStatus, MarketplaceProductType } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

// Biblioteca do comprador (§8): o que ele adquiriu e pode acessar. Lista os
// entitlements ativos/pendentes do usuário, com o título comprado (snapshot do
// item) e o slug do produto quando ainda existe.

export interface LibraryItem {
  entitlementId: string;
  title: string;
  productSlug: string | null;
  entitlementType: MarketplaceProductType;
  status: MarketplaceEntitlementStatus;
  purchasedAt: string;
}

export async function listBuyerLibrary(buyerUserId: string): Promise<LibraryItem[]> {
  const entitlements = await prisma.marketplaceEntitlement.findMany({
    where: { buyerUserId, status: { in: ["ACTIVE", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    include: {
      orderItem: { select: { title: true } },
      product: { select: { slug: true } },
    },
  });

  return entitlements.map((e) => ({
    entitlementId: e.id,
    title: e.orderItem?.title ?? "Produto",
    productSlug: e.product?.slug ?? null,
    entitlementType: e.entitlementType,
    status: e.status,
    purchasedAt: e.createdAt.toISOString(),
  }));
}
