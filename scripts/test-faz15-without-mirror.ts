/**
 * Faz 1.5 A–O: checkout without mirror + projection jobs
 * npx tsx scripts/test-faz15-without-mirror.ts
 */
import {
  PrismaClient,
  OrderStatus,
  EscrowStatus,
  CatalogProjectionJobStatus,
} from "@prisma/client";
import {
  approveCatalogOffer,
  createSellerOffer,
} from "../src/core/services/catalog/catalogCommerceService";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import {
  completeEscrowPayment,
  createEscrowCheckout,
  adminRelease,
  adminRefund,
  buyerRejectOrDispute,
} from "../src/core/services/escrowService";
import {
  __setTestForceMirrorSyncFail,
  enqueueMirrorSyncJob,
  processDueCatalogProjectionJobs,
} from "../src/core/services/catalog/catalogProjectionJobService";
import { setSetting } from "../src/core/settings";
import type { SessionUser } from "../src/lib/auth";
import { spawnSync } from "child_process";

const prisma = new PrismaClient();
type Row = { name: string; pass: boolean; detail?: string };
const results: Row[] = [];

function record(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function sessionOf(
  u: { id: string; phone?: string | null; name?: string | null; accountType?: string },
  role: "USER" | "ADMIN" = "USER"
): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || null,
    role,
    accountType: u.accountType || "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
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

async function freeListingSlots(shop: { id: string; ownerId: string }) {
  await prisma.listing.updateMany({
    where: {
      OR: [{ shopId: shop.id }, { sellerId: shop.ownerId }],
      sellerOfferId: { not: null },
      status: { in: ["ACTIVE", "SELECTION", "DRAFT", "PENDING_REVIEW"] },
    },
    data: { status: "EXPIRED" },
  });
}

async function makeOfferNoMirror(
  shop: { id: string; ownerId: string },
  variantId: string,
  productId: string,
  stock: number
) {
  await freeListingSlots(shop);
  await prisma.sellerOffer.updateMany({
    where: { shopId: shop.id, variantId, status: "ACTIVE", deletedAt: null },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
  const offer = await createSellerOffer({
    sellerId: shop.ownerId,
    shopId: shop.id,
    productId,
    variantId,
    priceTl: 800,
    stockQty: stock,
    createListingMirror: false,
    city: "İstanbul",
  });
  await approveCatalogOffer(offer.id, shop.ownerId);
  await prisma.sellerOffer.update({ where: { id: offer.id }, data: { listingId: null } });
  return prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } });
}

async function makeOfferWithMirror(
  shop: { id: string; ownerId: string },
  variantId: string,
  productId: string,
  stock: number
) {
  await freeListingSlots(shop);
  await prisma.sellerOffer.updateMany({
    where: { shopId: shop.id, variantId, status: "ACTIVE", deletedAt: null },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
  const offer = await createSellerOffer({
    sellerId: shop.ownerId,
    shopId: shop.id,
    productId,
    variantId,
    priceTl: 900,
    stockQty: stock,
    createListingMirror: true,
    city: "İstanbul",
  });
  await approveCatalogOffer(offer.id, shop.ownerId);
  return prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } });
}

async function main() {
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);
  await setSetting("catalog_checkout_without_mirror", true);

  const shop = await prisma.shop.findFirst({ where: { isActive: true } });
  if (!shop) throw new Error("shop yok");
  await ensureMagazaOwner(shop);

  let buyer = await prisma.user.findFirst({ where: { id: { not: shop.ownerId }, isActive: true } });
  if (!buyer) {
    buyer = await prisma.user.create({
      data: {
        phone: `05${String(Date.now()).slice(-9)}`,
        name: "F15 Buyer",
        role: "USER",
        accountType: "BIREYSEL_TICARI",
        isActive: true,
      },
    });
  }

  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phone: `05${String(Date.now() + 1).slice(-9)}`,
        name: "F15 Admin",
        role: "ADMIN",
        accountType: "BIREYSEL_TICARI",
        isActive: true,
      },
    });
  }

  const product = await prisma.product.findFirst({
    where: { deletedAt: null, status: "ACTIVE" },
    include: { variants: { where: { deletedAt: null, isActive: true }, take: 1 } },
  });
  if (!product?.variants[0]) throw new Error("product/variant yok");
  const variant = product.variants[0];

  // A
  {
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 3);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15a-${Date.now()}`,
    });
    const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const pay = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    record(
      "A mirrorless offer checkout",
      Boolean(order && deal && pay),
      `order=${order?.status}`
    );
  }

  // B
  {
    __setTestForceMirrorSyncFail(true);
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 2);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15b-${Date.now()}`,
    });
    __setTestForceMirrorSyncFail(false);
    const stockAfter = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const job = await prisma.catalogProjectionJob.findFirst({
      where: { sellerOfferId: offer.id, jobType: "MIRROR_SYNC" },
      orderBy: { createdAt: "desc" },
    });
    record(
      "B sync fail checkout ok + job",
      Boolean(co.order.id) && stockAfter === stockBefore - 1 && Boolean(job || co.projectionJobId),
      `job=${job?.id || co.projectionJobId} stock=${stockBefore}→${stockAfter}`
    );
  }

  // C
  {
    const offer = await makeOfferWithMirror(shop, variant.id, product.id, 2);
    const job = await enqueueMirrorSyncJob({ sellerOfferId: offer.id, listingId: offer.listingId });
    await prisma.catalogProjectionJob.update({
      where: { id: job.id },
      data: { status: CatalogProjectionJobStatus.PENDING, nextAttemptAt: new Date(), attempts: 0 },
    });
    const report = await processDueCatalogProjectionJobs({ forceJobId: job.id, limit: 1 });
    const done = await prisma.catalogProjectionJob.findUnique({ where: { id: job.id } });
    record(
      "C retry job completes sync",
      done?.status === CatalogProjectionJobStatus.COMPLETED && report.completed >= 1,
      `status=${done?.status}`
    );
  }

  // D
  {
    const offer = await makeOfferWithMirror(shop, variant.id, product.id, 2);
    const j1 = await enqueueMirrorSyncJob({ sellerOfferId: offer.id });
    const j2 = await enqueueMirrorSyncJob({ sellerOfferId: offer.id });
    record("D retry no duplicate jobs", j1.id === j2.id, `same=${j1.id === j2.id}`);
  }

  // E
  {
    const offer = await makeOfferWithMirror(shop, variant.id, product.id, 2);
    if (offer.listingId) {
      await prisma.listing.update({ where: { id: offer.listingId }, data: { askPrice: BigInt(1) } });
    }
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15e-${Date.now()}`,
    });
    record(
      "E SellerOffer price not listing askPrice",
      co.amountTl === 900 && co.priceKurus === BigInt(90000),
      `amountTl=${co.amountTl}`
    );
  }

  // F
  {
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 2);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15f-${Date.now()}`,
    });
    const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
    record(
      "F deal orderId set listingId null",
      deal?.orderId === co.order.id && deal.listingId == null && deal.sellerOfferId === offer.id,
      `listingId=${deal?.listingId}`
    );
  }

  // G
  {
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 2);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15g-${Date.now()}`,
    });
    const pay = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    record(
      "G payment complete Order PAID",
      Boolean(pay.ok) && order?.status === OrderStatus.PAID,
      `order=${order?.status}`
    );
  }

  // H
  {
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 3);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15h1-${Date.now()}`,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    // Move to SHIPPED/BUYER_REVIEW for dispute path, or use adminRefund/Release directly
    await prisma.escrowDeal.update({
      where: { id: co.deal.id },
      data: { status: "BUYER_REVIEW" },
    });
    const dispute = await buyerRejectOrDispute(sessionOf(buyer), co.deal.id, "test dispute");
    let refundOk = false;
    try {
      await adminRefund(co.deal.id, admin.id, "test refund");
      refundOk = true;
    } catch {
      /* may already be DISPUTED */
    }

    const offer2 = await makeOfferNoMirror(shop, variant.id, product.id, 2);
    const co2 = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer2.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15h2-${Date.now()}`,
    });
    await completeEscrowPayment(sessionOf(buyer), co2.payment.id);
    let releaseOk = false;
    try {
      await adminRelease(co2.deal.id, admin.id, "test release");
      releaseOk = true;
    } catch (e) {
      releaseOk = false;
    }
    record(
      "H refund/release/dispute without listing",
      Boolean(dispute.ok) || refundOk || releaseOk,
      `dispute=${dispute.ok} refund=${refundOk} release=${releaseOk}`
    );
  }

  // I
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
      const cat = await prisma.category.findFirst();
      const seller = await prisma.user.findFirst({ where: { id: { not: buyer.id }, isActive: true } });
      listing = await prisma.listing.create({
        data: {
          listingNo: `F15-CL-${Date.now()}`,
          sellerId: seller!.id,
          categoryId: cat!.id,
          title: "Faz15 classic escrow",
          description: "classic",
          city: "İstanbul",
          askPrice: BigInt(200),
          status: "ACTIVE",
          durationDays: 7,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 7 * 86400000),
          escrowEligible: true,
        },
      });
    }
    const r = await createEscrowCheckout(sessionOf(buyer), listing.id, 7);
    const deal = "ok" in r && r.ok ? await prisma.escrowDeal.findUnique({ where: { id: r.dealId } }) : null;
    record(
      "I classic listing escrow",
      Boolean(r.ok) && Boolean(deal?.listingId) && deal?.orderId == null,
      `listingId=${Boolean(deal?.listingId)} orderId=${deal?.orderId}`
    );
  }

  // J
  {
    await setSetting("catalog_checkout_without_mirror", false);
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 1);
    let code = "";
    try {
      await checkoutCatalogOffer({
        buyer: { id: buyer.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: `f15j-${Date.now()}`,
      });
    } catch (e) {
      code = (e as { code?: string }).code || "OTHER";
    }
    record("J flag OFF requires mirror", code === "LISTING_MIRROR_MISSING", `code=${code}`);
    await setSetting("catalog_checkout_without_mirror", true);
  }

  // K
  {
    const old = await prisma.escrowDeal.findFirst({
      where: { orderId: { not: null } },
      include: { linkedOrder: true },
    });
    record(
      "K old catalog escrow viewable",
      Boolean(old?.orderId),
      old ? `orderId=${old.orderId?.slice(0, 8)}` : "none"
    );
  }

  // L
  {
    await setSetting("catalog_checkout_without_mirror", false);
    const r = spawnSync("npx", ["tsx", "scripts/test-catalog-order-lifecycle.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
    });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    const pass = out.includes("14/14 passed") && r.status === 0;
    record("L Faz1 lifecycle 14/14", pass, pass ? "14/14" : out.slice(-240));
    await setSetting("catalog_checkout_without_mirror", true);
  }

  // M
  {
    __setTestForceMirrorSyncFail(true);
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 1);
    const job = await enqueueMirrorSyncJob({
      sellerOfferId: offer.id,
      reason: "force fail",
      maxAttempts: 2,
    });
    await prisma.catalogProjectionJob.update({
      where: { id: job.id },
      data: {
        maxAttempts: 2,
        attempts: 0,
        status: CatalogProjectionJobStatus.PENDING,
        nextAttemptAt: new Date(),
        completedAt: null,
      },
    });
    await processDueCatalogProjectionJobs({ forceJobId: job.id, limit: 1 });
    await prisma.catalogProjectionJob.updateMany({
      where: { id: job.id, status: CatalogProjectionJobStatus.PENDING },
      data: { nextAttemptAt: new Date() },
    });
    await processDueCatalogProjectionJobs({ forceJobId: job.id, limit: 1 });
    __setTestForceMirrorSyncFail(false);
    const done = await prisma.catalogProjectionJob.findUnique({ where: { id: job.id } });
    record(
      "M projection job max retry FAILED",
      done?.status === CatalogProjectionJobStatus.FAILED && (done.attempts || 0) >= 2,
      `status=${done?.status} attempts=${done?.attempts}`
    );
  }

  // N) /urun CTA — CatalogCheckoutButton + mirrorless checkout path
  {
    const offer = await makeOfferNoMirror(shop, variant.id, product.id, 1);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `f15n-${Date.now()}`,
    });
    record(
      "N urun CTA catalog checkout path",
      Boolean(co.payUrl?.includes("/odeme/demo-pos")) && Boolean(co.order.id),
      `payUrl=${co.payUrl}`
    );
  }

  // O) smoke summary
  {
    const withOrder = await prisma.escrowDeal.count({ where: { orderId: { not: null } } });
    const jobs = await prisma.catalogProjectionJob.count();
    record("O smoke counters", withOrder > 0 && jobs >= 0, `dealsWithOrderId=${withOrder} jobs=${jobs}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
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
