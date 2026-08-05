import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { isCorporateAccount } from "@/lib/accountTypes";

const COUNT_STATUSES: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.SELECTION,
  ListingStatus.DRAFT,
  ListingStatus.PENDING_REVIEW,
  ListingStatus.APPROVED,
  ListingStatus.REJECTED,
  ListingStatus.EXPIRED,
  ListingStatus.ARCHIVED,
];

export type ListingFeeDecision = {
  mode: string;
  used: number;
  quota: number | null;
  feeTl: number;
  accountType: string;
  /** Bu ilan ücretsiz kotadan mı? */
  withinFreeQuota: boolean;
  requiresFee: boolean;
};

const DEFAULT_BY_TYPE: Record<string, number> = {
  BIREYSEL_TICARI: 0,
  TICARI: 0,
  BIREYSEL: 0,
  EMLAKCI: 0,
  GALERICI: 0,
};

function feeForAccountType(
  accountType: string,
  byType: Record<string, number> | null | undefined,
  fallback: number
): number {
  if (byType && typeof byType === "object" && accountType in byType) {
    const n = Number(byType[accountType]);
    // Tip satırı 0 ise genel ücreti kullan (admin genelde sadece "İlan ücreti" doldurur)
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Kurumsal eski tipler → TICARI satırına bak
  if (isCorporateAccount(accountType) && byType && Number(byType.TICARI) > 0) {
    return Number(byType.TICARI);
  }
  if (
    (accountType === "BIREYSEL" || accountType === "BIREYSEL_TICARI") &&
    byType &&
    Number(byType.BIREYSEL_TICARI) > 0
  ) {
    return Number(byType.BIREYSEL_TICARI);
  }
  return Math.max(0, Number(fallback) || 0);
}

function quotaForAccountType(
  accountType: string,
  byType: Record<string, number> | null | undefined,
  fallback: number
): number {
  const pick = (key: string) => {
    if (!byType || typeof byType !== "object" || !(key in byType)) return null;
    const n = Number(byType[key]);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const direct = pick(accountType);
  if (direct != null) return direct;

  if (isCorporateAccount(accountType)) {
    const corp = pick("TICARI");
    if (corp != null) return corp;
  } else {
    const ind = pick("BIREYSEL_TICARI") ?? pick("BIREYSEL");
    if (ind != null) return ind;
  }

  return Math.max(0, Number(fallback) || 0);
}

/** Freemium / ücretli ilan kararı — bireysel ve kurumsal satıcılar için. */
export async function resolveListingFee(userId: string): Promise<ListingFeeDecision> {
  const mode = String((await getSetting<string>("listing_fee_mode", "free")) || "free");
  const quotaGlobal = Number((await getSetting<number>("listing_free_quota", 3)) || 0);
  const feeGlobal = Number((await getSetting<number>("listing_fee_tl", 0)) || 0);
  const byTypeFee = await getSetting<Record<string, number>>("listing_fee_by_account_type", {
    ...DEFAULT_BY_TYPE,
  });
  const byTypeQuota = await getSetting<Record<string, number>>("listing_free_quota_by_account_type", {
    BIREYSEL_TICARI: 3,
    TICARI: 3,
    BIREYSEL: 3,
    EMLAKCI: 3,
    GALERICI: 3,
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  });
  const accountType = user?.accountType || "BIREYSEL_TICARI";
  const feeTl = feeForAccountType(String(accountType), byTypeFee, feeGlobal);
  const quota = quotaForAccountType(String(accountType), byTypeQuota, quotaGlobal);

  const used = await prisma.listing.count({
    where: { sellerId: userId, status: { in: COUNT_STATUSES } },
  });

  if (mode === "free") {
    return {
      mode,
      used,
      quota: null,
      feeTl: 0,
      accountType: String(accountType),
      withinFreeQuota: true,
      requiresFee: false,
    };
  }

  if (mode === "paid") {
    return {
      mode,
      used,
      quota: null,
      feeTl,
      accountType: String(accountType),
      withinFreeQuota: false,
      requiresFee: feeTl > 0,
    };
  }

  // freemium
  const withinFreeQuota = used < quota;
  return {
    mode: "freemium",
    used,
    quota,
    feeTl,
    accountType: String(accountType),
    withinFreeQuota,
    requiresFee: !withinFreeQuota && feeTl > 0,
  };
}
