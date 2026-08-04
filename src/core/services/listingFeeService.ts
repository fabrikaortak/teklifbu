import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";

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
  return Math.max(0, Number(fallback) || 0);
}

/** Freemium / ücretli ilan kararı — bireysel ve kurumsal satıcılar için. */
export async function resolveListingFee(userId: string): Promise<ListingFeeDecision> {
  const mode = String((await getSetting<string>("listing_fee_mode", "free")) || "free");
  const quota = Number((await getSetting<number>("listing_free_quota", 3)) || 0);
  const feeGlobal = Number((await getSetting<number>("listing_fee_tl", 0)) || 0);
  const byType = await getSetting<Record<string, number>>("listing_fee_by_account_type", {
    BIREYSEL_TICARI: 0,
    TICARI: 0,
    BIREYSEL: 0,
    EMLAKCI: 0,
    GALERICI: 0,
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  });
  const accountType = user?.accountType || "BIREYSEL_TICARI";
  const feeTl = feeForAccountType(String(accountType), byType, feeGlobal);

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
