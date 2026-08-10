/** Liste / kart için küçük kapak boyutu (px, uzun kenar). */
export const LISTING_THUMB_MAX_EDGE = 480;

/** Detay galerisi için orijinal üst sınırı (px). Daha büyükler küçültülür. */
export const LISTING_ORIGINAL_MAX_EDGE = 2000;

/**
 * /uploads/foo.jpg → /uploads/foo.thumb.webp
 * Yerel upload değilse (http, data, boş) aynen döner.
 */
export function listingThumbUrl(src?: string | null): string {
  const url = String(src || "").trim();
  if (!url) return "";
  if (!url.startsWith("/uploads/")) return url;
  if (url.endsWith(".thumb.webp")) return url;
  const noQuery = url.split("?")[0] || url;
  const base = noQuery.replace(/\.[^.]+$/, "");
  return `${base}.thumb.webp`;
}

/** Thumb URL'den orijinal yolu tahmin etmez; silmede basename kullanılır. */
export function listingThumbCompanionPath(uploadUrl: string): string | null {
  const url = String(uploadUrl || "").trim();
  if (!url.startsWith("/uploads/")) return null;
  if (url.endsWith(".thumb.webp")) return null;
  return listingThumbUrl(url);
}
