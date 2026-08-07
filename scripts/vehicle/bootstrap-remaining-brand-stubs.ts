/**
 * Create REVIEW_REQUIRED research stubs for brands not yet having deep JSON files.
 * Does not invent verified rows.
 * npx tsx scripts/vehicle/bootstrap-remaining-brand-stubs.ts
 */
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "data/vehicle-deep-catalog");

const BRANDS: Array<{ brand: string; file: string; series: string[]; site: string; notes?: string }> = [
  { brand: "Volvo", file: "Volvo.json", series: ["XC40", "XC60", "XC90", "S60", "V60"], site: "https://www.volvocars.com/tr/" },
  { brand: "Nissan", file: "Nissan.json", series: ["Qashqai", "Juke", "X-Trail", "Micra"], site: "https://www.nissan.com.tr/" },
  { brand: "Kia", file: "Kia.json", series: ["Sportage", "Ceed", "Picanto", "Sorento", "EV6"], site: "https://www.kia.com/tr/" },
  { brand: "Dacia", file: "Dacia.json", series: ["Duster", "Sandero", "Jogger", "Logan"], site: "https://www.dacia.com.tr/" },
  { brand: "Alfa Romeo", file: "Alfa-Romeo.json", series: ["Giulia", "Stelvio", "Tonale"], site: "https://www.alfaromeo.com.tr/" },
  { brand: "Cupra", file: "Cupra.json", series: ["Formentor", "Leon", "Ateca", "Born"], site: "https://www.cupraofficial.com.tr/" },
  { brand: "Mini", file: "Mini.json", series: ["Cooper", "Countryman", "Clubman"], site: "https://www.mini.com.tr/" },
  { brand: "Porsche", file: "Porsche.json", series: ["911", "Cayenne", "Macan", "Panamera", "Taycan"], site: "https://www.porsche.com/turkey/" },
  { brand: "Lexus", file: "Lexus.json", series: ["NX", "RX", "UX", "ES"], site: "https://www.lexus.com.tr/" },
  { brand: "Jaguar", file: "Jaguar.json", series: ["F-Pace", "E-Pace", "XF", "I-Pace"], site: "https://www.jaguar.com.tr/" },
  { brand: "Land Rover", file: "Land-Rover.json", series: ["Range Rover", "Range Rover Sport", "Range Rover Evoque", "Discovery Sport", "Defender"], site: "https://www.landrover.com.tr/" },
  { brand: "Jeep", file: "Jeep.json", series: ["Renegade", "Compass", "Wrangler", "Avenger"], site: "https://www.jeep.com.tr/" },
  { brand: "Mitsubishi", file: "Mitsubishi.json", series: ["ASX", "Eclipse Cross", "L200"], site: "https://www.mitsubishi-motors.com.tr/" },
  { brand: "Subaru", file: "Subaru.json", series: ["XV", "Forester", "Outback", "Impreza"], site: "https://www.subaru.com.tr/" },
  { brand: "Suzuki", file: "Suzuki.json", series: ["Swift", "Vitara", "S-Cross", "Jimny"], site: "https://www.suzuki.com.tr/" },
  { brand: "Mazda", file: "Mazda.json", series: ["3", "CX-3", "CX-5", "CX-30"], site: "https://www.mazda.com.tr/" },
  {
    brand: "Tesla",
    file: "Tesla.json",
    series: ["Model 3", "Model Y", "Model S", "Model X"],
    site: "https://www.tesla.com/tr_tr",
    notes: "EV overlay — no duplicate EV series; TR official trim depth needs dedicated Tesla TR source pass.",
  },
  {
    brand: "TOGG",
    file: "TOGG.json",
    series: ["T10X", "T10F"],
    site: "https://www.togg.com.tr/",
    notes: "EV overlay preserve; official togg.com.tr trim/version naming required before VERIFIED.",
  },
  {
    brand: "BYD",
    file: "BYD.json",
    series: ["Atto 3", "Seal", "Dolphin", "Seal U"],
    site: "https://www.byd.com/tr",
    notes: "EV overlay preserve; BYD TR official lists needed for VERIFIED rows.",
  },
  {
    brand: "MG",
    file: "MG.json",
    series: ["ZS", "HS", "4", "5"],
    site: "https://www.mgmotor.com.tr/",
    notes: "EV/ICE mix; official MG TR lists needed.",
  },
];

let created = 0;
for (const b of BRANDS) {
  const path = join(DIR, b.file);
  if (existsSync(path)) {
    console.log("skip existing", b.file);
    continue;
  }
  const configurations = b.series.map((series) => ({
    brand: b.brand,
    series,
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    notes:
      b.notes ||
      `${series}: selectable tree stub — researched presence in TR market catalog; verifiable version/trim rows not yet captured (no invention).`,
    sources: [
      {
        url: b.site,
        title: `${b.brand} Türkiye resmi site`,
        date: "2026-08-07",
        role: "primary",
      },
    ],
  }));
  const doc = {
    brand: b.brand,
    brandSlug: b.file.replace(/\.json$/, "").toLowerCase(),
    version: "2026.08-deep-stub-v1",
    generatedAt: new Date().toISOString(),
    seriesCovered: b.series,
    status: "IN_PROGRESS",
    notes: "Bootstrap REVIEW_REQUIRED stubs only. Replace with sourced VERIFIED rows before completedBrands.",
    configurations,
  };
  writeFileSync(path, JSON.stringify(doc, null, 2));
  created++;
  console.log("created", b.file);
}
console.log(JSON.stringify({ created }, null, 2));
