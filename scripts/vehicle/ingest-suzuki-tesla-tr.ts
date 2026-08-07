/**
 * Enrich Suzuki + Tesla incomplete brands with sourced TR rows.
 * npx tsx scripts/vehicle/ingest-suzuki-tesla-tr.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "data/vehicle-deep-catalog");

function upsert(file: string, rows: any[]) {
  const path = join(DIR, file);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const map = new Map<string, any>();
  const key = (c: any) =>
    `${c.series}|${c.model}|${c.trim}|${c.generationCode || ""}|${c.yearFrom ?? ""}|${c.confidence}`;
  for (const c of raw.configurations || []) map.set(key(c), c);
  let added = 0;
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) {
      map.set(k, r);
      added++;
    }
  }
  raw.configurations = [...map.values()];
  raw.seriesCovered = [...new Set(raw.configurations.map((c: any) => c.series))].sort();
  raw.generatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(raw, null, 2));
  return { file, added, total: raw.configurations.length };
}

const suzukiSrc = [
  {
    url: "https://onedio.com/haber/suzuki-fiyat-listesi-agustos-2024-iste-suzuki-swift-vitara-s-cross-ve-jimny-guncel-fiyatlari-1238324",
    title: "Suzuki Ağustos 2024 fiyat listesi (Suzuki TR kaynaklı yayın)",
    date: "2024-08-01",
    role: "primary",
  },
  {
    url: "https://www.suzuki.com.tr/tr/otomobil/fiyat-listesi.html",
    title: "Suzuki Türkiye resmi fiyat listesi",
    date: "2026-08-07",
    role: "secondary",
  },
];

const teslaSrc = [
  {
    url: "https://www.cnbce.com/otomotiv/tesladan-agustos-zammi-model-ynin-uc-versiyonunun-fiyati-artti-iste-yeni-fiyatlar-h34369",
    title: "Tesla Model Y Ağustos 2026 TR fiyat listesi",
    date: "2026-08-04",
    role: "primary",
  },
  {
    url: "https://www.tesla.com/tr_tr/modely",
    title: "Tesla Model Y Türkiye resmi sayfa",
    date: "2026-08-07",
    role: "secondary",
  },
];

const suzukiRows = [
  {
    brand: "Suzuki",
    series: "Swift",
    model: "1.2 MHEV CVT",
    trim: "GL Techno",
    generation: "Swift Hybrid MY2024",
    generationCode: "",
    yearFrom: 2024,
    yearTo: 2024,
    fuelType: "MILD_HYBRID",
    engineVolume: "1197",
    powerHp: "83",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Suzuki TR Ağustos 2024: 1.2 MHEV CVT GL Techno",
    sources: suzukiSrc,
  },
  {
    brand: "Suzuki",
    series: "Swift",
    model: "1.2 MHEV CVT",
    trim: "GLX Premium",
    generation: "Swift Hybrid MY2024",
    generationCode: "",
    yearFrom: 2024,
    yearTo: 2024,
    fuelType: "MILD_HYBRID",
    engineVolume: "1197",
    powerHp: "83",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Suzuki TR Ağustos 2024: 1.2 MHEV CVT GLX Premium",
    sources: suzukiSrc,
  },
  {
    brand: "Suzuki",
    series: "Vitara",
    model: "1.4 MHEV 6AT",
    trim: "GLX Premium",
    generation: "Vitara Hybrid MY2024",
    generationCode: "",
    yearFrom: 2024,
    yearTo: 2024,
    fuelType: "MILD_HYBRID",
    powerHp: "129",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Suzuki TR Ağustos 2024 Vitara 1.4 MHEV 6AT GLX Premium",
    sources: suzukiSrc,
  },
  {
    brand: "Suzuki",
    series: "Vitara",
    model: "1.4 MHEV 6AT AllGrip",
    trim: "GL Elegance",
    generation: "Vitara Hybrid MY2024",
    generationCode: "",
    yearFrom: 2024,
    yearTo: 2024,
    fuelType: "MILD_HYBRID",
    powerHp: "129",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Suzuki TR Ağustos 2024 Vitara AllGrip GL Elegance",
    sources: suzukiSrc,
  },
  {
    brand: "Suzuki",
    series: "Jimny",
    model: "1.5 Allgrip 4AT",
    trim: "GLX",
    generation: "Jimny MY2024",
    generationCode: "",
    yearFrom: 2024,
    yearTo: 2024,
    fuelType: "GASOLINE",
    powerHp: "102",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Suzuki TR Ağustos 2024 Jimny 1.5 Allgrip 4AT GLX",
    sources: suzukiSrc,
  },
];

const teslaRows = [
  {
    brand: "Tesla",
    series: "Model Y",
    model: "Arkadan Çekiş",
    trim: "Standart",
    generation: "Juniper/Highland TR MY2026",
    generationCode: "",
    yearFrom: 2025,
    yearTo: 2026,
    fuelType: "ELECTRIC",
    transmission: "AUTOMATIC",
    driveType: "RWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Tesla TR Ağustos 2026: Model Y Arkadan Çekiş — EV overlay preserve Model Y series",
    sources: teslaSrc,
  },
  {
    brand: "Tesla",
    series: "Model Y",
    model: "Long Range Arkadan Çekiş",
    trim: "Premium",
    generation: "Juniper/Highland TR MY2026",
    generationCode: "",
    yearFrom: 2025,
    yearTo: 2026,
    fuelType: "ELECTRIC",
    transmission: "AUTOMATIC",
    driveType: "RWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Tesla TR: Premium Long Range Arkadan Çekiş",
    sources: teslaSrc,
  },
  {
    brand: "Tesla",
    series: "Model Y",
    model: "Long Range AWD",
    trim: "Premium",
    generation: "Juniper/Highland TR MY2026",
    generationCode: "",
    yearFrom: 2025,
    yearTo: 2026,
    fuelType: "ELECTRIC",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Tesla TR: Premium Long Range 4 Çeker",
    sources: teslaSrc,
  },
  {
    brand: "Tesla",
    series: "Model Y",
    model: "Performance AWD",
    trim: "Performance",
    generation: "Juniper/Highland TR MY2026",
    generationCode: "",
    yearFrom: 2025,
    yearTo: 2026,
    fuelType: "ELECTRIC",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Tesla TR: Performance 4 Çeker — Performance is model variant; trim mirrors official line name",
    sources: teslaSrc,
  },
];

console.log(JSON.stringify([upsert("Suzuki.json", suzukiRows), upsert("Tesla.json", teslaRows)], null, 2));
