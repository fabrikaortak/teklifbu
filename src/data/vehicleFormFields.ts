/** Vasıta ilan özellikleri — Sahibinden tablo alanları */

export const VEHICLE_STATUS_OPTIONS = ["Sıfır", "İkinci El"] as const;

export const VEHICLE_SELLER_OPTIONS = ["Sahibinden", "Galeriden", "Yetkili Bayiden"] as const;

export const VEHICLE_YES_NO_OPTIONS = ["Evet", "Hayır"] as const;

export const VEHICLE_CHASSIS_OPTIONS = ["Kısa", "Orta", "Uzun"] as const;

export const VEHICLE_DRIVE_OPTIONS = [
  "4x2 (Önden Çekişli)",
  "4x2 (Arkadan Çekişli)",
  "4x4",
  "AWD",
] as const;

export const VEHICLE_BODY_TYPE_OPTIONS = [
  "Sedan",
  "Hatchback",
  "Station Wagon",
  "SUV",
  "Crossover",
  "Coupe",
  "Cabrio",
  "MPV",
  "Pickup",
  "Panel Van",
  "Minivan",
  "Roadster",
] as const;

export function normalizeVehicleStatus(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s.toLocaleLowerCase("tr-TR");
  if (t.includes("belirtilmemis")) return "";
  if (t.includes("ikinci") || t.includes("2. el") || t.includes("2 el") || t.includes("kullanılmış"))
    return "İkinci El";
  if (t.includes("sıfır") || t.includes("sifir") || t === "0 km" || t.includes("0 km")) return "Sıfır";
  return VEHICLE_STATUS_OPTIONS.includes(s as (typeof VEHICLE_STATUS_OPTIONS)[number]) ? s : "";
}

export function normalizeVehicleSeller(raw: unknown): string {
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
  if (t.includes("galeri")) return "Galeriden";
  if (t.includes("yetkili") || t.includes("bayi")) return "Yetkili Bayiden";
  if (t.includes("sahibinden") || t.includes("sahibi") || t.includes("mal sahibi")) return "Sahibinden";
  return VEHICLE_SELLER_OPTIONS.includes(s as (typeof VEHICLE_SELLER_OPTIONS)[number]) ? s : "";
}

export function normalizeVehicleYesNo(raw: unknown): string {
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
  if (t === "evet" || t === "var") return "Evet";
  if (t === "hayir" || t === "yok") return "Hayır";
  if (s === "Evet" || s === "Hayır") return s;
  return "";
}

export function normalizeVehicleChassis(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s.toLocaleLowerCase("tr-TR");
  if (t.includes("kisa") || t.includes("kısa")) return "Kısa";
  if (t.includes("uzun")) return "Uzun";
  if (t.includes("orta")) return "Orta";
  return VEHICLE_CHASSIS_OPTIONS.includes(s as (typeof VEHICLE_CHASSIS_OPTIONS)[number]) ? s : s;
}

export function normalizeVehicleDrive(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s.toLocaleLowerCase("tr-TR");
  if (t.includes("awd")) return "AWD";
  if (t.includes("4x4") || t.includes("4 wd") || t.includes("dort")) return "4x4";
  if (t.includes("arkadan")) return "4x2 (Arkadan Çekişli)";
  if (t.includes("onden") || t.includes("önden") || t.includes("4x2")) return "4x2 (Önden Çekişli)";
  return s;
}

export function normalizeVehicleBodyType(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = s.toLocaleLowerCase("tr-TR");
  for (const opt of VEHICLE_BODY_TYPE_OPTIONS) {
    if (t === opt.toLocaleLowerCase("tr-TR")) return opt;
  }
  if (t.includes("panel")) return "Panel Van";
  if (t.includes("hatch")) return "Hatchback";
  if (t.includes("station") || t.includes("sw")) return "Station Wagon";
  if (t.includes("pickup") || t.includes("pick-up")) return "Pickup";
  if (t.includes("suv")) return "SUV";
  if (t.includes("sedan")) return "Sedan";
  if (t.includes("coupe") || t.includes("coupe")) return "Coupe";
  if (t.includes("cabrio") || t.includes("convertible")) return "Cabrio";
  if (t.includes("mpv")) return "MPV";
  if (t.includes("minivan") || t.includes("mini van")) return "Minivan";
  return s;
}

/** Tablo metninden vasıta alanları */
export function extractVehicleTableFields(...chunks: unknown[]): {
  brand: string;
  series: string;
  model: string;
  year: string;
  fuel: string;
  gear: string;
  vehicleStatus: string;
  km: string;
  bodyType: string;
  chassis: string;
  enginePower: string;
  engineSize: string;
  drive: string;
  seats: string;
  color: string;
  licenseRecord: string;
  heavyDamage: string;
  sellerType: string;
  plateOrigin: string;
  swap: string;
} {
  const blob = chunks.map((x) => String(x ?? "")).join("\n");
  const pick = (patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = blob.match(re);
      if (m?.[1] != null && String(m[1]).trim() !== "") return String(m[1]).trim();
    }
    return "";
  };

  return {
    brand: pick([/marka\s*[:：]?\s*([^\n]+)/i]),
    series: pick([/seri\s*[:：]?\s*([^\n]+)/i]),
    model: pick([/model\s*[:：]?\s*([^\n]+)/i]),
    year: pick([/y[ıi]l\s*[:：]?\s*(\d{4})/i]),
    fuel: pick([/yak[ıi]t(?:\s*\/\s*motor\s*tipi)?\s*[:：]?\s*([^\n]+)/i]),
    gear: pick([/vites\s*[:：]?\s*([^\n]+)/i]),
    vehicleStatus: pick([/ara[cç]\s*durumu\s*[:：]?\s*([^\n]+)/i]),
    km: pick([/\bkm\b\s*[:：]?\s*([\d.\s]+)/i]),
    bodyType: pick([/kasa\s*tipi\s*[:：]?\s*([^\n]+)/i]),
    chassis: pick([/[şs]asi\s*[:：]?\s*([^\n]+)/i]),
    enginePower: pick([/motor\s*g[uü]c[uü]\s*[:：]?\s*([^\n]+)/i]),
    engineSize: pick([/motor\s*hacmi\s*[:：]?\s*([^\n]+)/i]),
    drive: pick([/[çc]eki[şs]\s*[:：]?\s*([^\n]+)/i]),
    seats: pick([/koltuk\s*say[ıi]s[ıi]\s*[:：]?\s*([^\n]+)/i]),
    color: pick([/renk\s*[:：]?\s*([^\n]+)/i]),
    licenseRecord: pick([/ruhsat\s*kayd[ıi]\s*[:：]?\s*([^\n]+)/i]),
    heavyDamage: pick([/a[gğ][ıi]r\s*hasar\s*kay[ıi]tl[ıi]\s*[:：]?\s*([^\n]+)/i]),
    sellerType: pick([/kimden\s*[:：]?\s*([^\n]+)/i]),
    plateOrigin: pick([/plaka\s*\/\s*uyruk\s*[:：]?\s*([^\n]+)/i, /plaka\s*[:：]?\s*([^\n]+)/i]),
    swap: pick([/takas\s*[:：]?\s*([^\n]+)/i]),
  };
}

export function vehicleEnumPromptForAi(): string {
  return `VASITA ALAN SÖZLÜĞÜ (yalnızca bu değerlerden; yoksa ""):
vehicleStatus: Sıfır | İkinci El
fuel: Benzin | Dizel | LPG | Hibrit | Elektrik
gear: Manuel | Otomatik | Yarı Otomatik
bodyType: Sedan | Hatchback | Station Wagon | SUV | Crossover | Coupe | Cabrio | MPV | Pickup | Panel Van | Minivan | Roadster
chassis: Kısa | Orta | Uzun
drive: 4x2 (Önden Çekişli) | 4x2 (Arkadan Çekişli) | 4x4 | AWD
sellerType: Sahibinden | Galeriden | Yetkili Bayiden
heavyDamage: Evet | Hayır
swap: Evet | Hayır
series, model, brand, year, km, enginePower, engineSize, seats, color, licenseRecord, plateOrigin: tablodaki gibi
tramer / boyaDurumu / degisenDurumu / hasarDurumu: tabloda yoksa ""`;
}
