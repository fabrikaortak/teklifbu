import type { ListingStatus, SellerOfferStatus } from "@prisma/client";
import { CatalogCommerceError } from "@/lib/catalogCommerce";

/** Satıcının doğrudan set edebileceği hedef statusler */
const SELLER_ALLOWED: Record<string, SellerOfferStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["DRAFT", "ARCHIVED"],
  ACTIVE: ["PAUSED"],
  PAUSED: ["PENDING_REVIEW"],
  SOLD_OUT: [],
  REJECTED: ["PENDING_REVIEW"],
  ARCHIVED: [],
};

export function assertSellerStatusTransition(
  from: SellerOfferStatus,
  to: SellerOfferStatus
) {
  if (to === "ACTIVE") {
    throw new CatalogCommerceError(
      "FORBIDDEN_STATUS",
      "Satıcı offer'ı doğrudan ACTIVE yapamaz; admin onayı gerekir"
    );
  }
  const allowed = SELLER_ALLOWED[from] || [];
  if (!allowed.includes(to)) {
    throw new CatalogCommerceError(
      "FORBIDDEN_STATUS",
      `${from} → ${to} geçişine izin yok`
    );
  }
}

/**
 * Stok güncellemesi sonrası status:
 * - stock 0 → SOLD_OUT (ACTIVE veya zaten SOLD_OUT)
 * - SOLD_OUT + stock>0 + approvedAt → ACTIVE
 * - diğer durumlar stokla ACTIVE olmaz
 */
export function resolveStatusAfterStockChange(opts: {
  current: SellerOfferStatus;
  nextStock: number;
  approvedAt: Date | null;
  explicitStatus?: SellerOfferStatus;
}): SellerOfferStatus {
  if (opts.explicitStatus) return opts.explicitStatus;
  if (opts.nextStock <= 0) {
    if (opts.current === "ACTIVE" || opts.current === "SOLD_OUT") return "SOLD_OUT";
    return opts.current;
  }
  if (opts.current === "SOLD_OUT" && opts.approvedAt) {
    return "ACTIVE";
  }
  return opts.current;
}

export function listingStatusForOffer(
  offerStatus: SellerOfferStatus,
  currentListingStatus?: ListingStatus | null
): ListingStatus | null {
  switch (offerStatus) {
    case "PENDING_REVIEW":
      return "PENDING_REVIEW";
    case "ACTIVE":
      return "ACTIVE";
    case "SOLD_OUT":
      // Arşivlenmez; onaylı vitrin ACTIVE kalır
      if (
        currentListingStatus === "ACTIVE" ||
        currentListingStatus === "SELECTION" ||
        currentListingStatus === "PENDING_REVIEW" ||
        !currentListingStatus
      ) {
        return "ACTIVE";
      }
      return currentListingStatus;
    case "PAUSED":
      return "ARCHIVED";
    case "REJECTED":
      return "REJECTED";
    case "ARCHIVED":
      return "ARCHIVED";
    case "DRAFT":
      return "DRAFT";
    default:
      return null;
  }
}

export const CATALOG_MANAGED_LISTING_FIELDS = [
  "askPrice",
  "title",
  "coverImage",
  "images",
] as const;

export const CATALOG_MANAGED_ATTR_KEYS = [
  "stockQty",
  "condition",
  "sellerSku",
  "brand",
  "model",
  "variantTitle",
  "catalogOffer",
  "priceInKurus",
  "outOfStock",
] as const;
