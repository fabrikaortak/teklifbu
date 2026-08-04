import { BidStatus, ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateListingNo } from "@/lib/listingNo";
import { DEMO_LISTING_SEEDS } from "@/data/demoListings";
import { invalidateFacetCache } from "@/lib/facetCounts";
import { ensureDefaultTenant } from "@/core/services/tenantService";
import { setSetting, invalidateSettingsCache } from "@/core/settings";

const DEMO_FLAG = "_demo";
const DEMO_SELLER_PHONE = "05321112233";
const DEMO_SELLER_EMAIL = "demo-satici@teklifbu.com";
const DEMO_BUYER_EMAIL_SUFFIX = "@teklifbu-demo.local";

export function demoAttributes(attrs: Record<string, unknown>) {
  return { ...attrs, [DEMO_FLAG]: true };
}

export async function findDemoListingIds(): Promise<string[]> {
  const rows = await prisma.listing.findMany({
    where: {
      attributes: {
        path: [DEMO_FLAG],
        equals: true,
      },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function countDemoListings() {
  return prisma.listing.count({
    where: {
      attributes: {
        path: [DEMO_FLAG],
        equals: true,
      },
    },
  });
}

async function resolveDemoSeller(adminId: string) {
  const tenant = await ensureDefaultTenant(adminId);
  let seller = await prisma.user.findUnique({ where: { phone: DEMO_SELLER_PHONE } });
  if (!seller) {
    seller = await prisma.user.create({
      data: {
        phone: DEMO_SELLER_PHONE,
        phoneVerified: true,
        name: "Demo Satıcı",
        email: DEMO_SELLER_EMAIL,
        accountType: "BIREYSEL",
        tokenBalance: 100,
        tenantId: tenant.id,
      },
    });
  }
  return { seller, tenant };
}

async function ensureDemoBuyers(adminId: string, count = 3) {
  const tenant = await ensureDefaultTenant(adminId);
  const buyers = [];
  for (let i = 1; i <= count; i++) {
    const phone = `0532999010${i}`;
    const email = `demo-alici-${i}${DEMO_BUYER_EMAIL_SUFFIX}`;
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          phoneVerified: true,
          name: `Demo Alıcı ${i}`,
          email,
          accountType: "BIREYSEL",
          tokenBalance: 50,
          tenantId: tenant.id,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { tokenBalance: Math.max(user.tokenBalance, 20), phoneVerified: true },
      });
    }
    buyers.push(user);
  }
  return buyers;
}

/** Demo ilanları oluştur (varsayılan: DRAFT — yayınla ile ACTIVE). */
export async function seedDemoListings(adminId: string, opts?: { asActive?: boolean }) {
  const asActive = opts?.asActive === true;
  const { seller, tenant } = await resolveDemoSeller(adminId);
  const cats = await prisma.category.findMany({ select: { id: true, slug: true, isActive: true } });
  const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c]));

  const existing = await countDemoListings();
  if (existing > 0) {
    return {
      ok: false as const,
      error: `Zaten ${existing} demo ilan var. Önce «Demo ilanları kaldır» deyin veya «Yeniden yükle» kullanın.`,
      created: 0,
      skipped: 0,
      total: existing,
    };
  }

  const now = new Date();
  const ends = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let created = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const seed of DEMO_LISTING_SEEDS) {
    const cat = bySlug[seed.categorySlug];
    if (!cat) {
      skipped += 1;
      missing.push(seed.categorySlug);
      continue;
    }
    const listingNo = await generateListingNo();
    const status = asActive ? ListingStatus.ACTIVE : ListingStatus.DRAFT;
    await prisma.listing.create({
      data: {
        listingNo,
        sellerId: seller.id,
        tenantId: tenant.id,
        categoryId: cat.id,
        title: seed.title,
        description: seed.description,
        city: seed.city,
        district: seed.district,
        neighborhood: seed.neighborhood || null,
        dealType: seed.dealType,
        askPrice: BigInt(seed.askPrice),
        highestBid: BigInt(seed.highestBid || 0),
        bidCount: seed.bidCount || 0,
        status,
        isFeatured: Boolean(seed.isFeatured),
        durationDays: 7,
        startsAt: asActive ? now : null,
        endsAt: asActive ? ends : null,
        coverImage: seed.coverImage,
        images: [seed.coverImage],
        attributes: demoAttributes(seed.attributes) as Prisma.InputJsonValue,
        contactPhone: seller.phone,
      },
    });
    created += 1;
  }

  invalidateFacetCache();
  return {
    ok: true as const,
    created,
    skipped,
    total: created,
    missing: [...new Set(missing)],
    status: asActive ? "ACTIVE" : "DRAFT",
  };
}

export async function publishDemoListings() {
  const ids = await findDemoListingIds();
  if (!ids.length) {
    return { ok: false as const, error: "Demo ilan yok. Önce yükleyin.", updated: 0 };
  }
  const now = new Date();
  const ends = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const res = await prisma.listing.updateMany({
    where: { id: { in: ids } },
    data: {
      status: ListingStatus.ACTIVE,
      startsAt: now,
      endsAt: ends,
      durationDays: 7,
      rejectionReason: null,
      reviewedAt: now,
    },
  });
  invalidateFacetCache();
  return { ok: true as const, updated: res.count };
}

export async function removeDemoListings() {
  const ids = await findDemoListingIds();
  if (!ids.length) {
    return { ok: true as const, removed: 0 };
  }

  await prisma.message.updateMany({
    where: { listingId: { in: ids } },
    data: { listingId: null },
  });
  await prisma.listing.updateMany({
    where: { id: { in: ids } },
    data: { approvedBidId: null },
  });

  const res = await prisma.listing.deleteMany({ where: { id: { in: ids } } });
  invalidateFacetCache();
  return { ok: true as const, removed: res.count };
}

async function removeDemoUsers() {
  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: DEMO_SELLER_EMAIL },
        { email: { endsWith: DEMO_BUYER_EMAIL_SUFFIX } },
        { phone: DEMO_SELLER_PHONE },
        { phone: { startsWith: "0532999010" } },
      ],
    },
    select: { id: true },
  });
  let removed = 0;
  for (const u of demoUsers) {
    const remainingListings = await prisma.listing.count({ where: { sellerId: u.id } });
    if (remainingListings > 0) continue;
    await prisma.bid.deleteMany({ where: { bidderId: u.id } });
    await prisma.favorite.deleteMany({ where: { userId: u.id } });
    await prisma.message.deleteMany({
      where: { OR: [{ senderId: u.id }, { receiverId: u.id }] },
    });
    try {
      await prisma.user.delete({ where: { id: u.id } });
      removed += 1;
    } catch {
      /* ilişkili kayıt varsa atla */
    }
  }
  return removed;
}

/** Tüm demo ilan + demo kullanıcıları siler (akışı kapat). */
export async function removeAllDemoData() {
  const listings = await removeDemoListings();
  const usersRemoved = await removeDemoUsers();
  return {
    ok: true as const,
    removed: listings.removed,
    usersRemoved,
  };
}

/**
 * Canlı teklif + tamamlanan satışlar için demo ilanları zenginleştirir.
 */
export async function enrichDemoMarketplaceFlow(adminId: string) {
  const listings = await prisma.listing.findMany({
    where: {
      attributes: { path: [DEMO_FLAG], equals: true },
      status: ListingStatus.ACTIVE,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, askPrice: true, highestBid: true },
  });
  if (!listings.length) {
    return { ok: false as const, error: "Aktif demo ilan yok.", bids: 0, sales: 0 };
  }

  const buyers = await ensureDemoBuyers(adminId, 3);
  const now = new Date();
  let bidsCreated = 0;
  let salesCreated = 0;

  const liveSlice = listings.slice(0, Math.min(12, listings.length));
  for (let i = 0; i < liveSlice.length; i++) {
    const listing = liveSlice[i];
    const bidder = buyers[i % buyers.length];
    const ask = Number(listing.askPrice);
    const amount = BigInt(Math.max(10000, Math.floor((ask * (0.88 + (i % 5) * 0.02)) / 10000) * 10000));
    const expiresAt = new Date(now.getTime() + (3 + (i % 5)) * 24 * 60 * 60 * 1000);
    await prisma.bid.create({
      data: {
        listingId: listing.id,
        bidderId: bidder.id,
        amount,
        durationDays: 3 + (i % 5),
        expiresAt,
        status: BidStatus.ACTIVE,
        tokensSpent: 1,
      },
    });
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        highestBid: amount,
        bidCount: { increment: 1 },
      },
    });
    bidsCreated += 1;
  }

  const saleSlice = listings.slice(liveSlice.length, liveSlice.length + 8);
  for (let i = 0; i < saleSlice.length; i++) {
    const listing = saleSlice[i];
    const bidder = buyers[i % buyers.length];
    const ask = Number(listing.askPrice);
    const amount = BigInt(Math.max(10000, Math.floor((ask * (0.92 + (i % 4) * 0.02)) / 10000) * 10000));
    const hoursAgo = 2 + i * 5;
    const soldAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    const bid = await prisma.bid.create({
      data: {
        listingId: listing.id,
        bidderId: bidder.id,
        amount,
        durationDays: 7,
        expiresAt: new Date(soldAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: BidStatus.APPROVED,
        tokensSpent: 1,
        createdAt: soldAt,
        updatedAt: soldAt,
      },
    });
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: ListingStatus.APPROVED,
        highestBid: amount,
        bidCount: Math.max(1, i + 1),
        approvedBidId: bid.id,
        endsAt: soldAt,
        updatedAt: soldAt,
      },
    });
    salesCreated += 1;
  }

  try {
    const { getSetting } = await import("@/core/settings");
    const current =
      (await getSetting<Record<string, boolean>>("recent_sales_placements", {
        home: true,
        listing_detail: false,
        profile: false,
        ilanlar: false,
      })) || {};
    await setSetting("recent_sales_placements", {
      home: true,
      listing_detail: Boolean(current.listing_detail),
      profile: Boolean(current.profile),
      ilanlar: Boolean(current.ilanlar),
    });
    invalidateSettingsCache();
  } catch {
    /* ayar yoksa yoksay */
  }

  invalidateFacetCache();
  return { ok: true as const, bids: bidsCreated, sales: salesCreated, buyers: buyers.length };
}

/** Tek tık: temizle → yükle (ACTIVE) → teklif + satış akışı. */
export async function startDemoMarketplaceFlow(adminId: string) {
  const cleared = await removeAllDemoData();
  const seeded = await seedDemoListings(adminId, { asActive: true });
  if (!seeded.ok) {
    return { ok: false as const, error: seeded.error, cleared, seeded };
  }
  const enriched = await enrichDemoMarketplaceFlow(adminId);
  return {
    ok: true as const,
    cleared,
    created: seeded.created,
    skipped: seeded.skipped,
    bids: enriched.ok ? enriched.bids : 0,
    sales: enriched.ok ? enriched.sales : 0,
    buyers: enriched.ok ? enriched.buyers : 0,
    enrichError: enriched.ok ? undefined : enriched.error,
  };
}

export async function reloadDemoListings(adminId: string) {
  await removeDemoListings();
  return seedDemoListings(adminId, { asActive: false });
}
