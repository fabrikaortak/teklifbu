/**
 * Faz 1 smoke: katalog checkout → ödeme → reconcile → klasik escrow → sipariş paneli sorgusu
 * npx tsx scripts/smoke-faz1-lifecycle.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  approveCatalogOffer,
  createSellerOffer,
} from "../src/core/services/catalog/catalogCommerceService";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import { completeEscrowPayment, createEscrowCheckout } from "../src/core/services/escrowService";
import { reconcileExpiredCatalogOrders } from "../src/core/services/catalog/catalogOrderReconcileService";
import { setSetting } from "../src/core/settings";
import type { SessionUser } from "../src/lib/auth";

const prisma = new PrismaClient();

function sessionOf(u: { id: string; phone?: string | null; name?: string | null; accountType?: string }): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || null,
    role: "USER",
    accountType: u.accountType || "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
}

async function main() {
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);

  const shop = await prisma.shop.findFirst({ where: { isActive: true } });
  if (!shop) throw new Error("shop yok");
  await prisma.user.update({
    where: { id: shop.ownerId },
    data: { accountType: "TICARI", commercialSubtypes: ["MAGAZA"], commercialStatus: "APPROVED", isActive: true },
  });

  const buyer = await prisma.user.findFirst({ where: { id: { not: shop.ownerId }, isActive: true } });
  if (!buyer) throw new Error("buyer yok");

  const product = await prisma.product.findFirst({ where: { status: "ACTIVE" }, include: { variants: { take: 1 } } });
  if (!product?.variants[0]) throw new Error("product/variant yok");

  await prisma.listing.updateMany({
    where: {
      OR: [{ shopId: shop.id }, { sellerId: shop.ownerId }],
      sellerOfferId: { not: null },
      status: { in: ["ACTIVE", "SELECTION", "DRAFT", "PENDING_REVIEW"] },
    },
    data: { status: "EXPIRED" },
  });
  await prisma.sellerOffer.updateMany({
    where: { shopId: shop.id, variantId: product.variants[0].id, status: "ACTIVE", deletedAt: null },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });

  const offer = await createSellerOffer({
    sellerId: shop.ownerId,
    shopId: shop.id,
    productId: product.id,
    variantId: product.variants[0].id,
    priceTl: 500,
    stockQty: 3,
    createListingMirror: true,
    city: "İstanbul",
  });
  await approveCatalogOffer(offer.id, shop.ownerId);

  // 1) catalog checkout
  const co = await checkoutCatalogOffer({
    buyer: { id: buyer.id },
    sellerOfferId: offer.id,
    quantity: 1,
    shipDays: 7,
    idempotencyKey: `smoke-${Date.now()}`,
  });
  console.log("SMOKE catalog checkout", {
    orderId: co.order.id,
    paymentId: co.payment.id,
    amountTl: co.amountTl,
  });

  // 2) payment complete
  const pay = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
  console.log("SMOKE payment complete", pay);
  if (!("ok" in pay) || !pay.ok) throw new Error(`payment failed: ${JSON.stringify(pay)}`);

  const order = await prisma.order.findUnique({ where: { id: co.order.id } });
  if (order?.status !== "PAID") throw new Error(`order not PAID: ${order?.status}`);

  // 3) admin reconcile (no-op on PAID / empty batch ok)
  const rec = await reconcileExpiredCatalogOrders({ limit: 5 });
  console.log("SMOKE reconcile", rec);

  // 4) classic listing escrow
  let classic = await prisma.listing.findFirst({
    where: { sellerOfferId: null, status: "ACTIVE", escrowEligible: true, sellerId: { not: buyer.id } },
  });
  if (!classic) {
    const cat = await prisma.category.findFirst();
    const seller = await prisma.user.findFirst({ where: { id: { not: buyer.id }, isActive: true } });
    classic = await prisma.listing.create({
      data: {
        listingNo: `SMOKE-CL-${Date.now()}`,
        sellerId: seller!.id,
        categoryId: cat!.id,
        title: "Smoke classic escrow",
        description: "smoke",
        city: "İstanbul",
        askPrice: BigInt(150),
        status: "ACTIVE",
        durationDays: 7,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 7 * 86400000),
        escrowEligible: true,
      },
    });
  }
  const esc = await createEscrowCheckout(sessionOf(buyer), classic.id, 7);
  if (!("ok" in esc) || !esc.ok) throw new Error(`classic escrow failed: ${JSON.stringify(esc)}`);
  console.log("SMOKE classic escrow", { dealId: esc.dealId, payUrl: esc.payUrl });

  // 5) sipariş paneli sorgusu
  const panelOrders = await prisma.order.findMany({
    where: { buyerId: buyer.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { items: true },
  });
  console.log("SMOKE order panel", { count: panelOrders.length, latest: panelOrders[0]?.status });

  console.log("SMOKE ALL OK");
}

main()
  .catch((e) => {
    console.error("SMOKE FAIL", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
