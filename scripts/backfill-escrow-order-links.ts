/**
 * Backfill raporu + belirsiz EscrowDeal kayıtları
 * npx tsx scripts/backfill-escrow-order-links.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deals = await prisma.escrowDeal.findMany({
    select: {
      id: true,
      listingId: true,
      orderId: true,
      sellerOfferId: true,
      meta: true,
      order: { select: { id: true } },
    },
  });

  const withOrderLink = deals.filter((d) => d.orderId).length;
  const catalogMeta = deals.filter(
    (d) => d.meta && typeof d.meta === "object" && (d.meta as { catalogCheckout?: boolean }).catalogCheckout
  );
  const classic = deals.filter(
    (d) =>
      !(d.meta && typeof d.meta === "object" && (d.meta as { catalogCheckout?: boolean }).catalogCheckout)
  );

  const ambiguous: Array<{ dealId: string; reason: string }> = [];

  for (const d of catalogMeta) {
    if (!d.orderId) {
      // Try find via reverse Order.escrowDealId
      const ord = await prisma.order.findFirst({ where: { escrowDealId: d.id } });
      if (!ord) {
        ambiguous.push({ dealId: d.id, reason: "CATALOG_NO_ORDER" });
      } else if (!d.orderId) {
        ambiguous.push({ dealId: d.id, reason: "CATALOG_ORDER_LINK_MISSING_AFTER_MIGRATE" });
      }
    } else {
      const items = await prisma.orderItem.findMany({ where: { orderId: d.orderId } });
      if (!items.length) {
        ambiguous.push({ dealId: d.id, reason: "NO_ORDER_ITEM" });
      } else {
        const offers = new Set(items.map((i) => i.sellerOfferId));
        if (offers.size !== 1) {
          ambiguous.push({ dealId: d.id, reason: "INCONSISTENT_SELLER_OFFER" });
        } else if (!d.sellerOfferId) {
          ambiguous.push({ dealId: d.id, reason: "SELLER_OFFER_NOT_BACKFILLED" });
        }
      }
    }
  }

  // Multiple orders pointing same deal (should be impossible with unique escrowDealId)
  const multi = await prisma.$queryRaw<Array<{ escrowDealId: string; c: bigint }>>`
    SELECT "escrowDealId", COUNT(*)::bigint AS c
    FROM "Order"
    WHERE "escrowDealId" IS NOT NULL
    GROUP BY "escrowDealId"
    HAVING COUNT(*) > 1
  `;
  for (const row of multi) {
    ambiguous.push({ dealId: row.escrowDealId, reason: "MULTIPLE_ORDERS_SAME_DEAL" });
  }

  console.log(
    JSON.stringify(
      {
        totalDeals: deals.length,
        withOrderId: withOrderLink,
        classicCount: classic.length,
        catalogMetaCount: catalogMeta.length,
        ambiguousCount: ambiguous.length,
        ambiguous: ambiguous.slice(0, 50),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
