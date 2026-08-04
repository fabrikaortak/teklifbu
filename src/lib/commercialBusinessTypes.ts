/** Kurumsal işletme / faaliyet tipleri — ayardan yönetilir */

export type CommercialBusinessType = {
  key: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export const DEFAULT_COMMERCIAL_BUSINESS_TYPES: CommercialBusinessType[] = [
  { key: "EMLAK_OFISI", label: "Emlak Ofisi", active: true, sortOrder: 0 },
  { key: "GALERI", label: "Galeri", active: true, sortOrder: 1 },
  { key: "MAGAZA", label: "Mağaza", active: true, sortOrder: 2 },
  { key: "OTEL", label: "Otel", active: true, sortOrder: 3 },
  { key: "LOJISTIK", label: "Lojistik", active: true, sortOrder: 4 },
];

export const COMMERCIAL_BUSINESS_TYPES_SETTING_KEY = "commercial_business_types";

/** Etiket → KEY (EMLAK_OFISI) */
export function slugifyBusinessTypeKey(label: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "C",
    Ğ: "G",
    İ: "I",
    Ö: "O",
    Ş: "S",
    Ü: "U",
  };
  let s = String(label || "").trim();
  s = s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => map[ch] || ch);
  s = s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return s.slice(0, 40) || "TIP";
}

export function normalizeCommercialBusinessTypes(raw: unknown): CommercialBusinessType[] {
  const fallback = DEFAULT_COMMERCIAL_BUSINESS_TYPES.map((x) => ({ ...x }));
  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  const seen = new Set<string>();
  const out: CommercialBusinessType[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    let key = String(r.key || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");
    const label = String(r.label || "").trim();
    if (!key && label) key = slugifyBusinessTypeKey(label);
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      label,
      active: r.active !== false,
      sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : i,
    });
  }
  if (!out.length) return fallback;
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "tr"));
}

export function activeCommercialBusinessTypes(raw: unknown): CommercialBusinessType[] {
  return normalizeCommercialBusinessTypes(raw).filter((x) => x.active);
}

export function commercialBusinessTypeLabel(
  key: string | null | undefined,
  types?: CommercialBusinessType[]
): string {
  const k = String(key || "").toUpperCase();
  if (!k) return "—";
  const list = types?.length ? types : DEFAULT_COMMERCIAL_BUSINESS_TYPES;
  return list.find((t) => t.key === k)?.label || k;
}

/** Eski AccountType → faaliyet anahtarı */
export function legacyAccountTypeToBusinessKey(accountType?: string | null): string | null {
  const t = String(accountType || "").toUpperCase();
  if (t === "EMLAKCI") return "EMLAK_OFISI";
  if (t === "GALERICI") return "GALERI";
  return null;
}

export function allowedBusinessTypeKeys(raw: unknown, onlyActive = true): string[] {
  const list = onlyActive
    ? activeCommercialBusinessTypes(raw)
    : normalizeCommercialBusinessTypes(raw);
  return list.map((t) => t.key);
}
