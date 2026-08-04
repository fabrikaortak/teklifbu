import { getSetting } from "@/core/settings";
import {
  isOffersEnabledMode,
  normalizeMarketplaceMode,
  type MarketplaceMode,
} from "@/lib/marketplaceMode";

export async function getMarketplaceMode(): Promise<MarketplaceMode> {
  const raw = await getSetting<string>("marketplace_mode", "bidding");
  return normalizeMarketplaceMode(raw);
}

/** true = klasik TeklifBu teklif akışı açık */
export async function isOffersEnabled(): Promise<boolean> {
  return isOffersEnabledMode(await getMarketplaceMode());
}

/** true = Sahibinden Teklifsiz (ilan / iletişim odaklı) */
export async function isClassifiedMode(): Promise<boolean> {
  return !(await isOffersEnabled());
}
