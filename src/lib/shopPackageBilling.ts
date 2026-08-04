/** ShopPackage billing helpers — MONTHLY | DAILY | YEARLY */

export type ShopBillingType = "MONTHLY" | "DAILY" | "YEARLY";

export function normalizeBillingType(raw?: string | null): ShopBillingType {
  const v = String(raw || "").toUpperCase();
  if (v === "DAILY") return "DAILY";
  if (v === "YEARLY" || v === "ANNUAL" || v === "YEAR") return "YEARLY";
  return "MONTHLY";
}

export function billingTypeLabelTr(raw?: string | null): string {
  const t = normalizeBillingType(raw);
  if (t === "DAILY") return "Günlük";
  if (t === "YEARLY") return "Yıllık";
  return "Aylık";
}

export function billingUnitSuffixTr(raw?: string | null): string {
  const t = normalizeBillingType(raw);
  if (t === "DAILY") return "/ gün";
  if (t === "YEARLY") return "/ yıl";
  return "/ ay";
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function clampDays(days: number, minDays: number, maxDays: number) {
  const min = Math.max(1, Math.floor(Number(minDays) || 1));
  const max = Math.max(min, Math.floor(Number(maxDays) || 30));
  const d = Math.floor(Number(days) || min);
  return Math.max(min, Math.min(max, d));
}

/** Paket birim fiyatı × süre → tutar + bitiş tarihi */
export function calcPackagePurchase(opts: {
  billingType?: string | null;
  unitPriceTl: number;
  months?: number;
  days?: number;
  years?: number;
  minDays?: number;
  maxDays?: number;
  from?: Date;
}) {
  const billingType = normalizeBillingType(opts.billingType);
  const unit = Math.max(0, Number(opts.unitPriceTl) || 0);
  const from = opts.from || new Date();

  if (billingType === "DAILY") {
    const days = clampDays(opts.days ?? opts.minDays ?? 1, opts.minDays ?? 1, opts.maxDays ?? 30);
    return {
      billingType,
      days,
      months: 0,
      years: 0,
      amountTl: unit * days,
      endsAt: addDays(from, days),
      unitPriceTl: unit,
    };
  }

  if (billingType === "YEARLY") {
    const years = Math.max(1, Math.min(5, Math.floor(Number(opts.years ?? opts.months) || 1)));
    return {
      billingType,
      days: 0,
      months: 0,
      years,
      amountTl: unit * years,
      endsAt: addYears(from, years),
      unitPriceTl: unit,
    };
  }

  const months = Math.max(1, Math.min(24, Math.floor(Number(opts.months) || 1)));
  return {
    billingType,
    days: 0,
    months,
    years: 0,
    amountTl: unit * months,
    endsAt: addMonths(from, months),
    unitPriceTl: unit,
  };
}
