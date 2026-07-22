import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { SandboxMarketplaceGateway } from "@/modules/marketplace-checkout/gateway";
import { getMarketplaceGateway } from "@/modules/marketplace-checkout/gateway-factory";
import { createMarketplaceOrder } from "@/modules/marketplace-checkout/checkout-service";
import { handleMarketplaceWebhook } from "@/modules/marketplace-checkout/webhook-service";
import { listBuyerLibrary } from "@/modules/marketplace-orders/library";
import { uniqueEmail, uniqueSlug } from "./helpers";

// Etapa 5 — MVP do marketplace, ponta a ponta contra o banco real:
//   comprador cria pedido → webhook do gateway confirma → entrega concede
//   entitlement + lança o ledger → biblioteca lista a compra; e reenvio do
//   webhook é idempotente (não cobra, não entrega, não credita duas vezes).
//
// O gateway é o Sandbox (mesmo segredo/verificação do real). O que se exercita
// aqui é o serviço de webhook de verdade, não um atalho.

const VALID_PASSWORD = "correcthorse1";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdOrderIds: string[] = [];
let sellerProfileId = "";
let productId = "";
let productSlug = "";
let buyer = { userId: "", name: "", email: "" };

beforeAll(async () => {
  // Vendedor: treinador com perfil público publicado.
  const seller = await registerTrainer({
    name: "Seller Coach",
    email: uniqueEmail("mkt-seller"),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(seller.userId);
  createdOrganizationIds.push(seller.organizationId);

  const sellerProfile = await prisma.marketplaceSellerProfile.create({
    data: {
      organizationId: seller.organizationId,
      userId: seller.userId,
      kind: "TRAINER",
      displayName: "Seller Coach",
      slug: uniqueSlug("seller-coach"),
      status: "PUBLISHED",
    },
  });
  sellerProfileId = sellerProfile.id;

  // Produto digital automático PUBLISHED+PUBLIC com versão publicada.
  productSlug = uniqueSlug("pack-forca");
  const product = await prisma.marketplaceProduct.create({
    data: {
      sellerProfileId,
      sellerOrganizationId: seller.organizationId,
      sellerUserId: seller.userId,
      productType: "WORKOUT_TEMPLATE_PACK",
      title: "Pacote Força Total",
      slug: productSlug,
      shortDescription: "12 templates de força prontos.",
      price: "99.90",
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
      priceSnapshot: "99.90",
      contentSnapshot: { workoutTemplateIds: ["tpl_demo_1", "tpl_demo_2"] },
      publishedAt: new Date(),
    },
  });
  await prisma.marketplaceProduct.update({
    where: { id: productId },
    data: { publishedVersionId: version.id },
  });

  // Comprador: qualquer usuário serve.
  const email = uniqueEmail("mkt-buyer");
  const buyerReg = await registerTrainer({ name: "Buyer Person", email, password: VALID_PASSWORD });
  createdUserIds.push(buyerReg.userId);
  createdOrganizationIds.push(buyerReg.organizationId);
  buyer = { userId: buyerReg.userId, name: "Buyer Person", email };
});

afterAll(async () => {
  await prisma.marketplaceLedgerEntry.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.marketplacePaymentEvent.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.marketplaceEntitlement.deleteMany({ where: { buyerUserId: { in: createdUserIds } } });
  await prisma.marketplaceOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
  if (productId) await prisma.marketplaceProduct.delete({ where: { id: productId } }).catch(() => {});
  if (sellerProfileId)
    await prisma.marketplaceSellerProfile.delete({ where: { id: sellerProfileId } }).catch(() => {});

  await prisma.subscription.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.trainerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// Confirma o pagamento como o gateway faria: assina o corpo com o mesmo segredo.
function deliverPaidWebhook(reference: string) {
  const gateway = getMarketplaceGateway() as SandboxMarketplaceGateway;
  const { rawBody, signature } = gateway.simulateWebhook(reference, "PAID");
  return { rawBody, signature };
}

describe("Etapa 5 — compra ponta a ponta no marketplace", () => {
  it("checkout → webhook PAID → entitlement ativo + ledger + biblioteca", async () => {
    const order = await createMarketplaceOrder({
      buyerUserId: buyer.userId,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      productSlug,
      idempotencyKey: randomUUID(),
      method: "PIX",
    });
    createdOrderIds.push(order.orderId);
    expect(order.alreadyExisted).toBe(false);
    expect(order.amountCents).toBe(9990);
    expect(order.reference).toBeTruthy();

    // Antes do pagamento: nada entregue.
    const before = await prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(before.paymentStatus).toBe("PENDING");
    expect(await prisma.marketplaceEntitlement.count({ where: { orderId: order.orderId } })).toBe(0);

    const { rawBody, signature } = deliverPaidWebhook(order.reference);
    const result = await handleMarketplaceWebhook(rawBody, signature);
    expect(result.outcome).toBe("processed");

    const paid = await prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.status).toBe("COMPLETED");
    expect(paid.deliveryStatus).toBe("DELIVERED");

    const entitlements = await prisma.marketplaceEntitlement.findMany({
      where: { orderId: order.orderId },
    });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]?.status).toBe("ACTIVE");
    expect(entitlements[0]?.entitlementType).toBe("WORKOUT_TEMPLATE_PACK");

    // Ledger: crédito SALE + débito PLATFORM_FEE (comissão padrão 15%).
    const ledger = await prisma.marketplaceLedgerEntry.findMany({ where: { orderId: order.orderId } });
    expect(ledger).toHaveLength(2);
    const sale = ledger.find((e) => e.type === "SALE");
    const fee = ledger.find((e) => e.type === "PLATFORM_FEE");
    expect(Number(sale?.amount)).toBeCloseTo(99.9, 2);
    expect(Number(fee?.amount)).toBeCloseTo(-14.99, 2);

    const library = await listBuyerLibrary(buyer.userId);
    expect(library.some((i) => i.title === "Pacote Força Total" && i.status === "ACTIVE")).toBe(true);
  });

  it("reenvio do MESMO evento é duplicate — não duplica entitlement nem ledger", async () => {
    const order = await createMarketplaceOrder({
      buyerUserId: buyer.userId,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      productSlug,
      idempotencyKey: randomUUID(),
      method: "PIX",
    });
    createdOrderIds.push(order.orderId);

    const { rawBody, signature } = deliverPaidWebhook(order.reference);
    expect((await handleMarketplaceWebhook(rawBody, signature)).outcome).toBe("processed");
    // MESMO corpo/assinatura outra vez → barrado pelo índice único do evento.
    expect((await handleMarketplaceWebhook(rawBody, signature)).outcome).toBe("duplicate");

    // Evento NOVO para um pedido já PAID → também não reprocessa.
    const again = deliverPaidWebhook(order.reference);
    expect((await handleMarketplaceWebhook(again.rawBody, again.signature)).outcome).toBe("duplicate");

    expect(await prisma.marketplaceEntitlement.count({ where: { orderId: order.orderId } })).toBe(1);
    expect(await prisma.marketplaceLedgerEntry.count({ where: { orderId: order.orderId } })).toBe(2);
  });

  it("checkout com a mesma idempotencyKey devolve o pedido existente, sem recriar", async () => {
    const key = randomUUID();
    const first = await createMarketplaceOrder({
      buyerUserId: buyer.userId,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      productSlug,
      idempotencyKey: key,
      method: "PIX",
    });
    createdOrderIds.push(first.orderId);
    const second = await createMarketplaceOrder({
      buyerUserId: buyer.userId,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      productSlug,
      idempotencyKey: key,
      method: "PIX",
    });
    expect(second.orderId).toBe(first.orderId);
    expect(second.alreadyExisted).toBe(true);
  });
});
