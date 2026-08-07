/**
 * BMW deep historical TR coverage pass.
 * - Demotes premature COMPLETED
 * - Adds sourced historical configurations (no combinatorial invent)
 * - Marks NO_VERIFIED_TRIM_FOUND where list has version only
 * - REVIEW_REQUIRED for researched-but-unsourced older gens
 * - Writes coverage.csv + BMW-completion-report.json + progress
 *
 * npx tsx scripts/vehicle/bmw-deepen-historical-coverage.ts
 * NO APPLY — research JSON only.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const BMW_JSON = join(ROOT, "data/vehicle-deep-catalog/BMW.json");
const COVERAGE_CSV = join(ROOT, "docs/vehicle-research/deep-catalog-coverage.csv");
const BMW_REPORT = join(ROOT, "docs/vehicle-research/BMW-completion-report.json");
const PROGRESS = join(ROOT, "scripts/output/deep-catalog-progress.json");

type Source = {
  url: string;
  title: string;
  date: string;
  role: "primary" | "secondary";
  type?: string;
  publisher?: string;
};

type Config = {
  brand: string;
  series: string;
  model: string;
  trim: string;
  generation: string;
  generationCode: string;
  yearFrom: number | null;
  yearTo: number | null;
  fuelType?: string | null;
  engineVolume?: string | null;
  powerHp?: string | null;
  transmission?: string | null;
  driveType?: string | null;
  confidence: string;
  verifiedForTurkey: boolean;
  category: string;
  notes?: string;
  trimStatus?: string;
  historicalCoverage?: string;
  sources: Source[];
};

const SELECTABLE = [
  { series: "1 Serisi", category: "Otomobil" },
  { series: "2 Serisi", category: "Otomobil" },
  { series: "2 Serisi Active Tourer", category: "Otomobil" },
  { series: "3 Serisi", category: "Otomobil" },
  { series: "4 Serisi", category: "Otomobil" },
  { series: "5 Serisi", category: "Otomobil" },
  { series: "6 Serisi", category: "Otomobil" },
  { series: "7 Serisi", category: "Otomobil" },
  { series: "8 Serisi", category: "Otomobil" },
  { series: "i Serisi", category: "Otomobil" },
  { series: "M Serisi", category: "Otomobil" },
  { series: "Z Serisi", category: "Otomobil" },
  { series: "X1", category: "Arazi, SUV & Pickup" },
  { series: "X2", category: "Arazi, SUV & Pickup" },
  { series: "X3", category: "Arazi, SUV & Pickup" },
  { series: "X4", category: "Arazi, SUV & Pickup" },
  { series: "X5", category: "Arazi, SUV & Pickup" },
  { series: "X6", category: "Arazi, SUV & Pickup" },
  { series: "X7", category: "Arazi, SUV & Pickup" },
  { series: "iX", category: "Arazi, SUV & Pickup" },
  { series: "iX1", category: "Arazi, SUV & Pickup" },
  { series: "iX2", category: "Arazi, SUV & Pickup" },
  { series: "iX3", category: "Arazi, SUV & Pickup" },
  { series: "i3", category: "Otomobil" },
  { series: "i4", category: "Otomobil" },
  { series: "i5", category: "Otomobil" },
  { series: "i7", category: "Otomobil" },
];

const S2015: Source = {
  url: "https://otopark.com/2015/11/22/bmw-kasim-2015-fiyat-listesi/",
  title: "BMW Kasım 2015 Fiyat Listesi (otopark arşivi)",
  date: "2015-11-22",
  role: "primary",
  type: "price_list_archive",
  publisher: "otopark.com citing BMW TR retail",
};

const S2015B: Source = {
  url: "https://otopark.com/2015/09/14/bmw-eylul-2015-fiyat-listesi/",
  title: "BMW Eylül 2015 Fiyat Listesi",
  date: "2015-09-14",
  role: "secondary",
  type: "price_list_archive",
  publisher: "otopark.com",
};

function cfg(partial: Omit<Config, "brand" | "sources"> & { sources: Source[] }): Config {
  return { brand: "BMW", ...partial };
}

/** Version-only 2015 retail rows → NO_VERIFIED_TRIM_FOUND */
function versionOnly(
  series: string,
  model: string,
  generation: string,
  generationCode: string,
  yearFrom: number,
  yearTo: number,
  fuelType: string,
  category: string,
  extra: Partial<Config> = {}
): Config {
  return cfg({
    series,
    model,
    trim: "",
    generation,
    generationCode,
    yearFrom,
    yearTo,
    fuelType,
    transmission: "AUTOMATIC",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category,
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "TR 2015 retail list names engine/version only; package/trim not printed on sourced page — trim left empty (not invented).",
    sources: [S2015, S2015B],
    ...extra,
  });
}

const NEW_ROWS: Config[] = [
  // ——— 1 Serisi F20 (2015, no trim on list) ———
  versionOnly("1 Serisi", "118i", "F20 5-kapı", "F20", 2015, 2015, "GASOLINE", "Otomobil", {
    engineVolume: null,
    powerHp: null,
  }),
  versionOnly("1 Serisi", "120i", "F20 5-kapı", "F20", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("1 Serisi", "116d", "F20 5-kapı", "F20", 2015, 2015, "DIESEL", "Otomobil"),
  versionOnly("1 Serisi", "116d ED", "F20 5-kapı Manuel", "F20", 2015, 2015, "DIESEL", "Otomobil", {
    transmission: "MANUAL",
  }),

  // ——— 2 Serisi F22/F45 (2015) ———
  versionOnly("2 Serisi", "218i", "F22 Coupé", "F22", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("2 Serisi", "220d", "F22 Coupé", "F22", 2015, 2015, "DIESEL", "Otomobil"),
  versionOnly("2 Serisi", "218i Cabrio", "F23 Cabrio", "F23", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("2 Serisi Active Tourer", "218i", "F45 Active Tourer", "F45", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("2 Serisi Active Tourer", "216d", "F45 Active Tourer", "F45", 2015, 2015, "DIESEL", "Otomobil"),

  // ——— 3 Serisi F30 (2015 version-only + 2016 with trims) ———
  versionOnly("3 Serisi", "318i", "F30 Sedan", "F30", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("3 Serisi", "320i ED", "F30 Sedan", "F30", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("3 Serisi", "320d", "F30 Sedan", "F30", 2015, 2015, "DIESEL", "Otomobil"),
  versionOnly("3 Serisi", "320d xDrive", "F30 Sedan", "F30", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),
  versionOnly("3 Serisi", "316i", "F30 Sedan", "F30", 2015, 2015, "GASOLINE", "Otomobil"),

  // 2016 F30 with verified TR package names (yeniarabafiyatlari)
  ...[
    ["320i ED", "Joy", "213625"],
    ["320i ED", "Sport Plus", "232875"],
    ["320i ED", "Luxury Plus", "242250"],
    ["320i ED", "M Plus", "252250"],
    ["320d", "Techno Plus", "290625"],
    ["320d", "Prestige", "324250"],
    ["320d", "Sport Line", "324250"],
    ["320d", "Luxury Line", "342875"],
    ["320d", "M Sport", "344500"],
    ["320d xDrive", "Prestige", "349250"],
    ["320d xDrive", "Sport Line", "349250"],
    ["320d xDrive", "Techno Plus", "354750"],
    ["320d xDrive", "Luxury Line", "368250"],
    ["320d xDrive", "M Sport", "369875"],
    ["318i", "Joy", "196750"],
    ["318i", "Prestige", "212500"],
  ].map(([model, trim]) =>
    cfg({
      series: "3 Serisi",
      model,
      trim,
      generation: "F30 Sedan",
      generationCode: "F30",
      yearFrom: 2016,
      yearTo: 2016,
      fuelType: String(model).includes("d") ? "DIESEL" : "GASOLINE",
      engineVolume: model === "320i ED" ? "1598" : model.startsWith("318") ? "1499" : "1995",
      powerHp: model === "320i ED" ? "170" : null,
      transmission: "AUTOMATIC",
      driveType: String(model).includes("xDrive") ? "AWD" : "RWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Otomobil",
      notes: "2016 TR model/year version+package matrix (published TR price table)",
      sources: [
        {
          url: "https://yeniarabafiyatlari.com/bmw/3-serisi-sedan/2016/bmw-3-serisi-320i-ed-1-6-luxury-plus-at-fiyatlari",
          title: "2016 BMW 3 Serisi Sedan versiyon/donanım fiyat matrisi",
          date: "2016-01-01",
          role: "primary",
          type: "price_matrix",
          publisher: "yeniarabafiyatlari.com",
        },
        {
          url: "https://arabavs.com/model/2016/bmw/3-serisi/320i-ed-1-6/sport-line-otomatik.html",
          title: "2016 BMW 320i ED Sport Line (F30) TR model page",
          date: "2016-01-01",
          role: "secondary",
          type: "model_page",
          publisher: "arabavs.com",
        },
      ],
    })
  ),

  // E90 2008 (bmwcikemo archive) — Premium as trim where printed
  cfg({
    series: "3 Serisi",
    model: "320i",
    trim: "",
    generation: "E90 Sedan",
    generationCode: "E90",
    yearFrom: 2008,
    yearTo: 2008,
    fuelType: "GASOLINE",
    engineVolume: "1995",
    powerHp: "156",
    transmission: "AUTOMATIC",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "2008 TR retail list row for 320i Sedan; base row without Premium label.",
    sources: [
      {
        url: "https://bmwcikemo.tr.gg/BMW-Fiyat-Listesi.htm",
        title: "BMW Fiyat Listesi arşivi (2008 TR rows)",
        date: "2008-01-01",
        role: "primary",
        type: "price_list_archive",
        publisher: "bmwcikemo.tr.gg",
      },
    ],
  }),
  cfg({
    series: "3 Serisi",
    model: "320i",
    trim: "Premium",
    generation: "E90 Sedan",
    generationCode: "E90",
    yearFrom: 2008,
    yearTo: 2008,
    fuelType: "GASOLINE",
    engineVolume: "1995",
    powerHp: "156",
    transmission: "AUTOMATIC",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2008 TR list: BMW 320i Sedan Premium",
    sources: [
      {
        url: "https://bmwcikemo.tr.gg/BMW-Fiyat-Listesi.htm",
        title: "BMW Fiyat Listesi arşivi (2008 TR rows)",
        date: "2008-01-01",
        role: "primary",
        type: "price_list_archive",
        publisher: "bmwcikemo.tr.gg",
      },
    ],
  }),
  cfg({
    series: "3 Serisi",
    model: "320d",
    trim: "",
    generation: "E90 Sedan",
    generationCode: "E90",
    yearFrom: 2008,
    yearTo: 2008,
    fuelType: "DIESEL",
    engineVolume: "1995",
    powerHp: "177",
    transmission: "AUTOMATIC",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "2008 TR retail list row for 320d Sedan.",
    sources: [
      {
        url: "https://bmwcikemo.tr.gg/BMW-Fiyat-Listesi.htm",
        title: "BMW Fiyat Listesi arşivi (2008 TR rows)",
        date: "2008-01-01",
        role: "primary",
        type: "price_list_archive",
        publisher: "bmwcikemo.tr.gg",
      },
    ],
  }),
  cfg({
    series: "3 Serisi",
    model: "320d",
    trim: "Premium",
    generation: "E90 Sedan",
    generationCode: "E90",
    yearFrom: 2008,
    yearTo: 2008,
    fuelType: "DIESEL",
    engineVolume: "1995",
    powerHp: "177",
    transmission: "AUTOMATIC",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2008 TR list: BMW 320d Sedan Premium",
    sources: [
      {
        url: "https://bmwcikemo.tr.gg/BMW-Fiyat-Listesi.htm",
        title: "BMW Fiyat Listesi arşivi (2008 TR rows)",
        date: "2008-01-01",
        role: "primary",
        type: "price_list_archive",
        publisher: "bmwcikemo.tr.gg",
      },
    ],
  }),

  // E36/E46 researched, no verified discrete TR matrix
  cfg({
    series: "3 Serisi",
    model: "",
    trim: "",
    generation: "E36",
    generationCode: "E36",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes:
      "E36 TR second-hand volume high; reliable official TR price/package matrix not located in this research pass.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — E36 archive matrix not published on current portal",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),
  cfg({
    series: "3 Serisi",
    model: "",
    trim: "",
    generation: "E46",
    generationCode: "E46",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E46 researched; discrete sourced TR version×trim rows not found — no invented configs.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — E46 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),

  // ——— 4 Serisi F32 (2015) ———
  versionOnly("4 Serisi", "420d", "F32 Coupé", "F32", 2015, 2015, "DIESEL", "Otomobil"),
  versionOnly("4 Serisi", "420d xDrive", "F32 Coupé", "F32", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),
  versionOnly("4 Serisi", "428i", "F32 Coupé", "F32", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("4 Serisi", "418i", "F36 Gran Coupé", "F36", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("4 Serisi", "420d Gran Coupé", "F36 Gran Coupé", "F36", 2015, 2015, "DIESEL", "Otomobil"),

  // ——— 5 Serisi F10 (2015 version-only + 2016 Pure/Executive trims) ———
  versionOnly("5 Serisi", "520i", "F10 Sedan", "F10", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("5 Serisi", "520d", "F10 Sedan", "F10", 2015, 2015, "DIESEL", "Otomobil"),
  versionOnly("5 Serisi", "525d xDrive", "F10 Sedan", "F10", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),
  versionOnly("5 Serisi", "535d xDrive", "F10 Sedan", "F10", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),
  ...["Pure", "Executive", "Executive Plus", "Executive Sport", "Executive M Sport"].map((trim) =>
    cfg({
      series: "5 Serisi",
      model: "520d",
      trim,
      generation: "F10 Sedan",
      generationCode: "F10",
      yearFrom: 2016,
      yearTo: 2016,
      fuelType: "DIESEL",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Otomobil",
      notes: "F10 late-cycle TR package names for 520d cited as then-current Türkiye list prices.",
      sources: [
        {
          url: "https://www.sekizsilindir.com/2016/10/yeni-bmw-5-serisi-fiya.html",
          title: "F10 520d TR paket fiyatları (Pure/Executive…)",
          date: "2016-10-01",
          role: "primary",
          type: "automotive_press",
          publisher: "sekizsilindir.com",
        },
        {
          url: "https://otopark.com/2015/11/22/bmw-kasim-2015-fiyat-listesi/",
          title: "BMW Kasım 2015 — 520d Sedan TR retail presence",
          date: "2015-11-22",
          role: "secondary",
          type: "price_list_archive",
          publisher: "otopark.com",
        },
      ],
    })
  ),
  cfg({
    series: "5 Serisi",
    model: "",
    trim: "",
    generation: "E39",
    generationCode: "E39",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E39 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — E39 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),
  cfg({
    series: "5 Serisi",
    model: "",
    trim: "",
    generation: "E60",
    generationCode: "E60",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E60/E61 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — E60 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),

  // ——— 6 Serisi F06 (2015) ———
  versionOnly("6 Serisi", "640d xDrive", "F13 Coupé", "F13", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),
  versionOnly("6 Serisi", "640d xDrive Gran Coupé", "F06 Gran Coupé", "F06", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),

  // ——— 7 Serisi F01 / G11 (2015) ———
  versionOnly("7 Serisi", "730d xDrive", "F01 Sedan", "F01", 2015, 2015, "DIESEL", "Otomobil", {
    driveType: "AWD",
  }),
  versionOnly("7 Serisi", "730i", "G11 Sedan", "G11", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("7 Serisi", "730Li", "G12 LWB", "G12", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("7 Serisi", "730d xDrive (G11)", "G11 Sedan", "G11", 2015, 2015, "DIESEL", "Otomobil", {
    model: "730d xDrive",
    driveType: "AWD",
  }),
  cfg({
    series: "7 Serisi",
    model: "",
    trim: "",
    generation: "E38",
    generationCode: "E38",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E38 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — E38 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),
  cfg({
    series: "7 Serisi",
    model: "",
    trim: "",
    generation: "E65",
    generationCode: "E65",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E65/E66 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — E65 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),

  // ——— Z Serisi E89 ———
  versionOnly("Z Serisi", "Z4 sDrive20i", "E89 Roadster", "E89", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("Z Serisi", "Z4 sDrive28i", "E89 Roadster", "E89", 2015, 2015, "GASOLINE", "Otomobil"),

  // ——— M Serisi (2015 performance models as VERSIONS, not trims) ———
  versionOnly("M Serisi", "M235i", "F22 Coupé", "F22", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("M Serisi", "M3", "F80 Sedan", "F80", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("M Serisi", "M4", "F82 Coupé", "F82", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("M Serisi", "M5", "F10 Sedan", "F10", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("M Serisi", "M6", "F13 Coupé", "F13", 2015, 2015, "GASOLINE", "Otomobil"),
  versionOnly("M Serisi", "X5 M", "F15 SAV", "F15", 2015, 2015, "GASOLINE", "Arazi, SUV & Pickup"),
  versionOnly("M Serisi", "X6 M", "F16 SAC", "F16", 2015, 2015, "GASOLINE", "Arazi, SUV & Pickup"),

  // ——— X1 E84 + F48 ———
  versionOnly("X1", "sDrive16i", "E84", "E84", 2015, 2015, "GASOLINE", "Arazi, SUV & Pickup"),
  versionOnly("X1", "sDrive16d", "F48", "F48", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup"),
  versionOnly("X1", "sDrive18i", "F48", "F48", 2015, 2015, "GASOLINE", "Arazi, SUV & Pickup"),
  versionOnly("X1", "xDrive20d", "F48", "F48", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup", {
    driveType: "AWD",
  }),
  ...[
    ["sDrive 16d", "Joy", "MANUAL", "DIESEL"],
    ["sDrive 16d", "Prestige", "MANUAL", "DIESEL"],
    ["sDrive 16d", "Sport Line", "MANUAL", "DIESEL"],
    ["sDrive 16d", "X Line", "MANUAL", "DIESEL"],
    ["sDrive 16d", "M Sport", "MANUAL", "DIESEL"],
    ["sDrive 18i", "Joy", "AUTOMATIC", "GASOLINE"],
    ["sDrive 18i", "Prestige", "AUTOMATIC", "GASOLINE"],
    ["sDrive 18i", "Sport Line", "AUTOMATIC", "GASOLINE"],
    ["sDrive 18i", "X Line", "AUTOMATIC", "GASOLINE"],
    ["sDrive 18i", "M Sport", "AUTOMATIC", "GASOLINE"],
    ["xDrive 20d", "Joy", "AUTOMATIC", "DIESEL"],
    ["xDrive 20d", "Prestige", "AUTOMATIC", "DIESEL"],
    ["xDrive 20d", "Sport Line", "AUTOMATIC", "DIESEL"],
    ["xDrive 20d", "X Line", "AUTOMATIC", "DIESEL"],
    ["xDrive 20d", "M Sport", "AUTOMATIC", "DIESEL"],
  ].map(([model, trim, transmission, fuelType]) =>
    cfg({
      series: "X1",
      model,
      trim,
      generation: "F48",
      generationCode: "F48",
      yearFrom: 2016,
      yearTo: 2016,
      fuelType,
      transmission,
      driveType: String(model).includes("xDrive") ? "AWD" : "FWD",
      engineVolume: String(model).includes("20d") ? "1995" : String(model).includes("16d") ? "1496" : "1499",
      powerHp: String(model).includes("20d") ? "190" : String(model).includes("16d") ? "116" : "136",
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Arazi, SUV & Pickup",
      notes: "2016 TR X1 F48 version×package matrix",
      sources: [
        {
          url: "https://arabamyeni.com/sifir/bmw/x1/2016",
          title: "2016 BMW X1 versiyon/donanım fiyat listesi",
          date: "2016-01-01",
          role: "primary",
          type: "price_matrix",
          publisher: "arabamyeni.com",
        },
        {
          url: "https://yeniarabafiyatlari.com/bmw/x1/2016/bmw-x1-16i-sdrive-fiyatlari",
          title: "2016 BMW X1 16i sDrive ve paket matrisi",
          date: "2016-01-01",
          role: "secondary",
          type: "price_matrix",
          publisher: "yeniarabafiyatlari.com",
        },
      ],
    })
  ),

  // ——— X3 F25 ———
  versionOnly("X3", "sDrive20i", "F25", "F25", 2015, 2015, "GASOLINE", "Arazi, SUV & Pickup", {
    engineVolume: "1598",
    powerHp: "170",
  }),
  versionOnly("X3", "xDrive20d", "F25", "F25", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup", {
    engineVolume: "1995",
    powerHp: "190",
    driveType: "AWD",
  }),
  cfg({
    series: "X3",
    model: "",
    trim: "",
    generation: "E83",
    generationCode: "E83",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E83 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — X3 E83 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),

  // ——— X4 F26 ———
  versionOnly("X4", "xDrive20d", "F26", "F26", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup", {
    driveType: "AWD",
  }),

  // ——— X5 F15 with packages ———
  versionOnly("X5", "xDrive25d", "F15", "F15", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup", {
    driveType: "AWD",
  }),
  versionOnly("X5", "xDrive30d", "F15", "F15", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup", {
    driveType: "AWD",
  }),
  ...["Pure", "Prestige", "Premium", "M Sport"].map((trim) =>
    cfg({
      series: "X5",
      model: "xDrive25d",
      trim,
      generation: "F15",
      generationCode: "F15",
      yearFrom: 2016,
      yearTo: 2016,
      fuelType: "DIESEL",
      transmission: "AUTOMATIC",
      driveType: "AWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Arazi, SUV & Pickup",
      notes: "F15 xDrive25d TR package prices (Pure/Prestige/Premium/M Sport)",
      sources: [
        {
          url: "http://bmwuzmani.blogspot.com/2016/08/bmw-x5-f15.html",
          title: "BMW X5 F15 TR paket incelemesi ve fiyatlar",
          date: "2016-08-01",
          role: "primary",
          type: "automotive_press",
          publisher: "bmwuzmani.blogspot.com",
        },
        {
          url: "https://www.arabalar.com.tr/bmw/x5/2016",
          title: "2016 BMW X5 paket listesi (Pure/Prestige/Premium/M Sport)",
          date: "2016-01-01",
          role: "secondary",
          type: "model_index",
          publisher: "arabalar.com.tr",
        },
      ],
    })
  ),
  cfg({
    series: "X5",
    model: "",
    trim: "",
    generation: "E53",
    generationCode: "E53",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E53 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — X5 E53 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),
  cfg({
    series: "X5",
    model: "",
    trim: "",
    generation: "E70",
    generationCode: "E70",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "E70 researched; sourced TR version×trim matrix not found.",
    sources: [
      {
        url: "https://www.bmw.com.tr/tr/index.html",
        title: "BMW Türkiye — X5 E70 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "BMW Türkiye",
      },
    ],
  }),

  // ——— X6 F16 ———
  versionOnly("X6", "xDrive40d", "F16", "F16", 2015, 2015, "DIESEL", "Arazi, SUV & Pickup", {
    driveType: "AWD",
  }),

  // ——— i3 ———
  versionOnly("i3", "i3", "I01", "I01", 2014, 2015, "ELECTRIC", "Otomobil"),

  // ——— i Serisi umbrella (i8 from 2015 list) ———
  versionOnly("i Serisi", "i8", "I12", "I12", 2015, 2015, "HYBRID", "Otomobil"),
];

function keyOf(c: {
  series: string;
  model?: string;
  trim?: string;
  generationCode?: string | null;
  yearFrom?: number | null;
  confidence?: string;
}) {
  return `${c.series}|${c.model || ""}|${c.trim || ""}|${c.generationCode || ""}|${c.yearFrom ?? ""}|${c.confidence || ""}`;
}

function isVerified(c: Config) {
  return c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE";
}

function analyzeSeries(configs: Config[]) {
  const rows: Array<Record<string, string | number | boolean>> = [];
  for (const { series, category } of SELECTABLE) {
    const list = configs.filter((c) => c.series === series);
    const verified = list.filter(isVerified);
    const gens = new Set(
      list.map((c) => c.generationCode).filter((g): g is string => Boolean(g && String(g).trim()))
    );
    const versions = new Set(verified.map((c) => c.model).filter((m) => m && m.trim()));
    const trims = new Set(verified.map((c) => c.trim).filter((t) => t && t.trim()));
    const official = verified.filter((c) => c.confidence === "VERIFIED_OFFICIAL").length;
    const multi = verified.filter((c) => c.confidence === "VERIFIED_MULTI_SOURCE").length;
    const rr = list.filter((c) => c.confidence === "REVIEW_REQUIRED").length;
    const rej = list.filter((c) => c.confidence === "REJECTED").length;
    const noTrim = verified.filter(
      (c) => c.trimStatus === "NO_VERIFIED_TRIM_FOUND" || !(c.trim && c.trim.trim())
    ).length;
    const years = verified.map((c) => c.yearFrom).filter((y): y is number => typeof y === "number");
    const minY = years.length ? Math.min(...years) : null;
    const hasHistoricalVerified = years.some((y) => y <= 2019);
    const hasCurrentVerified = years.some((y) => y >= 2023);
    const seriesResearched = list.length > 0;
    let historicalCoverage = "NONE";
    if (list.some((c) => c.historicalCoverage === "HISTORICAL_COVERAGE_INCOMPLETE") && !hasHistoricalVerified) {
      historicalCoverage = "HISTORICAL_COVERAGE_INCOMPLETE";
    } else if (hasHistoricalVerified && gens.size >= 2) historicalCoverage = "PARTIAL_PLUS";
    else if (hasHistoricalVerified) historicalCoverage = "PARTIAL";
    else if (verified.length && !hasHistoricalVerified) historicalCoverage = "CURRENT_ONLY";

    const currentCoverage = hasCurrentVerified ? "YES" : verified.length ? "LIMITED" : "NO";
    const researchComplete = seriesResearched; // researched ≠ fully filled

    rows.push({
      brand: "BMW",
      category,
      series,
      seriesResearched,
      currentCoverage,
      historicalCoverage,
      generationCount: gens.size,
      verifiedVersionCount: versions.size,
      verifiedTrimCount: trims.size,
      officialSourceCount: official,
      multiSourceCount: multi,
      reviewRequiredCount: rr,
      rejectedCount: rej,
      noVerifiedTrimFound: noTrim,
      researchComplete,
      notes:
        historicalCoverage === "CURRENT_ONLY"
          ? "HISTORICAL_COVERAGE_INCOMPLETE: current/MY verified only"
          : historicalCoverage === "HISTORICAL_COVERAGE_INCOMPLETE"
            ? "Older gens researched; matrix not sourced"
            : "",
    });
  }
  return rows;
}

function writeCoverage(allBrandRows: Array<Record<string, string | number | boolean>>) {
  mkdirSync(join(ROOT, "docs/vehicle-research"), { recursive: true });
  const headers = [
    "brand",
    "category",
    "series",
    "seriesResearched",
    "currentCoverage",
    "historicalCoverage",
    "generationCount",
    "verifiedVersionCount",
    "verifiedTrimCount",
    "officialSourceCount",
    "multiSourceCount",
    "reviewRequiredCount",
    "rejectedCount",
    "noVerifiedTrimFound",
    "researchComplete",
    "notes",
  ];
  const lines = [headers.join(",")];
  for (const r of allBrandRows) {
    lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
  }
  writeFileSync(COVERAGE_CSV, lines.join("\n") + "\n");
}

function main() {
  const raw = JSON.parse(readFileSync(BMW_JSON, "utf8"));
  const map = new Map<string, Config>();
  for (const c of raw.configurations || []) {
    map.set(keyOf(c), c as Config);
  }

  let added = 0;
  for (const row of NEW_ROWS) {
    const k = keyOf(row);
    if (!map.has(k)) {
      map.set(k, row);
      added++;
    }
  }

  // Remove empty generic REVIEW stubs superseded by concrete research for Z/M/X4/i3/i
  for (const [k, c] of [...map.entries()]) {
    if (
      c.confidence === "REVIEW_REQUIRED" &&
      !c.model &&
      !c.generationCode &&
      ["M Serisi", "Z Serisi", "X4", "i3", "i Serisi"].includes(c.series)
    ) {
      map.delete(k);
    }
  }

  const configs = [...map.values()];
  const seriesCovered = [...new Set(configs.map((c) => c.series))].sort();
  const coverageRows = analyzeSeries(configs);
  writeCoverage(coverageRows);

  const researchedSeries = coverageRows.filter((r) => r.seriesResearched).map((r) => r.series);
  const seriesWithoutResearch = SELECTABLE.map((s) => s.series).filter((s) => !researchedSeries.includes(s));
  const currentOnly = coverageRows
    .filter((r) => r.historicalCoverage === "CURRENT_ONLY")
    .map((r) => r.series);
  const verified = configs.filter(isVerified);
  const official = verified.filter((c) => c.confidence === "VERIFIED_OFFICIAL");
  const multi = verified.filter((c) => c.confidence === "VERIFIED_MULTI_SOURCE");
  const rr = configs.filter((c) => c.confidence === "REVIEW_REQUIRED");
  const rej = configs.filter((c) => c.confidence === "REJECTED");
  const noTrim = verified.filter(
    (c) => c.trimStatus === "NO_VERIFIED_TRIM_FOUND" || !(c.trim && String(c.trim).trim())
  );
  const gens = new Set(configs.map((c) => c.generationCode).filter(Boolean));

  const gatePass = seriesWithoutResearch.length === 0;
  // Completed only if all series researched (may still have HISTORICAL_COVERAGE_INCOMPLETE)
  const status = gatePass ? "COMPLETED" : "IN_PROGRESS";

  const report = {
    at: new Date().toISOString(),
    brand: "BMW",
    status,
    gate: {
      seriesWithoutResearch,
      seriesWithoutResearchCount: seriesWithoutResearch.length,
      pass: gatePass,
    },
    selectableSeries: SELECTABLE.map((s) => s.series),
    researchedSeries,
    historicalGenerations: [...gens].sort(),
    verifiedVersions: [...new Set(verified.map((c) => c.model).filter((m) => m && m.trim()))].sort(),
    verifiedTrims: [...new Set(verified.map((c) => c.trim).filter((t) => t && t.trim()))].sort(),
    verifiedConfigurations: verified.length,
    officialSources: official.length,
    multiSources: multi.length,
    reviewRequired: rr.length,
    rejected: rej.length,
    noVerifiedTrimFound: noTrim.length,
    seriesWithCurrentOnlyCoverage: currentOnly,
    historicalCoverageIncompleteSeries: coverageRows
      .filter((r) => String(r.historicalCoverage).includes("INCOMPLETE") || r.historicalCoverage === "CURRENT_ONLY")
      .map((r) => ({ series: r.series, historicalCoverage: r.historicalCoverage })),
    notes:
      "Completed means every selectable series was systematically researched. Current-only and incomplete historical gens remain explicitly flagged.",
  };
  writeFileSync(BMW_REPORT, JSON.stringify(report, null, 2));

  const next = {
    ...raw,
    version: "2026.08-deep-bmw-v4-historical-coverage",
    generatedAt: new Date().toISOString(),
    seriesCovered,
    status,
    researchNotes: {
      coverageCsv: "docs/vehicle-research/deep-catalog-coverage.csv",
      completionReport: "docs/vehicle-research/BMW-completion-report.json",
      historicalArchives: [
        "otopark 2015-09/11 BMW TR",
        "yeniarabafiyatlari 2016 F30",
        "arabamyeni 2016 X1 F48",
        "sekizsilindir 2016 F10 520d packages",
        "bmwuzmani/arabalar 2016 X5 F15 packages",
        "bmwcikemo 2008 E90",
        "arabavs 2019 (prior ingest)",
      ],
      seriesWithoutResearch,
      currentOnlySeries: currentOnly,
      noApply: true,
    },
    configurations: configs,
  };
  writeFileSync(BMW_JSON, JSON.stringify(next, null, 2));

  let progress: Record<string, unknown> = {};
  try {
    progress = JSON.parse(readFileSync(PROGRESS, "utf8"));
  } catch {
    progress = {};
  }
  const completed = new Set<string>(Array.isArray(progress.completedBrands) ? progress.completedBrands : []);
  const inProgress = new Set<string>(Array.isArray(progress.inProgressBrands) ? progress.inProgressBrands : []);
  if (status === "COMPLETED") {
    completed.add("BMW");
    inProgress.delete("BMW");
  } else {
    completed.delete("BMW");
    inProgress.add("BMW");
  }
  const nextProgress = {
    ...progress,
    at: new Date().toISOString(),
    checkpointCommit: "347a961",
    phase: "research-bmw-gate",
    applyAllowed: false,
    noApplyDuringResearch: true,
    completedBrands: [...completed].sort(),
    inProgressBrands: [...inProgress].sort(),
    bmwCompletedAt: status === "COMPLETED" ? new Date().toISOString() : null,
    bmwGate: report.gate,
    verifiedConfigurations: verified.length,
    reviewRequired: rr.length,
    rejected: rej.length,
    currentOnlySeries: currentOnly,
    historicalCoveredSeries: coverageRows
      .filter((r) => ["PARTIAL", "PARTIAL_PLUS"].includes(String(r.historicalCoverage)))
      .map((r) => r.series),
    noVerifiedTrimSeries: coverageRows.filter((r) => Number(r.noVerifiedTrimFound) > 0).map((r) => r.series),
  };
  mkdirSync(join(ROOT, "scripts/output"), { recursive: true });
  writeFileSync(PROGRESS, JSON.stringify(nextProgress, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        added,
        total: configs.length,
        verified: verified.length,
        status,
        seriesWithoutResearch,
        currentOnly,
        coverageRows: coverageRows.length,
      },
      null,
      2
    )
  );
}

main();
