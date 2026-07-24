import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { createMarketplaceOrder } from "@/modules/marketplace-checkout/checkout-service";
import { SandboxMarketplaceGateway } from "@/modules/marketplace-checkout/gateway";
import { getMarketplaceGateway } from "@/modules/marketplace-checkout/gateway-factory";
import { handleMarketplaceWebhook } from "@/modules/marketplace-checkout/webhook-service";
import { uniqueEmail, uniqueSlug } from "./helpers";

// Etapa 5 fatia B — execução da entrega: comprador TREINADOR recebe uma cópia do
// workout template comprado na própria biblioteca (dono do clone) após o
// pagamento. Comprador atleta puro não clona (coberto pela ausência de trainerProfile).

const VALID_PASSWORD = "correcthorse1";
const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdOrderIds: string[] = [];
let sellerProfileId = "";
let productId = "";
let productSlug = "";
let sourceTemplateId = "";
let buyerTrainerProfileId = "";
let buyer = { userId: "", name: "", email: "" };

beforeAll(async () => {
  const seller = await registerTrainer({
    name: "Deliv Seller",
    email: uniqueEmail("mkt-deliv-seller"),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(seller.userId);
  createdOrganizationIds.push(seller.organizationId);
  const sellerTrainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });

  // Template real do vendedor — é o que será clonado na entrega.
  const template = await prisma.workoutTemplate.create({
    data: {
      organizationId: seller.organizationId,
      trainerId: sellerTrainer.id,
      title: "Template Força Vendido",
      description: "Conteúdo entregável",
      modality: "STRENGTH",
      contentSnapshot: { blocks: [] },
    },
  });
  sourceTemplateId = template.id;

  const sellerProfile = await prisma.marketplaceSellerProfile.create({
    data: {
      organizationId: seller.organizationId,
      userId: seller.userId,
      kind: "TRAINER",
      displayName: "Deliv Seller",
      slug: uniqueSlug("deliv-seller"),
      status: "PUBLISHED",
    },
  });
  sellerProfileId = sellerProfile.id;

  productSlug = uniqueSlug("pack-entrega");
  const product = await prisma.marketplaceProduct.create({
    data: {
      sellerProfileId,
      sellerOrganizationId: seller.organizationId,
      sellerUserId: seller.userId,
      productType: "WORKOUT_TEMPLATE_PACK",
      title: "Pacote com Entrega",
      slug: productSlug,
      price: "50.00",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date(),
    },
  });
  productId = product.id;

  const version = await prisma.marketplaceProductVersion.create({
    data: {
      productId,
      commercialVersion: 1,
      titleSnapshot: product.title,
      priceSnapshot: "50.00",
      contentSnapshot: { workoutTemplateIds: [sourceTemplateId] },
      publishedAt: new Date(),
    },
  });
  await prisma.marketplaceProduct.update({
    where: { id: productId },
    data: { publishedVersionId: version.id },
  });

  // Comprador é TREINADOR (tem biblioteca para receber o clone).
  const email = uniqueEmail("mkt-deliv-buyer");
  const buyerReg = await registerTrainer({ name: "Deliv Buyer", email, password: VALID_PASSWORD });
  createdUserIds.push(buyerReg.userId);
  createdOrganizationIds.push(buyerReg.organizationId);
  buyer = { userId: buyerReg.userId, name: "Deliv Buyer", email };
  const buyerTrainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId: buyerReg.userId } });
  buyerTrainerProfileId = buyerTrainer.id;
});

afterAll(async () => {
  await prisma.marketplaceLedgerEntry.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.marketplacePaymentEvent.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.marketplaceEntitlement.deleteMany({ where: { buyerUserId: { in: createdUserIds } } });
  await prisma.marketplaceOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
  if (productId) await prisma.marketplaceProduct.delete({ where: { id: productId } }).catch(() => {});
  if (sellerProfileId)
    await prisma.marketplaceSellerProfile.delete({ where: { id: sellerProfileId } }).catch(() => {});
  await prisma.workoutTemplate.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.subscription.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.trainerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("Etapa 5 — execução da entrega (comprador treinador)", () => {
  it("clona o template comprado na biblioteca do comprador após o pagamento", async () => {
    const order = await createMarketplaceOrder({
      buyerUserId: buyer.userId,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      productSlug,
      idempotencyKey: randomUUID(),
      method: "PIX",
    });
    createdOrderIds.push(order.orderId);

    // Antes do pagamento: nada clonado.
    const before = await prisma.workoutTemplate.count({ where: { trainerId: buyerTrainerProfileId } });
    expect(before).toBe(0);

    const gateway = getMarketplaceGateway() as SandboxMarketplaceGateway;
    const { rawBody, signature } = gateway.simulateWebhook(order.reference, "PAID");
    expect((await handleMarketplaceWebhook(rawBody, signature)).outcome).toBe("processed");

    // Depois: uma cópia do template na biblioteca do comprador.
    const clones = await prisma.workoutTemplate.findMany({ where: { trainerId: buyerTrainerProfileId } });
    expect(clones).toHaveLength(1);
    expect(clones[0]?.title).toBe("Template Força Vendido");
    expect(clones[0]?.id).not.toBe(sourceTemplateId); // é cópia, não referência

    // O entitlement registra o id entregue.
    const entitlement = await prisma.marketplaceEntitlement.findFirstOrThrow({
      where: { orderId: order.orderId },
    });
    const payload = entitlement.deliveryPayload as { deliveredWorkoutTemplateIds?: string[] };
    expect(payload.deliveredWorkoutTemplateIds).toContain(clones[0]?.id);
  });
});
