import type { ShopFocusRoot } from "@/data/shopFocus";
import { DEFAULT_COMMERCIAL_BUSINESS_TYPES } from "@/lib/commercialBusinessTypes";

/** İlan formu / giriş türü */
export type CommercialListingFormKind = "genel" | "alisveris" | "premium";

export type CommercialPublishMapRow = {
  /** Faaliyet anahtarı: EMLAK_OFISI, GALERI, … */
  subtypeKey: string;
  /** Dikey / mağaza kök kategorisi */
  verticalRoot: ShopFocusRoot;
  /** ListingKindChooser / ilan-ver kind */
  listingForm: CommercialListingFormKind;
  /** İlan ekleme giriş URL’si */
  entryPath: string;
  /** Kayıtta profile yazılacak varsayılan alt kategori slug */
  defaultSub: string;
  enabled: boolean;
};

export type CommercialPublishMap = {
  rows: CommercialPublishMapRow[];
};

export const COMMERCIAL_PUBLISH_MAP_SETTING_KEY = "commercial_publish_map";

export const COMMERCIAL_VERTICAL_ROOT_OPTIONS: Array<{ value: ShopFocusRoot; label: string }> = [
  { value: "emlak", label: "Emlak" },
  { value: "vasita", label: "Vasıta" },
  { value: "alisveris", label: "Alışveriş" },
  { value: "premium", label: "Premium" },
];

export const COMMERCIAL_LISTING_FORM_OPTIONS: Array<{
  value: CommercialListingFormKind;
  label: string;
  description: string;
}> = [
  {
    value: "genel",
    label: "Normal ilan formu",
    description: "Emlak / vasıta klasik ilan-ver sayfası",
  },
  {
    value: "alisveris",
    label: "Mağaza / alışveriş formu",
    description: "Alışveriş ürün ilanı veya mağaza paneli akışı",
  },
  {
    value: "premium",
    label: "Premium form",
    description: "Otel / lojistik / kapasite ilanı",
  },
];

export const COMMERCIAL_ENTRY_PATH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "/ilan-ver?kind=genel", label: "Normal ilan (/ilan-ver?kind=genel)" },
  { value: "/ilan-ver?kind=alisveris", label: "Alışveriş ilan (/ilan-ver?kind=alisveris)" },
  { value: "/ilan-ver/alisveris", label: "Alışveriş kısayol (/ilan-ver/alisveris)" },
  { value: "/hesabim?s=ilan-ekle", label: "Hesabım — ilan ekle" },
  { value: "/ilan-ver?kind=premium", label: "Premium ilan (/ilan-ver?kind=premium)" },
  { value: "/ilan-ver/premium", label: "Premium kısayol (/ilan-ver/premium)" },
];

const DEFAULT_BY_SUBTYPE: Record<string, Omit<CommercialPublishMapRow, "subtypeKey" | "enabled">> = {
  EMLAK_OFISI: {
    verticalRoot: "emlak",
    listingForm: "genel",
    entryPath: "/ilan-ver?kind=genel",
    defaultSub: "konut",
  },
  GALERI: {
    verticalRoot: "vasita",
    listingForm: "genel",
    entryPath: "/ilan-ver?kind=genel",
    defaultSub: "otomobil",
  },
  MAGAZA: {
    verticalRoot: "alisveris",
    listingForm: "alisveris",
    entryPath: "/ilan-ver/alisveris",
    defaultSub: "elektronik",
  },
  OTEL: {
    verticalRoot: "premium",
    listingForm: "premium",
    entryPath: "/ilan-ver?kind=premium",
    defaultSub: "premium-otel",
  },
  LOJISTIK: {
    verticalRoot: "premium",
    listingForm: "premium",
    entryPath: "/ilan-ver?kind=premium",
    defaultSub: "premium-lojistik",
  },
};

export function defaultCommercialPublishMap(): CommercialPublishMap {
  const keys = new Set(DEFAULT_COMMERCIAL_BUSINESS_TYPES.map((t) => t.key));
  for (const k of Object.keys(DEFAULT_BY_SUBTYPE)) keys.add(k);
  const rows: CommercialPublishMapRow[] = [...keys].map((subtypeKey) => {
    const d = DEFAULT_BY_SUBTYPE[subtypeKey] || {
      verticalRoot: "emlak" as ShopFocusRoot,
      listingForm: "genel" as CommercialListingFormKind,
      entryPath: "/ilan-ver?kind=genel",
      defaultSub: "diger",
    };
    return { subtypeKey, enabled: true, ...d };
  });
  return { rows };
}

export function normalizeCommercialPublishMap(raw: unknown): CommercialPublishMap {
  const base = defaultCommercialPublishMap();
  const byKey = new Map(base.rows.map((r) => [r.subtypeKey, { ...r }]));

  const incoming =
    raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)
      ? (raw as { rows: unknown[] }).rows
      : Array.isArray(raw)
        ? raw
        : [];

  for (const row of incoming) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const subtypeKey = String(o.subtypeKey || o.key || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");
    if (!subtypeKey) continue;
    const prev = byKey.get(subtypeKey) || {
      subtypeKey,
      verticalRoot: "emlak" as ShopFocusRoot,
      listingForm: "genel" as CommercialListingFormKind,
      entryPath: "/ilan-ver?kind=genel",
      defaultSub: "diger",
      enabled: true,
    };
    const verticalRoot = String(o.verticalRoot || prev.verticalRoot).toLowerCase();
    const listingForm = String(o.listingForm || prev.listingForm).toLowerCase();
    const roots = new Set(["emlak", "vasita", "alisveris", "premium"]);
    const forms = new Set(["genel", "alisveris", "premium"]);
    byKey.set(subtypeKey, {
      subtypeKey,
      verticalRoot: (roots.has(verticalRoot) ? verticalRoot : prev.verticalRoot) as ShopFocusRoot,
      listingForm: (forms.has(listingForm) ? listingForm : prev.listingForm) as CommercialListingFormKind,
      entryPath: String(o.entryPath || prev.entryPath).trim() || prev.entryPath,
      defaultSub: String(o.defaultSub || prev.defaultSub).trim() || prev.defaultSub,
      enabled: o.enabled === undefined ? prev.enabled : Boolean(o.enabled),
    });
  }

  return { rows: [...byKey.values()].sort((a, b) => a.subtypeKey.localeCompare(b.subtypeKey)) };
}

export function publishRowForSubtype(
  map: CommercialPublishMap,
  subtypeKey: string
): CommercialPublishMapRow | null {
  const key = String(subtypeKey || "").toUpperCase();
  return map.rows.find((r) => r.subtypeKey === key && r.enabled) || null;
}

/** Alt tiplerden dikey seti */
export function verticalRootsForSubtypes(
  subtypes: string[],
  map: CommercialPublishMap = defaultCommercialPublishMap()
): Set<ShopFocusRoot> {
  const out = new Set<ShopFocusRoot>();
  for (const st of subtypes) {
    const row = publishRowForSubtype(map, st);
    if (row) out.add(row.verticalRoot);
  }
  return out;
}

export function listingFormsForSubtypes(
  subtypes: string[],
  map: CommercialPublishMap = defaultCommercialPublishMap()
): Set<CommercialListingFormKind> {
  const out = new Set<CommercialListingFormKind>();
  for (const st of subtypes) {
    const row = publishRowForSubtype(map, st);
    if (row) out.add(row.listingForm);
  }
  return out;
}

export function entryPathsForSubtypes(
  subtypes: string[],
  map: CommercialPublishMap = defaultCommercialPublishMap()
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const st of subtypes) {
    const row = publishRowForSubtype(map, st);
    if (!row || seen.has(row.entryPath)) continue;
    seen.add(row.entryPath);
    paths.push(row.entryPath);
  }
  return paths;
}

/**
 * Kayıt sırasında faaliyetlerden shopFocusRoot/Sub üret (müşteri seçmez).
 * Birden fazla faaliyet varsa ilk eşleşen satır + alışveriş varsa alışveriş öncelikli (panel).
 */
export function shopFocusFromSubtypes(
  subtypes: string[],
  map: CommercialPublishMap = defaultCommercialPublishMap()
): { root: ShopFocusRoot | ""; sub: string; otherNote: string } {
  const rows = subtypes
    .map((s) => publishRowForSubtype(map, s))
    .filter((r): r is CommercialPublishMapRow => Boolean(r));
  if (!rows.length) return { root: "", sub: "", otherNote: "" };
  const alisveris = rows.find((r) => r.verticalRoot === "alisveris");
  const pick = alisveris || rows[0];
  return { root: pick.verticalRoot, sub: pick.defaultSub || "diger", otherNote: "" };
}
