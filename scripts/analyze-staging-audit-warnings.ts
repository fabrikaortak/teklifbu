/**
 * Staging warning sınıflandırma + soft-delete / FAILED / legacy analiz
 * Salt okuma. STAGING_CONFIRMATION gerekli.
 *
 * npx tsx scripts/analyze-staging-audit-warnings.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  const reportPath = path.join(process.cwd(), "scripts", "output", "catalog-checkout-consistency-report.json");
  if (!fs.existsSync(reportPath)) throw new Error("Run npm run audit:catalog-checkout first");
  const audit = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
    warnings: Array<{ code: string; entity?: string; entityId?: string; message?: string; meta?: Record<string, unknown> }>;
  };

  const groups = {
    A_transition: audit.warnings.filter((w) => w.code === "CATALOG_DEAL_TRANSITION_BOTH_IDS"),
    B_test_artifacts: audit.warnings.filter((w) =>
      ["PAYMENT_PAID_ORDER_NOT_PAID_LEGACY", "ORDER_NO_IDEMPOTENCY_KEY", "PROJECTION_JOB_FAILED"].includes(w.code)
    ),
    C_data_quality: audit.warnings.filter((w) => w.code === "SELLER_OFFER_SOFT_DELETED"),
  };

  // --- A samples ---
  const transitionIds = groups.A_transition.map((w) => w.entityId!).filter(Boolean).slice(0, 5);
  const transitionDeals = await prisma.escrowDeal.findMany({
    where: { id: { in: transitionIds } },
    select: { id: true, createdAt: true, orderId: true, listingId: true, meta: true },
  });

  // --- B legacy payment mismatches ---
  const legacyPayWarnings = groups.B_test_artifacts.filter((w) => w.code === "PAYMENT_PAID_ORDER_NOT_PAID_LEGACY");
  const legacyDetails = [];
  for (const w of legacyPayWarnings) {
    const payment = await prisma.payment.findUnique({ where: { id: w.entityId! } });
    const orderId = String((w.meta as { orderId?: string })?.orderId || "");
    const order = orderId
      ? await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true, escrowDeal: true },
        })
      : null;
    const offerIds = order?.items.map((i) => i.sellerOfferId) || [];
    const offers = offerIds.length
      ? await prisma.sellerOffer.findMany({ where: { id: { in: offerIds } }, select: { id: true, stockQty: true, status: true } })
      : [];
    legacyDetails.push({
      paymentId: payment?.id,
      paymentStatus: payment?.status,
      paymentCreatedAt: payment?.createdAt,
      orderId: order?.id,
      orderStatus: order?.status,
      orderPaidAt: order?.paidAt,
      orderIdempotencyKey: order?.idempotencyKey,
      escrowStatus: order?.escrowDeal?.status,
      escrowListingId: order?.escrowDeal?.listingId,
      stockOffers: offers,
      looksLikeFlagOffTest: Boolean(order && !order.paidAt && order.status === "PENDING_PAYMENT" && payment?.status === "PAID"),
      realRisk: order?.status === "CANCELLED" ? "HIGH" : "LOW_TEST_ARTIFACT",
    });
  }

  const noKeyWarnings = groups.B_test_artifacts.filter((w) => w.code === "ORDER_NO_IDEMPOTENCY_KEY");
  const noKeyOrders = await prisma.order.findMany({
    where: { id: { in: noKeyWarnings.map((w) => w.entityId!).filter(Boolean).slice(0, 10) } },
    select: { id: true, createdAt: true, status: true, idempotencyKey: true },
  });

  // --- B FAILED jobs ---
  const failedJobs = await prisma.catalogProjectionJob.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
  });

  // --- C soft-deleted offers ---
  const softIds = [...new Set(groups.C_data_quality.map((w) => w.entityId!).filter(Boolean))];
  const softOffers = await prisma.sellerOffer.findMany({
    where: { id: { in: softIds } },
    select: {
      id: true,
      deletedAt: true,
      createdAt: true,
      status: true,
      stockQty: true,
      listingId: true,
      shopId: true,
      productId: true,
      variantId: true,
      sellerSku: true,
    },
  });

  const softAnalysis = [];
  let withOrderItem = 0;
  let withActiveMirror = 0;
  let stgSeedLike = 0;
  let testLifecycleLike = 0;

  for (const o of softOffers.slice(0, softIds.length)) {
    const itemCount = await prisma.orderItem.count({ where: { sellerOfferId: o.id } });
    const activeMirror = o.listingId
      ? await prisma.listing.findFirst({
          where: { id: o.listingId, status: { in: ["ACTIVE", "PENDING_REVIEW", "SELECTION"] } },
          select: { id: true, status: true },
        })
      : null;
    // Also mirrors pointing via sellerOfferId
    const linkedActive = await prisma.listing.count({
      where: {
        sellerOfferId: o.id,
        status: { in: ["ACTIVE", "PENDING_REVIEW", "SELECTION"] },
      },
    });
    const isStg = Boolean(o.sellerSku?.startsWith("STG") || (o.deletedAt && o.createdAt > new Date(Date.now() - 2 * 86400000)));
    // lifecycle tests archive ACTIVE→ARCHIVED with deletedAt
    const looksTestArchive = o.status === "ARCHIVED" && Boolean(o.deletedAt);

    if (itemCount > 0) withOrderItem++;
    if (activeMirror || linkedActive > 0) withActiveMirror++;
    if (isStg) stgSeedLike++;
    if (looksTestArchive) testLifecycleLike++;

    softAnalysis.push({
      id: o.id,
      deletedAt: o.deletedAt,
      createdAt: o.createdAt,
      status: o.status,
      shopId: o.shopId,
      orderItemCount: itemCount,
      activeMirror: Boolean(activeMirror) || linkedActive > 0,
      mirrorListingId: activeMirror?.id || null,
      visibleInProductOfferList: false, // deletedAt not null → query with deletedAt:null excludes
      checkoutEligible: false,
      keepReason: itemCount > 0 ? "HISTORICAL_ORDER_ITEM" : looksTestArchive ? "TEST_ARCHIVE_CANDIDATE" : "ORPHAN_SOFT_DELETE",
      testLike: looksTestArchive || isStg,
    });
  }

  // Filter visibility note: catalog queries
  const filterNotes = {
    sellerOfferListUsesDeletedAtNull: true, // createSellerOffer / checkout findFirst deletedAt:null
    productPageOffers: "typically deletedAt:null — soft-deleted not shown",
    checkout: "checkoutCatalogOffer where deletedAt:null — cannot buy",
    orderHistory: "OrderItem.sellerOfferId FK remains for snapshot; offer soft-delete OK",
  };

  // Sample active UI check — count ACTIVE offers with deletedAt null vs soft
  const activeVisible = await prisma.sellerOffer.count({
    where: { deletedAt: null, status: "ACTIVE" },
  });
  const softButWouldLeakIfNoFilter = await prisma.sellerOffer.count({
    where: { deletedAt: { not: null }, status: "ACTIVE" },
  });

  const out = {
    generatedAt: new Date().toISOString(),
    db: fp,
    classification: {
      A_transition: {
        code: "CATALOG_DEAL_TRANSITION_BOTH_IDS",
        count: groups.A_transition.length,
        meaning: "Beklenen geçiş — orderId + listingId birlikte",
        samples: transitionDeals,
        testData: false,
        activeCheckoutImpact: "Düşük — geçiş uyumluluğu; warning beklenen",
      },
      B_test_artifacts: {
        count: groups.B_test_artifacts.length,
        byCode: {
          PAYMENT_PAID_ORDER_NOT_PAID_LEGACY: legacyPayWarnings.length,
          ORDER_NO_IDEMPOTENCY_KEY: noKeyWarnings.length,
          PROJECTION_JOB_FAILED: failedJobs.length,
        },
        legacyPaymentMismatches: legacyDetails,
        ordersWithoutIdempotencyKey: noKeyOrders,
        failedProjectionJobs: failedJobs.map((j) => ({
          id: j.id,
          sellerOfferId: j.sellerOfferId,
          lastError: j.lastError,
          attempts: j.attempts,
          maxAttempts: j.maxAttempts,
          createdAt: j.createdAt,
          testHookSource: String(j.lastError || "").includes("TEST_FORCE_MIRROR_SYNC_FAIL"),
        })),
        cleanupPlanFailedJobs:
          "Hepsi TEST_FORCE_MIRROR_SYNC_FAIL ise staging'de silinebilir veya status=COMPLETED + lastError=IGNORED_TEST_ARTIFACT (onay sonrası). Production mantığı değişmez.",
      },
      C_data_quality: {
        code: "SELLER_OFFER_SOFT_DELETED",
        count: softIds.length,
        withOrderItem,
        withActiveMirror,
        stgSeedLike,
        testLifecycleLike,
        activeVisibleOffers: activeVisible,
        softDeletedStillStatusActive: softButWouldLeakIfNoFilter,
        filterNotes,
        samples: softAnalysis.slice(0, 15),
        deletableCandidates: softAnalysis.filter((s) => s.keepReason === "TEST_ARCHIVE_CANDIDATE" && s.orderItemCount === 0).slice(0, 20),
        doNotDelete: softAnalysis.filter((s) => s.orderItemCount > 0).length,
        approvalRequired: true,
      },
    },
    suggestedTestDataFilter: {
      marker: "meta.stagingPhase / idempotencyKey prefix stg1-|f15|a-|b-| OR shop name STG Test / phone 059*",
      phase2Since: new Date().toISOString(),
      excludeCodesFromPhase2Noise: [
        "CATALOG_DEAL_TRANSITION_BOTH_IDS",
        "PAYMENT_PAID_ORDER_NOT_PAID_LEGACY",
        "ORDER_NO_IDEMPOTENCY_KEY",
        "PROJECTION_JOB_FAILED",
        "SELLER_OFFER_SOFT_DELETED",
      ],
      note: "Critical kurallar aynı; phase2 scope yalnız yeni shop allowlist + since tarihinden sonraki kayıtları tarar",
    },
  };

  const outFile = path.join(process.cwd(), "scripts", "output", "staging-warning-classification.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.error("Wrote", outFile);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
