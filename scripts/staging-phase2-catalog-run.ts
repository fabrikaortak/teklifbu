/**
 * Staging Aşama 2 — allowlist shop kontrollü checkout suite
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npm run staging:phase2
 */
import "dotenv/config";
import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  EscrowStatus,
  CatalogProjectionJobStatus,
} from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import { setSetting, getSetting } from "../src/core/settings";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import {
  completeEscrowPayment,
  createEscrowCheckout,
  adminRefund,
  adminRelease,
} from "../src/core/services/escrowService";
import { cancelExpiredCatalogOrder } from "../src/core/services/catalog/catalogOrderLifecycleService";
import {
  enqueueMirrorSyncJob,
  processDueCatalogProjectionJobs,
  __setTestForceMirrorSyncFail,
} from "../src/core/services/catalog/catalogProjectionJobService";
import { auditCatalogCheckoutConsistency } from "./audit-catalog-checkout-consistency";
import { CatalogCommerceError } from "../src/lib/catalogCommerce";
import type { SessionUser } from "../src/lib/auth";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type TxRecord = {
  scenario: string;
  shopId: string;
  buyerId: string;
  sellerOfferId: string;
  orderId?: string;
  orderNo?: string;
  escrowDealId?: string;
  paymentId?: string;
  idempotencyKey?: string;
  orderStatus?: string;
  paymentStatus?: string;
  escrowStatus?: string;
  stockBefore?: number;
  stockAfter?: number;
  stockReleasedAt?: string | null;
  listingIdNull?: boolean;
  projectionJobStatus?: string | null;
  ok: boolean;
  detail?: string;
};

function sessionOf(
  u: { id: string; phone?: string | null; name?: string | null },
  role: "USER" | "ADMIN" = "USER"
): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || "STG",
    role,
    accountType: "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
}

async function snapshotTx(partial: TxRecord): Promise<TxRecord> {
  if (!partial.orderId) return partial;
  const order = await prisma.order.findUnique({
    where: { id: partial.orderId },
    include: { items: true, escrowDeal: true },
  });
  const payment = partial.paymentId
    ? await prisma.payment.findUnique({ where: { id: partial.paymentId } })
    : null;
  const deal = order?.escrowDeal;
  const item = order?.items[0];
  const offer = item
    ? await prisma.sellerOffer.findUnique({ where: { id: item.sellerOfferId } })
    : null;
  return {
    ...partial,
    orderNo: order?.orderNo || partial.orderNo,
    orderStatus: order?.status,
    paymentStatus: payment?.status,
    escrowStatus: deal?.status,
    stockAfter: offer?.stockQty,
    stockReleasedAt: item?.stockReleasedAt?.toISOString() || null,
    listingIdNull: deal ? deal.listingId == null : partial.listingIdNull,
  };
}

async function ensureOfferStock(offerId: string, qty: number) {
  await prisma.sellerOffer.update({
    where: { id: offerId },
    data: {
      stockQty: qty,
      status: "ACTIVE",
      deletedAt: null,
      listingId: null, // mirrorless for phase2 catalog path
    },
  });
}

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("STAGING_GUARD_OK", fp.maskedUrl, "prodLook=", fp.looksProduction);

  const allowPath = path.join(process.cwd(), "scripts", "output", "staging-phase2-allowlist.json");
  if (!fs.existsSync(allowPath)) throw new Error("Allowlist missing — run staging:phase2-allowlist");
  const allow = JSON.parse(fs.readFileSync(allowPath, "utf8")) as {
    phase2Since: string;
    shopIds: string[];
    shops: Array<{ shopId: string; ownerId: string; name: string }>;
  };

  // Fresh baseline for this Phase2 run (after job cleanup)
  const phase2Since = new Date().toISOString();
  const shopIds = allow.shopIds;
  console.log("ALLOWLIST", shopIds);
  console.log("PHASE2_SINCE", phase2Since);

  await setSetting("catalog_checkout_without_mirror", true);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);
  const flag = await getSetting<boolean>("catalog_checkout_without_mirror", false);
  if (flag !== true) throw new Error("staging flag not ON");

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("admin yok");

  // Dedicated phase2 buyers (one per shop + extras)
  const stamp = Date.now();
  async function makeBuyer(i: number) {
    const phone = `0598${String(stamp + i).slice(-7)}`;
    return prisma.user.create({
      data: {
        phone,
        name: `STG P2 Buyer ${i}`,
        role: "USER",
        accountType: "BIREYSEL_TICARI",
        isActive: true,
      },
    });
  }
  const buyers = [await makeBuyer(1), await makeBuyer(2), await makeBuyer(3), await makeBuyer(4)];

  const txs: TxRecord[] = [];
  const scenarioResults: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const recordScenario = (name: string, pass: boolean, detail = "") => {
    scenarioResults.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  let successCount = 0;
  let timeoutCount = 0;
  let replayCount = 0;
  let refundCount = 0;
  let releaseCount = 0;
  const perShop: Record<string, { success: number; timeout: number; replay: number }> = {};
  for (const id of shopIds) perShop[id] = { success: 0, timeout: 0, replay: 0 };

  // Load active offers per shop (create stock if needed)
  async function offersForShop(shopId: string) {
    let offers = await prisma.sellerOffer.findMany({
      where: { shopId, deletedAt: null, status: { in: ["ACTIVE", "SOLD_OUT", "ARCHIVED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    if (!offers.length) throw new Error(`No offers for shop ${shopId}`);
    return offers;
  }

  // ========== Per-shop: 5 success + 1 timeout + 1 replay ==========
  for (let si = 0; si < allow.shops.length; si++) {
    const shop = allow.shops[si];
    const buyer = buyers[si % buyers.length];
    const offers = await offersForShop(shop.shopId);
    const offer = offers[0];

    // 5 successful checkouts
    for (let n = 0; n < 5; n++) {
      await ensureOfferStock(offer.id, 5);
      const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
      const key = `p2-ok-${shop.shopId.slice(-6)}-${stamp}-${n}`;
      const co = await checkoutCatalogOffer({
        buyer: { id: buyer.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: key,
      });
      await completeEscrowPayment(sessionOf(buyer), co.payment.id);
      let row: TxRecord = {
        scenario: "A_success",
        shopId: shop.shopId,
        buyerId: buyer.id,
        sellerOfferId: offer.id,
        orderId: co.order.id,
        orderNo: co.order.orderNo,
        escrowDealId: co.deal.id,
        paymentId: co.payment.id,
        idempotencyKey: key,
        stockBefore,
        listingIdNull: true,
        ok: true,
      };
      row = await snapshotTx(row);
      row.ok = row.orderStatus === OrderStatus.PAID && row.paymentStatus === PaymentStatus.PAID;
      txs.push(row);
      if (row.ok) {
        successCount++;
        perShop[shop.shopId].success++;
      }
    }

    // 1 timeout
    {
      await ensureOfferStock(offer.id, 3);
      const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
      const key = `p2-to-${shop.shopId.slice(-6)}-${stamp}`;
      const co = await checkoutCatalogOffer({
        buyer: { id: buyer.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: key,
      });
      await prisma.order.update({
        where: { id: co.order.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const r = await cancelExpiredCatalogOrder(co.order.id);
      let row: TxRecord = {
        scenario: "B_timeout",
        shopId: shop.shopId,
        buyerId: buyer.id,
        sellerOfferId: offer.id,
        orderId: co.order.id,
        escrowDealId: co.deal.id,
        paymentId: co.payment.id,
        idempotencyKey: key,
        stockBefore,
        ok: r.ok,
      };
      row = await snapshotTx(row);
      row.ok =
        row.orderStatus === OrderStatus.CANCELLED &&
        Boolean(row.stockReleasedAt) &&
        row.stockAfter === stockBefore;
      txs.push(row);
      if (row.ok) {
        timeoutCount++;
        perShop[shop.shopId].timeout++;
      }
    }

    // 1 idempotency replay
    {
      await ensureOfferStock(offer.id, 4);
      const key = `p2-idemp-${shop.shopId.slice(-6)}-${stamp}`;
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
      const count = await prisma.order.count({
        where: { buyerId: buyer.id, idempotencyKey: key },
      });
      let row: TxRecord = {
        scenario: "C_idempotency",
        shopId: shop.shopId,
        buyerId: buyer.id,
        sellerOfferId: offer.id,
        orderId: c1.order.id,
        escrowDealId: c1.deal.id,
        paymentId: c1.payment.id,
        idempotencyKey: key,
        ok: c1.order.id === c2.order.id && count === 1 && Boolean(c2.idempotentReplay),
        detail: `replay=${c2.idempotentReplay} count=${count}`,
      };
      row = await snapshotTx(row);
      txs.push(row);
      if (row.ok) {
        replayCount++;
        perShop[shop.shopId].replay++;
      }
    }
  }

  recordScenario(
    "A success per shop >=5",
    Object.values(perShop).every((s) => s.success >= 5),
    JSON.stringify(perShop)
  );
  recordScenario(
    "B timeout per shop >=1",
    Object.values(perShop).every((s) => s.timeout >= 1) && timeoutCount >= 4,
    `timeouts=${timeoutCount}`
  );
  recordScenario(
    "C replay per shop >=1",
    Object.values(perShop).every((s) => s.replay >= 1) && replayCount >= 4,
    `replays=${replayCount}`
  );

  // ========== D Refund (pool >=1) ==========
  {
    const shop = allow.shops[0];
    const buyer = buyers[0];
    const offer = (await offersForShop(shop.shopId))[0];
    await ensureOfferStock(offer.id, 2);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `p2-refund-${stamp}`,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    await adminRefund(co.deal.id, admin.id, "phase2 refund test");
    let row: TxRecord = {
      scenario: "D_refund",
      shopId: shop.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      idempotencyKey: `p2-refund-${stamp}`,
      ok: false,
    };
    row = await snapshotTx(row);
    row.ok = row.escrowStatus === EscrowStatus.REFUNDED;
    txs.push(row);
    if (row.ok) refundCount++;
    recordScenario("D refund", row.ok, `escrow=${row.escrowStatus}`);
  }

  // ========== E Release (pool >=1) ==========
  {
    const shop = allow.shops[1];
    const buyer = buyers[1];
    const offer = (await offersForShop(shop.shopId))[0];
    await ensureOfferStock(offer.id, 2);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `p2-release-${stamp}`,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    await adminRelease(co.deal.id, admin.id, "phase2 release test");
    let row: TxRecord = {
      scenario: "E_release",
      shopId: shop.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      idempotencyKey: `p2-release-${stamp}`,
      ok: false,
    };
    row = await snapshotTx(row);
    row.ok = row.escrowStatus === EscrowStatus.RELEASED;
    txs.push(row);
    if (row.ok) releaseCount++;
    recordScenario("E release", row.ok, `escrow=${row.escrowStatus}`);
  }

  // ========== F PRICE_CHANGED ==========
  {
    const shop = allow.shops[0];
    const buyer = buyers[0];
    const offer = (await offersForShop(shop.shopId))[0];
    await ensureOfferStock(offer.id, 2);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    let code = "";
    try {
      await checkoutCatalogOffer({
        buyer: { id: buyer.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        expectedEffectiveUnitPriceMinor: BigInt(1), // wrong
        idempotencyKey: `p2-price-${stamp}`,
      });
    } catch (e) {
      code = e instanceof CatalogCommerceError ? e.code : "OTHER";
    }
    const stockAfter = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const ok = code === "PRICE_CHANGED" && stockAfter === stockBefore;
    recordScenario("F PRICE_CHANGED", ok, `code=${code} stock ${stockBefore}→${stockAfter}`);
  }

  // ========== G stock 1 concurrent ==========
  {
    const shop = allow.shops[2] || allow.shops[0];
    const offer = (await offersForShop(shop.shopId))[0];
    await ensureOfferStock(offer.id, 1);
    const b1 = buyers[0];
    const b2 = buyers[1];
    const results = await Promise.allSettled([
      checkoutCatalogOffer({
        buyer: { id: b1.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: `p2-race-a-${stamp}`,
      }).then((co) => ({ co, buyer: b1 })),
      checkoutCatalogOffer({
        buyer: { id: b2.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: `p2-race-b-${stamp}`,
      }).then((co) => ({ co, buyer: b2 })),
    ]);
    const okOnes = results.filter((r) => r.status === "fulfilled").length;
    const failOnes = results.filter((r) => r.status === "rejected").length;
    const stock = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const ok = okOnes === 1 && failOnes === 1 && stock === 0;
    recordScenario("G concurrent stock1", ok, `ok=${okOnes} fail=${failOnes} stock=${stock}`);
    for (const r of results) {
      if (r.status === "fulfilled") {
        await completeEscrowPayment(sessionOf(r.value.buyer), r.value.co.payment.id);
      }
    }
  }

  // ========== H Projection retry ==========
  {
    const shop = allow.shops[0];
    const offer = (await offersForShop(shop.shopId))[0];
    await ensureOfferStock(offer.id, 2);
    __setTestForceMirrorSyncFail(true);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyers[0].id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `p2-proj-${stamp}`,
    });
    __setTestForceMirrorSyncFail(false);
    const job =
      (await prisma.catalogProjectionJob.findFirst({
        where: { sellerOfferId: offer.id },
        orderBy: { createdAt: "desc" },
      })) ||
      (await enqueueMirrorSyncJob({ sellerOfferId: offer.id, reason: "phase2" }));
    await prisma.catalogProjectionJob.update({
      where: { id: job.id },
      data: {
        status: CatalogProjectionJobStatus.PENDING,
        nextAttemptAt: new Date(),
        attempts: 0,
        completedAt: null,
        lastError: null,
      },
    });
    await processDueCatalogProjectionJobs({ forceJobId: job.id, limit: 1 });
    const after = await prisma.catalogProjectionJob.findUnique({ where: { id: job.id } });
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const ok =
      after?.status === CatalogProjectionJobStatus.COMPLETED &&
      order?.status === OrderStatus.PENDING_PAYMENT;
    recordScenario("H projection retry", ok, `job=${after?.status} order=${order?.status}`);
    txs.push({
      scenario: "H_projection",
      shopId: shop.shopId,
      buyerId: buyers[0].id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      projectionJobStatus: after?.status || null,
      ok,
    });
  }

  // ========== I Admin null listing display ==========
  {
    const deal = await prisma.escrowDeal.findFirst({
      where: {
        listingId: null,
        orderId: { not: null },
        sellerOfferId: { not: null },
        createdAt: { gte: new Date(phase2Since) },
      },
      include: {
        linkedOrder: { include: { items: { take: 1 } } },
        sellerOffer: { include: { product: true } },
      },
    });
    const title =
      deal?.linkedOrder?.items?.[0]?.productNameSnapshot ||
      deal?.sellerOffer?.product?.name ||
      null;
    recordScenario("I admin null listing", Boolean(deal && title), `title=${title?.slice(0, 40)}`);
  }

  // ========== J Account snapshot ==========
  {
    const order = await prisma.order.findFirst({
      where: {
        createdAt: { gte: new Date(phase2Since) },
        status: OrderStatus.PAID,
        items: { some: { shopId: { in: shopIds } } },
      },
      include: { items: true },
    });
    const item = order?.items[0];
    const ok = Boolean(
      item?.productNameSnapshot && item.sellerOfferId && item.effectiveUnitPriceSnapshot != null
    );
    recordScenario(
      "J account snapshot fields",
      ok,
      `name=${item?.productNameSnapshot?.slice(0, 30)}`
    );
  }

  // ========== K Classic escrow ==========
  {
    let listing = await prisma.listing.findFirst({
      where: {
        sellerOfferId: null,
        status: "ACTIVE",
        escrowEligible: true,
        sellerId: { not: buyers[0].id },
      },
    });
    if (!listing) {
      const cat = await prisma.category.findFirst();
      listing = await prisma.listing.create({
        data: {
          listingNo: `P2-CL-${stamp}`,
          sellerId: allow.shops[0].ownerId,
          categoryId: cat!.id,
          title: "P2 classic escrow",
          description: "phase2 classic",
          city: "İzmir",
          askPrice: BigInt(120),
          status: "ACTIVE",
          durationDays: 7,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 7 * 86400000),
          escrowEligible: true,
        },
      });
    }
    const r = await createEscrowCheckout(sessionOf(buyers[0]), listing.id, 7);
    const deal = r.ok ? await prisma.escrowDeal.findUnique({ where: { id: r.dealId } }) : null;
    recordScenario(
      "K classic escrow",
      Boolean(r.ok) && Boolean(deal?.listingId) && deal?.orderId == null,
      `listingId=${Boolean(deal?.listingId)}`
    );
  }

  // Totals
  recordScenario("TOTAL success>=20", successCount >= 20, `success=${successCount}`);
  recordScenario("TOTAL timeout>=4", timeoutCount >= 4, `timeout=${timeoutCount}`);
  recordScenario("TOTAL replay>=4", replayCount >= 4, `replay=${replayCount}`);
  recordScenario("TOTAL refund>=1", refundCount >= 1, `refund=${refundCount}`);
  recordScenario("TOTAL release>=1", releaseCount >= 1, `release=${releaseCount}`);

  // Mid audit
  const audit = await auditCatalogCheckoutConsistency({
    scope: "phase2",
    since: phase2Since,
    shopIds,
  });

  const failedJobs = await prisma.catalogProjectionJob.count({
    where: { status: CatalogProjectionJobStatus.FAILED },
  });
  const negStock = await prisma.sellerOffer.count({
    where: { stockQty: { lt: 0 }, shopId: { in: shopIds } },
  });

  // Mismatch checks in scope
  const paidMismatch = audit.critical.filter(
    (c) =>
      c.code.includes("PAID") ||
      c.code.includes("PAYMENT") ||
      c.code.includes("ORDER_PAID")
  );

  recordScenario("AUDIT critical=0", audit.summary.criticalCount === 0, `c=${audit.summary.criticalCount}`);
  recordScenario(
    "AUDIT scoped warnings=0",
    audit.summary.warningCount === 0,
    `w=${audit.summary.warningCount}`
  );
  recordScenario("FAILED jobs=0", failedJobs === 0, `failed=${failedJobs}`);
  recordScenario("neg stock=0", negStock === 0, `neg=${negStock}`);
  recordScenario("no PAID mismatch critical", paidMismatch.length === 0, `n=${paidMismatch.length}`);

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    db: fp,
    phase2Since,
    shopIds,
    flag: true,
    totals: { successCount, timeoutCount, replayCount, refundCount, releaseCount },
    perShop,
    scenarioResults,
    transactions: txs,
    audit,
    failedJobs,
    negStock,
  };
  fs.writeFileSync(path.join(outDir, "staging-phase2-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(outDir, "catalog-checkout-consistency-phase2.json"),
    JSON.stringify(audit, null, 2)
  );

  const failedScenarios = scenarioResults.filter((s) => !s.pass);
  console.log(
    `\nPhase2 scenarios ${scenarioResults.filter((s) => s.pass).length}/${scenarioResults.length}`
  );
  console.log("TOTALS", report.totals);
  if (failedScenarios.length) {
    console.error("Failed scenarios:", failedScenarios.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
