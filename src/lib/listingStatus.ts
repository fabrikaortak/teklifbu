export const LIVE_LISTING_STATUSES = ["ACTIVE", "SELECTION"] as const;
export const OFFLINE_LISTING_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "REJECTED",
  "APPROVED",
  "EXPIRED",
  "ARCHIVED",
] as const;

export function listingStatusLabel(status?: string | null) {
  switch (status) {
    case "PENDING_REVIEW":
      return "Onay bekliyor";
    case "REJECTED":
      return "Reddedildi";
    case "ACTIVE":
      return "Yayında";
    case "SELECTION":
      return "Seçim aşaması";
    case "APPROVED":
      return "Sonuçlandı";
    case "EXPIRED":
      return "Süresi doldu";
    case "ARCHIVED":
      return "Arşiv";
    case "DRAFT":
      return "Taslak";
    default:
      return status || "—";
  }
}

export function isLiveListingStatus(status?: string | null) {
  return LIVE_LISTING_STATUSES.includes(status as (typeof LIVE_LISTING_STATUSES)[number]);
}

export function listingHasBids(listing?: { bidCount?: number | null; highestBid?: number | null } | null) {
  return Number(listing?.bidCount || 0) > 0 || Number(listing?.highestBid || 0) > 0;
}

export function canSellerEditListing(
  status?: string | null,
  opts?: { allowLiveEdit?: boolean }
) {
  if (
    status === "DRAFT" ||
    status === "PENDING_REVIEW" ||
    status === "REJECTED" ||
    status === "ARCHIVED" ||
    status === "EXPIRED"
  ) {
    return true;
  }
  if (opts?.allowLiveEdit && isLiveListingStatus(status)) return true;
  return false;
}

export function isListingRemovedForBidder(opts?: {
  listingGone?: boolean | null;
  listingStatus?: string | null;
}) {
  if (opts?.listingGone) return true;
  const s = opts?.listingStatus;
  return s === "ARCHIVED";
}

export function canSellerUnpublishListing(status?: string | null) {
  return status === "ACTIVE" || status === "SELECTION";
}

/** Sonuçlanan (teklif onaylı) ilan silinemez — satıcı ve admin dahil. */
export function canDeleteListing(status?: string | null) {
  return status !== "APPROVED";
}

/** @deprecated canDeleteListing kullanın */
export function canSellerDeleteListing(status?: string | null) {
  return canDeleteListing(status);
}

export const LISTING_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "DRAFT", label: "Taslak" },
  { value: "PENDING_REVIEW", label: "Onay bekliyor" },
  { value: "REJECTED", label: "Reddedildi" },
  { value: "ACTIVE", label: "Yayında" },
  { value: "SELECTION", label: "Seçim aşaması" },
  { value: "APPROVED", label: "Sonuçlandı" },
  { value: "EXPIRED", label: "Süresi doldu" },
  { value: "ARCHIVED", label: "Arşiv" },
];

export const BID_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "APPROVED", label: "Onaylandı" },
  { value: "REJECTED", label: "Reddedildi" },
  { value: "EXPIRED", label: "Süresi doldu" },
  { value: "WITHDRAWN", label: "Geri çekildi" },
];

export function bidStatusLabel(status?: string | null) {
  return BID_STATUS_OPTIONS.find((o) => o.value === status)?.label || status || "—";
}
