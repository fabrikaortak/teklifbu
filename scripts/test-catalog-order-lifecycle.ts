/**
 * Faz 1 A–L katalog order lifecycle testleri
 * npx tsx scripts/test-catalog-order-lifecycle.ts
 */
import { PrismaClient, OrderStatus, PaymentStatus, EscrowStatus } from "@prisma/client";
import {
  approveCatalogOffer,
  createSellerOffer,
} from "../src/core/services/catalog/catalogCommerceService";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import { completeEscrowPayment, createEscrowCheckout } from "../src/core/services/escrowService";
import { reconcileExpiredCatalogOrders } from "../src/core/services/catalog/catalogOrderReconcileService";
import { cancelExpiredCatalogOrder } from "../src/core/services/catalog/catalogOrderLifecycleService";
import { CatalogCommerceError, tlToMinor, minorToTl } from "../src/lib/catalogCommerce";
import { setSetting } from "../src/core/settings";
import type { SessionUser } from "../src/lib/auth";

const prisma = new PrismaClient();
type Row = { name: string; pass: boolean; detail?: string };
const results: Row[] = [];

function record(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

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

async function flagsOn() {
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);
  await setSetting("catalog_checkout_pending_ttl_minutes", 15);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
}

async function ensureMagazaOwner(shop: { id: string; ownerId: string }) {
  await prisma.user.update({
    where: { id: shop.ownerId },
    data: {
      accountType: "TICARI",
      commercialSubtypes: ["MAGAZA"],
      commercialStatus: "APPROVED",
      isActive: true,
    },
  });
  const pkg = await prisma.shopPackage.findFirst({ where: { isActive: true } });
  if (pkg) {
    await prisma.shopSubscription.upsert({
      where: { userId: shop.ownerId },
      create: {
        userId: shop.ownerId,
        shopId: shop.id,
        packageId: pkg.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 86400000),
        isActive: true,
      },
      update: {
        shopId: shop.id,
        packageId: pkg.id,
        endsAt: new Date(Date.now() + 30 * 86400000),
        isActive: true,
      },
    });
  }
}

async function makeOffer(shop: { id: string; ownerId: string }, variantId: string, productId: string, stock: number) {
  await prisma.sellerOffer.updateMany({
    where: { shopId: shop.id, variantId, status: "ACTIVE", deletedAt: null },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
  // Mirror Listing'ler paket limitini doldurmasın — eski ACTIVE mirror'ları kapat
  await prisma.listing.updateMany({
    where: {
      OR: [{ shopId: shop.id }, { sellerId: shop.ownerId }],
      sellerOfferId: { not: null },
      status: { in: ["ACTIVE", "SELECTION", "DRAFT", "PENDING_REVIEW"] },
    },
    data: { status: "EXPIRED" },
  });
  // Unique (shopId, variantId) EXPIRED kayıtlarda da tutulur — mirror create çakışmasın
  await prisma.listing.updateMany({
    where: { shopId: shop.id, variantId },
    data: { variantId: null, sellerOfferId: null, status: "EXPIRED" },
  });
  const offer = await createSellerOffer({
    sellerId: shop.ownerId,
    shopId: shop.id,
    productId,
    variantId,
    priceTl: 1000,
    stockQty: stock,
    createListingMirror: true,
    city: "İstanbul",
  });
  await approveCatalogOffer(offer.id, shop.ownerId);
  return prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } });
}

async function main() {
  await flagsOn();

  const shop = await prisma.shop.findFirst({ where: { isActive: true } });
  if (!shop) throw new Error("Aktif shop yok");
  await ensureMagazaOwner(shop);

  let buyer = await prisma.user.findFirst({
    where: { id: { not: shop.ownerId }, isActive: true },
  });
  if (!buyer) {
    buyer = await prisma.user.create({
      data: {
        phone: `05${String(Date.now()).slice(-9)}`,
        name: "Lifecycle Buyer",
        role: "USER",
        accountType: "BIREYSEL_TICARI",
        isActive: true,
      },
    });
  }

  const product = await prisma.product.findFirst({
    where: { deletedAt: null, status: "ACTIVE" },
    include: { variants: { where: { deletedAt: null, isActive: true }, take: 1 } },
  });
  if (!product?.variants[0]) throw new Error("Product/variant yok");
  const variant = product.variants[0];

  // --- A: payment success → Order PAID ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 5);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id, name: buyer.name },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `a-${Date.now()}`,
    });
    const done = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const pay = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    record(
      "A payment success → Order PAID",
      Boolean(done.ok) && order?.status === OrderStatus.PAID && Boolean(order.paidAt) && pay?.status === PaymentStatus.PAID && Boolean(pay.paidAt),
      `order=${order?.status} pay=${pay?.status}`
    );
  }

  // --- B: idempotency key twice ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 5);
    const key = `b-${Date.now()}`;
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const c1 = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    const c2 = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    const stockAfter = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const orderCount = await prisma.order.count({
      where: { buyerId: buyer.id, idempotencyKey: key },
    });
    record(
      "B same idempotencyKey twice",
      c1.order.id === c2.order.id &&
        c2.idempotentReplay === true &&
        orderCount === 1 &&
        stockAfter === stockBefore - 1 &&
        c1.deal.id === c2.deal.id &&
        c1.payment.id === c2.payment.id,
      `orders=${orderCount} stock ${stockBefore}→${stockAfter}`
    );
  }

  // --- C: payment completion twice ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 3);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `c-${Date.now()}`,
    });
    const d1 = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const d2 = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    record(
      "C payment completion twice",
      Boolean(d1.ok) && Boolean(d2.ok) && deal?.status === EscrowStatus.AWAITING_SHIPMENT && order?.status === OrderStatus.PAID,
      `d2.already=${(d2 as { alreadyCompleted?: boolean }).alreadyCompleted} deal=${deal?.status}`
    );
  }

  // --- D: timeout cancel + stock restore ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 4);
    const before = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `d-${Date.now()}`,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const r = await cancelExpiredCatalogOrder(co.order.id);
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const pay = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    const after = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const item = await prisma.orderItem.findFirst({ where: { orderId: co.order.id } });
    record(
      "D timeout cancel + stock restore",
      r.ok &&
        order?.status === OrderStatus.CANCELLED &&
        pay?.status === PaymentStatus.CANCELLED &&
        after === before &&
        Boolean(item?.stockReleasedAt),
      `stock ${before}→${after} reason=${r.reason}`
    );
  }

  // --- E: reconcile twice ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 3);
    const before = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `e-${Date.now()}`,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await reconcileExpiredCatalogOrders({ limit: 20, force: true });
    const mid = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    await reconcileExpiredCatalogOrders({ limit: 20, force: true });
    const after = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    record("E reconcile twice stock once", mid === before && after === before, `stock ${before}→${mid}→${after}`);
  }

  // --- F-A: payment wins lock first, then timeout must no-op ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 3);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `fa-${Date.now()}`,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const payRes = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const cancelRes = await cancelExpiredCatalogOrder(co.order.id);
    const reconcile = await reconcileExpiredCatalogOrders({ limit: 20, force: true });

    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const pay = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
    const item = await prisma.orderItem.findFirst({ where: { orderId: co.order.id } });
    const stockAfter = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const reconcileTouched = reconcile.results.some((r) => r.orderId === co.order.id && r.ok && r.reason === "CANCELLED");

    const okFa =
      Boolean(payRes.ok) &&
      order?.status === OrderStatus.PAID &&
      Boolean(order.paidAt) &&
      pay?.status === PaymentStatus.PAID &&
      deal?.status === EscrowStatus.AWAITING_SHIPMENT &&
      !cancelRes.ok &&
      item?.stockReleasedAt == null &&
      stockAfter === stockBefore - 1 &&
      !reconcileTouched;

    record(
      "F-A payment first then timeout no-op",
      okFa,
      `order=${order?.status} pay=${pay?.status} deal=${deal?.status} cancel=${cancelRes.reason} stock=${stockBefore}→${stockAfter} releasedAt=${item?.stockReleasedAt ?? "null"}`
    );
  }

  // --- F-B: timeout/reconcile wins lock first, then payment must not revive ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 3);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `fb-${Date.now()}`,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const cancelRes = await cancelExpiredCatalogOrder(co.order.id);
    const payRes = await completeEscrowPayment(sessionOf(buyer), co.payment.id);

    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const pay = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    const item = await prisma.orderItem.findFirst({ where: { orderId: co.order.id } });
    const stockAfter = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;

    // Second cancel must not double-restore stock
    await cancelExpiredCatalogOrder(co.order.id);
    const stockAfter2 = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;

    const okFb =
      cancelRes.ok &&
      order?.status === OrderStatus.CANCELLED &&
      pay?.status === PaymentStatus.CANCELLED &&
      Boolean(item?.stockReleasedAt) &&
      stockAfter === stockBefore &&
      stockAfter2 === stockBefore &&
      order.status !== OrderStatus.PAID &&
      (!payRes.ok || order.status === OrderStatus.CANCELLED);

    record(
      "F-B timeout first then payment rejected",
      okFb,
      `order=${order?.status} pay=${pay?.status} payOk=${payRes.ok} cancel=${cancelRes.reason} stock=${stockBefore}→${stockAfter}→${stockAfter2}`
    );
  }

  // --- F concurrent race (either winner OK; PAID never cancelled) ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 3);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f-${Date.now()}`,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const [payRes, cancelRes] = await Promise.all([
      completeEscrowPayment(sessionOf(buyer), co.payment.id),
      cancelExpiredCatalogOrder(co.order.id),
    ]);
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const pay = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    const paidWins = order?.status === OrderStatus.PAID && pay?.status === PaymentStatus.PAID && !cancelRes.ok;
    const cancelWins =
      order?.status === OrderStatus.CANCELLED &&
      pay?.status === PaymentStatus.CANCELLED &&
      cancelRes.ok &&
      (!payRes.ok || order.status === OrderStatus.CANCELLED);
    const okRace = (paidWins || cancelWins) && !(order?.status === OrderStatus.PAID && cancelRes.ok && cancelRes.reason === "CANCELLED");
    record(
      "F concurrent payment vs timeout race",
      Boolean(okRace),
      `order=${order?.status} pay=${pay?.status} payOk=${payRes.ok} cancel=${cancelRes.reason}`
    );
  }

  // --- G: stock 1 → checkout → timeout → 1 ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 1);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `g-${Date.now()}`,
    });
    const mid = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!;
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await cancelExpiredCatalogOrder(co.order.id);
    const after = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!;
    record(
      "G stock 1 checkout timeout restore",
      mid.stockQty === 0 && after.stockQty === 1,
      `mid=${mid.stockQty}/${mid.status} after=${after.stockQty}/${after.status}`
    );
  }

  // --- H: SOLD_OUT + approvedAt → ACTIVE after restore ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 1);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `h-${Date.now()}`,
    });
    const mid = await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await cancelExpiredCatalogOrder(co.order.id);
    const after = await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } });
    record(
      "H SOLD_OUT restore → ACTIVE",
      mid.status === "SOLD_OUT" && Boolean(mid.approvedAt) && after.status === "ACTIVE" && after.stockQty === 1,
      `mid=${mid.status} after=${after.status}`
    );
  }

  // --- I: PRICE_CHANGED rollback ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 2);
    const before = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    let code = "";
    try {
      await checkoutCatalogOffer({
        buyer: { id: buyer.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        expectedEffectiveUnitPriceMinor: tlToMinor(1), // wrong
        idempotencyKey: `i-${Date.now()}`,
      });
    } catch (e) {
      code = e instanceof CatalogCommerceError ? e.code : "OTHER";
    }
    const after = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    record("I PRICE_CHANGED rollback", code === "PRICE_CHANGED" && after === before, `code=${code} stock ${before}→${after}`);
  }

  // --- J: classic Listing escrow (mirror’süz, escrowEligible) ---
  {
    let listing = await prisma.listing.findFirst({
      where: {
        sellerOfferId: null,
        status: "ACTIVE",
        escrowEligible: true,
        sellerId: { not: buyer.id },
      },
    });
    if (!listing) {
      const cat = await prisma.category.findFirst({
        where: { OR: [{ slug: { contains: "emlak" } }, { slug: { contains: "vasita" } }, { slug: { contains: "vasıta" } }] },
      });
      const fallbackCat =
        cat ||
        (await prisma.category.findFirst({
          where: { NOT: { slug: { contains: "alisveris" } } },
        }));
      if (!fallbackCat) {
        record("J classic Listing escrow", true, "SKIPPED — kategori yok");
      } else {
        const seller = await prisma.user.findFirst({
          where: { id: { not: buyer.id }, isActive: true },
        });
        if (!seller) {
          record("J classic Listing escrow", true, "SKIPPED — satıcı yok");
        } else {
          listing = await prisma.listing.create({
            data: {
              listingNo: `CL-J-${Date.now()}`,
              sellerId: seller.id,
              categoryId: fallbackCat.id,
              title: "Faz1 klasik escrow regresyon ilanı",
              description: "Klasik Listing escrow regression test listing.",
              city: "İstanbul",
              askPrice: BigInt(250),
              status: "ACTIVE",
              durationDays: 14,
              startsAt: new Date(),
              endsAt: new Date(Date.now() + 14 * 86400000),
              escrowEligible: true,
              sellerOfferId: null,
            },
          });
        }
      }
    }
    if (listing) {
      try {
        const r = await createEscrowCheckout(sessionOf(buyer), listing.id, 7);
        const okJ = "ok" in r && r.ok === true && Boolean((r as { payUrl?: string }).payUrl);
        const code = !("ok" in r && r.ok) ? (r as { body?: { code?: string } }).body?.code : undefined;
        if (code === "USE_CATALOG_CHECKOUT") {
          record("J classic Listing escrow", false, "classic listing wrongly routed to catalog");
        } else {
          record("J classic Listing escrow", okJ, JSON.stringify(r).slice(0, 160));
        }
      } catch (e) {
        record("J classic Listing escrow", false, e instanceof Error ? e.message : String(e));
      }
    }
  }

  // --- K: kuruş/TL no 100x ---
  {
    const offer = await makeOffer(shop, variant.id, product.id, 2);
    await prisma.sellerOffer.update({
      where: { id: offer.id },
      data: { price: BigInt(12345), discountedPrice: null }, // 123.45 TL
    });
    // re-approve status ACTIVE
    await prisma.sellerOffer.update({
      where: { id: offer.id },
      data: { status: "ACTIVE", stockQty: 2 },
    });
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `k-${Date.now()}`,
    });
    const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
    const expectedTl = Math.round(minorToTl(BigInt(12345)));
    record(
      "K kuruş/TL no 100x",
      co.amountTl === expectedTl && deal?.amountTl === expectedTl && co.priceKurus === BigInt(12345),
      `amountTl=${co.amountTl} expected=${expectedTl} deal=${deal?.amountTl}`
    );
  }

  // --- L: flag OFF fallback ---
  {
    await setSetting("catalog_order_payment_lifecycle_v2", false);
    const offer = await makeOffer(shop, variant.id, product.id, 2);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `l-${Date.now()}`,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    // Flag OFF: Order may stay PENDING_PAYMENT (legacy)
    record(
      "L flag OFF legacy Order not forced PAID",
      order?.status === OrderStatus.PENDING_PAYMENT || order?.status === OrderStatus.PAID,
      `order=${order?.status} (expected PENDING when flag off)`
    );
    const legacyOk = order?.status === OrderStatus.PENDING_PAYMENT;
    if (!legacyOk && order?.status === OrderStatus.PAID) {
      // If somehow paid, still mark as pass with note — but plan says old behavior
      results[results.length - 1].pass = false;
      results[results.length - 1].detail = `FAIL expected PENDING_PAYMENT got PAID`;
      console.log("FAIL L — expected PENDING_PAYMENT when lifecycle flag OFF");
    }
    await flagsOn();
  }

  const failed = results.filter((r) => !r.pass && !String(r.detail || "").includes("SKIPPED"));
  const skipped = results.filter((r) => String(r.detail || "").includes("SKIPPED"));
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed (${skipped.length} skipped notes)`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
