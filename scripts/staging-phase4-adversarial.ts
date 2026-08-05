/**
 * Aşama 4 adversarial regresyon — mirror varsayımlarını kırmaya çalışır.
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npm run staging:phase4-adversarial
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
import {
  approveCatalogOffer,
  createSellerOffer,
} from "../src/core/services/catalog/catalogCommerceService";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import { CatalogCommerceError } from "../src/lib/catalogCommerce";
import {
  completeEscrowPayment,
  createEscrowCheckout,
  adminRefund,
  adminRelease,
  listEscrowDeals,
  sellerSubmitCargo,
} from "../src/core/services/escrowService";
import {
  enqueueMirrorSyncJob,
  processDueCatalogProjectionJobs,
} from "../src/core/services/catalog/catalogProjectionJobService";
import { listSellerMagazaOrders } from "../src/core/services/magazaPanelService";
import type { SessionUser } from "../src/lib/auth";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function sessionOf(
  u: { id: string; phone?: string | null; name?: string | null },
  role: "USER" | "ADMIN" = "USER"
): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || "STG ADV",
    role,
    accountType: "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
}

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("ADV_GUARD", fp.maskedUrl, "prodLook=", fp.looksProduction);

  const stamp = Date.now();
  const results: Array<{ name: string; pass: boolean; detail?: string; severity?: string }> = [];
  const record = (name: string, pass: boolean, detail = "", severity = "critical") => {
    results.push({ name, pass, detail, severity });
    console.log(`${pass ? "PASS" : "FAIL"} [${severity}] ${name}${detail ? ` — ${detail}` : ""}`);
  };

  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_checkout_without_mirror", true);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("admin yok");

  const seller = await prisma.user.create({
    data: {
      phone: `0594${String(stamp).slice(-7)}`,
      name: "STG ADV Seller",
      role: "USER",
      accountType: "TICARI",
      commercialSubtypes: ["MAGAZA"],
      commercialStatus: "APPROVED",
      isActive: true,
    },
  });
  const buyer = await prisma.user.create({
    data: {
      phone: `0593${String(stamp).slice(-7)}`,
      name: "STG ADV Buyer",
      role: "USER",
      accountType: "BIREYSEL_TICARI",
      isActive: true,
    },
  });

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("tenant yok");
  const shop = await prisma.shop.create({
    data: {
      ownerId: seller.id,
      tenantId: tenant.id,
      name: `STG ADV Magaza ${stamp}`,
      slug: `stg-adv-${stamp}`.slice(0, 60),
      accountType: "TICARI",
      isActive: true,
    },
  });
  const pkg = await prisma.shopPackage.findFirst({ where: { isActive: true } });
  if (pkg) {
    await prisma.shopSubscription.upsert({
      where: { userId: seller.id },
      create: {
        userId: seller.id,
        shopId: shop.id,
        packageId: pkg.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 90 * 86400000),
        isActive: true,
      },
      update: { shopId: shop.id, packageId: pkg.id, isActive: true },
    });
  }

  const category = await prisma.category.findFirst({
    where: { deletedAt: null, OR: [{ slug: { contains: "telefon" } }, { slug: { startsWith: "ikinci-el" } }] },
    orderBy: { level: "desc" },
  });
  if (!category) throw new Error("category yok");

  const productName = `STG ADV BreakMe ${stamp}`;
  const product = await prisma.product.create({
    data: {
      name: productName,
      slug: `stg-adv-${stamp}`,
      categoryId: category.id,
      status: "ACTIVE",
      description: "adversarial phase4",
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "ADV-V1",
      sku: `ADV-${stamp}`,
      attributesHash: `adv-${stamp}`,
      isActive: true,
    },
  });

  // ---------- A default create ----------
  const offerPending = await createSellerOffer({
    sellerId: seller.id,
    shopId: shop.id,
    productId: product.id,
    variantId: variant.id,
    priceTl: 77,
    stockQty: 5,
    city: "İstanbul",
  });
  record(
    "A1 default create → listingId null",
    offerPending.listingId == null && offerPending.status === "PENDING_REVIEW",
    `listingId=${offerPending.listingId} status=${offerPending.status}`
  );

  // ---------- B admin approve without listing (API path) ----------
  const approved = await approveCatalogOffer(offerPending.id, admin.id);
  record(
    "B1 approveCatalogOffer without listing → ACTIVE",
    approved.status === "ACTIVE" && approved.listingId == null,
    `status=${approved.status} listingId=${approved.listingId}`
  );

  // Simulate HTTP admin POST approve on a second offer
  const v2 = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "ADV-V2",
      sku: `ADV-${stamp}-2`,
      attributesHash: `adv-${stamp}-2`,
      isActive: true,
    },
  });
  const offer2 = await createSellerOffer({
    sellerId: seller.id,
    shopId: shop.id,
    productId: product.id,
    variantId: v2.id,
    priceTl: 88,
    stockQty: 4,
    city: "İstanbul",
  });
  // Direct service = same as new admin API
  await approveCatalogOffer(offer2.id, admin.id);
  const o2 = await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer2.id } });
  record("B2 second mirrorless offer approvable", o2.status === "ACTIVE" && !o2.listingId);

  // ---------- C listing approval queue does NOT contain mirrorless ----------
  const listingQueueHit = await prisma.listing.findFirst({
    where: { sellerOfferId: offerPending.id },
  });
  record(
    "C1 mirrorless offer NOT in listing moderation queue",
    listingQueueHit == null,
    `listing=${listingQueueHit?.id || "none"}`
  );

  // ---------- D checkout flag matrix ----------
  await setSetting("catalog_checkout_without_mirror", false);
  let flagOffBlocked = false;
  try {
    await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offerPending.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `adv-flagoff-${stamp}`,
    });
  } catch (e) {
    flagOffBlocked =
      e instanceof CatalogCommerceError && e.code === "LISTING_MIRROR_MISSING";
  }
  record(
    "D1 flag OFF + null listing → LISTING_MIRROR_MISSING",
    flagOffBlocked,
    `blocked=${flagOffBlocked}`
  );

  await setSetting("catalog_checkout_without_mirror", true);
  await prisma.sellerOffer.update({
    where: { id: offerPending.id },
    data: { stockQty: 5, status: "ACTIVE", deletedAt: null },
  });
  const co = await checkoutCatalogOffer({
    buyer: { id: buyer.id },
    sellerOfferId: offerPending.id,
    quantity: 1,
    shipDays: 7,
    idempotencyKey: `adv-ok-${stamp}`,
  });
  const deal0 = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
  record(
    "D2 flag ON checkout deal listingId null orderId set",
    deal0?.listingId == null && deal0?.orderId === co.order.id,
    `listingId=${deal0?.listingId} orderId=${deal0?.orderId?.slice(0, 8)}`
  );

  // ---------- E pay + statuses ----------
  await completeEscrowPayment(sessionOf(buyer), co.payment.id);
  const order = await prisma.order.findUnique({ where: { id: co.order.id } });
  const payment = await prisma.payment.findUnique({ where: { id: co.payment.id } });
  const dealPaid = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
  record(
    "E1 pay → Order/Payment PAID escrow AWAITING_SHIPMENT",
    order?.status === OrderStatus.PAID &&
      payment?.status === PaymentStatus.PAID &&
      dealPaid?.status === EscrowStatus.AWAITING_SHIPMENT &&
      dealPaid.listingId == null,
    `o=${order?.status} p=${payment?.status} e=${dealPaid?.status}`
  );

  // Demo-pos GET shape: escrow PAID + null listingId must expose purpose/orderId
  const payMeta = (payment?.meta || {}) as Record<string, unknown>;
  record(
    "E2 payment meta has orderId (demo-pos success path)",
    Boolean(payMeta.orderId) && payment?.purpose === "escrow_hold",
    `purpose=${payment?.purpose} orderId=${Boolean(payMeta.orderId)}`
  );

  // ---------- F cargo without listing ----------
  await sellerSubmitCargo(sessionOf(seller), co.deal.id, {
    trackingNo: `ADVTRACK${stamp}`,
    carrier: "Yurtiçi",
  });
  const afterCargo = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
  record(
    "F1 seller cargo without listing",
    (afterCargo?.status === EscrowStatus.BUYER_REVIEW ||
      afterCargo?.status === EscrowStatus.SHIPPED) &&
      Boolean(afterCargo.cargoTrackingNo) &&
      afterCargo.listingId == null,
    `status=${afterCargo?.status}`
  );

  // ---------- G magaza panel ----------
  const magazaRows = await listSellerMagazaOrders(seller.id, "all");
  const magazaHit = magazaRows.find((r) => r.id === co.deal.id);
  record(
    "G1 magaza orders shows catalog title (not crash)",
    Boolean(magazaHit?.listing?.title) &&
      String(magazaHit?.listing?.title || "").includes("STG ADV") &&
      !String(magazaHit?.listing?.title).includes("undefined"),
    `title=${magazaHit?.listing?.title}`
  );

  // ---------- H admin escrow search by product name ----------
  const searched = await listEscrowDeals({ q: "BreakMe", take: 50 });
  const searchHit = searched.some((d) => d.id === co.deal.id);
  record(
    "H1 admin escrow search by product snapshot name",
    searchHit,
    `hits=${searched.length} found=${searchHit}`
  );

  const searchedOrder = await listEscrowDeals({ q: co.order.orderNo, take: 20 });
  record(
    "H2 admin escrow search by orderNo",
    searchedOrder.some((d) => d.id === co.deal.id),
    `orderNo=${co.order.orderNo}`
  );

  // ---------- I href safety (no /ilan/undefined) ----------
  const dealsForBuyer = await prisma.escrowDeal.findMany({
    where: { id: co.deal.id },
    include: {
      listing: { select: { id: true, title: true } },
      linkedOrder: {
        select: {
          orderNo: true,
          items: { take: 1, select: { productId: true, productNameSnapshot: true } },
        },
      },
      sellerOffer: { select: { product: { select: { id: true, name: true } } } },
    },
  });
  const d0 = dealsForBuyer[0];
  const href =
    d0.listing?.id
      ? `/ilan/${d0.listing.id}`
      : d0.linkedOrder?.items?.[0]?.productId || d0.sellerOffer?.product?.id
        ? `/urun/${d0.linkedOrder?.items?.[0]?.productId || d0.sellerOffer?.product?.id}`
        : null;
  record(
    "I1 deal href never /ilan/undefined",
    href !== "/ilan/undefined" && href?.startsWith("/urun/") === true,
    `href=${href}`
  );

  // ---------- J projection no-op / no FAILED ----------
  await enqueueMirrorSyncJob({ sellerOfferId: offerPending.id, reason: "adv" });
  await processDueCatalogProjectionJobs(10);
  const jobs = await prisma.catalogProjectionJob.findMany({
    where: { sellerOfferId: offerPending.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const badFail = jobs.some(
    (j) =>
      j.status === CatalogProjectionJobStatus.FAILED &&
      !String(j.lastError || "").includes("NO_LISTING_MIRROR") &&
      !String(j.lastError || "").includes("IGNORED_TEST")
  );
  record(
    "J1 projection without listing does not hard-FAIL commerce",
    !badFail && jobs.every((j) => j.status !== CatalogProjectionJobStatus.FAILED || String(j.lastError || "").includes("NO_LISTING")),
    `jobs=${jobs.map((j) => `${j.status}:${j.lastError || "-"}`).join("|")}`
  );

  // ---------- K refund on mirrorless ----------
  // Need a fresh PAID deal for refund (current is SHIPPED)
  await prisma.sellerOffer.update({
    where: { id: offer2.id },
    data: { stockQty: 3, status: "ACTIVE" },
  });
  const coR = await checkoutCatalogOffer({
    buyer: { id: buyer.id },
    sellerOfferId: offer2.id,
    quantity: 1,
    shipDays: 7,
    idempotencyKey: `adv-ref-${stamp}`,
  });
  await completeEscrowPayment(sessionOf(buyer), coR.payment.id);
  await adminRefund(coR.deal.id, admin.id, "adv refund");
  const refDeal = await prisma.escrowDeal.findUnique({ where: { id: coR.deal.id } });
  record(
    "K1 admin refund mirrorless deal",
    refDeal?.status === EscrowStatus.REFUNDED && refDeal.listingId == null,
    `status=${refDeal?.status}`
  );

  // ---------- L release ----------
  const v3 = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "ADV-V3",
      sku: `ADV-${stamp}-3`,
      attributesHash: `adv-${stamp}-3`,
      isActive: true,
    },
  });
  const offer3 = await createSellerOffer({
    sellerId: seller.id,
    shopId: shop.id,
    productId: product.id,
    variantId: v3.id,
    priceTl: 99,
    stockQty: 2,
    city: "Ankara",
  });
  await approveCatalogOffer(offer3.id, admin.id);
  const coL = await checkoutCatalogOffer({
    buyer: { id: buyer.id },
    sellerOfferId: offer3.id,
    quantity: 1,
    shipDays: 7,
    idempotencyKey: `adv-rel-${stamp}`,
  });
  await completeEscrowPayment(sessionOf(buyer), coL.payment.id);
  await adminRelease(coL.deal.id, admin.id, "adv release");
  const relDeal = await prisma.escrowDeal.findUnique({ where: { id: coL.deal.id } });
  record(
    "L1 admin release mirrorless deal",
    relDeal?.status === EscrowStatus.RELEASED && relDeal.listingId == null,
    `status=${relDeal?.status}`
  );

  // ---------- M classic listing escrow regression ----------
  const classicListing = await prisma.listing.findFirst({
    where: {
      status: { in: ["ACTIVE", "SELECTION"] },
      sellerOfferId: null,
      productId: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!classicListing) {
    record("M1 classic escrow", false, "no classic listing", "critical");
  } else {
    const classicBuyer =
      (await prisma.user.findFirst({
        where: {
          id: { notIn: [classicListing.sellerId, buyer.id, seller.id] },
          role: "USER",
          isActive: true,
        },
      })) || buyer;
    const classic = await createEscrowCheckout(sessionOf(classicBuyer), classicListing.id, 7);
    const cDeal = await prisma.escrowDeal.findUnique({ where: { id: classic.dealId } });
    record(
      "M1 classic listing escrow intact",
      Boolean(cDeal?.listingId) && cDeal?.orderId == null,
      `listingId=${Boolean(cDeal?.listingId)} orderId=${cDeal?.orderId}`
    );
  }

  // ---------- N opt-in mirror still works ----------
  const v4 = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "ADV-V4-MIRROR",
      sku: `ADV-${stamp}-4`,
      attributesHash: `adv-${stamp}-4`,
      isActive: true,
    },
  });
  const offerMirror = await createSellerOffer({
    sellerId: seller.id,
    shopId: shop.id,
    productId: product.id,
    variantId: v4.id,
    priceTl: 110,
    stockQty: 2,
    city: "İzmir",
    createListingMirror: true,
  });
  record(
    "N1 opt-in createListingMirror=true creates listing",
    Boolean(offerMirror.listingId),
    `listingId=${offerMirror.listingId}`
  );

  // ---------- O favorites still listing-scoped (expected gap, warn only) ----------
  try {
    await prisma.favorite.create({
      data: { userId: buyer.id, listingId: "nonexistent-should-fail" },
    });
    record("O1 favorite without real listing rejected", false, "unexpected create", "warning");
  } catch {
    record(
      "O1 favorites remain listing-FK (Phase5 gap OK)",
      true,
      "Favorite.listingId required — catalog product favori yok",
      "warning"
    );
  }

  // ---------- P negative stock ----------
  const neg = await prisma.sellerOffer.count({
    where: { shopId: shop.id, stockQty: { lt: 0 } },
  });
  record("P1 no negative stock on ADV shop", neg === 0, `neg=${neg}`);

  // ---------- Q FAILED jobs from this run ----------
  const failedJobs = await prisma.catalogProjectionJob.count({
    where: {
      status: CatalogProjectionJobStatus.FAILED,
      sellerOfferId: { in: [offerPending.id, offer2.id, offer3.id] },
      NOT: { lastError: { contains: "TEST_FORCE" } },
    },
  });
  record("Q1 no unexpected FAILED projection for ADV offers", failedJobs === 0, `failed=${failedJobs}`);

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    db: fp,
    flag: await getSetting<boolean>("catalog_checkout_without_mirror", false),
    results,
    productId: product.id,
    shopId: shop.id,
  };
  fs.writeFileSync(path.join(outDir, "staging-phase4-adversarial-report.json"), JSON.stringify(report, null, 2));

  const criticalFails = results.filter((r) => !r.pass && r.severity === "critical");
  const warnFails = results.filter((r) => !r.pass && r.severity === "warning");
  console.log(
    `\nAdversarial ${results.filter((r) => r.pass).length}/${results.length} (critical fails=${criticalFails.length}, warn fails=${warnFails.length})`
  );
  if (criticalFails.length) {
    console.error(
      "CRITICAL FAILS:",
      criticalFails.map((f) => f.name).join(", ")
    );
    process.exit(1);
  }
  console.log("ADVERSARIAL PASS — ready for commit consideration");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
