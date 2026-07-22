import { randomUUID } from "node:crypto";
import type { MarketplaceProductStatus, MarketplaceProductType, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { BusinessRuleError, NotFoundError } from "@/domain/errors";
import type { CreateProductBody, EnsureSellerProfileBody } from "./seller-schema";

// Painel do vendedor (§8/§18): o treinador vira vendedor, cadastra e publica
// produtos. Publicar cria uma versão comercial imutável (priceSnapshot +
// contentSnapshot) e é o que faz o produto aparecer no catálogo público.
// Moderação (PENDING_REVIEW) é fatia B — aqui o vendedor publica direto.

export interface SellerActor {
  organizationId: string;
  userId: string;
}

function slugify(text: string): string {
  // Remove acentos por codepoint (combining marks U+0300–U+036F) — sem regex de
  // caractere invisível no source.
  const noAccents = Array.from(text.normalize("NFD"))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Slug único global: base do texto + sufixo curto. Colisão de slug é improvável,
// mas o sufixo a torna impossível sem um retry-loop.
function uniqueSlug(text: string): string {
  const base = slugify(text) || "item";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
function toCents(dec: Prisma.Decimal | number): number {
  return Math.round(Number(dec) * 100);
}

// Perfil de vendedor do treinador na org. Idempotente: se já existe, atualiza os
// campos editáveis; senão cria PUBLISHED (self-serve, sem moderação neste MVP).
export async function ensureSellerProfile(actor: SellerActor, input: EnsureSellerProfileBody) {
  const existing = await prisma.marketplaceSellerProfile.findFirst({
    where: { organizationId: actor.organizationId, userId: actor.userId },
  });
  if (existing) {
    return prisma.marketplaceSellerProfile.update({
      where: { id: existing.id },
      data: { displayName: input.displayName, headline: input.headline, bio: input.bio },
    });
  }
  return prisma.marketplaceSellerProfile.create({
    data: {
      organizationId: actor.organizationId,
      userId: actor.userId,
      kind: "TRAINER",
      displayName: input.displayName,
      slug: uniqueSlug(input.displayName),
      headline: input.headline,
      bio: input.bio,
      status: "PUBLISHED",
    },
  });
}

async function requireSellerProfile(actor: SellerActor) {
  const profile = await prisma.marketplaceSellerProfile.findFirst({
    where: { organizationId: actor.organizationId, userId: actor.userId },
  });
  if (!profile) throw new NotFoundError("Crie seu perfil de vendedor primeiro.");
  return profile;
}

export interface SellerDashboard {
  profile: { id: string; displayName: string; slug: string; headline: string | null } | null;
  products: {
    id: string;
    title: string;
    slug: string;
    productType: MarketplaceProductType;
    status: MarketplaceProductStatus;
    priceCents: number;
    isPublished: boolean;
    salesCount: number;
  }[];
}

export async function getSellerDashboard(actor: SellerActor): Promise<SellerDashboard> {
  const profile = await prisma.marketplaceSellerProfile.findFirst({
    where: { organizationId: actor.organizationId, userId: actor.userId },
  });
  if (!profile) return { profile: null, products: [] };

  const products = await prisma.marketplaceProduct.findMany({
    where: { sellerProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  return {
    profile: { id: profile.id, displayName: profile.displayName, slug: profile.slug, headline: profile.headline },
    products: products.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      productType: p.productType,
      status: p.status,
      priceCents: toCents(p.price),
      isPublished: p.status === "PUBLISHED" && p.publishedVersionId !== null,
      salesCount: p.salesCount,
    })),
  };
}

export async function createSellerProduct(actor: SellerActor, input: CreateProductBody) {
  const profile = await requireSellerProfile(actor);

  const contentSnapshot: Prisma.InputJsonValue =
    input.workoutTemplateIds && input.workoutTemplateIds.length > 0
      ? { workoutTemplateIds: input.workoutTemplateIds }
      : {};

  const product = await prisma.marketplaceProduct.create({
    data: {
      sellerProfileId: profile.id,
      sellerOrganizationId: actor.organizationId,
      sellerUserId: actor.userId,
      productType: input.productType,
      title: input.title,
      slug: uniqueSlug(input.title),
      shortDescription: input.shortDescription,
      fullDescription: input.fullDescription,
      price: centsToDecimal(input.priceCents),
      status: "DRAFT",
      // Guarda o conteúdo em edição na versão de trabalho, congelado no publish.
      versions: {
        create: {
          commercialVersion: 1,
          titleSnapshot: input.title,
          priceSnapshot: centsToDecimal(input.priceCents),
          contentSnapshot,
        },
      },
    },
  });
  return product;
}

// Publica: encontra (ou cria) a versão da `commercialVersion` atual, congela
// preço/conteúdo/título com base no estado corrente do produto e aponta
// publishedVersionId. Idempotente por versão (unique productId+commercialVersion).
export async function publishSellerProduct(productId: string, actor: SellerActor) {
  const profile = await requireSellerProfile(actor);
  const product = await prisma.marketplaceProduct.findUnique({
    where: { id: productId },
    include: { versions: { orderBy: { commercialVersion: "desc" }, take: 1 } },
  });
  if (!product || product.sellerProfileId !== profile.id) {
    throw new NotFoundError("Produto não encontrado.");
  }
  const draftVersion = product.versions[0];
  if (!draftVersion) {
    throw new BusinessRuleError("Produto sem versão para publicar.");
  }

  const now = new Date();
  const published = await prisma.marketplaceProductVersion.update({
    where: { id: draftVersion.id },
    data: {
      titleSnapshot: product.title,
      priceSnapshot: product.price,
      publishedAt: now,
    },
  });

  await prisma.marketplaceProduct.update({
    where: { id: product.id },
    data: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedVersionId: published.id,
      publishedAt: now,
    },
  });

  return { productId: product.id, slug: product.slug, publishedVersionId: published.id };
}
