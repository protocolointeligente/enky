import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { getPublishedProductBySlug, listPublishedProducts } from "@/modules/marketplace-catalog/catalog";
import {
  createSellerProduct,
  ensureSellerProfile,
  getSellerDashboard,
  publishSellerProduct,
  type SellerActor,
} from "@/modules/marketplace-seller/seller-service";
import { uniqueEmail } from "./helpers";

// Etapa 5 fatia B — painel do vendedor, contra o banco real:
//   treinador vira vendedor → cria produto (DRAFT, fora do catálogo) →
//   publica → produto entra no catálogo público; e treinador alheio não publica.

const VALID_PASSWORD = "correcthorse1";
const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

let actor: SellerActor;
let otherActor: SellerActor;

beforeAll(async () => {
  const seller = await registerTrainer({
    name: "Panel Seller",
    email: uniqueEmail("mkt-panel-seller"),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(seller.userId);
  createdOrganizationIds.push(seller.organizationId);
  actor = { organizationId: seller.organizationId, userId: seller.userId };

  const other = await registerTrainer({
    name: "Other Trainer",
    email: uniqueEmail("mkt-panel-other"),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(other.userId);
  createdOrganizationIds.push(other.organizationId);
  otherActor = { organizationId: other.organizationId, userId: other.userId };
});

afterAll(async () => {
  await prisma.marketplaceProduct.deleteMany({
    where: { sellerOrganizationId: { in: createdOrganizationIds } },
  });
  await prisma.marketplaceSellerProfile.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.subscription.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.trainerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("Etapa 5 — painel do vendedor", () => {
  it("perfil de vendedor é idempotente", async () => {
    const first = await ensureSellerProfile(actor, { displayName: "Panel Seller Studio" });
    const second = await ensureSellerProfile(actor, { displayName: "Panel Seller Studio 2" });
    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe("Panel Seller Studio 2"); // atualiza, não duplica
  });

  it("cria rascunho fora do catálogo, publica e então aparece", async () => {
    await ensureSellerProfile(actor, { displayName: "Panel Seller Studio" });

    const product = await createSellerProduct(actor, {
      title: "Base de Força 8 semanas",
      productType: "WORKOUT_TEMPLATE_PACK",
      priceCents: 12900,
      shortDescription: "Oito semanas de força para iniciantes.",
    });
    expect(product.status).toBe("DRAFT");
    expect(product.publishedVersionId).toBeNull();

    // DRAFT não entra no catálogo.
    const beforeCatalog = await listPublishedProducts();
    expect(beforeCatalog.some((p) => p.slug === product.slug)).toBe(false);

    const published = await publishSellerProduct(product.id, actor);
    expect(published.slug).toBe(product.slug);

    // Agora está no catálogo com o preço snapshot.
    const detail = await getPublishedProductBySlug(product.slug);
    expect(detail?.priceCents).toBe(12900);
    expect(detail?.title).toBe("Base de Força 8 semanas");

    const afterCatalog = await listPublishedProducts();
    expect(afterCatalog.some((p) => p.slug === product.slug)).toBe(true);

    const dashboard = await getSellerDashboard(actor);
    expect(dashboard.products.some((p) => p.id === product.id && p.isPublished)).toBe(true);
  });

  it("treinador alheio (com perfil próprio) não publica produto de outro vendedor", async () => {
    await ensureSellerProfile(otherActor, { displayName: "Other Studio" });
    const product = await createSellerProduct(actor, {
      title: "Produto Protegido",
      productType: "TRAINING_PLAN",
      priceCents: 9900,
    });
    // otherActor tem perfil, mas não é dono → rejeita pela checagem de ownership.
    await expect(publishSellerProduct(product.id, otherActor)).rejects.toThrow();
    const still = await prisma.marketplaceProduct.findUniqueOrThrow({ where: { id: product.id } });
    expect(still.status).toBe("DRAFT");
  });
});
