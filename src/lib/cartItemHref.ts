/** Sepet anahtarı: klasik ilan id veya `urun:{productId}` katalog ürünü. */
export function cartItemHref(listingId: string): string {
  if (listingId.startsWith("urun:")) return `/urun/${listingId.slice(5)}`;
  return `/ilan/${listingId}`;
}

export function catalogCartListingId(productId: string): string {
  return `urun:${productId}`;
}
