import type { MarketplaceProductType, MarketplaceDeliveryType } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

// Leitura do catálogo público (§8/§37). Só produto PUBLISHED + PUBLIC com uma
// versão publicada aparece — o preço exibido é SEMPRE o priceSnapshot da versão
// publicada (nunca o `price` em edição). Ids sem conteúdo sensível: view models.

// Decimal(12,2) do Prisma → centavos inteiros, a moeda do resto do domínio.
function toCents(dec: unknown): number {
  return Math.round(Number(dec) * 100);
}

export interface CatalogProductCard {
  slug: string;
  title: string;
  shortDescription: string | null;
  productType: MarketplaceProductType;
  priceCents: number;
  currency: string;
  thumbnailUrl: string | null;
  sellerName: string;
  averageRating: number;
  reviewCount: number;
}

export interface CatalogProductDetail extends CatalogProductCard {
  fullDescription: string | null;
  deliveryType: MarketplaceDeliveryType;
  coverImageUrl: string | null;
  modality: string | null;
  level: string | null;
  durationWeeks: number | null;
  sessionsPerWeek: number | null;
  sellerSlug: string;
  /** Id da versão publicada — o checkout compra exatamente esta versão. */
  publishedVersionId: string;
  status: "PUBLISHED";
  visibility: "PUBLIC";
}

const PUBLISHED_WHERE = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
  publishedVersionId: { not: null },
} as const;

export async function listPublishedProducts(): Promise<CatalogProductCard[]> {
  const products = await prisma.marketplaceProduct.findMany({
    where: PUBLISHED_WHERE,
    orderBy: [{ isFeatured: "desc" }, { salesCount: "desc" }, { publishedAt: "desc" }],
    include: {
      publishedVersion: { select: { priceSnapshot: true, currency: true } },
      sellerProfile: { select: { displayName: true } },
    },
  });

  return products
    .filter((p) => p.publishedVersion)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      shortDescription: p.shortDescription,
      productType: p.productType,
      priceCents: toCents(p.publishedVersion!.priceSnapshot),
      currency: p.publishedVersion!.currency,
      thumbnailUrl: p.thumbnailUrl,
      sellerName: p.sellerProfile.displayName,
      averageRating: Number(p.averageRating),
      reviewCount: p.reviewCount,
    }));
}

export async function getPublishedProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
  const p = await prisma.marketplaceProduct.findFirst({
    where: { slug, ...PUBLISHED_WHERE },
    include: {
      publishedVersion: { select: { id: true, priceSnapshot: true, currency: true } },
      sellerProfile: { select: { displayName: true, slug: true } },
    },
  });
  if (!p || !p.publishedVersion) return null;

  return {
    slug: p.slug,
    title: p.title,
    shortDescription: p.shortDescription,
    fullDescription: p.fullDescription,
    productType: p.productType,
    deliveryType: p.deliveryType,
    priceCents: toCents(p.publishedVersion.priceSnapshot),
    currency: p.publishedVersion.currency,
    thumbnailUrl: p.thumbnailUrl,
    coverImageUrl: p.coverImageUrl,
    modality: p.modality,
    level: p.level,
    durationWeeks: p.durationWeeks,
    sessionsPerWeek: p.sessionsPerWeek,
    sellerName: p.sellerProfile.displayName,
    sellerSlug: p.sellerProfile.slug,
    averageRating: Number(p.averageRating),
    reviewCount: p.reviewCount,
    publishedVersionId: p.publishedVersion.id,
    status: "PUBLISHED",
    visibility: "PUBLIC",
  };
}
