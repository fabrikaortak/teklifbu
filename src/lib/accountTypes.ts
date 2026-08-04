/** Üyelik tipleri ve Kurumsal faaliyet alanları — tek kaynak */

import {
  DEFAULT_COMMERCIAL_BUSINESS_TYPES,
  commercialBusinessTypeLabel,
  legacyAccountTypeToBusinessKey,
} from "@/lib/commercialBusinessTypes";

export const ACCOUNT_TYPES = ["BIREYSEL_TICARI", "TICARI"] as const;
export type AppAccountType = (typeof ACCOUNT_TYPES)[number];

/** Eski DB değerleri (geçiş / geriye dönük) */
export const LEGACY_ACCOUNT_TYPES = ["BIREYSEL", "EMLAKCI", "GALERICI"] as const;

/** Varsayılan faaliyet anahtarları (ayarsız fallback) */
export const COMMERCIAL_SUBTYPES = DEFAULT_COMMERCIAL_BUSINESS_TYPES.map((t) => t.key);

export type CommercialSubtype = string;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BIREYSEL_TICARI: "Bireysel",
  TICARI: "Kurumsal",
  BIREYSEL: "Bireysel",
  EMLAKCI: "Kurumsal",
  GALERICI: "Kurumsal",
};

export const COMMERCIAL_SUBTYPE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_COMMERCIAL_BUSINESS_TYPES.map((t) => [t.key, t.label])
);

export function isAppAccountType(v: unknown): v is AppAccountType {
  return v === "BIREYSEL_TICARI" || v === "TICARI";
}

export function normalizeAccountType(raw?: string | null): AppAccountType {
  const t = String(raw || "").toUpperCase();
  if (t === "TICARI" || t === "EMLAKCI" || t === "GALERICI") return "TICARI";
  return "BIREYSEL_TICARI";
}

export function isCorporateAccount(type?: string | null): boolean {
  const t = String(type || "").toUpperCase();
  return t === "TICARI" || t === "EMLAKCI" || t === "GALERICI";
}

export function isIndividualAccount(type?: string | null): boolean {
  return !isCorporateAccount(type);
}

export function needsListingKindChoice(type?: string | null): boolean {
  return normalizeAccountType(type) === "TICARI";
}

/**
 * @param allowedKeys — ayardan gelen anahtarlar; boş/null → varsayılan liste
 * @param keepUnknown — true: bilinen dışı değerleri de koru (profil gösterimi)
 */
export function parseCommercialSubtypes(
  raw: unknown,
  allowedKeys?: string[] | null,
  keepUnknown = false
): CommercialSubtype[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(
    (allowedKeys?.length ? allowedKeys : COMMERCIAL_SUBTYPES).map((k) => String(k).toUpperCase())
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const k = String(x || "")
      .trim()
      .toUpperCase();
    if (!k || seen.has(k)) continue;
    if (!keepUnknown && !allowed.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function accountTypeLabelTr(type?: string | null): string {
  const t = String(type || "").toUpperCase();
  return ACCOUNT_TYPE_LABELS[t] || type || "—";
}

export function commercialSubtypeLabelTr(sub?: string | null): string {
  return commercialBusinessTypeLabel(sub);
}

/** Eski tipten ticari alt seçenek çıkar (tek seferlik migrate) */
export function legacySubtypesForAccountType(type?: string | null): CommercialSubtype[] {
  const k = legacyAccountTypeToBusinessKey(type);
  return k ? [k] : [];
}

export const CORPORATE_ACCOUNT_TYPES = ["TICARI", "EMLAKCI", "GALERICI"] as const;
export const INDIVIDUAL_ACCOUNT_TYPES = ["BIREYSEL", "BIREYSEL_TICARI"] as const;
