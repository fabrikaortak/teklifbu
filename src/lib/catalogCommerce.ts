/** Normalize catalog title / search text (TR-aware-ish). */
export function normalizeCatalogText(input: string): string {
  return String(input || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable hash for variant attribute combination. */
export function buildAttributesHash(
  values: Array<{ attributeId: string; optionId?: string | null; textValue?: string | null }>
): string {
  const parts = values
    .map((v) => {
      const val = v.optionId || normalizeCatalogText(String(v.textValue || ""));
      return `${v.attributeId}:${val}`;
    })
    .sort();
  return parts.join("|") || "empty";
}

export function tlToMinor(tl: number): bigint {
  return BigInt(Math.round(Number(tl) * 100));
}

export function minorToTl(minor: bigint | number | null | undefined): number {
  if (minor == null) return 0;
  return Number(minor) / 100;
}

/** discountedPrice geçerliyse onu, değilse price. */
export function effectiveOfferPriceMinor(
  price: bigint,
  discountedPrice: bigint | null | undefined
): bigint {
  if (discountedPrice != null && discountedPrice > BigInt(0) && discountedPrice <= price) {
    return discountedPrice;
  }
  return price;
}

export function assertValidOfferPrices(price: bigint, discountedPrice: bigint | null | undefined) {
  if (price <= BigInt(0)) {
    throw Object.assign(new Error("Geçerli fiyat girin"), { code: "INVALID_PRICE" });
  }
  if (discountedPrice != null) {
    if (discountedPrice <= BigInt(0) || discountedPrice > price) {
      throw Object.assign(new Error("İndirimli fiyat geçersiz"), { code: "INVALID_DISCOUNT" });
    }
  }
}

export class CatalogCommerceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CatalogCommerceError";
  }
}
