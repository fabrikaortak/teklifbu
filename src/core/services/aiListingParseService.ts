import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getSetting } from "@/core/settings";
import { VEHICLE_EKSPERTIZ } from "@/data/vehicleExtras";
import {
  extractHousingTableFields,
  fieldStr,
  matchHousingSubtype,
  normalizeBalcony,
  normalizeBuildingAgeBand,
  normalizeDeedStatus,
  normalizeDues,
  normalizeFurnished,
  normalizeHeating,
  normalizeRooms,
  parseFloorNum,
  parseM2,
} from "@/data/housingMatch";
import {
  housingEnumPromptForAi,
  normalizeEnergyCertificate,
  normalizeFloorOption,
  normalizeKitchen,
  normalizeSellerType,
  normalizeUsageStatus,
  normalizeYesNo,
} from "@/data/housingFormFields";
import {
  extractVehicleTableFields,
  normalizeVehicleBodyType,
  normalizeVehicleChassis,
  normalizeVehicleDrive,
  normalizeVehicleSeller,
  normalizeVehicleStatus,
  normalizeVehicleYesNo,
  vehicleEnumPromptForAi,
} from "@/data/vehicleFormFields";
import { stripContactFromAiDescription } from "@/lib/listingDescription";
import {
  matchVehicleBrandModel,
  matchVehicleSubtype,
  normalizeFuel,
  normalizeGear,
  normalizeVehicleColor,
  parseVehicleKm,
} from "@/data/vehicleMatch";

export type AiListingDraft = {
  title: string;
  description: string;
  city: string;
  district: string;
  neighborhood: string;
  dealType: "SATILIK" | "KIRALIK" | "SATIS" | string;
  askPrice: number | null;
  categorySlug: string;
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
  year: string;
  km: string;
  brand: string;
  model: string;
  series: string;
  trim: string;
  subtype: string;
  fuel: string;
  gear: string;
  color: string;
  vehicleStatus: string;
  bodyType: string;
  chassis: string;
  enginePower: string;
  engineSize: string;
  drive: string;
  seats: string;
  licenseRecord: string;
  heavyDamage: string;
  plateOrigin: string;
  tramer: string;
  boyaDurumu: string;
  degisenDurumu: string;
  hasarDurumu: string;
  /** Bizim ekstra id'ler (vasıta veya konut) — AI doldurmaz */
  extras: string[];
  confidence: number;
  notes: string;
};

function normalizeDealType(raw: string): string {
  const s = String(raw || "")
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, "");
  if (s.includes("KİRA") || s.includes("KIRA") || s === "KIRALIK") return "KIRALIK";
  return "SATILIK";
}

function guessCategorySlug(raw: string, title = "", extrasHint = ""): string {
  const s = `${raw} ${title} ${extrasHint}`.toLocaleLowerCase("tr-TR");
  // Konut sinyalleri önce (daire ilanında yanlışlıkla araç olmasın)
  if (
    s.includes("daire") ||
    s.includes("residence") ||
    s.includes("rezidans") ||
    s.includes("villa") ||
    s.includes("konut") ||
    s.includes("emlak") ||
    s.includes("m²") ||
    s.includes("m2") ||
    s.includes("oda sayısı") ||
    s.includes("oda sayisi") ||
    s.includes("bina yaşı") ||
    s.includes("bina yasi")
  ) {
    if (s.includes("kiralık") || s.includes("kiralik") || raw === "kiralik") return "kiralik";
    return "konut";
  }
  if (
    s.includes("vasıta") ||
    s.includes("vasita") ||
    s.includes("otomobil") ||
    s.includes("mercedes") ||
    s.includes("bmw") ||
    s.includes("suv") ||
    s.includes("amg") ||
    s.includes("motosiklet") ||
    s.includes("kilometre") ||
    (s.includes("araç") || s.includes("arac"))
  )
    return "arac";
  if (s.includes("arsa")) return "arsa";
  if (s.includes("işyeri") || s.includes("isyeri") || s.includes("ofis") || s.includes("dükkan")) return "isyeri";
  if (s.includes("kiralık") || s.includes("kiralik")) return "kiralik";
  return "konut";
}

/** TR fiyat: 14.250.000 veya 14.250.000,00 → sayı */
function parseTrPrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  let s = String(raw).replace(/[^\d.,]/g, "").trim();
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length <= 2 ? `${parts[0].replace(/\./g, "")}.${parts[1]}` : s.replace(/,/g, "");
  } else {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function pickFromList(raw: string, options: readonly string[]): string {
  const t = String(raw || "")
    .toLocaleLowerCase("tr-TR")
    .trim();
  if (!t) return "";
  for (const opt of options) {
    if (t === opt.toLocaleLowerCase("tr-TR")) return opt;
  }
  // anahtar kelime
  if (options === VEHICLE_EKSPERTIZ.tramer) {
    if (t.includes("yok") || t.includes("kayıtsız") || t.includes("kayitsiz") || t.includes("tramer yok")) return "Yok";
    if (t.includes("var")) return "Var";
  }
  if (options === VEHICLE_EKSPERTIZ.boyaDurumu) {
    if (t.includes("boyasız") || t.includes("boyasiz")) return "Boyasız";
    if (t.includes("lokal")) return "Lokal boyalı";
    if (t.includes("boya")) return "Boyalı";
  }
  if (options === VEHICLE_EKSPERTIZ.degisenDurumu) {
    if (t.includes("değişensiz") || t.includes("degisensiz") || t.includes("orijinal")) return "Değişensiz";
    if (t.includes("değişen") || t.includes("degisen")) return "Değişen var";
  }
  if (options === VEHICLE_EKSPERTIZ.hasarDurumu) {
    if (t.includes("ağır") || t.includes("agir")) return "Ağır hasar kayıtlı";
    if (t.includes("hasarsız") || t.includes("hasarsiz") || t.includes("hatasız") || t.includes("hatasiz")) return "Hasarsız";
    if (t.includes("hasar")) return "Hasarlı";
  }
  return "";
}

type ImagePart = { type: "image_url"; image_url: { url: string; detail: "high" } };

/** Sabit tarama penceresi — sayfa yukarıdan aşağı 1418×888 kesilir */
const TILE_W = 1418;
const TILE_H = 888;
/** Yalnızca ilk 3 dilim AI’ya gider (tablo / açıklama / devam); ek özellik yok */
const AI_TILE_COUNT = 3;

async function loadImageBuffer(imageUrl: string): Promise<Buffer> {
  const url = String(imageUrl || "").trim();
  if (!url) throw new Error("Görsel URL gerekli");

  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1] || "";
    return Buffer.from(b64, "base64");
  }

  if (url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    return readFile(filePath);
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Görsel indirilemedi");
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("Geçersiz görsel URL");
}

/** 1 veya 2 SS — iki parça ise dikey birleştir */
async function loadPageBuffer(urls: string[]): Promise<Buffer> {
  const list = urls.map((u) => String(u || "").trim()).filter(Boolean).slice(0, 2);
  if (!list.length) throw new Error("Görsel gerekli");
  if (list.length === 1) return loadImageBuffer(list[0]);

  const bufs = await Promise.all(list.map((u) => loadImageBuffer(u)));
  const prepared = await Promise.all(
    bufs.map((b) =>
      sharp(b)
        .rotate()
        .flatten({ background: "#ffffff" })
        .resize({ width: TILE_W, kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer()
    )
  );
  const heights: number[] = [];
  for (const p of prepared) {
    const m = await sharp(p).metadata();
    heights.push(Math.max(1, m.height || 1));
  }
  const totalH = heights.reduce((a, b) => a + b, 0);
  return sharp({
    create: { width: TILE_W, height: totalH, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: prepared[0], top: 0, left: 0 },
      { input: prepared[1], top: heights[0], left: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * Tek SS → 1418×888 dilimler; yalnızca ilk `limit` parça üretilir.
 * Son parça kısa kalırsa beyazla 1418×888’e tamamlanır.
 */
async function buildFixedPageTiles(buf: Buffer, limit = AI_TILE_COUNT): Promise<ImagePart[]> {
  const page = await sharp(buf)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: TILE_W, kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 6 })
    .toBuffer();

  const meta = await sharp(page).metadata();
  const width = meta.width || TILE_W;
  const height = Math.max(1, meta.height || TILE_H);
  const maxTiles = Math.max(1, Math.min(limit, Math.ceil(height / TILE_H)));

  const parts: ImagePart[] = [];
  for (let i = 0; i < maxTiles; i++) {
    const top = i * TILE_H;
    const extractH = Math.min(TILE_H, height - top);
    const crop = await sharp(page)
      .extract({ left: 0, top, width, height: extractH })
      .png()
      .toBuffer();

    const tile = await sharp({
      create: {
        width: TILE_W,
        height: TILE_H,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite([{ input: crop, top: 0, left: 0 }])
      .sharpen({ sigma: 0.5 })
      .png({ compressionLevel: 6 })
      .toBuffer();

    parts.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${tile.toString("base64")}`, detail: "high" },
    });
  }
  return parts;
}

async function openaiJson(
  cfg: { apiKey: string; baseUrl: string; model: string },
  system: string,
  userText: string,
  images: ImagePart[]
): Promise<Record<string, unknown>> {
  const endpoint = `${cfg.baseUrl}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [{ type: "text", text: userText }, ...images],
        },
      ],
    }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = raw?.error?.message || raw?.error || `OpenAI hata (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "OpenAI isteği başarısız");
  }

  const content = raw?.choices?.[0]?.message?.content;
  try {
    return typeof content === "string" ? JSON.parse(content) : content || {};
  } catch {
    throw new Error("AI yanıtı JSON değil");
  }
}

/** Doğruluk için: her vision çağrısında yalnızca 1 görsel */
async function openaiJsonOneImage(
  cfg: { apiKey: string; baseUrl: string; model: string },
  system: string,
  userText: string,
  image: ImagePart
): Promise<Record<string, unknown>> {
  return openaiJson(cfg, system, userText, [image]);
}

/** Görsel yok — sadece metin (tableText → alan eşleme) */
async function openaiJsonTextOnly(
  cfg: { apiKey: string; baseUrl: string; model: string },
  system: string,
  userText: string
): Promise<Record<string, unknown>> {
  return openaiJson(cfg, system, userText, []);
}

function mergeParsedFields(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (k === "tableText" || k === "confidence" || k === "notes") continue;
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s === "null" || s === "undefined") continue;
    // overlay doluysa yaz (ikinci tur tablo metninden daha güvenilir)
    out[k] = v;
  }
  return out;
}

export async function getAiListingConfig() {
  const [enabled, offerPopupEnabled, apiKey, baseUrl, model, tokenCost] = await Promise.all([
    getSetting<boolean>("ai_listing_import_enabled", false),
    getSetting<boolean>("ai_listing_offer_popup_enabled", true),
    getSetting<string>("ai_openai_api_key", ""),
    getSetting<string>("ai_openai_base_url", "https://api.openai.com/v1"),
    getSetting<string>("ai_openai_model", "gpt-4o"),
    getSetting<number>("ai_listing_parse_token_cost", 2),
  ]);
  return {
    enabled: Boolean(enabled),
    /** İlan Ver sayfasındaki kampanya popup’ı */
    offerPopupEnabled: Boolean(offerPopupEnabled),
    apiKey: String(apiKey || "").trim(),
    baseUrl: String(baseUrl || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: String(model || "gpt-4o").trim() || "gpt-4o",
    tokenCost: Math.max(0, Math.floor(Number(tokenCost) || 0)),
  };
}

function assembleListingDraft(parsed: Record<string, unknown>): AiListingDraft {
  const title = String(parsed.title || "").trim().slice(0, 160);
  const description = stripContactFromAiDescription(String(parsed.description || ""))
    .trim()
    .slice(0, 8000);
  const askPrice = parseTrPrice(parsed.askPrice);
  const categorySlug = guessCategorySlug(
    String(parsed.categorySlug || ""),
    title,
    String(parsed.tableText || "")
  );
  const isHome = categorySlug === "konut" || categorySlug === "kiralik";
  const isVehicle = categorySlug === "arac";

  let bodyType = String(parsed.bodyType || "").trim();
  let subtype = String(parsed.subtype || "").trim();
  let brand = String(parsed.brand || "").trim();
  let model = String(parsed.model || "").trim();
  let series = String(parsed.series || "").trim();
  let trim = String(parsed.trim || "").trim();
  const extras: string[] = [];
  const tableColor = String(parsed.tableColor || "").trim();
  const tableKm = String(parsed.tableKm || "").trim();
  let color = String(parsed.color || "").trim();
  let km = "";
  let year = String(parsed.year || "").trim().replace(/[^\d]/g, "").slice(0, 4);
  let fuel = String(parsed.fuel || "").trim();
  let gear = String(parsed.gear || "").trim();
  let vehicleStatus = String(parsed.vehicleStatus || parsed.condition || "").trim();
  let chassis = String(parsed.chassis || "").trim();
  let enginePower = String(parsed.enginePower || "").trim();
  let engineSize = String(parsed.engineSize || "").trim();
  let drive = String(parsed.drive || "").trim();
  let seats = String(parsed.seats || "").trim();
  let licenseRecord = String(parsed.licenseRecord || "").trim();
  let heavyDamage = String(parsed.heavyDamage || "").trim();
  let plateOrigin = String(parsed.plateOrigin || "").trim();
  let rooms = fieldStr(parsed.rooms);
  let m2 = fieldStr(parsed.m2);
  let netM2 = fieldStr(parsed.netM2);
  let buildingAge = fieldStr(parsed.buildingAge);
  let floor = fieldStr(parsed.floor);
  let totalFloors = fieldStr(parsed.totalFloors);
  let heating = fieldStr(parsed.heating);
  let bathrooms = fieldStr(parsed.bathrooms);
  let balcony = fieldStr(parsed.balcony);
  let kitchen = fieldStr(parsed.kitchen);
  let usageStatus = fieldStr(parsed.usageStatus);
  let inSite = fieldStr(parsed.inSite);
  let siteName = fieldStr(parsed.siteName);
  let elevator = fieldStr(parsed.elevator);
  let creditEligible = fieldStr(parsed.creditEligible);
  let energyCertificate = fieldStr(parsed.energyCertificate);
  let sellerType = fieldStr(parsed.sellerType);
  let swap = fieldStr(parsed.swap);
  let dues = fieldStr(parsed.dues);
  let deedStatus = fieldStr(parsed.deedStatus);
  let furnished = fieldStr(parsed.furnished);
  const tableText = String(parsed.tableText || "").trim();

  if (isVehicle) {
    const vt = extractVehicleTableFields(tableText, title);
    brand = vt.brand || brand;
    series = vt.series || series;
    model = vt.model || model;
    year = (vt.year || year).replace(/[^\d]/g, "").slice(0, 4);
    fuel = normalizeFuel(vt.fuel || fuel) || vt.fuel || fuel;
    gear = normalizeGear(vt.gear || gear) || vt.gear || gear;
    vehicleStatus = normalizeVehicleStatus(vt.vehicleStatus || vehicleStatus);
    bodyType = normalizeVehicleBodyType(vt.bodyType || bodyType);
    chassis = normalizeVehicleChassis(vt.chassis || chassis);
    enginePower = (vt.enginePower || enginePower).trim();
    engineSize = (vt.engineSize || engineSize).trim();
    drive = normalizeVehicleDrive(vt.drive || drive);
    seats = (vt.seats || seats).trim();
    licenseRecord = (vt.licenseRecord || licenseRecord).trim();
    heavyDamage = normalizeVehicleYesNo(vt.heavyDamage || heavyDamage);
    sellerType = normalizeVehicleSeller(vt.sellerType || sellerType);
    plateOrigin = (vt.plateOrigin || plateOrigin).trim();
    swap = normalizeVehicleYesNo(vt.swap || swap);
    color = normalizeVehicleColor(
      vt.color || tableColor || color,
      `Renk: ${vt.color || tableColor || color}`,
      tableText,
      title,
      description
    );
    km = parseVehicleKm(
      parsed.km,
      vt.km ? `Kilometre: ${vt.km}` : tableKm ? `Kilometre: ${tableKm}` : "",
      tableText,
      title,
      description
    );

    const blob = [title, description, bodyType, brand, model, series, trim, tableText].join("\n");
    const hinted = matchVehicleSubtype(blob, bodyType);
    if (!subtype || !/^[a-z0-9-]+$/.test(subtype) || (hinted === "arazi-suv-pickup" && subtype === "otomobil")) {
      subtype = hinted;
    }
    const matched = matchVehicleBrandModel({
      subtype,
      brand,
      model: model || series,
      bodyType,
      title,
      description: `${description}\n${tableText}\n${series}\n${trim}`,
    });
    subtype = matched.subtype || subtype;
    brand = matched.brand || brand;
    model = matched.model || model;
    trim = matched.trim || trim;
  } else if (isHome) {
    const table = extractHousingTableFields(
      tableText,
      title,
      description,
      [
        rooms && `Oda Sayısı ${rooms}`,
        m2 && `m² (Brüt) ${m2}`,
        netM2 && `m² (Net) ${netM2}`,
        buildingAge !== "" && `Bina Yaşı ${buildingAge}`,
        floor !== "" && `Bulunduğu Kat ${floor}`,
        totalFloors !== "" && `Kat Sayısı ${totalFloors}`,
        heating && `Isıtma ${heating}`,
        bathrooms !== "" && `Banyo Sayısı ${bathrooms}`,
        balcony && `Balkon ${balcony}`,
        kitchen && `Mutfak ${kitchen}`,
        usageStatus && `Kullanım Durumu ${usageStatus}`,
        inSite && `Site İçinde ${inSite}`,
        siteName && `Site Adı ${siteName}`,
        elevator && `Asansör ${elevator}`,
        creditEligible && `Krediye Uygun ${creditEligible}`,
        energyCertificate && `Enerji Kimlik Belgesi ${energyCertificate}`,
        sellerType && `Kimden ${sellerType}`,
        swap && `Takas ${swap}`,
        dues !== "" && `Aidat ${dues}`,
        deedStatus && `Tapu Durumu ${deedStatus}`,
        furnished && `Eşyalı ${furnished}`,
      ]
        .filter(Boolean)
        .join("\n")
    );

    subtype = matchHousingSubtype(`${subtype} ${bodyType} ${title} ${tableText}`, categorySlug);
    rooms = table.rooms || normalizeRooms(rooms);
    m2 = table.m2 || parseM2(m2);
    netM2 = table.netM2 || parseM2(netM2);
    buildingAge = normalizeBuildingAgeBand(table.buildingAge || buildingAge);
    floor = normalizeFloorOption(table.floor || floor) || parseFloorNum(table.floor || floor);
    totalFloors = parseFloorNum(table.totalFloors || totalFloors);
    heating = table.heating || normalizeHeating(heating);
    bathrooms = parseFloorNum(table.bathrooms || bathrooms);
    balcony = table.balcony || normalizeBalcony(balcony);
    dues = normalizeDues(table.dues || dues);
    deedStatus = table.deedStatus || normalizeDeedStatus(deedStatus);
    furnished = table.furnished || normalizeFurnished(furnished);
    kitchen = normalizeKitchen(table.kitchen) || normalizeKitchen(kitchen);
    usageStatus = normalizeUsageStatus(table.usageStatus) || normalizeUsageStatus(usageStatus);
    inSite = normalizeYesNo(table.inSite) || normalizeYesNo(inSite);
    if (table.flags.siteIci === true) inSite = "Evet";
    if (table.flags.siteIci === false && !inSite) inSite = "Hayır";
    siteName = (table.siteName || siteName).trim();
    if (inSite !== "Evet") siteName = "";
    elevator = normalizeYesNo(table.elevator) || normalizeYesNo(elevator);
    if (table.flags.asansor === true) elevator = "Evet";
    if (table.flags.asansor === false) elevator = "Hayır";
    creditEligible = normalizeYesNo(table.creditEligible) || normalizeYesNo(creditEligible);
    energyCertificate =
      normalizeEnergyCertificate(table.energyCertificate) || normalizeEnergyCertificate(energyCertificate);
    sellerType = normalizeSellerType(table.sellerType) || normalizeSellerType(sellerType);
    swap = normalizeYesNo(table.swap) || normalizeYesNo(swap);
  }

  return {
    title,
    description,
    city: String(parsed.city || "").trim(),
    district: String(parsed.district || "").trim(),
    neighborhood: String(parsed.neighborhood || "").trim(),
    dealType: normalizeDealType(String(parsed.dealType || "SATILIK")),
    askPrice,
    categorySlug,
    rooms,
    m2,
    netM2,
    buildingAge,
    floor,
    totalFloors,
    heating,
    bathrooms,
    balcony,
    kitchen: isHome ? kitchen : "",
    usageStatus: isHome ? usageStatus : "",
    inSite: isHome ? inSite : "",
    siteName: isHome ? siteName : "",
    elevator: isHome ? elevator : "",
    creditEligible: isHome ? creditEligible : "",
    energyCertificate: isHome ? energyCertificate : "",
    sellerType: isHome || isVehicle ? sellerType : "",
    swap: isHome || isVehicle ? swap : "",
    dues,
    deedStatus,
    furnished,
    year: isVehicle ? year : "",
    km: isVehicle ? km : "",
    brand: isVehicle ? brand : "",
    model: isVehicle ? model : "",
    series: isVehicle ? series : "",
    trim: isVehicle ? trim : "",
    subtype: isVehicle || isHome ? subtype : "",
    fuel: isVehicle ? fuel : "",
    gear: isVehicle ? gear : "",
    color: isVehicle ? color : "",
    vehicleStatus: isVehicle ? vehicleStatus : "",
    bodyType: isVehicle ? bodyType : "",
    chassis: isVehicle ? chassis : "",
    enginePower: isVehicle ? enginePower : "",
    engineSize: isVehicle ? engineSize : "",
    drive: isVehicle ? drive : "",
    seats: isVehicle ? seats : "",
    licenseRecord: isVehicle ? licenseRecord : "",
    heavyDamage: isVehicle ? heavyDamage : "",
    plateOrigin: isVehicle ? plateOrigin : "",
    tramer: isVehicle ? pickFromList(String(parsed.tramer || ""), VEHICLE_EKSPERTIZ.tramer) : "",
    boyaDurumu: isVehicle ? pickFromList(String(parsed.boyaDurumu || ""), VEHICLE_EKSPERTIZ.boyaDurumu) : "",
    degisenDurumu: isVehicle ? pickFromList(String(parsed.degisenDurumu || ""), VEHICLE_EKSPERTIZ.degisenDurumu) : "",
    hasarDurumu: isVehicle
      ? pickFromList(String(parsed.hasarDurumu || "") || `${title} ${description}`, VEHICLE_EKSPERTIZ.hasarDurumu)
      : "",
    extras,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    notes: String(parsed.notes || "").trim(),
  };
}

/**
 * Tek SS → yalnızca ilk 3 dilim (1418×888):
 * 1) başlık / fiyat / adres / özellik tablosu
 * 2) açıklama
 * 3) açıklama veya tablo devamı
 * İlan ek özellikleri AI tarafından seçilmez.
 */
export async function parseListingFromScreenshot(
  imageUrlOrUrls: string | string[]
): Promise<AiListingDraft> {
  const cfg = await getAiListingConfig();
  if (!cfg.enabled) throw new Error("AI ile ilan aktarımı kapalı");
  if (!cfg.apiKey) throw new Error("OpenAI API anahtarı tanımlı değil (Admin → AI)");

  const urls = (Array.isArray(imageUrlOrUrls) ? imageUrlOrUrls : [imageUrlOrUrls])
    .map((u) => String(u || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!urls.length) throw new Error("Görsel gerekli");

  const tiles = await buildFixedPageTiles(await loadPageBuffer(urls), AI_TILE_COUNT);
  if (!tiles.length) throw new Error("Görsel dilimlenemedi");

  let parsed: Record<string, unknown> = {};
  const descParts: string[] = [];

  // —— 1. dilim: başlık, fiyat, adres, özellik tablosu ——
  const tableParsed = await openaiJsonOneImage(
    cfg,
    `Sahibinden ilan — 1. dilim (başlık + fiyat + adres + özellik tablosu). Tek görsel.
Sadece JSON. Uydurma. Görmediğin "".
tableText: tablodaki her satırı AYNEN kopyala (İlan No, m², Oda Sayısı, Kat, Isıtma, Mutfak…).
title, askPrice, city, district, neighborhood, dealType, categorySlug.
askPrice: 7.900.000 → 7900000
categorySlug: konut | kiralik | arac | arsa | isyeri
Açıklama / yeşil tik / ek özellik YAZMA.
JSON: title, city, district, neighborhood, dealType, askPrice, categorySlug, tableText, confidence`,
    `Bu 1418×888 dilimden başlık, fiyat, adres ve özellik tablosunu çıkar.`,
    tiles[0]
  );
  parsed = mergeParsedFields(parsed, tableParsed);
  parsed.tableText = String(tableParsed.tableText || "");

  // tableText → form alanları (görselsiz)
  let tableText = String(parsed.tableText || "").trim();
  if (tableText.length > 40) {
    const mapped = await openaiJsonTextOnly(
      cfg,
      `Aşağıdaki tablo metninden form alanlarını doldur.
Sadece JSON. Uydurma. Metinde yoksa "".
${housingEnumPromptForAi()}
${vehicleEnumPromptForAi()}
floor: "Giriş Katı"→"Giriş Kat"
Konut sellerType: Sahibinden→Sahibi ; emlak ofisi→Emlak Ofisi
Vasıta sellerType: Galeriden | Sahibinden | Yetkili Bayiden
dues: Belirtilmemiş→""
JSON: rooms, m2, netM2, buildingAge, floor, totalFloors, heating, bathrooms, balcony, kitchen, usageStatus, inSite, siteName, elevator, creditEligible, energyCertificate, sellerType, swap, dues, deedStatus, furnished, subtype, bodyType, brand, series, model, trim, year, fuel, gear, color, km, vehicleStatus, chassis, enginePower, engineSize, drive, seats, licenseRecord, heavyDamage, plateOrigin`,
      `TABLO METNİ:\n${tableText.slice(0, 14000)}`
    );
    parsed = mergeParsedFields(parsed, mapped);
    parsed.tableText = tableText;
  }

  // —— 2. dilim: açıklama ——
  if (tiles[1]) {
    const descParsed = await openaiJsonOneImage(
      cfg,
      `Sahibinden "Açıklama" dilimi — tek görsel. Sadece JSON.
description: metni AYNEN (maddeler dahil). Telefon / WhatsApp / e-posta satırlarını ATLA.
Yeşil tik / ek özellik / özellik tablosu YAZMA.
JSON: { "description": string }`,
      `Bu 1418×888 dilimden yalnızca ilan açıklamasını çıkar.`,
      tiles[1]
    );
    const d = String(descParsed.description || "").trim();
    if (d) descParts.push(d);
  }

  // —— 3. dilim: açıklama veya tablo devamı (ek özellik YOK) ——
  let gotMoreTable = false;
  if (tiles[2]) {
    const cont = await openaiJsonOneImage(
      cfg,
      `Sahibinden ilan — 3. dilim. Tek görsel. Sadece JSON. Uydurma.
Bu dilimde ne varsa onu yaz:
- description: açıklama metni devamı (telefon satırlarını yazma)
- tableText: özellik tablosu satırları görünüyorsa
Yeşil tik / Cephe / İç / Dış / Muhit ek özellikleri ASLA yazma.
JSON: { "description": string, "tableText": string }`,
      `Bu 1418×888 dilimden açıklama veya tablo devamını çıkar. Ek özellik seçme.`,
      tiles[2]
    );
    const d = String(cont.description || "").trim();
    if (d) descParts.push(d);
    const moreTable = String(cont.tableText || "").trim();
    if (moreTable) {
      tableText = [tableText, moreTable].filter(Boolean).join("\n");
      parsed.tableText = tableText;
      gotMoreTable = true;
    }
  }

  parsed.description = descParts.join("\n\n").trim();

  if (gotMoreTable && tableText.length > 40) {
    const mapped = await openaiJsonTextOnly(
      cfg,
      `Aşağıdaki tablo metninden form alanlarını doldur.
Sadece JSON. Uydurma. Metinde yoksa "".
${housingEnumPromptForAi()}
${vehicleEnumPromptForAi()}
JSON: rooms, m2, netM2, buildingAge, floor, totalFloors, heating, bathrooms, balcony, kitchen, usageStatus, inSite, siteName, elevator, creditEligible, energyCertificate, sellerType, swap, dues, deedStatus, furnished, subtype, bodyType, brand, series, model, trim, year, fuel, gear, color, km, vehicleStatus, chassis, enginePower, engineSize, drive, seats, licenseRecord, heavyDamage, plateOrigin`,
      `TABLO METNİ:\n${tableText.slice(0, 14000)}`
    );
    parsed = mergeParsedFields(parsed, mapped);
    parsed.tableText = tableText;
  }

  return assembleListingDraft(parsed);
}
