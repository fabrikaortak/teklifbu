/** KDV brüt / net / oran hesapları */

export type VatBreakdown = {
  /** Adminin girdiği tutar */
  inputTl: number;
  pricesIncludeVat: boolean;
  vatPercent: number;
  /** KDV hariç */
  netTl: number;
  /** KDV tutarı */
  vatTl: number;
  /** KDV dahil (ödenecek / brüt) */
  grossTl: number;
};

export type PaymentVatMeta = {
  vatPercent: number;
  pricesIncludeVat: boolean;
  vatTl: number;
  netTl: number;
  grossTl: number;
};

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function clampVatPercent(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(40, Math.round(n * 100) / 100));
}

/** Girilen tutardan KDV kırılımı */
export function calcVatBreakdown(
  inputTl: number,
  vatPercent: number,
  pricesIncludeVat: boolean
): VatBreakdown {
  const pct = clampVatPercent(vatPercent);
  const input = round2(Math.max(0, Number(inputTl) || 0));
  if (pct <= 0) {
    return {
      inputTl: input,
      pricesIncludeVat: Boolean(pricesIncludeVat),
      vatPercent: 0,
      netTl: input,
      vatTl: 0,
      grossTl: input,
    };
  }
  if (pricesIncludeVat) {
    const netTl = round2(input / (1 + pct / 100));
    const vatTl = round2(input - netTl);
    return {
      inputTl: input,
      pricesIncludeVat: true,
      vatPercent: pct,
      netTl,
      vatTl,
      grossTl: input,
    };
  }
  const vatTl = round2((input * pct) / 100);
  const grossTl = round2(input + vatTl);
  return {
    inputTl: input,
    pricesIncludeVat: false,
    vatPercent: pct,
    netTl: input,
    vatTl,
    grossTl,
  };
}

/** Ödeme meta’sına yazılacak KDV alanları */
export function vatMetaFromBreakdown(b: VatBreakdown): PaymentVatMeta {
  return {
    vatPercent: b.vatPercent,
    pricesIncludeVat: b.pricesIncludeVat,
    vatTl: b.vatTl,
    netTl: b.netTl,
    grossTl: b.grossTl,
  };
}

/** Ham ödeme kaydından gerçek KDV tutarını çıkar (tahmin yok) */
export function extractPaymentVatTl(meta: unknown, amountTl?: number): number {
  const m =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
  if (typeof m.vatTl === "number" && Number.isFinite(m.vatTl)) {
    return round2(Math.max(0, m.vatTl));
  }
  const fee =
    m.fee && typeof m.fee === "object" && !Array.isArray(m.fee)
      ? (m.fee as Record<string, unknown>)
      : null;
  if (fee) {
    const inv =
      fee.invoice && typeof fee.invoice === "object" && !Array.isArray(fee.invoice)
        ? (fee.invoice as Record<string, unknown>)
        : null;
    if (inv && typeof inv.vatTl === "number" && Number.isFinite(inv.vatTl)) {
      return round2(Math.max(0, inv.vatTl));
    }
    if (typeof fee.vatTl === "number" && Number.isFinite(fee.vatTl)) {
      return round2(Math.max(0, fee.vatTl));
    }
  }
  const inv =
    m.invoice && typeof m.invoice === "object" && !Array.isArray(m.invoice)
      ? (m.invoice as Record<string, unknown>)
      : null;
  if (inv && typeof inv.vatTl === "number" && Number.isFinite(inv.vatTl)) {
    return round2(Math.max(0, inv.vatTl));
  }
  // Eski kayıt: oran + dahil bilgisi varsa hesapla
  const pct = clampVatPercent(Number(m.vatPercent));
  if (pct > 0 && amountTl != null && Number(amountTl) > 0) {
    const include = m.pricesIncludeVat !== false;
    return calcVatBreakdown(Number(amountTl), pct, include).vatTl;
  }
  return 0;
}

export function extractPaymentVatPercent(meta: unknown): number | null {
  const m =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
  if (m.vatPercent != null && Number.isFinite(Number(m.vatPercent))) {
    return clampVatPercent(Number(m.vatPercent));
  }
  const fee =
    m.fee && typeof m.fee === "object" && !Array.isArray(m.fee)
      ? (m.fee as Record<string, unknown>)
      : null;
  const inv =
    (fee?.invoice && typeof fee.invoice === "object"
      ? (fee.invoice as Record<string, unknown>)
      : null) ||
    (m.invoice && typeof m.invoice === "object" ? (m.invoice as Record<string, unknown>) : null);
  if (inv?.vatPercent != null && Number.isFinite(Number(inv.vatPercent))) {
    return clampVatPercent(Number(inv.vatPercent));
  }
  return null;
}
