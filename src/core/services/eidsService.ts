import { getSettingsMap } from "@/core/settings";

export type EidsMode = "mock" | "live";

export type EidsConfig = {
  enabled: boolean;
  mode: EidsMode;
  categories: string[];
  badgeText: string;
  showBadge: boolean;
  firmaKodu: string;
  mockAutoVerify: boolean;
  /** live istenmiş ama firma kodu yok → güvenli mock */
  effectiveMode: EidsMode;
};

export async function getEidsConfig(): Promise<EidsConfig> {
  const map = await getSettingsMap();
  const enabled = Boolean(map.eids_enabled ?? false);
  const modeRaw = String(map.eids_mode ?? "mock").toLowerCase();
  const mode: EidsMode = modeRaw === "live" ? "live" : "mock";
  const categories = Array.isArray(map.eids_categories)
    ? (map.eids_categories as string[]).map((s) => String(s).toLowerCase())
    : ["konut", "arac", "isyeri", "arsa", "kiralik"];
  const badgeText = String(
    map.eids_badge_text ??
      "Bu ilan için Ticaret Bakanlığı EİDS (Elektronik İlan Doğrulama Sistemi) yetkilendirmesi yapılmıştır."
  );
  const showBadge = map.eids_show_badge !== false;
  const firmaKodu = String(map.eids_firma_kodu ?? "").trim();
  const mockAutoVerify = map.eids_mock_auto_verify !== false;
  const effectiveMode: EidsMode = mode === "live" && firmaKodu ? "live" : "mock";

  return { enabled, mode, categories, badgeText, showBadge, firmaKodu, mockAutoVerify, effectiveMode };
}

export function isEidsCategory(categorySlug: string, categories: string[]) {
  return categories.includes(String(categorySlug || "").toLowerCase());
}

/** Public listing alanı: sadece admin EİDS açık + rozet açık + ilan doğrulanmışsa metin */
export async function resolveEidsBadge(listing: { eidsVerified?: boolean | null }) {
  const cfg = await getEidsConfig();
  if (!cfg.enabled || !cfg.showBadge || !listing.eidsVerified) return null;
  return cfg.badgeText;
}

export async function attachEidsBadge<T extends { eidsVerified?: boolean | null }>(listing: T) {
  const eidsBadge = await resolveEidsBadge(listing);
  return { ...listing, eidsBadge };
}

export async function attachEidsBadgeMany<T extends { eidsVerified?: boolean | null }>(listings: T[]) {
  const cfg = await getEidsConfig();
  const show = cfg.enabled && cfg.showBadge;
  return listings.map((l) => ({
    ...l,
    eidsBadge: show && l.eidsVerified ? cfg.badgeText : null,
  }));
}
