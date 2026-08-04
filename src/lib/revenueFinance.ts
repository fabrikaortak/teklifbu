/** Gelir / masraf kayıtları — tek kaynak */

import { calcVatBreakdown, clampVatPercent } from "@/lib/vat";

export type RevenueExpense = {
  id: string;
  title: string;
  /** Girilen tutar (KDV dahil/hariç bayrağına göre) */
  amountTl: number;
  /** Ödenen brüt (KDV dahil) */
  grossTl: number;
  /** KDV hariç */
  netTl: number;
  /** Masraftaki KDV (çıkan / indirilecek) */
  vatTl: number;
  vatPercent: number;
  amountIncludesVat: boolean;
  category: string;
  note: string;
  spentAt: string;
  createdAt: string;
};

export const REVENUE_EXPENSES_SETTING_KEY = "revenue_expenses";

export const EXPENSE_CATEGORIES = [
  { value: "OFIS", label: "Ofis / kira" },
  { value: "REKLAM", label: "Reklam / pazarlama" },
  { value: "PERSONEL", label: "Personel" },
  { value: "YAZILIM", label: "Yazılım / altyapı" },
  { value: "POS", label: "POS / banka" },
  { value: "VERGI", label: "Vergi / muhasebe" },
  { value: "DIGER", label: "Diğer" },
] as const;

export function buildExpenseRow(input: {
  id?: string;
  title: string;
  amountTl: number;
  vatPercent?: number;
  amountIncludesVat?: boolean;
  category?: string;
  note?: string;
  spentAt?: string;
}): RevenueExpense {
  const amountIncludesVat = input.amountIncludesVat !== false;
  const vatPercent = clampVatPercent(Number(input.vatPercent ?? 20));
  const b = calcVatBreakdown(Number(input.amountTl) || 0, vatPercent, amountIncludesVat);
  const now = new Date().toISOString();
  return {
    id: input.id || `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(input.title || "").trim(),
    amountTl: b.inputTl,
    grossTl: b.grossTl,
    netTl: b.netTl,
    vatTl: b.vatTl,
    vatPercent: b.vatPercent,
    amountIncludesVat,
    category: String(input.category || "DIGER").toUpperCase(),
    note: String(input.note || "").trim(),
    spentAt: input.spentAt || now,
    createdAt: now,
  };
}

export function normalizeRevenueExpenses(raw: unknown): RevenueExpense[] {
  if (!Array.isArray(raw)) return [];
  const out: RevenueExpense[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || "").trim();
    const title = String(r.title || "").trim();
    const amountTl = Number(r.amountTl);
    if (!id || !title || !Number.isFinite(amountTl) || amountTl < 0) continue;
    const amountIncludesVat = r.amountIncludesVat !== false;
    const vatPercent = clampVatPercent(Number(r.vatPercent ?? 20));
    const hasStored =
      typeof r.vatTl === "number" &&
      typeof r.netTl === "number" &&
      typeof r.grossTl === "number";
    const b = hasStored
      ? null
      : calcVatBreakdown(amountTl, vatPercent, amountIncludesVat);
    out.push({
      id,
      title,
      amountTl,
      grossTl: hasStored ? Number(r.grossTl) : b!.grossTl,
      netTl: hasStored ? Number(r.netTl) : b!.netTl,
      vatTl: hasStored ? Number(r.vatTl) : b!.vatTl,
      vatPercent,
      amountIncludesVat,
      category: String(r.category || "DIGER").toUpperCase(),
      note: String(r.note || ""),
      spentAt: String(r.spentAt || r.createdAt || new Date().toISOString()),
      createdAt: String(r.createdAt || new Date().toISOString()),
    });
  }
  return out.sort(
    (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
  );
}

export function expenseCategoryLabel(cat?: string | null) {
  const c = String(cat || "").toUpperCase();
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label || cat || "Diğer";
}

/** @deprecated — eski finans ayarı; UI kaldırıldı */
export type RevenueVatByGroup = {
  listing_fee: number;
  token: number;
  shop_subscription: number;
  other: number;
};

/** @deprecated */
export type RevenueFinanceConfig = {
  vatPercentDefault: number;
  vatByGroup: RevenueVatByGroup;
  posCommissionPercent: number;
  posFixedFeeTl: number;
};

export const REVENUE_FINANCE_SETTING_KEY = "revenue_finance";

export const DEFAULT_REVENUE_FINANCE: RevenueFinanceConfig = {
  vatPercentDefault: 20,
  vatByGroup: {
    listing_fee: 20,
    token: 20,
    shop_subscription: 20,
    other: 20,
  },
  posCommissionPercent: 2.49,
  posFixedFeeTl: 0,
};

export function normalizeRevenueFinance(raw: unknown): RevenueFinanceConfig {
  const base = { ...DEFAULT_REVENUE_FINANCE, vatByGroup: { ...DEFAULT_REVENUE_FINANCE.vatByGroup } };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const vg =
    o.vatByGroup && typeof o.vatByGroup === "object"
      ? (o.vatByGroup as Record<string, unknown>)
      : {};
  const clampPct = (n: number) => {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(40, Math.round(n * 100) / 100));
  };
  return {
    vatPercentDefault: clampPct(Number(o.vatPercentDefault ?? base.vatPercentDefault)),
    vatByGroup: {
      listing_fee: clampPct(Number(vg.listing_fee ?? base.vatByGroup.listing_fee)),
      token: clampPct(Number(vg.token ?? base.vatByGroup.token)),
      shop_subscription: clampPct(
        Number(vg.shop_subscription ?? base.vatByGroup.shop_subscription)
      ),
      other: clampPct(Number(vg.other ?? base.vatByGroup.other)),
    },
    posCommissionPercent: clampPct(Number(o.posCommissionPercent ?? base.posCommissionPercent)),
    posFixedFeeTl: Math.max(0, Number(o.posFixedFeeTl) || 0),
  };
}

export function vatFromGross(grossTl: number, vatPercent: number) {
  return calcVatBreakdown(grossTl, vatPercent, true).vatTl;
}

export function netExVat(grossTl: number, vatPercent: number) {
  return calcVatBreakdown(grossTl, vatPercent, true).netTl;
}
