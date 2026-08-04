export const EXTENSION_DAY_OPTIONS = [1, 3, 7, 14] as const;

export type ExtensionDayOption = (typeof EXTENSION_DAY_OPTIONS)[number];

/** Ek süre: yayın süresi dolmuş ve sonuçlanmamış (teklif yok / hiçbiri kabul edilmemiş). */
export function canRequestListingExtension(
  status?: string | null,
  opts?: { endsAt?: string | Date | null; approvedBidId?: string | null }
) {
  if (opts?.approvedBidId) return false;
  if (status === "APPROVED") return false;

  if (status === "SELECTION" || status === "EXPIRED") return true;

  // Cron henüz SELECTION'a çekmediyse: süresi dolmuş ACTIVE
  if (status === "ACTIVE" && opts?.endsAt) {
    const t = new Date(opts.endsAt).getTime();
    return Number.isFinite(t) && t <= Date.now();
  }

  return false;
}

export function isExtensionDayOption(days: number): days is ExtensionDayOption {
  return EXTENSION_DAY_OPTIONS.includes(days as ExtensionDayOption);
}
