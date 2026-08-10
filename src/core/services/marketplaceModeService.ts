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

/** Teklifsiz modda ilan detayı kalan süre sayacı */
export async function isClassifiedDetailCountdownEnabled(): Promise<boolean> {
  if (!(await isClassifiedMode())) return true;
  return (await getSetting<boolean>("classified_detail_countdown_enabled", true)) !== false;
}

/** Teklifsiz: tüm üyeler mesaj gönderebilsin */
export async function isClassifiedMessagingEveryone(): Promise<boolean> {
  if (!(await isClassifiedMode())) return false;
  return (await getSetting<boolean>("classified_messaging_everyone", true)) !== false;
}

/** Teklifsiz: üyelik / iletişim bilgileri giriş yapanlara açık */
export async function isClassifiedMembershipPublic(): Promise<boolean> {
  if (!(await isClassifiedMode())) return false;
  return (await getSetting<boolean>("classified_membership_public", true)) !== false;
}
