/** /ilanlar ve anasayfa “Tümünü Gör” deep-link modları */

export type ListingBrowseMode =
  | "default"
  | "sold"
  | "live"
  | "ending"
  | "mostBids"
  | "profit"
  | "forYou";

export function modeFromParams(params: URLSearchParams): ListingBrowseMode {
  if (params.get("live") === "1") return "live";
  if (params.get("sold") === "1" && (params.get("sort") === "profit" || params.get("profit") === "1")) {
    return "profit";
  }
  if (params.get("sold") === "1") return "sold";
  if (params.get("ending") === "1" || params.get("sort") === "ending") return "ending";
  if (params.get("mostBids") === "today" || params.get("mostBids") === "1") return "mostBids";
  if (params.get("forYou") === "1") return "forYou";
  return "default";
}

export function modeTitle(mode: ListingBrowseMode, sellerId?: string | null): string {
  if (sellerId) return "Satıcının ilanları";
  switch (mode) {
    case "sold":
      return "Son Gerçekleşen Satışlar";
    case "live":
      return "Canlı Teklif Akışı";
    case "ending":
      return "Bitmek Üzere Olan İlanlar";
    case "mostBids":
      return "Bugün En Çok Teklif Alanlar";
    case "profit":
      return "En Çok Kazandıran Satışlar";
    case "forYou":
      return "Size Özel Öneriler";
    default:
      return "İlanlar";
  }
}

export function modeEmptyMessage(mode: ListingBrowseMode): string {
  switch (mode) {
    case "sold":
      return "Henüz sonuçlanan satış yok.";
    case "live":
      return "Henüz canlı teklif yok.";
    case "ending":
      return "Yakında biten ilan yok.";
    case "mostBids":
      return "Bugün henüz teklif alan ilan yok.";
    case "profit":
      return "Henüz kazançlı satış yok.";
    case "forYou":
      return "Şu an önerilecek ilan bulunamadı.";
    default:
      return "Bu filtrelere uygun ilan bulunamadı. Filtreleri genişletmeyi deneyin.";
  }
}

/** Filtre değişince mevcut mod query’sini koru */
export function appendModeToHref(href: string, mode: ListingBrowseMode): string {
  if (mode === "default") return href;
  const u = new URL(href, "http://local");
  switch (mode) {
    case "sold":
      u.searchParams.set("sold", "1");
      break;
    case "profit":
      u.searchParams.set("sold", "1");
      u.searchParams.set("sort", "profit");
      break;
    case "live":
      u.searchParams.set("live", "1");
      break;
    case "ending":
      u.searchParams.set("ending", "1");
      break;
    case "mostBids":
      u.searchParams.set("mostBids", "today");
      break;
    case "forYou":
      u.searchParams.set("forYou", "1");
      break;
  }
  const qs = u.searchParams.toString();
  return qs ? `/ilanlar?${qs}` : "/ilanlar";
}

export const MODE_HREF = {
  sold: "/ilanlar?sold=1",
  live: "/ilanlar?live=1",
  ending: "/ilanlar?ending=1",
  mostBids: "/ilanlar?mostBids=today",
  profit: "/ilanlar?sold=1&sort=profit",
  forYou: "/ilanlar?forYou=1",
} as const;
