import { AccountType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const COUNTED_STATUSES: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.SIMULATED];

export type RevenuePurposeGroup = "listing_fee" | "token" | "shop_subscription" | "other";

function groupPurpose(purpose: string): RevenuePurposeGroup {
  const p = purpose.toLowerCase();
  if (p === "listing_fee") return "listing_fee";
  if (p.includes("token")) return "token";
  if (p === "shop_subscription" || p.includes("shop") || p.includes("subscription")) {
    return "shop_subscription";
  }
  return "other";
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getRevenueDashboard(opts?: { days?: number }) {
  const days = Math.min(365, Math.max(7, Number(opts?.days) || 30));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const payments = await prisma.payment.findMany({
    where: {
      status: { in: COUNTED_STATUSES },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          accountType: true,
        },
      },
    },
  });

  const allTime = await prisma.payment.groupBy({
    by: ["purpose", "status"],
    where: { status: { in: COUNTED_STATUSES } },
    _sum: { amountTl: true },
    _count: { _all: true },
  });

  const buckets: Record<
    RevenuePurposeGroup,
    { amountTl: number; count: number }
  > = {
    listing_fee: { amountTl: 0, count: 0 },
    token: { amountTl: 0, count: 0 },
    shop_subscription: { amountTl: 0, count: 0 },
    other: { amountTl: 0, count: 0 },
  };

  const shopByType: Record<string, { amountTl: number; count: number }> = {
    TICARI: { amountTl: 0, count: 0 },
    BIREYSEL_TICARI: { amountTl: 0, count: 0 },
    EMLAKCI: { amountTl: 0, count: 0 },
    GALERICI: { amountTl: 0, count: 0 },
    BIREYSEL: { amountTl: 0, count: 0 },
  };

  const seriesMap = new Map<string, { listingFees: number; tokens: number; shop: number; other: number; total: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    seriesMap.set(dayKey(d), { listingFees: 0, tokens: 0, shop: 0, other: 0, total: 0 });
  }

  let periodTotal = 0;
  for (const p of payments) {
    const g = groupPurpose(p.purpose);
    buckets[g].amountTl += p.amountTl;
    buckets[g].count += 1;
    periodTotal += p.amountTl;

    const key = dayKey(p.createdAt);
    const row = seriesMap.get(key);
    if (row) {
      row.total += p.amountTl;
      if (g === "listing_fee") row.listingFees += p.amountTl;
      else if (g === "token") row.tokens += p.amountTl;
      else if (g === "shop_subscription") row.shop += p.amountTl;
      else row.other += p.amountTl;
    }

    if (g === "shop_subscription") {
      const t = p.user.accountType || AccountType.BIREYSEL;
      if (!shopByType[t]) shopByType[t] = { amountTl: 0, count: 0 };
      shopByType[t].amountTl += p.amountTl;
      shopByType[t].count += 1;
    }
  }

  const allTimeBuckets: typeof buckets = {
    listing_fee: { amountTl: 0, count: 0 },
    token: { amountTl: 0, count: 0 },
    shop_subscription: { amountTl: 0, count: 0 },
    other: { amountTl: 0, count: 0 },
  };
  let allTimeTotal = 0;
  for (const row of allTime) {
    const g = groupPurpose(row.purpose);
    const amt = Number(row._sum.amountTl || 0);
    allTimeBuckets[g].amountTl += amt;
    allTimeBuckets[g].count += row._count._all;
    allTimeTotal += amt;
  }

  const activeSubs = await prisma.shopSubscription.findMany({
    where: { isActive: true, endsAt: { gt: new Date() } },
    include: {
      package: true,
      user: { select: { id: true, name: true, phone: true, accountType: true } },
      shop: { select: { id: true, name: true } },
    },
    orderBy: { endsAt: "asc" },
    take: 50,
  });

  const mrr = activeSubs.reduce((sum, s) => sum + (s.package?.monthlyPrice || 0), 0);

  const { getSetting } = await import("@/core/settings");
  const {
    REVENUE_EXPENSES_SETTING_KEY,
    normalizeRevenueExpenses,
  } = await import("@/lib/revenueFinance");
  const { extractPaymentVatTl } = await import("@/lib/vat");

  const allExpenses = normalizeRevenueExpenses(await getSetting(REVENUE_EXPENSES_SETTING_KEY, []));
  const sinceMs = since.getTime();
  const expenses = allExpenses.filter((e) => new Date(e.spentAt).getTime() >= sinceMs);
  const expensesTotalTl = expenses.reduce((s, e) => s + (e.grossTl ?? e.amountTl), 0);
  const expensesNetTl = expenses.reduce((s, e) => s + (e.netTl ?? e.amountTl), 0);
  const vatOutgoingTl = Math.round(expenses.reduce((s, e) => s + (e.vatTl || 0), 0) * 100) / 100;

  let vatCollectedTl = 0;
  for (const p of payments) {
    vatCollectedTl += extractPaymentVatTl(p.meta, p.amountTl);
  }
  vatCollectedTl = Math.round(vatCollectedTl * 100) / 100;
  const vatNetTl = Math.round((vatCollectedTl - vatOutgoingTl) * 100) / 100;

  // Net işletme: (brüt gelir − toplanan KDV) − (masraf KDV hariç)
  const netTl =
    Math.round((periodTotal - vatCollectedTl - expensesNetTl) * 100) / 100;

  // Dönemdeki tüm ödemeler (filtre için; sayfa altı liste)
  const periodPayments = await prisma.payment.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: { select: { id: true, name: true, phone: true, accountType: true } },
    },
  });

  return {
    days,
    since: since.toISOString(),
    period: {
      totalTl: periodTotal,
      ...buckets,
    },
    allTime: {
      totalTl: allTimeTotal,
      ...allTimeBuckets,
    },
    shopByAccountType: shopByType,
    mrrEstimateTl: mrr,
    activeSubscriptionCount: activeSubs.length,
    series: Array.from(seriesMap.entries()).map(([date, v]) => ({ date, ...v })),
    recent: payments.slice(0, 40).map((p) => ({
      id: p.id,
      amountTl: p.amountTl,
      purpose: p.purpose,
      group: groupPurpose(p.purpose),
      status: p.status,
      createdAt: p.createdAt,
      meta: p.meta,
      vatTl: extractPaymentVatTl(p.meta, p.amountTl),
      user: p.user,
    })),
    payments: periodPayments.map((p) => ({
      id: p.id,
      amountTl: p.amountTl,
      purpose: p.purpose,
      group: groupPurpose(p.purpose),
      status: p.status,
      createdAt: p.createdAt,
      meta: p.meta,
      vatTl: extractPaymentVatTl(p.meta, p.amountTl),
      user: p.user,
    })),
    activeSubscriptions: activeSubs.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      monthlyPrice: s.package.monthlyPrice,
      packageName: s.package.name,
      accountType: s.user.accountType,
      user: s.user,
      shopName: s.shop?.name || null,
    })),
    expenses,
    expensesAll: allExpenses.slice(0, 100),
    expensesTotalTl,
    expensesNetTl,
    vatCollectedTl,
    vatOutgoingTl,
    vatNetTl,
    /** geriye uyumluluk */
    vatTotalTl: vatCollectedTl,
    posFeesTl: 0,
    finance: null,
    netTl,
  };
}

/** İlan onay kuyruğu için satıcı sıra no + alınan ücret. */
export async function enrichPendingListingsWithFeeInfo<
  T extends { id: string; sellerId: string; createdAt: Date },
>(listings: T[]) {
  if (!listings.length) {
    return [] as Array<
      T & {
        sellerListingIndex: number;
        feePaidTl: number;
        feePaymentId: string | null;
        feePayment: {
          id: string;
          amountTl: number;
          status: string;
          purpose: string;
          createdAt: Date;
          meta: unknown;
          userId: string;
        } | null;
      }
    >;
  }

  const sellerIds = [...new Set(listings.map((l) => l.sellerId))];
  const listingIds = listings.map((l) => l.id);

  const [sellerListings, feePayments] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: { in: sellerIds } },
      select: { id: true, sellerId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        purpose: "listing_fee",
        status: { in: COUNTED_STATUSES },
        userId: { in: sellerIds },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const indexByListing = new Map<string, number>();
  const bySeller = new Map<string, typeof sellerListings>();
  for (const row of sellerListings) {
    const arr = bySeller.get(row.sellerId) || [];
    arr.push(row);
    bySeller.set(row.sellerId, arr);
  }
  for (const [, rows] of bySeller) {
    rows.forEach((r, i) => indexByListing.set(r.id, i + 1));
  }

  const feeByListing = new Map<string, (typeof feePayments)[number]>();
  for (const p of feePayments) {
    const meta = (p.meta || {}) as Record<string, unknown>;
    const lid = meta.listingId ? String(meta.listingId) : "";
    if (lid && listingIds.includes(lid) && !feeByListing.has(lid)) {
      feeByListing.set(lid, p);
    }
  }

  // listingId eşleşmezse: aynı satıcıda henüz tüketilmemiş / yakın zamanlı ücret
  for (const l of listings) {
    if (feeByListing.has(l.id)) continue;
    const candidate = feePayments.find((p) => {
      if (p.userId !== l.sellerId) return false;
      const meta = (p.meta || {}) as Record<string, unknown>;
      if (meta.listingId && String(meta.listingId) !== l.id) return false;
      const t = Math.abs(p.createdAt.getTime() - l.createdAt.getTime());
      return t < 1000 * 60 * 60 * 6; // 6 saat penceresi
    });
    if (candidate) feeByListing.set(l.id, candidate);
  }

  return listings.map((l) => {
    const fee = feeByListing.get(l.id) || null;
    return {
      ...l,
      sellerListingIndex: indexByListing.get(l.id) || 1,
      feePaidTl: fee?.amountTl ?? 0,
      feePaymentId: fee?.id ?? null,
      feePayment: fee
        ? {
            id: fee.id,
            amountTl: fee.amountTl,
            status: fee.status,
            purpose: fee.purpose,
            createdAt: fee.createdAt,
            meta: fee.meta,
            userId: fee.userId,
          }
        : null,
    };
  });
}

export async function recordShopSubscriptionPayment(opts: {
  userId: string;
  tenantId: string | null;
  amountTl: number;
  packageId: string;
  months: number;
  subscriptionId: string;
  accountType: string;
  simulatedBy?: string;
}) {
  const { calcVatBreakdown, vatMetaFromBreakdown } = await import("@/lib/vat");
  const vatRows = await prisma.$queryRaw<
    Array<{ pricesIncludeVat: boolean; vatPercent: number; name: string }>
  >`SELECT "pricesIncludeVat", "vatPercent", name FROM "ShopPackage" WHERE id = ${opts.packageId}`;
  const pricesIncludeVat = vatRows[0]?.pricesIncludeVat !== false;
  const vatPercent = Number(vatRows[0]?.vatPercent ?? 20);
  const vat = calcVatBreakdown(Math.max(0, opts.amountTl), vatPercent, pricesIncludeVat);
  return prisma.payment.create({
    data: {
      userId: opts.userId,
      tenantId: opts.tenantId,
      amountTl: vat.grossTl,
      purpose: "shop_subscription",
      status: PaymentStatus.SIMULATED,
      meta: {
        packageId: opts.packageId,
        packageName: vatRows[0]?.name || null,
        months: opts.months,
        subscriptionId: opts.subscriptionId,
        accountType: opts.accountType,
        simulatedBy: opts.simulatedBy || null,
        channel: "admin_assign",
        ...vatMetaFromBreakdown(vat),
      } as Prisma.InputJsonValue,
    },
  });
}
