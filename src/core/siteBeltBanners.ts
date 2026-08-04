import { getSetting } from "@/core/settings";

/** Sahibinden tarzı kuşak üstü / kuşak altı tek görsel banner */
export type BeltBannerConfig = {
  enabled: boolean;
  imageUrl: string;
  href: string;
  heightPx: number;
  /** 0 = tam genişlik (üstte viewport, ortada sayfa max) */
  widthPx: number;
};

export const DEFAULT_TOP_BELT_BANNER: BeltBannerConfig = {
  enabled: false,
  imageUrl: "",
  href: "",
  heightPx: 90,
  widthPx: 0,
};

export const DEFAULT_MID_BELT_BANNER: BeltBannerConfig = {
  enabled: false,
  imageUrl: "",
  href: "",
  heightPx: 120,
  widthPx: 0,
};

export function normalizeBeltBanner(raw: unknown, fallback: BeltBannerConfig): BeltBannerConfig {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  const heightPx = Math.min(400, Math.max(40, Number(o.heightPx) || fallback.heightPx));
  const widthPx = Math.min(2400, Math.max(0, Number(o.widthPx) || 0));
  return {
    enabled: o.enabled === true,
    imageUrl: String(o.imageUrl || "").trim(),
    href: String(o.href || "").trim(),
    heightPx,
    widthPx,
  };
}

export async function getTopBeltBanner(): Promise<BeltBannerConfig> {
  const raw = await getSetting<unknown>("site_top_belt_banner", DEFAULT_TOP_BELT_BANNER);
  return normalizeBeltBanner(raw, DEFAULT_TOP_BELT_BANNER);
}

export async function getMidBeltBanner(): Promise<BeltBannerConfig> {
  const raw = await getSetting<unknown>("site_mid_belt_banner", DEFAULT_MID_BELT_BANNER);
  return normalizeBeltBanner(raw, DEFAULT_MID_BELT_BANNER);
}
