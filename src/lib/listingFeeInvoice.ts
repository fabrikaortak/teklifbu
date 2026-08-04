/** İlan ücreti / premium özellik fatura satırları */

export type FeeLine = { key: string; label: string; amountTl: number };

export type ListingFeeInvoice = {
  lines: FeeLine[];
  /** Liste fiyatları toplamı (admin’in girdiği, KDV dahil/hariç ayarına göre) */
  subtotalTl: number;
  /** KDV hariç ara toplam (indirim öncesi) */
  subtotalExVatTl: number;
  /** Yalnızca premium özelliklere (KDV hariç) uygulanan kurumsal indirim % */
  corporateDiscountPercent: number;
  corporateDiscountTl: number;
  packageName: string | null;
  /** İndirim sonrası KDV hariç */
  afterDiscountExVatTl: number;
  vatPercent: number;
  pricesIncludeVat: boolean;
  /** KDV tutarı */
  vatTl: number;
  /** Kullanıcının ödeyeceği net tutar (KDV dahil) */
  payableTl: number;
};

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function exVat(amountInclOrEx: number, vatPercent: number, pricesIncludeVat: boolean) {
  const a = round2(Math.max(0, amountInclOrEx));
  if (!pricesIncludeVat || vatPercent <= 0) return a;
  return round2(a / (1 + vatPercent / 100));
}

export function buildListingFeeInvoice(input: {
  baseFeeTl: number;
  premiumBreakdown: FeeLine[];
  corporateDiscountPercent?: number;
  packageName?: string | null;
  vatPercent?: number;
  pricesIncludeVat?: boolean;
}): ListingFeeInvoice {
  const lines: FeeLine[] = [];
  if (input.baseFeeTl > 0) {
    lines.push({ key: "base", label: "Temel ilan ücreti", amountTl: round2(input.baseFeeTl) });
  }
  for (const row of input.premiumBreakdown || []) {
    if (row.amountTl > 0) {
      lines.push({
        key: row.key,
        label: row.label,
        amountTl: round2(row.amountTl),
      });
    }
  }

  const premiumSubtotal = round2(
    (input.premiumBreakdown || []).reduce((s, x) => s + (Number(x.amountTl) || 0), 0)
  );
  const baseFeeTl = round2(Math.max(0, Number(input.baseFeeTl) || 0));
  const subtotalTl = round2(baseFeeTl + premiumSubtotal);

  const vatPercent = Math.max(0, Math.min(40, Number(input.vatPercent) || 0));
  const pricesIncludeVat = input.pricesIncludeVat !== false;

  // Önce KDV’siz tutarlar
  const baseEx = exVat(baseFeeTl, vatPercent, pricesIncludeVat);
  const premiumEx = exVat(premiumSubtotal, vatPercent, pricesIncludeVat);
  const subtotalExVatTl = round2(baseEx + premiumEx);

  const discountPercent = Math.max(
    0,
    Math.min(100, Math.floor(Number(input.corporateDiscountPercent) || 0))
  );
  const corporateDiscountTl = round2((premiumEx * discountPercent) / 100);
  const afterDiscountExVatTl = round2(subtotalExVatTl - corporateDiscountTl);

  let vatTl = 0;
  let payableTl = afterDiscountExVatTl;
  if (vatPercent > 0) {
    vatTl = round2((afterDiscountExVatTl * vatPercent) / 100);
    payableTl = round2(afterDiscountExVatTl + vatTl);
  }

  return {
    lines,
    subtotalTl,
    subtotalExVatTl,
    corporateDiscountPercent: discountPercent,
    corporateDiscountTl,
    packageName: input.packageName || null,
    afterDiscountExVatTl,
    vatPercent,
    pricesIncludeVat,
    vatTl,
    payableTl,
  };
}
