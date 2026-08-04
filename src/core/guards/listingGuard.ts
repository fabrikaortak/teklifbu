import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureUserShop } from "@/core/services/tenantService";
import { getSetting } from "@/core/settings";
import { isCorporateAccount } from "@/lib/accountTypes";
import { isShopPackageBuyEnabledForAccount } from "@/core/services/shopPackagePurchaseService";

export type ListingGuardCode =
  | "COMMERCIAL_PENDING"
  | "COMMERCIAL_REJECTED"
  | "SHOP_PACKAGE_REQUIRED"
  | "SHOP_PACKAGE_LIMIT";

export type ListingLimitResult =
  | { allowed: true; shopId: string | null; tenantId: string; limit: number | null; used: number }
  | {
      allowed: false;
      error: string;
      code?: ListingGuardCode;
      limit: number;
      used: number;
      buyPopupEnabled?: boolean;
    };

const LISTING_COUNT_STATUSES: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.SELECTION,
  ListingStatus.DRAFT,
  ListingStatus.PENDING_REVIEW,
  ListingStatus.REJECTED,
];

/** Guard: package holders respect listingLimit; corporate must have active package. */
export async function guardListingCreate(userId: string): Promise<ListingLimitResult> {
  const { shop, tenant, user } = await ensureUserShop(userId);

  const approvalRequired = (await getSetting<boolean>("commercial_approval_required", true)) !== false;
  if (approvalRequired && isCorporateAccount(user.accountType)) {
    const st = String(user.commercialStatus || "PENDING").toUpperCase();
    const updatePendingOk =
      st === "PENDING" && user.isActive && Boolean(user.commercialReviewedAt);
    if (st !== "APPROVED" && !updatePendingOk) {
      return {
        allowed: false,
        error:
          st === "REJECTED"
            ? "Ticari üyeliğiniz reddedildi. Hesabım üzerinden bilgilerinizi güncelleyip tekrar başvurun."
            : "Ticari üyeliğiniz yönetici onayı bekliyor. Onaylanmadan ilan veremezsiniz.",
        code: st === "REJECTED" ? "COMMERCIAL_REJECTED" : "COMMERCIAL_PENDING",
        limit: 0,
        used: 0,
      };
    }
  }

  const buyPopupEnabled = await isShopPackageBuyEnabledForAccount(user.accountType);

  const sub = await prisma.shopSubscription.findUnique({
    where: { userId: user.id },
    include: { package: true },
  });
  const subActive = Boolean(sub && sub.isActive && sub.endsAt > new Date() && sub.package);

  // Kurumsal: paket zorunlu
  if (isCorporateAccount(user.accountType)) {
    if (!shop) {
      return { allowed: true, shopId: null, tenantId: tenant.id, limit: null, used: 0 };
    }
    if (!subActive) {
      return {
        allowed: false,
        error: "Kurumsal paket aboneliğiniz yok veya süresi dolmuş. Paket satın alın veya yenileyin.",
        code: "SHOP_PACKAGE_REQUIRED",
        limit: 0,
        used: 0,
        buyPopupEnabled,
      };
    }
  } else if (!subActive) {
    // Bireysel: paketsiz freemium / ücretli ilan akışı
    return { allowed: true, shopId: null, tenantId: tenant.id, limit: null, used: 0 };
  }

  const limit = Number(sub!.package.listingLimit) || 0;
  const used = shop
    ? await prisma.listing.count({
        where: { shopId: shop.id, status: { in: LISTING_COUNT_STATUSES } },
      })
    : await prisma.listing.count({
        where: { sellerId: user.id, status: { in: LISTING_COUNT_STATUSES } },
      });

  if (used >= limit) {
    return {
      allowed: false,
      error: `İlan limitine ulaşıldı (${used}/${limit}). Paketinizi yükseltin veya yenileyin.`,
      code: "SHOP_PACKAGE_LIMIT",
      limit,
      used,
      buyPopupEnabled,
    };
  }

  return {
    allowed: true,
    shopId: shop?.id || null,
    tenantId: tenant.id,
    limit,
    used,
  };
}
