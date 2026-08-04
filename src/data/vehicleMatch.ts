import { ARAC_TYPES } from "@/data/categoryBrowseTree";
import { brandsForSubtype, modelsForBrand, trimsForModel } from "@/data/vehicleCatalog";

/** AI metninden vasıta alt tipi / marka / model / paket eşle */

const SUBTYPE_KEYS: Array<{ slug: string; keys: string[]; priority: number }> = [
  {
    slug: "arazi-suv-pickup",
    priority: 100,
    keys: [
      "suv",
      "arazi",
      "pickup",
      "pick-up",
      "pick up",
      "jeep",
      "kasa tipi suv",
      "arac tipi suv",
      "g-class",
      "g class",
      "g63",
      "g 63",
      "gle",
      "glc",
      "gla",
      "x5",
      "x3",
      "x1",
      "rav4",
      "tucson",
      "sportage",
      "qashqai",
      "tiguan",
      "crossover",
    ],
  },
  { slug: "motosiklet", priority: 90, keys: ["motosiklet", "scooter", "motor bisiklet"] },
  { slug: "minivan-panelvan", priority: 80, keys: ["minivan", "panelvan", "transporter", "vito", "sprinter"] },
  { slug: "ticari-araclar", priority: 70, keys: ["ticari", "kamyonet", "kamyon"] },
  { slug: "elektrikli-araclar", priority: 60, keys: ["elektrikli arac", "tesla model"] },
  { slug: "klasik-araclar", priority: 50, keys: ["klasik arac", "classic car"] },
  { slug: "hasarli-araclar", priority: 40, keys: ["hasarli arac", "pert", "agir hasar"] },
  { slug: "karavan", priority: 30, keys: ["karavan"] },
  { slug: "deniz-araclari", priority: 20, keys: ["tekne", "yat ", "deniz araci"] },
  { slug: "otomobil", priority: 10, keys: ["otomobil", "sedan", "hatchback", "coupe", "cabrio"] },
];

const VALID_SUBTYPES = new Set(ARAC_TYPES.map((x) => x.slug));

function norm(s: string) {
  return String(s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchVehicleSubtype(text: string, bodyType?: string): string {
  const t = norm([bodyType, text].filter(Boolean).join(" "));
  let best = "";
  let bestPri = -1;
  for (const row of SUBTYPE_KEYS) {
    if (row.keys.some((k) => t.includes(norm(k))) && row.priority > bestPri) {
      best = row.slug;
      bestPri = row.priority;
    }
  }
  if (best) return best;
  return "otomobil";
}

function scoreBrandModelInSubtype(
  subtype: string,
  hay: string
): { brand: string; model: string; trim: string; score: number } {
  const brands = brandsForSubtype(subtype);
  let brandSlug = "";
  let brandScore = 0;
  for (const b of brands) {
    for (const n of [b.slug, b.name, b.name.replace(/-/g, " ")]) {
      const nn = norm(n);
      if (nn && hay.includes(nn) && nn.length >= brandScore) {
        brandSlug = b.slug;
        brandScore = nn.length;
      }
    }
  }
  if (!brandSlug && (hay.includes("mercedes") || hay.includes("amg"))) {
    if (brands.some((b) => b.slug === "mercedes-benz")) {
      brandSlug = "mercedes-benz";
      brandScore = 8;
    }
  }
  if (!brandSlug) return { brand: "", model: "", trim: "", score: 0 };

  const models = modelsForBrand(subtype, brandSlug);
  let modelSlug = "";
  let modelScore = 0;
  for (const m of models) {
    for (const c of [m.slug, m.name, m.slug.replace(/-/g, " "), m.name.replace(/-/g, " ")]) {
      const cn = norm(c);
      if (cn && hay.includes(cn) && cn.length >= modelScore) {
        modelSlug = m.slug;
        modelScore = cn.length;
      }
    }
  }
  if (!modelSlug && (hay.includes("g 63") || hay.includes("g63") || hay.includes("g class") || hay.includes("g serisi"))) {
    const g = models.find((m) => /g-class|g-serisi|g63|g-63/i.test(`${m.slug} ${m.name}`));
    if (g) {
      modelSlug = g.slug;
      modelScore = 10;
    }
  }
  if (!modelSlug) return { brand: brandSlug, model: "", trim: "", score: brandScore };

  const trims = trimsForModel(subtype, brandSlug, modelSlug);
  let trimSlug = "";
  for (const tr of trims) {
    const tn = norm(tr.name);
    const ts = norm(tr.slug);
    if ((tn && hay.includes(tn)) || (ts && hay.includes(ts))) {
      trimSlug = tr.slug;
      break;
    }
  }
  if (!trimSlug && (hay.includes("g 63") || hay.includes("g63") || hay.includes("amg"))) {
    const amg = trims.find((t) => /63|amg/i.test(t.slug + t.name));
    if (amg) trimSlug = amg.slug;
  }

  return {
    brand: brandSlug,
    model: modelSlug,
    trim: trimSlug,
    score: brandScore + modelScore + (trimSlug ? 5 : 0),
  };
}

export function matchVehicleBrandModel(input: {
  subtype: string;
  brand?: string;
  model?: string;
  title?: string;
  description?: string;
  bodyType?: string;
}): { subtype: string; brand: string; model: string; trim: string } {
  const hay = norm(
    [input.bodyType, input.brand, input.model, input.title, input.description].filter(Boolean).join(" ")
  );

  let subtype = VALID_SUBTYPES.has(input.subtype) ? input.subtype : matchVehicleSubtype(hay, input.bodyType);
  let best = scoreBrandModelInSubtype(subtype, hay);

  if (!best.model) {
    for (const t of ARAC_TYPES) {
      const hit = scoreBrandModelInSubtype(t.slug, hay);
      if (hit.score > best.score && hit.model) {
        best = hit;
        subtype = t.slug;
      }
    }
  }

  const fromText = matchVehicleSubtype(hay, input.bodyType);
  if (fromText === "arazi-suv-pickup" && subtype === "otomobil") {
    const suvHit = scoreBrandModelInSubtype("arazi-suv-pickup", hay);
    if (suvHit.brand) {
      subtype = "arazi-suv-pickup";
      if (suvHit.score >= best.score) best = suvHit;
    }
  }

  return {
    subtype,
    brand: best.brand,
    model: best.model,
    trim: best.trim,
  };
}

export function normalizeFuel(raw: string): string {
  const t = norm(raw);
  if (t.includes("dizel") || t.includes("diesel")) return "Dizel";
  if (t.includes("lpg")) return "LPG";
  if (t.includes("hibrit") || t.includes("hybrid")) return "Hibrit";
  if (t.includes("elektr")) return "Elektrik";
  if (t.includes("benzin") || t.includes("gasoline") || t.includes("petrol")) return "Benzin";
  return raw.trim();
}

export function normalizeGear(raw: string): string {
  const t = norm(raw);
  if (t.includes("otomatik") || t.includes("automatic") || t.includes("auto")) return "Otomatik";
  if (t.includes("yari") || t.includes("yarı")) return "Yarı Otomatik";
  if (t.includes("manuel") || t.includes("manual")) return "Manuel";
  return raw.trim();
}

const COLOR_MAP: Array<{ out: string; keys: string[] }> = [
  { out: "Yeşil", keys: ["yesil", "yeşil", "green"] },
  { out: "Kırmızı", keys: ["kirmizi", "kırmızı", "red"] },
  { out: "Beyaz", keys: ["beyaz", "white"] },
  { out: "Siyah", keys: ["siyah", "black"] },
  { out: "Gri", keys: ["gri", "gray", "grey"] },
  { out: "Gümüş", keys: ["gumus", "gümüş", "silver"] },
  { out: "Mavi", keys: ["mavi", "blue"] },
  { out: "Sarı", keys: ["sari", "sarı", "yellow"] },
  { out: "Turuncu", keys: ["turuncu", "orange"] },
  { out: "Kahverengi", keys: ["kahverengi", "brown"] },
  { out: "Bej", keys: ["bej", "beige"] },
  { out: "Bordo", keys: ["bordo", "maroon"] },
  { out: "Lacivert", keys: ["lacivert", "navy"] },
];

const COLOR_ALT = COLOR_MAP.map((r) => r.keys.join("|")).join("|");

function isGenericColorLabel(s: string) {
  const t = norm(s);
  return !t || t === "ozel renk" || t === "ozel" || t === "diger" || t === "diğer" || t === "other";
}

function mapColorToken(token: string): string {
  const t = norm(token);
  const hit = COLOR_MAP.find((row) => row.keys.some((k) => t === norm(k) || t.startsWith(norm(k) + " ")));
  return hit?.out || "";
}

/** Metindeki "Renk: Yeşil" etiketini öncelikle al (AI uydurmasından üstün) */
function labeledColorFromText(text: string): string {
  const raw = String(text || "");
  // "Renk Yeşil" / "Renk: Yeşil" — "özel renk" satırını atla
  const re = new RegExp(
    `(?:^|[\\n\\r]|\\s)renk\\s*[:：]?\\s*(${COLOR_ALT})(?:\\s|$|[\\n\\r]|,)`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const before = raw.slice(Math.max(0, m.index - 8), m.index).toLocaleLowerCase("tr-TR");
    if (before.includes("özel") || before.includes("ozel")) continue;
    const mapped = mapColorToken(m[1]);
    if (mapped) return mapped;
  }
  return "";
}

/**
 * Renk: önce ilan metnindeki "Renk …" alanı, sonra AI değeri.
 * AI "Kırmızı" dese bile metinde "Renk Yeşil" varsa Yeşil kazanır.
 */
export function normalizeVehicleColor(raw: string, ...hints: string[]): string {
  const corpus = [raw, ...hints].filter(Boolean).join("\n");
  const labeled = labeledColorFromText(corpus);
  if (labeled) return labeled;

  const rawT = String(raw || "").trim();
  if (rawT && !isGenericColorLabel(rawT)) {
    const mapped = mapColorToken(rawT);
    if (mapped) return mapped;
    // AI tek kelime renk verdiyse
    for (const row of COLOR_MAP) {
      if (row.keys.some((k) => norm(rawT) === norm(k))) return row.out;
    }
  }

  // Son çare: metinde geçen ilk net renk adı (özel renk hariç)
  const n = norm(corpus.replace(/ozel renk/g, " "));
  for (const row of COLOR_MAP) {
    if (row.keys.some((k) => n.includes(norm(k)))) return row.out;
  }
  return "";
}

function digitsOnly(s: string) {
  return String(s || "").replace(/[.\s]/g, "").replace(/[^\d]/g, "");
}

/** Metinden kilometre adayları (etiketli alan öncelikli) */
function kmCandidatesFromText(text: string): number[] {
  const raw = String(text || "");
  const out: number[] = [];
  const push = (s: string) => {
    const d = digitsOnly(s);
    if (!d) return;
    const n = Number(d);
    // makul km aralığı (yıl/fiyat karışmasın)
    if (Number.isFinite(n) && n >= 0 && n <= 2_000_000) out.push(n);
  };

  const labeled = [
    ...raw.matchAll(/kilometre\s*[:：]?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)/gi),
    ...raw.matchAll(/km\s*[:：]\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)/gi),
  ];
  for (const m of labeled) push(m[1]);

  for (const m of raw.matchAll(/(\d{1,3}(?:[.\s]\d{3})+|\d{2,7})\s*km\b/gi)) {
    push(m[1]);
  }
  return out;
}

/**
 * Km: metindeki "Kilometre / xx km" AI'nın 0'ından üstündür.
 * AI 0 + metinde 55000 → 55000. Gerçek 0 km için metinde de 0 olmalı veya metin boş.
 */
export function parseVehicleKm(aiKm: unknown, ...textChunks: unknown[]): string {
  const blob = textChunks.map((x) => String(x ?? "")).join("\n");
  const textVals = kmCandidatesFromText(blob);

  let aiVal: number | null = null;
  if (aiKm != null && aiKm !== "") {
    if (typeof aiKm === "number" && Number.isFinite(aiKm) && aiKm >= 0) aiVal = Math.round(aiKm);
    else {
      const d = digitsOnly(String(aiKm));
      if (d) aiVal = Number(d);
    }
  }

  // Etiketli / "55.000 km" metin değerleri
  const textBest = textVals.length ? Math.max(...textVals) : null;

  if (textBest != null && textBest > 0) {
    // AI 0 veya boş veya çok farklıysa metni kullan
    if (aiVal == null || aiVal === 0 || Math.abs(aiVal - textBest) / textBest > 0.2) {
      return String(textBest);
    }
    return String(aiVal);
  }

  // Metinde yalnızca 0 km
  if (textVals.includes(0)) return "0";

  if (aiVal != null && aiVal > 0) return String(aiVal);
  if (aiVal === 0) return "0";
  return "";
}
