/**
 * Append current-MY BMW TR dealer price-list configurations (Teknik Oto 2026-08-07)
 * into data/vehicle-deep-catalog/BMW.json without inventing historical packages.
 *
 * npx tsx scripts/vehicle/ingest-bmw-teknikoto-current.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const BMW_JSON = join(ROOT, "data/vehicle-deep-catalog/BMW.json");

/** Sourced from https://teknikoto.bmw.com.tr/fiyat-listesi (fetched 2026-08-07) */
const CURRENT: Array<{
  category: string;
  series: string;
  model: string;
  trim: string;
  fuelType: string;
  engineVolume?: string;
  powerHp?: string;
  driveType?: string;
  notes?: string;
}> = [
  { category: "Otomobil", series: "1 Serisi", model: "120", trim: "Sport Line", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20" },
  { category: "Otomobil", series: "1 Serisi", model: "120", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20" },
  { category: "Otomobil", series: "2 Serisi", model: "220 Gran Coupe", trim: "Sport Line", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20" },
  { category: "Otomobil", series: "2 Serisi", model: "220 Gran Coupe", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20" },
  { category: "Otomobil", series: "2 Serisi Active Tourer", model: "220i Active Tourer", trim: "Luxury Line", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20" },
  { category: "Otomobil", series: "2 Serisi Active Tourer", model: "220i Active Tourer", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20" },
  { category: "Otomobil", series: "2 Serisi Active Tourer", model: "230e xDrive Active Tourer", trim: "Luxury Line", fuelType: "PLUGIN_HYBRID", engineVolume: "1499", powerHp: "150+177", driveType: "AWD" },
  { category: "Otomobil", series: "2 Serisi Active Tourer", model: "230e xDrive Active Tourer", trim: "M Sport", fuelType: "PLUGIN_HYBRID", engineVolume: "1499", powerHp: "150+177", driveType: "AWD" },
  { category: "Otomobil", series: "3 Serisi", model: "320i", trim: "Sport Line", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "170" },
  { category: "Otomobil", series: "3 Serisi", model: "320i", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "170" },
  { category: "Otomobil", series: "4 Serisi", model: "420i Coupé", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "170" },
  { category: "Otomobil", series: "4 Serisi", model: "420i Coupé", trim: "Edition M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "170" },
  { category: "Otomobil", series: "4 Serisi", model: "430i xDrive Cabrio", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1998", powerHp: "245", driveType: "AWD" },
  { category: "Otomobil", series: "4 Serisi", model: "420i Gran Coupé", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "170" },
  { category: "Otomobil", series: "4 Serisi", model: "420i Gran Coupé", trim: "Edition M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "170" },
  { category: "Otomobil", series: "5 Serisi", model: "520i", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "190+11" },
  { category: "Otomobil", series: "5 Serisi", model: "520i", trim: "Edition M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "190+11" },
  { category: "Otomobil", series: "5 Serisi", model: "520d xDrive", trim: "M Sport", fuelType: "DIESEL", engineVolume: "1995", powerHp: "197+11", driveType: "AWD" },
  { category: "Otomobil", series: "5 Serisi", model: "520d xDrive", trim: "Edition M Sport", fuelType: "DIESEL", engineVolume: "1995", powerHp: "197+11", driveType: "AWD" },
  { category: "Otomobil", series: "7 Serisi", model: "740d xDrive", trim: "Pure Excellence", fuelType: "DIESEL", engineVolume: "2993", powerHp: "286+18", driveType: "AWD" },
  { category: "Otomobil", series: "7 Serisi", model: "740d xDrive", trim: "M Excellence", fuelType: "DIESEL", engineVolume: "2993", powerHp: "286+18", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X1", model: "X1 xDrive25e", trim: "X-Line", fuelType: "PLUGIN_HYBRID", engineVolume: "1499", powerHp: "136+109", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X1", model: "X1 xDrive25e", trim: "M Sport", fuelType: "PLUGIN_HYBRID", engineVolume: "1499", powerHp: "136+109", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X1", model: "X1 xDrive20i", trim: "X-Line", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X1", model: "X1 xDrive20i", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X2", model: "X2 sDrive20i", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1499", powerHp: "156+20", driveType: "RWD" },
  { category: "Arazi, SUV & Pickup", series: "X3", model: "X3 20", trim: "X-Line", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "190+11" },
  { category: "Arazi, SUV & Pickup", series: "X3", model: "X3 20", trim: "M Sport", fuelType: "GASOLINE", engineVolume: "1597", powerHp: "190+11" },
  { category: "Arazi, SUV & Pickup", series: "X5", model: "X5 xDrive40d", trim: "M Sport", fuelType: "DIESEL", engineVolume: "2993", powerHp: "340+12", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X6", model: "X6 xDrive40d", trim: "M Sport", fuelType: "DIESEL", engineVolume: "2993", powerHp: "340+12", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "X7", model: "X7 xDrive40d", trim: "M Excellence", fuelType: "DIESEL", engineVolume: "2993", powerHp: "340+12", driveType: "AWD" },
  { category: "Otomobil", series: "i4", model: "i4 eDrive40", trim: "Sport Line", fuelType: "ELECTRIC", powerHp: "218" },
  { category: "Otomobil", series: "i4", model: "i4 eDrive40", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "218" },
  { category: "Otomobil", series: "i4", model: "i4 eDrive40", trim: "Edition M Sport", fuelType: "ELECTRIC", powerHp: "218" },
  { category: "Otomobil", series: "i5", model: "i5 eDrive40", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "218" },
  { category: "Otomobil", series: "i5", model: "i5 eDrive40", trim: "Edition M Sport", fuelType: "ELECTRIC", powerHp: "218" },
  { category: "Otomobil", series: "i5", model: "i5 xDrive40 Touring", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "394", driveType: "AWD" },
  { category: "Otomobil", series: "i5", model: "i5 xDrive40 Touring", trim: "Edition M Sport", fuelType: "ELECTRIC", powerHp: "394", driveType: "AWD" },
  { category: "Otomobil", series: "i7", model: "i7 xDrive60", trim: "Pure Excellence", fuelType: "ELECTRIC", powerHp: "544", driveType: "AWD" },
  { category: "Otomobil", series: "i7", model: "i7 xDrive60", trim: "M Excellence", fuelType: "ELECTRIC", powerHp: "544", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "iX1", model: "iX1 Drive20", trim: "Sport Line", fuelType: "ELECTRIC", powerHp: "204" },
  { category: "Arazi, SUV & Pickup", series: "iX1", model: "iX1 Drive20", trim: "X-Line", fuelType: "ELECTRIC", powerHp: "204" },
  { category: "Arazi, SUV & Pickup", series: "iX1", model: "iX1 Drive20", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "204" },
  { category: "Arazi, SUV & Pickup", series: "iX2", model: "iX2 eDrive20", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "204" },
  { category: "Arazi, SUV & Pickup", series: "iX3", model: "iX3 50 xDrive", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "218", driveType: "AWD" },
  { category: "Arazi, SUV & Pickup", series: "iX", model: "iX xDrive60", trim: "M Sport", fuelType: "ELECTRIC", powerHp: "544", driveType: "AWD" },
];

function main() {
  const raw = JSON.parse(readFileSync(BMW_JSON, "utf8"));
  const existing = raw.configurations || [];
  const key = (c: { series: string; model: string; trim: string; generationCode?: string | null; yearFrom?: number | null }) =>
    `${c.series}|${c.model}|${c.trim}|${c.generationCode || ""}|${c.yearFrom ?? ""}`;

  const map = new Map<string, unknown>();
  for (const c of existing) map.set(key(c), c);

  const source = {
    url: "https://teknikoto.bmw.com.tr/fiyat-listesi",
    title: "Teknik Oto BMW yetkili satici perakende azami fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
  };
  const secondary = {
    url: "https://ozgorkey.bmw.com.tr/fiyat-listesi-2024",
    title: "Ozgorkey BMW yetkili satici fiyat listesi",
    date: "2026-08-07",
    role: "secondary" as const,
  };

  let added = 0;
  for (const row of CURRENT) {
    const conf = {
      brand: "BMW",
      series: row.series,
      model: row.model,
      trim: row.trim,
      generation: "Current TR MY",
      generationCode: "",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: row.fuelType,
      engineVolume: row.engineVolume || null,
      powerHp: row.powerHp || null,
      transmission: "AUTOMATIC",
      driveType: row.driveType || null,
      confidence: "VERIFIED_OFFICIAL",
      verifiedForTurkey: true,
      category: row.category,
      notes: row.notes || "Current TR official dealer price-list row (Model + Tasarim Paketi)",
      sources: [source, secondary],
    };
    const k = key(conf);
    if (!map.has(k)) {
      map.set(k, conf);
      added++;
    }
  }

  const series = [...new Set([...map.values()].map((c: any) => c.series))];
  const next = {
    ...raw,
    version: "2026.08-deep-bmw-v2-current-plus-5series-history",
    generatedAt: new Date().toISOString(),
    seriesCovered: series.sort(),
    status: "IN_PROGRESS",
    configurations: [...map.values()],
  };
  writeFileSync(BMW_JSON, JSON.stringify(next, null, 2));
  console.log(JSON.stringify({ ok: true, added, total: next.configurations.length, series: series.length }, null, 2));
}

main();
