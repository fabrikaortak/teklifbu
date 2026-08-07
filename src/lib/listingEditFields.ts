/** Teklif sonrası admin izinli düzenlenebilir alanlar */

import { brandLabel, modelLabel, trimLabel } from "@/lib/vasitaLabels";
import { subtypesForCategory } from "@/data/categoryBrowseTree";
import { buildingAgeLabel } from "@/data/housingMatch";
import { accountTypeLabelTr as accountTypeLabelFromLib } from "@/lib/accountTypes";

export const CORE_EDITABLE_FIELDS = [
  { key: "title", label: "Başlık" },
  { key: "description", label: "Açıklama" },
  { key: "askPrice", label: "İlan fiyatı" },
  { key: "city", label: "İl" },
  { key: "district", label: "İlçe" },
  { key: "neighborhood", label: "Mahalle" },
  { key: "dealType", label: "İşlem tipi" },
  { key: "images", label: "Fotoğraflar" },
] as const;

/** Yaygın özellik anahtarları (attr:xxx) */
export const ATTR_FIELD_META: Array<{ key: string; label: string; aliases?: string[]; suffix?: string }> = [
  { key: "subtype", label: "Alt kategori / Tip" },
  { key: "rentalPeriod", label: "Kiralama süresi", aliases: ["rental"] },
  { key: "brand", label: "Marka" },
  { key: "model", label: "Model" },
  { key: "version", label: "Model / Motor" },
  { key: "trim", label: "Paket / Donanım" },
  { key: "m2", label: "Brüt / Alan", aliases: ["brut", "alan"], suffix: " m²" },
  { key: "netM2", label: "Net Alan", aliases: ["net"], suffix: " m²" },
  { key: "rooms", label: "Oda Sayısı", aliases: ["oda"] },
  { key: "floor", label: "Bulunduğu Kat", aliases: ["bulundugu"] },
  { key: "totalFloors", label: "Kat Sayısı", aliases: ["katSayisi"] },
  { key: "buildingAge", label: "Bina Yaşı" },
  { key: "heating", label: "Isınma", aliases: ["isinma"] },
  { key: "bathrooms", label: "Banyo", aliases: ["banyo"] },
  { key: "balcony", label: "Balkon", aliases: ["balkon"] },
  { key: "kitchen", label: "Mutfak", aliases: ["mutfak"] },
  { key: "usageStatus", label: "Kullanım Durumu", aliases: ["kullanim"] },
  { key: "inSite", label: "Site İçinde", aliases: ["siteIci", "site"] },
  { key: "siteName", label: "Site Adı", aliases: ["siteAdi"] },
  { key: "elevator", label: "Asansör", aliases: ["asansor"] },
  { key: "creditEligible", label: "Krediye Uygun", aliases: ["kredi"] },
  { key: "energyCertificate", label: "Enerji Kimlik Belgesi", aliases: ["enerji", "eKb"] },
  { key: "sellerType", label: "Satıcı / Kimden", aliases: ["satici", "kimden"] },
  { key: "swap", label: "Takas", aliases: ["takas"] },
  { key: "furnished", label: "Eşya Durumu", aliases: ["esya"] },
  { key: "dues", label: "Aidat", aliases: ["aidat"], suffix: " TL" },
  { key: "deedStatus", label: "Tapu Durumu", aliases: ["tapu"] },
  { key: "zoning", label: "İmar Durumu", aliases: ["imar"] },
  { key: "frontage", label: "Cephe" },
  { key: "year", label: "Model Yılı" },
  { key: "km", label: "Kilometre" },
  { key: "fuel", label: "Yakıt", aliases: ["yakit"] },
  { key: "gear", label: "Vites", aliases: ["vites"] },
  { key: "color", label: "Renk" },
  { key: "series", label: "Seri" },
  { key: "vehicleStatus", label: "Araç Durumu", aliases: ["aracDurumu"] },
  { key: "bodyType", label: "Kasa Tipi", aliases: ["kasaTipi"] },
  { key: "chassis", label: "Şasi", aliases: ["sasi"] },
  { key: "enginePower", label: "Motor Gücü", aliases: ["motorGucu"] },
  { key: "engineSize", label: "Motor Hacmi", aliases: ["motorHacmi"] },
  { key: "drive", label: "Çekiş", aliases: ["cekis"] },
  { key: "seats", label: "Koltuk Sayısı", aliases: ["koltuk"] },
  { key: "licenseRecord", label: "Ruhsat Kaydı", aliases: ["ruhsat"] },
  { key: "heavyDamage", label: "Ağır Hasar Kayıtlı", aliases: ["agirHasar"] },
  { key: "plateOrigin", label: "Plaka / Uyruk", aliases: ["plaka"] },
  { key: "tramer", label: "Tramer" },
  { key: "boyaDurumu", label: "Boya Durumu", aliases: ["boya"] },
  { key: "degisenDurumu", label: "Değişen Durumu", aliases: ["degisen"] },
  { key: "hasarDurumu", label: "Hasar Durumu", aliases: ["hasar"] },
  { key: "condition", label: "Durum" },
  { key: "warranty", label: "Garanti" },
  { key: "sku", label: "Stok kodu (SKU)" },
  { key: "barcode", label: "Barkod" },
  { key: "gtin", label: "GTIN / EAN" },
  { key: "listPrice", label: "Liste fiyatı", suffix: " TL" },
  { key: "premiumPrice", label: "Premium fiyatı", suffix: " TL" },
  { key: "stockQty", label: "Stok adedi" },
  { key: "shippingFree", label: "Ücretsiz kargo" },
  { key: "sameDayShipping", label: "Aynı gün kargo" },
  { key: "shippingLabel", label: "Teslimat" },
  { key: "badgeText", label: "Ürün rozeti" },
  { key: "promoBadge", label: "Kampanya rozeti" },
  { key: "highlights", label: "Öne çıkan özellikler" },
  { key: "videoUrl", label: "Video URL" },
  { key: "viewAngle360", label: "360° görsel" },
  { key: "installments", label: "Taksit seçenekleri" },
  { key: "installmentNote", label: "Taksit notu" },
  { key: "returnDays", label: "İade süresi (gün)" },
  { key: "originCountry", label: "Menşei" },
];

export function attrFieldLabel(key: string): string {
  const lk = key.toLowerCase();
  const meta = ATTR_FIELD_META.find(
    (m) =>
      m.key.toLowerCase() === lk ||
      m.aliases?.some((a) => a.toLowerCase() === lk || lk.includes(a.toLowerCase()))
  );
  if (meta) return meta.label;
  // camelCase → okunabilir yedek
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^\s+/, "")
    .replace(/^./, (c) => c.toUpperCase());
}

export function accountTypeLabelTr(type?: string | null) {
  return accountTypeLabelFromLib(type);
}

const EMPTY_ATTR_LABEL = "Belirtilmedi";

/** Kategoriye göre önizlemede her zaman gösterilecek alanlar (boşsa Belirtilmedi) */
export function expectedAttrKeysForCategory(
  categorySlug?: string | null,
  opts?: { housingFieldsEnabled?: Record<string, boolean> | null }
): string[] {
  const slug = String(categorySlug || "");
  if (slug === "konut" || slug === "kiralik" || slug === "isyeri") {
    const keys = [
      "m2",
      "netM2",
      "rooms",
      "buildingAge",
      "floor",
      "totalFloors",
      "heating",
      "bathrooms",
      "balcony",
      "dues",
      "deedStatus",
    ];
    if (slug === "kiralik" || slug === "konut") keys.splice(keys.indexOf("dues"), 0, "furnished");
    // Opsiyonel konut alanları — admin’de açıksa Belirtilmedi satırına dahil
    if (slug === "konut" || slug === "kiralik") {
      const en = opts?.housingFieldsEnabled;
      const on = (k: string) => (en && k in en ? Boolean(en[k]) : true);
      const optional = [
        "kitchen",
        "usageStatus",
        "inSite",
        "siteName",
        "elevator",
        "creditEligible",
        "energyCertificate",
        "sellerType",
        "swap",
      ];
      for (const k of optional) {
        if (on(k)) keys.push(k);
      }
    }
    return keys;
  }
  if (slug === "arsa") return ["m2", "zoning", "deedStatus", "frontage"];
  if (slug === "arac") {
    return [
      "series",
      "year",
      "km",
      "fuel",
      "gear",
      "vehicleStatus",
      "bodyType",
      "chassis",
      "enginePower",
      "engineSize",
      "drive",
      "seats",
      "color",
      "licenseRecord",
      "heavyDamage",
      "sellerType",
      "plateOrigin",
      "swap",
      "tramer",
      "boyaDurumu",
      "degisenDurumu",
      "hasarDurumu",
    ];
  }
  return [];
}

/** Admin / önizleme için Türkçe etiketli özellik satırları */
export function formatListingAttributeRows(
  attributes: unknown,
  categorySlug?: string | null,
  opts?: { showEmptyAsBelirtilmedi?: boolean; housingFieldsEnabled?: Record<string, boolean> | null }
): Array<{ key: string; label: string; value: string }> {
  const attrs =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>)
      : {};
  const showEmpty = Boolean(opts?.showEmptyAsBelirtilmedi);
  if (!Object.keys(attrs).length && !showEmpty) return [];

  const subtype = String(attrs.subtype || "");
  const brand = String(attrs.brand || "");
  const model = String(attrs.model || "");

  const subtypePools = [
    ...(categorySlug ? subtypesForCategory(categorySlug) : []),
    ...subtypesForCategory("arac"),
    ...subtypesForCategory("konut"),
    ...subtypesForCategory("isyeri"),
    ...subtypesForCategory("arsa"),
    ...subtypesForCategory("kiralik"),
  ];
  const subtypeName = subtypePools.find((s) => s.slug === subtype)?.name || subtype;

  const used = new Set<string>();
  const rows: Array<{ key: string; label: string; value: string }> = [];

  const push = (key: string, label: string, raw: unknown, suffix?: string, allowEmpty = false) => {
    const empty = raw == null || String(raw).trim() === "";
    if (empty && !allowEmpty) return;
    let value = empty ? EMPTY_ATTR_LABEL : String(raw);
    if (!empty) {
      if (key === "subtype") value = subtypeName || value;
      if (key === "brand" && subtype) value = brandLabel(value);
      if (key === "model" && subtype && brand) value = modelLabel(value);
      if (key === "version" && subtype && brand && model) value = trimLabel(value);
      if (key === "trim" && subtype && brand && model) value = trimLabel(value);
      if (key === "buildingAge") value = buildingAgeLabel(value) || value;
      if (suffix && value !== EMPTY_ATTR_LABEL && !value.toLowerCase().includes(suffix.trim().toLowerCase())) {
        value = `${value}${suffix}`;
      }
    }
    rows.push({ key, label, value });
  };

  for (const meta of ATTR_FIELD_META) {
    const found = Object.entries(attrs).find(([k]) => {
      const lk = k.toLowerCase();
      return (
        lk === meta.key.toLowerCase() ||
        meta.aliases?.some((a) => lk === a.toLowerCase() || lk.includes(a.toLowerCase()))
      );
    });
    if (found && !used.has(found[0])) {
      used.add(found[0]);
      push(meta.key, meta.label, found[1], meta.suffix, showEmpty);
    }
  }

  for (const [k, v] of Object.entries(attrs)) {
    if (used.has(k)) continue;
    if (k === "extras" || Array.isArray(v)) continue;
    push(k, attrFieldLabel(k), v, undefined, showEmpty);
  }

  if (showEmpty) {
    const expected = expectedAttrKeysForCategory(categorySlug, {
      housingFieldsEnabled: opts?.housingFieldsEnabled,
    });
    const inSiteVal = String(attrs.inSite || "").trim();
    for (const key of expected) {
      if (rows.some((r) => r.key === key)) continue;
      // Site adı yalnızca “Site içinde = Evet” iken anlamlı
      if (key === "siteName" && inSiteVal !== "Evet") continue;
      const meta = ATTR_FIELD_META.find((m) => m.key === key);
      push(key, meta?.label || attrFieldLabel(key), "", meta?.suffix, true);
    }
  }

  return rows;
}

export const EDITABLE_FIELD_OPTIONS = [
  ...CORE_EDITABLE_FIELDS,
  { key: "attributes", label: "Tüm özellikler" },
] as const;

export type EditableFieldKey = string;

export function isAttrField(key: string) {
  return key.startsWith("attr:");
}

export function attrKeyFromField(field: string) {
  return field.startsWith("attr:") ? field.slice(5) : null;
}

export function fieldLabel(key: string) {
  if (isAttrField(key)) {
    return attrFieldLabel(attrKeyFromField(key)!);
  }
  return (
    [...CORE_EDITABLE_FIELDS, { key: "attributes", label: "Tüm özellikler" }].find((f) => f.key === key)
      ?.label || key
  );
}

const CORE_KEYS = new Set(CORE_EDITABLE_FIELDS.map((f) => f.key));

export function parseAllowedFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => {
    if (typeof k !== "string" || !k.trim()) return false;
    if (CORE_KEYS.has(k as (typeof CORE_EDITABLE_FIELDS)[number]["key"])) return true;
    if (k === "attributes") return true;
    if (isAttrField(k) && attrKeyFromField(k)) return true;
    return false;
  });
}

/** İlandaki attributes objesinden seçilebilir özellik alanları üretir */
export function attributeFieldOptions(attributes: unknown): Array<{ key: string; label: string; value: unknown }> {
  const attrs =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>)
      : {};
  const used = new Set<string>();
  const out: Array<{ key: string; label: string; value: unknown }> = [];

  for (const meta of ATTR_FIELD_META) {
    const found = Object.entries(attrs).find(([k]) => {
      const lk = k.toLowerCase();
      return (
        lk === meta.key.toLowerCase() ||
        meta.aliases?.some((a) => lk === a.toLowerCase() || lk.includes(a.toLowerCase()))
      );
    });
    if (found && !used.has(found[0])) {
      used.add(found[0]);
      out.push({ key: `attr:${found[0]}`, label: meta.label, value: found[1] });
    }
  }

  for (const [k, v] of Object.entries(attrs)) {
    if (used.has(k)) continue;
    if (k === "extras" || Array.isArray(v)) continue;
    out.push({ key: `attr:${k}`, label: attrFieldLabel(k), value: v });
  }
  return out;
}

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

export function snapshotListingFields(listing: {
  title: string;
  description: string;
  askPrice: bigint | number;
  city: string;
  district: string | null;
  neighborhood: string | null;
  dealType: string;
  coverImage: string | null;
  images: string[];
  attributes: unknown;
}) {
  return {
    title: listing.title,
    description: listing.description,
    askPrice: Number(listing.askPrice),
    city: listing.city,
    district: listing.district,
    neighborhood: listing.neighborhood,
    dealType: listing.dealType,
    coverImage: listing.coverImage,
    images: listing.images || [],
    attributes: listing.attributes ?? {},
  };
}

export function buildChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): FieldDiff {
  const diff: FieldDiff = {};
  for (const key of fields) {
    const from = before[key];
    const to = after[key];
    const same = JSON.stringify(from ?? null) === JSON.stringify(to ?? null);
    if (!same) diff[key] = { from, to };
  }
  return diff;
}

export function isBidderReviseOpen(bidderReviseUntil?: Date | string | null) {
  if (!bidderReviseUntil) return false;
  return new Date(bidderReviseUntil).getTime() > Date.now();
}
