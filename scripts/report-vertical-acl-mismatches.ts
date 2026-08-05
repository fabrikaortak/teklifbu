/**
 * Tek seferlik dikey ACL uyumsuzluk raporu (silme/kapatma yok).
 * npx tsx scripts/report-vertical-acl-mismatches.ts
 *
 * Çıktı: scripts/output/vertical-acl-mismatch-report.json
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient, ListingStatus } from "@prisma/client";
import { resolveListingVerticalFromDb, type ListingVertical } from "../src/lib/listingVertical";
import {
  allowedVerticalsForUser,
  userHasAlisverisCommerceAccess,
} from "../src/lib/verticalAccessPolicy";
import { writeAuditLog } from "../src/core/services/tenantService";

const prisma = new PrismaClient();

const OPEN_LISTING: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.SELECTION,
  ListingStatus.PENDING_REVIEW,
  ListingStatus.DRAFT,
  ListingStatus.REJECTED,
  ListingStatus.EXPIRED,
];

type ListingHit = {
  listingId: string;
  listingNo: string | null;
  title: string;
  status: string;
  categoryId: string;
  categorySlug: string | null;
  vertical: ListingVertical;
  userId: string;
  userName: string | null;
  phone: string | null;
  accountType: string;
  commercialSubtypes: string[];
  allowedVerticals: ListingVertical[];
};

async function main() {
  const listings = await prisma.listing.findMany({
    where: { status: { in: OPEN_LISTING } },
    select: {
      id: true,
      listingNo: true,
      title: true,
      status: true,
      categoryId: true,
      attributes: true,
      sellerId: true,
      category: { select: { slug: true } },
      seller: {
        select: {
          id: true,
          name: true,
          phone: true,
          accountType: true,
          commercialSubtypes: true,
          profile: true,
        },
      },
    },
    take: 20000,
  });

  const emlakOfisiWrong: ListingHit[] = [];
  const galeriWrong: ListingHit[] = [];
  const magazaWrong: ListingHit[] = [];

  for (const l of listings) {
    const vertical = await resolveListingVerticalFromDb({
      categoryId: l.categoryId,
      categorySlug: l.category?.slug,
      attributes: (l.attributes || {}) as Record<string, unknown>,
    });
    if (vertical === "unknown" || vertical === "premium") continue;

    const subtypes = (l.seller.commercialSubtypes || []).map((s) => String(s).toUpperCase());
    const allowed = allowedVerticalsForUser({
      id: l.seller.id,
      accountType: l.seller.accountType,
      commercialSubtypes: l.seller.commercialSubtypes,
      profile: l.seller.profile,
    });
    // Çoklu subtype sahibi doğru dikeydeyse raporlama
    if (allowed.has(vertical)) continue;

    const hit: ListingHit = {
      listingId: l.id,
      listingNo: l.listingNo,
      title: l.title,
      status: l.status,
      categoryId: l.categoryId,
      categorySlug: l.category?.slug || null,
      vertical,
      userId: l.seller.id,
      userName: l.seller.name,
      phone: l.seller.phone,
      accountType: l.seller.accountType,
      commercialSubtypes: subtypes,
      allowedVerticals: [...allowed],
    };

    if (subtypes.includes("EMLAK_OFISI") && (vertical === "vasita" || vertical === "alisveris")) {
      emlakOfisiWrong.push(hit);
    }
    if (subtypes.includes("GALERI") && (vertical === "emlak" || vertical === "alisveris")) {
      galeriWrong.push(hit);
    }
    if (subtypes.includes("MAGAZA") && (vertical === "emlak" || vertical === "vasita")) {
      magazaWrong.push(hit);
    }
  }

  const offers = await prisma.sellerOffer.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["ARCHIVED", "REJECTED"] },
    },
    select: {
      id: true,
      status: true,
      shopId: true,
      sellerId: true,
      productId: true,
      createdAt: true,
      seller: {
        select: {
          id: true,
          name: true,
          phone: true,
          accountType: true,
          commercialSubtypes: true,
          profile: true,
        },
      },
      shop: { select: { id: true, isActive: true, name: true } },
    },
    take: 20000,
  });

  const offersWithoutMagaza = [];
  const offersOnInactiveShop = [];
  for (const o of offers) {
    const hasMagaza = userHasAlisverisCommerceAccess({
      id: o.seller.id,
      accountType: o.seller.accountType,
      commercialSubtypes: o.seller.commercialSubtypes,
      profile: o.seller.profile,
    });
    const row = {
      offerId: o.id,
      status: o.status,
      shopId: o.shopId,
      shopName: o.shop?.name || null,
      shopActive: o.shop?.isActive ?? null,
      productId: o.productId,
      userId: o.sellerId,
      userName: o.seller.name,
      phone: o.seller.phone,
      accountType: o.seller.accountType,
      commercialSubtypes: o.seller.commercialSubtypes,
      createdAt: o.createdAt.toISOString(),
    };
    if (!hasMagaza) offersWithoutMagaza.push(row);
    if (o.shop && o.shop.isActive === false && o.status === "ACTIVE") {
      offersOnInactiveShop.push(row);
    }
  }

  const requests = await prisma.catalogProductRequest.findMany({
    where: { status: { in: ["PENDING", "DRAFT"] } },
    select: {
      id: true,
      status: true,
      proposedName: true,
      categoryId: true,
      shopId: true,
      requesterUserId: true,
      createdAt: true,
      requester: {
        select: {
          id: true,
          name: true,
          phone: true,
          accountType: true,
          commercialSubtypes: true,
          profile: true,
        },
      },
    },
    take: 20000,
  });

  const productRequestsWithoutMagaza = [];
  for (const r of requests) {
    const hasMagaza = userHasAlisverisCommerceAccess({
      id: r.requester.id,
      accountType: r.requester.accountType,
      commercialSubtypes: r.requester.commercialSubtypes,
      profile: r.requester.profile,
    });
    if (hasMagaza) continue;
    productRequestsWithoutMagaza.push({
      requestId: r.id,
      status: r.status,
      proposedName: r.proposedName,
      categoryId: r.categoryId,
      shopId: r.shopId,
      userId: r.requesterUserId,
      userName: r.requester.name,
      phone: r.requester.phone,
      accountType: r.requester.accountType,
      commercialSubtypes: r.requester.commercialSubtypes,
      createdAt: r.createdAt.toISOString(),
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    note: "Salt okunur admin inceleme raporu — otomatik silme/kapatma yok",
    summary: {
      emlakOfisiWrongListings: emlakOfisiWrong.length,
      galeriWrongListings: galeriWrong.length,
      magazaWrongListings: magazaWrong.length,
      sellerOffersWithoutMagaza: offersWithoutMagaza.length,
      productRequestsWithoutMagaza: productRequestsWithoutMagaza.length,
      activeOffersOnInactiveShop: offersOnInactiveShop.length,
    },
    buckets: {
      emlakOfisi_vasita_or_alisveris_listings: emlakOfisiWrong,
      galeri_emlak_or_alisveris_listings: galeriWrong,
      magaza_emlak_or_vasita_listings: magazaWrong,
      sellerOffers_without_magaza: offersWithoutMagaza,
      productRequests_without_magaza: productRequestsWithoutMagaza,
      activeSellerOffers_on_inactive_shop: offersOnInactiveShop,
    },
  };

  const outDir = join(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "vertical-acl-mismatch-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  try {
    await writeAuditLog({
      action: "vertical.acl.mismatch_report",
      entity: "VerticalAcl",
      entityId: "one-shot-report",
      meta: {
        ...report.summary,
        outputPath: outPath,
        timestamp: report.generatedAt,
      },
    });
  } catch {
    /* best-effort */
  }

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report written: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
