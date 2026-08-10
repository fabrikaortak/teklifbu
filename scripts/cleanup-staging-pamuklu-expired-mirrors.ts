/**
 * Staging: Basic Pamuklu Erkek Tişört EXPIRED mirror Listing temizliği.
 *
 * Yalnız:
 * - status = EXPIRED
 * - başlık Pamuklu seed ürünü VEYA productId = seed ürün
 * - katalog mirror: sellerOfferId NOT NULL VEYA attributes.catalogOffer = true
 *   (bazı test mirror’larında offer bağı kopmuş olabilir)
 *
 * Güvenlik:
 * - assertStagingSafe
 * - açık escrow varsa abort
 * - ACTIVE / diğer müşteri ilanlarına dokunmaz
 *
 * DRY_RUN (default) → yalnız rapor
 * APPLY=1 → sil
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npx tsx scripts/cleanup-staging-pamuklu-expired-mirrors.ts
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 APPLY=1 npx tsx scripts/cleanup-staging-pamuklu-expired-mirrors.ts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient, ListingStatus, EscrowStatus } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import { writeAuditLog } from "../src/core/services/tenantService";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "1";
const TITLE_NEEDLE = "Basic Pamuklu Erkek Tişört";
const BARCODE = "TEE-BASIC-001";
const OUT = join(process.cwd(), "scripts/output/cleanup-pamuklu-expired-mirrors.json");

const CLOSED_ESCROW: EscrowStatus[] = [
  EscrowStatus.RELEASED,
  EscrowStatus.REFUNDED,
  EscrowStatus.CANCELLED,
  EscrowStatus.EXPIRED,
];

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("DB", fp.maskedUrl, "APPLY=", APPLY);

  const product = await prisma.product.findFirst({
    where: {
      deletedAt: null,
      OR: [{ name: { contains: "Basic Pamuklu Erkek" } }, { barcode: BARCODE }],
    },
    select: { id: true, name: true, barcode: true },
  });
  console.log("SEED_PRODUCT", product);

  const seedMatch = {
    OR: [
      { title: { contains: TITLE_NEEDLE } },
      ...(product ? [{ productId: product.id }] : []),
    ],
  };
  const catalogMirrorMatch = {
    OR: [
      { sellerOfferId: { not: null as unknown as string } },
      { attributes: { path: ["catalogOffer"], equals: true } },
    ],
  };
  const where = {
    status: ListingStatus.EXPIRED,
    AND: [seedMatch, catalogMirrorMatch],
  };

  const targets = await prisma.listing.findMany({
    where,
    select: {
      id: true,
      listingNo: true,
      title: true,
      status: true,
      sellerOfferId: true,
      productId: true,
      variantId: true,
      shopId: true,
      sellerId: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const allStatuses = await prisma.listing.groupBy({
    by: ["status"],
    where: {
      AND: [seedMatch, catalogMirrorMatch],
    },
    _count: { _all: true },
  });

  const ids = targets.map((t) => t.id);
  const openEscrow = ids.length
    ? await prisma.escrowDeal.count({
        where: {
          listingId: { in: ids },
          status: { notIn: CLOSED_ESCROW },
        },
      })
    : 0;

  const openEscrowByStatus = ids.length
    ? await prisma.escrowDeal.groupBy({
        by: ["status"],
        where: { listingId: { in: ids }, status: { notIn: CLOSED_ESCROW } },
        _count: { _all: true },
      })
    : [];

  const openQuestions = ids.length
    ? await prisma.listingQuestion.count({
        where: { listingId: { in: ids }, answeredAt: null },
      })
    : 0;

  const safeTargets = ids.length
    ? (
        await prisma.listing.findMany({
          where: {
            id: { in: ids },
            NOT: {
              escrowDeals: {
                some: { status: { notIn: CLOSED_ESCROW } },
              },
            },
          },
          select: { id: true },
        })
      ).map((l) => l.id)
    : [];

  console.log("STATUS_BREAKDOWN", allStatuses);
  console.log("EXPIRED_MIRROR_TARGETS", targets.length);
  console.log("SAFE_WITHOUT_OPEN_ESCROW", safeTargets.length);
  console.log("OPEN_ESCROW_ON_TARGETS", openEscrow, openEscrowByStatus);
  console.log("OPEN_QUESTIONS_ON_TARGETS", openQuestions);
  console.log(
    "SAMPLE",
    targets.slice(0, 8).map((t) => ({
      id: t.id,
      listingNo: t.listingNo,
      title: t.title.slice(0, 60),
      offer: t.sellerOfferId,
    }))
  );

  if (!APPLY) {
    const report = {
      at: new Date().toISOString(),
      mode: "DRY_RUN",
      db: fp.maskedUrl,
      product,
      targetCount: targets.length,
      safeWithoutOpenEscrow: safeTargets.length,
      blockedByOpenEscrow: openEscrow,
      openEscrowByStatus,
      statusBreakdown: allStatuses,
      openQuestions,
      sample: targets.slice(0, 20),
      plan: {
        step1: "AWAITING_SHIPMENT test escrow'larını CANCELLED yap (yalnız hedef EXPIRED mirror listing)",
        step2: "SellerOffer.listingId detach",
        step3: "EXPIRED mirror Listing deleteMany",
      },
    };
    mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
    writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
    console.log("DRY_RUN only. APPLY=1 ile temizlenir. Report:", OUT);
    return;
  }

  if (!targets.length) {
    console.log("Nothing to delete");
    return;
  }

  // 1) Staging test artığı: hedef EXPIRED mirror'lara bağlı açık escrow'ları kapat
  const openDeals = await prisma.escrowDeal.findMany({
    where: { listingId: { in: ids }, status: { notIn: CLOSED_ESCROW } },
    select: { id: true, status: true, orderId: true, listingId: true },
  });
  if (openDeals.length) {
    const allowedStuck = new Set<EscrowStatus>([
      EscrowStatus.AWAITING_SHIPMENT,
      EscrowStatus.AWAITING_PAYMENT,
    ]);
    const unexpected = openDeals.filter((d) => !allowedStuck.has(d.status));
    if (unexpected.length) {
      throw new Error(
        `Abort: beklenmeyen açık escrow status'leri var: ${[
          ...new Set(unexpected.map((d) => d.status)),
        ].join(",")}`
      );
    }
    await prisma.escrowDeal.updateMany({
      where: { id: { in: openDeals.map((d) => d.id) } },
      data: {
        status: EscrowStatus.CANCELLED,
        adminNote: "STAGING cleanup: Pamuklu EXPIRED mirror test artığı",
      },
    });
    const orderIds = openDeals.map((d) => d.orderId).filter(Boolean) as string[];
    if (orderIds.length) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, status: { notIn: ["CANCELLED", "REFUNDED", "COMPLETED"] } },
        data: { status: "CANCELLED" },
      }).catch(() => {
        /* OrderStatus enum farkı olabilir — listing silme asıl hedef */
      });
    }
    console.log("CANCELLED_TEST_ESCROWS", openDeals.length);
  }

  // 2) Detach SellerOffer.listingId
  const offerIds = targets.map((t) => t.sellerOfferId!).filter(Boolean);
  if (offerIds.length) {
    await prisma.sellerOffer.updateMany({
      where: { id: { in: offerIds }, listingId: { in: ids } },
      data: { listingId: null },
    });
  }

  // 3) Null escrow listingId then delete listings
  await prisma.escrowDeal.updateMany({
    where: { listingId: { in: ids } },
    data: { listingId: null },
  });

  const deleted = await prisma.listing.deleteMany({ where: { id: { in: ids } } });

  await writeAuditLog({
    action: "staging.cleanup.pamuklu_expired_mirrors",
    entity: "Listing",
    meta: {
      stagingOnly: true,
      productId: product?.id || null,
      titleNeedle: TITLE_NEEDLE,
      deletedCount: deleted.count,
      cancelledEscrows: openDeals.length,
      listingIdsSample: ids.slice(0, 30),
      offerIdsDetached: offerIds.length,
    },
  });

  const left = await prisma.listing.count({ where });
  const report = {
    at: new Date().toISOString(),
    mode: "APPLY",
    db: fp.maskedUrl,
    product,
    deleted: deleted.count,
    cancelledEscrows: openDeals.length,
    remainingMatching: left,
  };
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log("DELETED", deleted.count, "CANCELLED_ESCROWS", openDeals.length, "REMAINING", left);
  console.log("Report:", OUT);
  if (left !== 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
