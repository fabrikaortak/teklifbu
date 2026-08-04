import { subtypesForCategory } from "@/data/categoryBrowseTree";

function norm(s: string) {
  return String(s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SUBTYPE_KEYS: Array<{ slug: string; keys: string[] }> = [
  { slug: "daire", keys: ["daire", "apartman dairesi", "satilik daire", "kiralik daire"] },
  { slug: "residence", keys: ["residence", "rezidans"] },
  { slug: "villa", keys: ["villa"] },
  { slug: "mustakil-ev", keys: ["mustakil ev", "müstakil ev"] },
  { slug: "yazlik", keys: ["yazlik", "yazlık"] },
  { slug: "yali", keys: ["yali", "yalı"] },
  { slug: "yali-dairesi", keys: ["yali dairesi", "yalı dairesi"] },
  { slug: "ciftlik-evi", keys: ["ciftlik", "çiftlik"] },
  { slug: "kosk-konak", keys: ["kosk", "köşk", "konak"] },
  { slug: "prefabrik-ev", keys: ["prefabrik"] },
  { slug: "kooperatif", keys: ["kooperatif"] },
  { slug: "apart", keys: ["apart"] },
];

export function matchHousingSubtype(text: string, categorySlug = "konut"): string {
  const t = norm(text);
  const allowed = new Set(subtypesForCategory(categorySlug).map((x) => x.slug));
  for (const row of SUBTYPE_KEYS) {
    if (allowed.size && !allowed.has(row.slug)) continue;
    if (row.keys.some((k) => t.includes(norm(k)))) return row.slug;
  }
  if (allowed.has("daire")) return "daire";
  return [...allowed][0] || "daire";
}

export function normalizeRooms(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.replace(/\s+/g, "").match(/(\d)\+(\d)/);
  if (m) {
    const key = `${m[1]}+${m[2]}`;
    if (["1+0", "1+1", "2+1", "3+1", "4+1", "5+1"].includes(key)) return key;
    if (Number(m[1]) >= 6) return "6+";
    return key;
  }
  if (/^6\+?$/i.test(s.replace(/\s/g, ""))) return "6+";
  return s;
}

export function normalizeHeating(raw: string): string {
  const t = norm(raw);
  if (!t || t.includes("belirtilmemis")) return "";
  if (t.includes("yerden")) return "Yerden Isıtma";
  if (t.includes("kombi") || t.includes("dogalgaz")) return "Doğalgaz (Kombi)";
  if (t.includes("merkezi")) return "Merkezi";
  if (t.includes("klima")) return "Klima";
  if (t.includes("soba")) return "Soba";
  if (t === "yok") return "Yok";
  return raw.trim();
}

export function normalizeDeedStatus(raw: string): string {
  const t = norm(raw);
  if (!t || t.includes("belirtilmemis")) return "";
  if (t.includes("kat mulkiyet")) return "Kat Mülkiyeti";
  if (t.includes("kat irtifak") || t.includes("irtifak")) return "Kat İrtifakı";
  if (t.includes("hisseli")) return "Hisseli Tapu";
  if (t.includes("mustakil")) return "Müstakil Tapulu";
  if (t.includes("tahsis")) return "Tahsis";
  if (t.includes("bilinmiyor")) return "Bilinmiyor";
  return raw.trim();
}

export function normalizeBalcony(raw: string): string {
  const t = norm(raw);
  if (!t || t.includes("belirtilmemis")) return "";
  if (t === "yok" || t.startsWith("yok ") || t.includes(" hayir") || t === "hayir") return "Yok";
  if (t === "var" || t.startsWith("var ") || t === "evet") return "Var";
  // "Balkon Var" satırı
  if (t.includes("balkon") && t.includes("yok")) return "Yok";
  if (t.includes("balkon") && t.includes("var")) return "Var";
  if (t.includes("var")) return "Var";
  if (t.includes("yok")) return "Yok";
  return "";
}

export function normalizeFurnished(raw: string): string {
  const t = norm(raw);
  if (!t || t.includes("belirtilmemis")) return "";
  if (t.includes("yari")) return "Yarı Eşyalı";
  if (t === "hayir" || t.includes("esyasiz") || t.includes("bos")) return "Eşyasız";
  if (t === "evet" || t.includes("esyali")) return "Eşyalı";
  return raw.trim();
}

/** "Belirtilmemiş" / boş → "" ; rakam varsa al */
export function normalizeDues(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const t = norm(s);
  if (!t || t.includes("belirtilmemis") || t === "-") return "";
  return s.replace(/[^\d]/g, "");
}

export function parseM2(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(Math.round(raw));
  const s = String(raw).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

/** Bina yaşı seçenekleri (form select value) */
export const BUILDING_AGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "0 - Yeni" },
  ...Array.from({ length: 9 }, (_, i) => {
    const n = String(i + 1);
    return { value: n, label: n };
  }),
  { value: "10-15", label: "10-15" },
  { value: "15-20", label: "15-20" },
  { value: "20+", label: "20 ve üstü" },
];

/** Bina yaşı 0 geçerli ("0 (Oturuma Hazır)") → ham sayı string */
export function parseBuildingAge(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10-15", "15-20", "20+"].includes(s)) return s;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return String(Math.round(raw));
  const m = s.match(/(\d+)/);
  return m ? m[1] : "";
}

/** Ham yaş / AI değeri → select value */
export function normalizeBuildingAgeBand(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (BUILDING_AGE_OPTIONS.some((o) => o.value === s)) return s;
  const n = Number(parseBuildingAge(s));
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "0";
  if (n >= 1 && n <= 9) return String(n);
  if (n >= 10 && n <= 15) return "10-15";
  if (n >= 16 && n <= 20) return "15-20";
  if (n > 20) return "20+";
  return "";
}

export function buildingAgeLabel(value: string): string {
  return BUILDING_AGE_OPTIONS.find((o) => o.value === value)?.label || value;
}

export function parseFloorNum(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.round(raw));
  const s = String(raw).trim();
  const low = s.toLocaleLowerCase("tr-TR");
  if (low.includes("giriş") || low.includes("giris")) return "Giriş Kat";
  if (low.includes("çatı") || low.includes("cati")) return "Çatı Katı";
  if (low.includes("bodrum")) return "Bodrum";
  if (low === "zemin" || low.includes("zemin kat")) return "Zemin";
  // "2" / "Giriş" / "Çatı" — rakam varsa al, yoksa metni bırak
  const m = s.match(/(\d+)/);
  if (m) return m[1];
  return s;
}

/**
 * Sahibinden özellik tablosu satırları: "Balkon Var", "m² (Net) 90"
 * AI kaçırsa bile metinden kurtarır.
 */
export function extractHousingTableFields(...chunks: unknown[]): {
  rooms: string;
  m2: string;
  netM2: string;
  buildingAge: string;
  floor: string;
  totalFloors: string;
  heating: string;
  bathrooms: string;
  balcony: string;
  kitchen: string;
  usageStatus: string;
  inSite: string;
  siteName: string;
  elevator: string;
  creditEligible: string;
  energyCertificate: string;
  sellerType: string;
  swap: string;
  dues: string;
  deedStatus: string;
  furnished: string;
  /** Var olan dış özellik id'leri / Yok olanlar */
  flags: { asansor?: boolean; otopark?: boolean; siteIci?: boolean };
} {
  const blob = chunks.map((x) => String(x ?? "")).join("\n");
  const nblob = norm(blob);

  const pick = (patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = blob.match(re);
      if (m?.[1] != null && String(m[1]).trim() !== "") return String(m[1]).trim();
    }
    return "";
  };

  const rooms = normalizeRooms(
    pick([/oda\s*say[ıi]s[ıi]\s*[:：]?\s*([0-9]+\s*\+\s*[0-9]+)/i, /([0-9]\s*\+\s*[0-9])/])
  );
  const m2 = parseM2(
    pick([
      /m²\s*\(\s*br[üu]t\s*\)\s*[:：]?\s*(\d+)/i,
      /m2\s*\(\s*br[üu]t\s*\)\s*[:：]?\s*(\d+)/i,
      /br[üu]t\s*m[²2]?\s*[:：]?\s*(\d+)/i,
    ])
  );
  const netM2 = parseM2(
    pick([/m²\s*\(\s*net\s*\)\s*[:：]?\s*(\d+)/i, /m2\s*\(\s*net\s*\)\s*[:：]?\s*(\d+)/i, /net\s*m[²2]?\s*[:：]?\s*(\d+)/i])
  );
  const buildingAge = parseBuildingAge(pick([/bina\s*ya[sş][ıi]\s*[:：]?\s*(\d+)/i]));
  const floor = parseFloorNum(pick([/bulundu[gğ]u\s*kat\s*[:：]?\s*([^\n]+)/i]));
  const totalFloors = parseFloorNum(pick([/kat\s*say[ıi]s[ıi]\s*[:：]?\s*(\d+)/i]));
  const heating = normalizeHeating(pick([/is[ıi]tma\s*[:：]?\s*([^\n]+)/i]));
  const bathrooms = parseFloorNum(pick([/banyo\s*say[ıi]s[ıi]\s*[:：]?\s*(\d+)/i]));
  const balcony = normalizeBalcony(pick([/balkon\s*[:：]?\s*([^\n]+)/i]));
  const dues = normalizeDues(pick([/aidat(?:\s*\(tl\))?\s*[:：]?\s*([^\n]+)/i]));
  const deedStatus = normalizeDeedStatus(pick([/tapu\s*durumu\s*[:：]?\s*([^\n]+)/i]));
  const furnished = normalizeFurnished(pick([/e[sş]yal[ıi]\s*[:：]?\s*([^\n]+)/i]));
  const kitchenRaw = pick([/mutfak\s*[:：]?\s*([^\n]+)/i]);
  const usageRaw = pick([/kullan[ıi]m\s*durumu\s*[:：]?\s*([^\n]+)/i]);
  const siteName = pick([/site\s*ad[ıi]\s*[:：]?\s*([^\n]+)/i]);
  const creditRaw = pick([/krediye\s*uygun(?:luk)?\s*[:：]?\s*([^\n]+)/i]);
  const energyRaw = pick([
    /enerji\s*kimlik\s*belgesi\s*[:：]?\s*([^\n]+)/i,
    /\bekb\b\s*[:：]?\s*([^\n]+)/i,
  ]);
  const sellerRaw = pick([
    /kimden\s*[:：]?\s*([^\n]+)/i,
    /sat[ıi]c[ıi]\s*[:：]?\s*([^\n]+)/i,
  ]);
  const swapRaw = pick([/takas\s*[:：]?\s*([^\n]+)/i]);

  const flagLine = (...labels: string[]): boolean | undefined => {
    for (const label of labels) {
      const re = new RegExp(`${norm(label)}\\s*(var|yok|evet|hayir|belirtilmemis)`, "i");
      const m = nblob.match(re);
      if (!m) continue;
      const v = norm(m[1]);
      if (v.includes("belirtilmemis")) return undefined;
      if (v === "var" || v === "evet") return true;
      if (v === "yok" || v === "hayir") return false;
    }
    return undefined;
  };

  const siteIciFlag = flagLine("site icerisinde", "site icinde", "site içerisinde");
  let inSite = "";
  if (siteIciFlag === true) inSite = "Evet";
  else if (siteIciFlag === false) inSite = "Hayır";
  else {
    const siteRaw = pick([/site\s*i[cç]inde(?:\s*mi)?\s*[:：]?\s*([^\n]+)/i]);
    const t = norm(siteRaw);
    if (t === "evet" || t === "var") inSite = "Evet";
    else if (t === "hayir" || t === "yok") inSite = "Hayır";
  }

  const asansorFlag = flagLine("asansor", "asansör");
  let elevator = "";
  if (asansorFlag === true) elevator = "Evet";
  else if (asansorFlag === false) elevator = "Hayır";
  else {
    const elevRaw = pick([/asans[oö]r\s*[:：]?\s*([^\n]+)/i]);
    const t = norm(elevRaw);
    if (t === "evet" || t === "var") elevator = "Evet";
    else if (t === "hayir" || t === "yok") elevator = "Hayır";
  }

  return {
    rooms,
    m2,
    netM2,
    buildingAge,
    floor,
    totalFloors,
    heating,
    bathrooms,
    balcony,
    kitchen: kitchenRaw,
    usageStatus: usageRaw,
    inSite,
    siteName: siteName && !norm(siteName).includes("belirtilmemis") ? siteName : "",
    elevator,
    creditEligible: creditRaw,
    energyCertificate: energyRaw,
    sellerType: sellerRaw,
    swap: swapRaw,
    dues,
    deedStatus,
    furnished,
    flags: {
      asansor: asansorFlag,
      otopark: flagLine("otopark"),
      siteIci: siteIciFlag,
    },
  };
}

/** Form/draft için 0 değerini düşürme */
export function fieldStr(v: unknown): string {
  if (v === 0 || v === "0") return "0";
  if (v == null || v === "") return "";
  return String(v);
}
