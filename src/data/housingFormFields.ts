/** Konut formu — seçenekler + admin’den aç/kapa opsiyonel alanlar */

export const HOUSING_KITCHEN_OPTIONS = ["Kapalı", "Açık"] as const;

export const HOUSING_USAGE_STATUS_OPTIONS = ["Boş", "Kiracılı", "Mülk Sahibi"] as const;

export const HOUSING_YES_NO_OPTIONS = ["Evet", "Hayır"] as const;

export const HOUSING_ENERGY_CERT_OPTIONS = ["Var", "Yok", "A", "B", "C", "D", "E", "F", "G"] as const;

export const HOUSING_SELLER_TYPE_OPTIONS = ["Sahibi", "Emlak Ofisi"] as const;

/** Bulunduğu kat — Giriş Kat dahil seçilebilir */
export const HOUSING_FLOOR_OPTIONS: string[] = [
  "Bodrum",
  "Zemin",
  "Giriş Kat",
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  "Çatı Katı",
];

/** Bina kat sayısı 1–50 */
export const HOUSING_TOTAL_FLOOR_OPTIONS: string[] = Array.from({ length: 50 }, (_, i) => String(i + 1));

/** Admin flagMap + form’da opsiyonel gösterilecek yeni alanlar */
export const HOUSING_OPTIONAL_FORM_FIELDS = [
  { key: "kitchen", label: "Mutfak" },
  { key: "usageStatus", label: "Kullanım durumu" },
  { key: "inSite", label: "Site içinde mi" },
  { key: "siteName", label: "Site adı" },
  { key: "elevator", label: "Asansör" },
  { key: "creditEligible", label: "Krediye uygun" },
  { key: "energyCertificate", label: "Enerji kimlik belgesi" },
  { key: "sellerType", label: "Satıcı" },
  { key: "swap", label: "Takas" },
] as const;

export type HousingOptionalFieldKey = (typeof HOUSING_OPTIONAL_FORM_FIELDS)[number]["key"];

export const DEFAULT_HOUSING_FORM_FIELDS_ENABLED: Record<HousingOptionalFieldKey, boolean> = {
  kitchen: true,
  usageStatus: true,
  inSite: true,
  siteName: true,
  elevator: true,
  creditEligible: true,
  energyCertificate: true,
  sellerType: true,
  swap: true,
};

export function normalizeHousingFormFieldsEnabled(
  raw: unknown
): Record<HousingOptionalFieldKey, boolean> {
  const base = { ...DEFAULT_HOUSING_FORM_FIELDS_ENABLED };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const map = raw as Record<string, unknown>;
  for (const { key } of HOUSING_OPTIONAL_FORM_FIELDS) {
    if (key in map) base[key] = Boolean(map[key]);
  }
  return base;
}

export function isHousingOptionalFieldEnabled(
  enabled: Record<string, boolean> | null | undefined,
  key: HousingOptionalFieldKey
): boolean {
  if (!enabled || !(key in enabled)) return DEFAULT_HOUSING_FORM_FIELDS_ENABLED[key] !== false;
  return Boolean(enabled[key]);
}

export function normalizeFloorOption(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.round(raw));
  const s = String(raw).trim();
  if (!s) return "";
  if (HOUSING_FLOOR_OPTIONS.includes(s)) return s;
  const t = s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
  if (t.includes("giris")) return "Giriş Kat";
  if (t.includes("cati") || t.includes("teras kat")) return "Çatı Katı";
  if (t.includes("bodrum")) return "Bodrum";
  if (t === "zemin" || t.includes("zemin kat")) return "Zemin";
  const m = s.match(/^-?\d+$/);
  if (m && HOUSING_FLOOR_OPTIONS.includes(m[0])) return m[0];
  const dig = s.match(/(\d+)/);
  if (dig && HOUSING_FLOOR_OPTIONS.includes(dig[1])) return dig[1];
  return s;
}

export function normalizeYesNo(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
  if (t.includes("belirtilmemis") || t === "-") return "";
  if (t === "evet" || t === "var" || t === "uygun") return "Evet";
  if (t === "hayir" || t === "yok" || t === "uygun degil") return "Hayır";
  if (s === "Evet" || s === "Hayır") return s;
  return "";
}

export function normalizeKitchen(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s.toLocaleLowerCase("tr-TR");
  if (t.includes("belirtilmemis")) return "";
  if (t.includes("kapal")) return "Kapalı";
  if (t.includes("acik") || t.includes("açık") || t.includes("amerikan")) return "Açık";
  return HOUSING_KITCHEN_OPTIONS.includes(s as (typeof HOUSING_KITCHEN_OPTIONS)[number]) ? s : "";
}

export function normalizeUsageStatus(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
  if (t.includes("belirtilmemis")) return "";
  if (t.includes("kiraci")) return "Kiracılı";
  if (t.includes("mulk") || t.includes("oturu")) return "Mülk Sahibi";
  if (t === "bos" || t.includes("bos ")) return "Boş";
  return HOUSING_USAGE_STATUS_OPTIONS.includes(s as (typeof HOUSING_USAGE_STATUS_OPTIONS)[number])
    ? s
    : "";
}

export function normalizeSellerType(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
  if (t.includes("belirtilmemis")) return "";
  if (t.includes("emlak") || t.includes("ofis") || t.includes("danisman") || t.includes("emlakci"))
    return "Emlak Ofisi";
  // Sahibinden sitelerinde “Kimden: Sahibinden” = mal sahibi
  if (t.includes("sahibinden") || t.includes("mal sahibi") || t === "sahibi" || t.includes("sahib"))
    return "Sahibi";
  return HOUSING_SELLER_TYPE_OPTIONS.includes(s as (typeof HOUSING_SELLER_TYPE_OPTIONS)[number])
    ? s
    : "";
}

export function normalizeEnergyCertificate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const yn = normalizeYesNo(s);
  if (yn === "Evet") return "Var";
  if (yn === "Hayır") return "Yok";
  const t = s.toLocaleLowerCase("tr-TR");
  if (t.includes("belirtilmemis")) return "";
  if (t === "var") return "Var";
  if (t === "yok") return "Yok";
  const cls = s.trim().toUpperCase();
  if (/^[A-G]$/.test(cls)) return cls;
  return HOUSING_ENERGY_CERT_OPTIONS.includes(s as (typeof HOUSING_ENERGY_CERT_OPTIONS)[number])
    ? s
    : "";
}

/** Form select’leriyle aynı sözlük — AI prompt’una tek seferde verilir (alan alan anlatmaya gerek yok) */
export function housingEnumPromptForAi(): string {
  const floorsShort = ["Bodrum", "Zemin", "Giriş Kat", "1…30", "Çatı Katı"].join(" | ");
  return `KONUT ALAN SÖZLÜĞÜ (yalnızca bu değerlerden birini yaz; yoksa ""):
rooms: 1+0 | 1+1 | 2+1 | 3+1 | 4+1 | 5+1 | 6+
buildingAge: 0 | 1 | 2 | … | 9 | 10-15 | 15-20 | 20+
floor: ${floorsShort}  (Sahibinden “Giriş Katı” → "Giriş Kat", “Çatı Katı” → "Çatı Katı")
totalFloors: 1…50 (sadece sayı string)
heating: Doğalgaz (Kombi) | Merkezi | Klima | Soba | Yerden Isıtma | Yok
balcony: Var | Yok
kitchen: Kapalı | Açık
usageStatus: Boş | Kiracılı | Mülk Sahibi
inSite: Evet | Hayır
siteName: serbest metin (yalnız inSite=Evet ise; değilse "")
elevator: Evet | Hayır
creditEligible: Evet | Hayır
energyCertificate: Var | Yok | A | B | C | D | E | F | G
sellerType: Sahibi | Emlak Ofisi
swap: Evet | Hayır
deedStatus: Kat Mülkiyeti | Kat İrtifakı | Hisseli Tapu | Müstakil Tapulu | Tahsis | Bilinmiyor
furnished: Eşyalı | Eşyasız | Yarı Eşyalı
dues: sadece rakam; “Belirtilmemiş” ise ""`;
}
