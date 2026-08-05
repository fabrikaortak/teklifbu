/** Alışveriş e-ticaret ürün ilanı — attributes anahtarları */

export const SHOPPING_PRODUCT_ATTR_KEYS = [
  "brand",
  "model",
  "condition",
  "warranty",
  "color",
  "sku",
  "barcode",
  "listPrice",
  "premiumPrice",
  "askPriceTl",
  "stockQty",
  "shippingFree",
  "sameDayShipping",
  "shippingLabel",
  "badgeText",
  "promoBadge",
  "highlights",
  "videoUrl",
  "viewAngle360",
  "installments",
  "installmentNote",
  "returnDays",
  "originCountry",
  "gtin",
] as const;

export type ShoppingProductAttrKey = (typeof SHOPPING_PRODUCT_ATTR_KEYS)[number];

export const SHOPPING_PRODUCT_ATTR_LABELS: Record<ShoppingProductAttrKey, string> = {
  brand: "Marka",
  model: "Model",
  condition: "Durum",
  warranty: "Garanti",
  color: "Renk / Varyant",
  sku: "Stok kodu (SKU)",
  barcode: "Barkod",
  listPrice: "Liste fiyatı (TL)",
  premiumPrice: "Premium fiyatı (TL)",
  askPriceTl: "Satış fiyatı (kuruşlu)",
  stockQty: "Stok adedi",
  shippingFree: "Ücretsiz kargo",
  sameDayShipping: "Aynı gün kargo",
  shippingLabel: "Teslimat etiketi",
  badgeText: "Ürün rozeti",
  promoBadge: "Kampanya rozeti",
  highlights: "Öne çıkan özellikler",
  videoUrl: "Video URL",
  viewAngle360: "360° görsel URL",
  installments: "Taksit seçenekleri",
  installmentNote: "Taksit notu",
  returnDays: "İade süresi (gün)",
  originCountry: "Menşei",
  gtin: "GTIN / EAN",
};

export type ShoppingInstallmentPlan = {
  id: string;
  card: string;
  months: number;
  /** Vade farkı / faiz (%) — 0 = peşin fiyatına taksit */
  ratePercent: number;
};

export const SHOPPING_CARD_OPTIONS = [
  "Tüm kartlar",
  "World",
  "Bonus",
  "Axess",
  "Maximum",
  "Paraf",
  "CardFinans",
  "Bankkart Combo",
  "Diğer",
] as const;

export const DEFAULT_SHOPPING_INSTALLMENTS: ShoppingInstallmentPlan[] = [
  { id: "1", card: "Tüm kartlar", months: 1, ratePercent: 0 },
  { id: "2", card: "World", months: 3, ratePercent: 0 },
  { id: "3", card: "Bonus", months: 6, ratePercent: 4.5 },
  { id: "4", card: "Axess", months: 9, ratePercent: 6.9 },
];

function newInstallmentId() {
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function calcInstallmentAmounts(price: number, months: number, ratePercent: number) {
  const base = Math.max(0, Number(price) || 0);
  const m = Math.max(1, Math.floor(Number(months) || 1));
  const rate = Math.max(0, Number(ratePercent) || 0);
  const total = Math.round(base * (1 + rate / 100));
  const monthly = m <= 1 ? total : Math.round(total / m);
  return { monthly, total, months: m };
}

export function parseInstallments(raw: unknown): ShoppingInstallmentPlan[] {
  if (!raw) return [];
  let data: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      data = JSON.parse(s);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const card = String(r.card || "").trim();
      const months = Math.max(1, Math.floor(Number(r.months) || 0));
      const ratePercent = Math.max(0, Number(r.ratePercent) || 0);
      if (!card || !months) return null;
      return {
        id: String(r.id || `row-${i}`),
        card,
        months,
        ratePercent,
      } satisfies ShoppingInstallmentPlan;
    })
    .filter(Boolean) as ShoppingInstallmentPlan[];
}

export function serializeInstallments(rows: ShoppingInstallmentPlan[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      id: r.id || newInstallmentId(),
      card: r.card.trim(),
      months: Math.max(1, Math.floor(r.months) || 1),
      ratePercent: Math.max(0, Number(r.ratePercent) || 0),
    }))
  );
}

export function createEmptyInstallment(): ShoppingInstallmentPlan {
  return { id: newInstallmentId(), card: "Tüm kartlar", months: 3, ratePercent: 0 };
}

export function parseHighlights(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || "").trim()).filter(Boolean);
  }
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(/\r?\n|;/)
    .map((x) => x.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function parseNumAttr(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(String(raw).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Alışveriş ürün satış fiyatı (kuruşlu askPriceTl varsa onu kullanır) */
export function shoppingSalePriceTl(listing: {
  askPrice?: number | null;
  attributes?: Record<string, unknown> | null;
}): number {
  const fromAttr = parseNumAttr(listing.attributes?.askPriceTl);
  if (fromAttr != null && fromAttr >= 0) return Math.round(fromAttr * 100) / 100;
  const n = Number(listing.askPrice);
  return Number.isFinite(n) ? n : 0;
}

export function shoppingDiscountPercent(listPrice: number | null, salePrice: number): number | null {
  if (!listPrice || listPrice <= salePrice || salePrice <= 0) return null;
  return Math.round(((listPrice - salePrice) / listPrice) * 100);
}

/** Deterministik sosyal kanıt (backend yokken) */
export function shoppingSocialProof(listingId: string) {
  let h = 0;
  for (let i = 0; i < listingId.length; i++) h = (h * 31 + listingId.charCodeAt(i)) >>> 0;
  const views = 120 + (h % 900);
  const cartToday = 8 + (h % 55);
  return { views24h: views, cartToday };
}

export const SHOPPING_CONDITION_OPTIONS = [
  "Sıfır",
  "Sıfır Ayarında",
  "Çok İyi",
  "İyi",
  "Orta",
  "Yıpranmış",
] as const;
