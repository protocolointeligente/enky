import type {
  MarketplaceProductStatus,
  MarketplaceVisibility,
  MarketplaceSellerStatus,
} from "@prisma/client";
import { getPublicBaseUrl } from "@/lib/env";

// SEO das páginas públicas do marketplace (§37). Puro dado o baseUrl (default
// resolve do ambiente via getPublicBaseUrl). Regra dura: só produto PUBLISHED +
// PUBLIC (e vendedor PUBLISHED) é indexável e entra no sitemap — rascunho,
// unlisted e private ficam com noindex e fora do sitemap.

const MAX_DESCRIPTION = 160;

export interface SeoMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: "index,follow" | "noindex,nofollow";
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    image?: string;
  };
}

export interface ProductSeoInput {
  slug: string;
  title: string;
  shortDescription?: string | null;
  status: MarketplaceProductStatus;
  visibility: MarketplaceVisibility;
  thumbnailUrl?: string | null;
}

export interface SellerSeoInput {
  slug: string;
  displayName: string;
  headline?: string | null;
  status: MarketplaceSellerStatus;
  profileImageUrl?: string | null;
}

function truncate(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function isProductIndexable(product: Pick<ProductSeoInput, "status" | "visibility">): boolean {
  return product.status === "PUBLISHED" && product.visibility === "PUBLIC";
}

export function isSellerIndexable(seller: Pick<SellerSeoInput, "status">): boolean {
  return seller.status === "PUBLISHED";
}

export function buildProductSeo(product: ProductSeoInput, baseUrl = getPublicBaseUrl()): SeoMetadata {
  const url = `${baseUrl}/marketplace/produtos/${product.slug}`;
  const description = truncate(product.shortDescription?.trim() || product.title);
  return {
    title: product.title,
    description,
    canonical: url,
    robots: isProductIndexable(product) ? "index,follow" : "noindex,nofollow",
    openGraph: {
      title: product.title,
      description,
      url,
      type: "product",
      image: product.thumbnailUrl ?? undefined,
    },
  };
}

export function buildSellerSeo(seller: SellerSeoInput, baseUrl = getPublicBaseUrl()): SeoMetadata {
  const url = `${baseUrl}/marketplace/treinadores/${seller.slug}`;
  const description = truncate(seller.headline?.trim() || seller.displayName);
  return {
    title: seller.displayName,
    description,
    canonical: url,
    robots: isSellerIndexable(seller) ? "index,follow" : "noindex,nofollow",
    openGraph: {
      title: seller.displayName,
      description,
      url,
      type: "profile",
      image: seller.profileImageUrl ?? undefined,
    },
  };
}
