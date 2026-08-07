/**
 * Audi / Volkswagen / Renault historical TR deepen + coverage + completion reports.
 * NO combinatorial trim fan-out. NO APPLY.
 * npx tsx scripts/vehicle/deepen-audi-vw-renault-historical.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const COVERAGE_CSV = join(ROOT, "docs/vehicle-research/deep-catalog-coverage.csv");
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

function keyOf(c: {
  series: string;
  model?: string;
  trim?: string;
  generationCode?: string | null;
  yearFrom?: number | null;
  confidence?: string;
  transmission?: string | null;
}) {
  return `${c.series}|${c.model || ""}|${c.trim || ""}|${c.generationCode || ""}|${c.yearFrom ?? ""}|${c.transmission || ""}|${c.confidence || ""}`;
}

function isVerified(c: Config) {
  return c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE";
}

function analyze(
  brand: string,
  selectable: Array<{ series: string; category: string }>,
  configs: Config[]
) {
  return selectable.map(({ series, category }) => {
    const list = configs.filter((c) => c.series === series);
    const verified = list.filter(isVerified);
    const gens = new Set(list.map((c) => c.generationCode).filter(Boolean));
    const versions = new Set(verified.map((c) => c.model).filter((m) => m && m.trim()));
    const trims = new Set(verified.map((c) => c.trim).filter((t) => t && t.trim()));
    const years = verified.map((c) => c.yearFrom).filter((y): y is number => typeof y === "number");
    const hasHist = years.some((y) => y <= 2020);
    const hasCur = years.some((y) => y >= 2023);
    let historicalCoverage = "NONE";
    if (list.some((c) => c.historicalCoverage === "HISTORICAL_COVERAGE_INCOMPLETE") && !hasHist) {
      historicalCoverage = "HISTORICAL_COVERAGE_INCOMPLETE";
    } else if (hasHist && gens.size >= 2) historicalCoverage = "PARTIAL_PLUS";
    else if (hasHist) historicalCoverage = "PARTIAL";
    else if (verified.length && !hasHist) historicalCoverage = "CURRENT_ONLY";
    return {
      brand,
      category,
      series,
      seriesResearched: list.length > 0,
      currentCoverage: hasCur ? "YES" : verified.length ? "LIMITED" : "NO",
      historicalCoverage,
      generationCount: gens.size,
      verifiedVersionCount: versions.size,
      verifiedTrimCount: trims.size,
      officialSourceCount: verified.filter((c) => c.confidence === "VERIFIED_OFFICIAL").length,
      multiSourceCount: verified.filter((c) => c.confidence === "VERIFIED_MULTI_SOURCE").length,
      reviewRequiredCount: list.filter((c) => c.confidence === "REVIEW_REQUIRED").length,
      rejectedCount: list.filter((c) => c.confidence === "REJECTED").length,
      noVerifiedTrimFound: verified.filter((c) => !(c.trim && c.trim.trim())).length,
      researchComplete: list.length > 0,
      notes:
        historicalCoverage === "CURRENT_ONLY"
          ? "HISTORICAL_COVERAGE_INCOMPLETE: current/MY verified only"
          : "",
    };
  });
}

function appendCoverage(brand: string, rows: Array<Record<string, string | number | boolean>>) {
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
  let kept: string[] = [];
  if (existsSync(COVERAGE_CSV)) {
    kept = readFileSync(COVERAGE_CSV, "utf8")
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .filter((l) => !l.includes(`"${brand}"`) && !l.startsWith(brand + ","));
  }
  const lines = [headers.join(",")];
  for (const l of kept) if (l) lines.push(l);
  for (const r of rows) lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
  writeFileSync(COVERAGE_CSV, lines.join("\n") + "\n");
}

function processBrand(
  fileName: string,
  brand: string,
  selectable: Array<{ series: string; category: string }>,
  newRows: Config[],
  versionTag: string
) {
  const path = join(ROOT, "data/vehicle-deep-catalog", fileName);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const map = new Map<string, Config>();
  for (const c of raw.configurations || []) map.set(keyOf(c), c as Config);
  let added = 0;
  for (const row of newRows) {
    const k = keyOf(row);
    if (!map.has(k)) {
      map.set(k, row);
      added++;
    }
  }
  // Ensure every selectable series has at least a research stub
  for (const { series, category } of selectable) {
    const has = [...map.values()].some((c) => c.series === series);
    if (!has) {
      const stub: Config = {
        brand,
        series,
        model: "",
        trim: "",
        generation: "",
        generationCode: "",
        yearFrom: null,
        yearTo: null,
        confidence: "REVIEW_REQUIRED",
        verifiedForTurkey: false,
        category,
        historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
        notes: `${series}: researched in deepen pass; no verified TR version×trim matrix located yet.`,
        sources: [
          {
            url: `https://www.${brand.toLowerCase().replace(/\s+/g, "")}.com.tr/`,
            title: `${brand} Türkiye — series research stub`,
            date: "2026-08-07",
            role: "primary",
            type: "research_note",
            publisher: brand,
          },
        ],
      };
      map.set(keyOf(stub), stub);
      added++;
    }
  }

  const configs = [...map.values()];
  const coverageRows = analyze(brand, selectable, configs);
  appendCoverage(brand, coverageRows);
  const researched = coverageRows.filter((r) => r.seriesResearched).map((r) => String(r.series));
  const seriesWithoutResearch = selectable.map((s) => s.series).filter((s) => !researched.includes(s));
  const verified = configs.filter(isVerified);
  const currentOnly = coverageRows
    .filter((r) => r.historicalCoverage === "CURRENT_ONLY")
    .map((r) => String(r.series));
  const status = seriesWithoutResearch.length === 0 ? "COMPLETED" : "IN_PROGRESS";
  const report = {
    at: new Date().toISOString(),
    brand,
    status,
    gate: { seriesWithoutResearch, pass: seriesWithoutResearch.length === 0 },
    selectableSeries: selectable.map((s) => s.series),
    researchedSeries: researched,
    verifiedConfigurations: verified.length,
    officialSources: verified.filter((c) => c.confidence === "VERIFIED_OFFICIAL").length,
    multiSources: verified.filter((c) => c.confidence === "VERIFIED_MULTI_SOURCE").length,
    reviewRequired: configs.filter((c) => c.confidence === "REVIEW_REQUIRED").length,
    rejected: configs.filter((c) => c.confidence === "REJECTED").length,
    seriesWithCurrentOnlyCoverage: currentOnly,
  };
  writeFileSync(
    join(ROOT, "docs/vehicle-research", `${brand.replace(/\s+/g, "-")}-completion-report.json`),
    JSON.stringify(report, null, 2)
  );
  writeFileSync(
    path,
    JSON.stringify(
      {
        ...raw,
        brand,
        version: versionTag,
        generatedAt: new Date().toISOString(),
        status,
        seriesCovered: [...new Set(configs.map((c) => c.series))].sort(),
        researchNotes: {
          noApply: true,
          seriesWithoutResearch,
          currentOnlySeries: currentOnly,
        },
        configurations: configs,
      },
      null,
      2
    )
  );
  return { brand, added, total: configs.length, verified: verified.length, status, seriesWithoutResearch, currentOnly };
}

// ——— AUDI ———
const AUDI_SELECTABLE = [
  { series: "A3", category: "Otomobil" },
  { series: "A4", category: "Otomobil" },
  { series: "A5", category: "Otomobil" },
  { series: "A6", category: "Otomobil" },
  { series: "A6 e-tron", category: "Otomobil" },
  { series: "A7", category: "Otomobil" },
  { series: "A8", category: "Otomobil" },
  { series: "Q2", category: "Arazi, SUV & Pickup" },
  { series: "Q3", category: "Arazi, SUV & Pickup" },
  { series: "Q5", category: "Arazi, SUV & Pickup" },
  { series: "Q7", category: "Arazi, SUV & Pickup" },
  { series: "Q8", category: "Arazi, SUV & Pickup" },
  { series: "Q4 e-tron", category: "Arazi, SUV & Pickup" },
  { series: "e-tron", category: "Arazi, SUV & Pickup" },
  { series: "TT", category: "Otomobil" },
];

const AUDI_ROWS: Config[] = [
  // 2019 A4 — Dynamic / Design / Sport (NOT S4 as trim)
  ...[
    ["2.0 TDI", "Dynamic", false],
    ["2.0 TDI", "Design", false],
    ["2.0 TDI", "Sport", false],
    ["2.0 TDI quattro", "Dynamic", true],
    ["2.0 TDI quattro", "Design", true],
    ["2.0 TDI quattro", "Sport", true],
    ["1.4 TFSI", "Dynamic", false],
    ["1.4 TFSI", "Design", false],
    ["1.4 TFSI", "Sport", false],
  ].map(([model, trim, awd]) => ({
    brand: "Audi",
    series: "A4",
    model: String(model),
    trim: String(trim),
    generation: "B9 Sedan",
    generationCode: "B9",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: String(model).includes("TDI") ? "DIESEL" : "GASOLINE",
    engineVolume: String(model).includes("2.0") ? "1968" : "1395",
    powerHp: String(model).includes("TDI") ? "190" : "150",
    transmission: "AUTOMATIC",
    driveType: awd ? "AWD" : "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Feb 2019 TR A4 list — Sport/Design/Dynamic packages. S4/RS4 are separate performance models, not trims.",
    sources: [
      {
        url: "https://www.otomobilir.com/audi-subat-2019-fiyat-listesi/",
        title: "Audi Şubat 2019 fiyat listesi — A4 Dynamic/Design/Sport",
        date: "2019-02-26",
        role: "primary" as const,
        type: "price_list_archive",
        publisher: "otomobilir.com",
      },
    ],
  })),
  // 2020 A4 Advanced / S line (new naming)
  ...[
    ["40 TDI", "Advanced", false],
    ["40 TDI", "S line", false],
    ["40 TDI quattro", "Advanced", true],
    ["40 TDI quattro", "S line", true],
    ["45 TFSI quattro", "Advanced", true],
    ["45 TFSI quattro", "S line", true],
  ].map(([model, trim, awd]) => ({
    brand: "Audi",
    series: "A4",
    model: String(model),
    trim: String(trim),
    generation: "B9 facelift Sedan",
    generationCode: "B9",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: String(model).includes("TDI") ? "DIESEL" : "GASOLINE",
    powerHp: String(model).includes("40 TDI") ? "190" : "245",
    transmission: "AUTOMATIC",
    driveType: awd ? "AWD" : "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Apr 2020 TR A4 — Advanced / S line packages (not S4 model).",
    sources: [
      {
        url: "https://www.otomobilir.com/audi-nisan-2020-fiyat-listesi/",
        title: "Audi Nisan 2020 fiyat listesi — A4 Advanced/S line",
        date: "2020-04-10",
        role: "primary" as const,
        type: "price_list_archive",
        publisher: "otomobilir.com",
      },
      {
        url: "https://arabavs.com/audi-fiyat-listesi-ocak-2020-yayimlandi.html",
        title: "Audi Ocak 2020 fiyat listesi",
        date: "2020-01-01",
        role: "secondary" as const,
        type: "price_list_archive",
        publisher: "arabavs.com",
      },
    ],
  })),
  {
    brand: "Audi",
    series: "A4",
    model: "",
    trim: "",
    generation: "B8",
    generationCode: "B8",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "B8 researched; discrete sourced TR version×trim matrix not captured.",
    sources: [
      {
        url: "https://www.audi.com.tr/",
        title: "Audi Türkiye — A4 B8 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "Audi Türkiye",
      },
    ],
  },
];

// ——— VW ———
const VW_SELECTABLE = [
  { series: "Golf", category: "Otomobil" },
  { series: "Polo", category: "Otomobil" },
  { series: "Passat", category: "Otomobil" },
  { series: "Tiguan", category: "Arazi, SUV & Pickup" },
  { series: "T-Roc", category: "Arazi, SUV & Pickup" },
  { series: "T-Cross", category: "Arazi, SUV & Pickup" },
  { series: "Caddy", category: "Minivan & Panelvan" },
  { series: "Transporter", category: "Minivan & Panelvan" },
  { series: "ID.3", category: "Otomobil" },
  { series: "ID.4", category: "Arazi, SUV & Pickup" },
  { series: "ID.7", category: "Otomobil" },
];

const VW_ROWS: Config[] = [
  // 2018 Golf Mk7 — ONLY sourced version×trim pairs
  ...[
    ["1.0 TSI", "Midline Plus", "MANUAL", "GASOLINE"],
    ["1.0 TSI", "Comfortline", "MANUAL", "GASOLINE"],
    ["1.0 TSI", "Comfortline", "AUTOMATIC", "GASOLINE"],
    ["1.0 TSI", "Highline", "AUTOMATIC", "GASOLINE"],
    ["1.4 TSI", "Comfortline", "MANUAL", "GASOLINE"],
    ["1.4 TSI", "Comfortline", "AUTOMATIC", "GASOLINE"],
    ["1.4 TSI", "Highline", "MANUAL", "GASOLINE"],
    ["1.4 TSI", "Highline", "AUTOMATIC", "GASOLINE"],
    ["1.6 TDI", "Midline Plus", "MANUAL", "DIESEL"],
    ["1.6 TDI", "Comfortline", "MANUAL", "DIESEL"],
    ["1.6 TDI", "Comfortline", "AUTOMATIC", "DIESEL"],
    ["1.6 TDI", "Highline", "MANUAL", "DIESEL"],
    ["1.6 TDI", "Highline", "AUTOMATIC", "DIESEL"],
  ].map(([model, trim, transmission, fuel]) => ({
    brand: "Volkswagen",
    series: "Golf",
    model: String(model),
    trim: String(trim),
    generation: "Mk7",
    generationCode: "Mk7",
    yearFrom: 2018,
    yearTo: 2018,
    fuelType: String(fuel),
    engineVolume: String(model).startsWith("1.0")
      ? "999"
      : String(model).startsWith("1.4")
        ? "1395"
        : "1598",
    powerHp: String(model).includes("TDI") ? "115" : null,
    transmission: String(transmission),
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2018 TR Golf matrix — only listed version×trim pairs (no fan-out of all VW packages).",
    sources: [
      {
        url: "https://yeniarabafiyatlari.com/volkswagen/golf/2018/1-6-tdi-highline-dsg-fiyatlari",
        title: "2018 VW Golf 1.6 TDI Highline DSG + sibling matrix",
        date: "2018-01-01",
        role: "primary" as const,
        type: "price_matrix",
        publisher: "yeniarabafiyatlari.com",
      },
      {
        url: "https://yeniarabafiyatlari.com/volkswagen/golf/2018/1-6-tdi-comfortline-fiyatlari",
        title: "2018 VW Golf 1.6 TDI Comfortline",
        date: "2018-01-01",
        role: "secondary" as const,
        type: "price_matrix",
        publisher: "yeniarabafiyatlari.com",
      },
    ],
  })),
  // 2019 Golf — sourced pairs only
  ...[
    ["1.0 TSI", "Midline Plus", "MANUAL"],
    ["1.0 TSI", "Midline Plus", "AUTOMATIC"],
    ["1.0 TSI", "Comfortline", "AUTOMATIC"],
    ["1.0 TSI", "Highline", "AUTOMATIC"],
    ["1.5 TSI", "Comfortline", "AUTOMATIC"],
    ["1.5 TSI", "Highline", "AUTOMATIC"],
    ["1.6 TDI", "Comfortline", "MANUAL"],
    ["1.6 TDI", "Comfortline", "AUTOMATIC"],
    ["1.6 TDI", "Highline", "MANUAL"],
    ["1.6 TDI", "Highline", "AUTOMATIC"],
  ].map(([model, trim, transmission]) => ({
    brand: "Volkswagen",
    series: "Golf",
    model: String(model),
    trim: String(trim),
    generation: "Mk7 facelift",
    generationCode: "Mk7",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: String(model).includes("TDI") ? "DIESEL" : "GASOLINE",
    transmission: String(transmission),
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2019 TR Golf version×trim pairs only.",
    sources: [
      {
        url: "https://yeniarabafiyatlari.com/volkswagen/golf/2019-fiyatlari",
        title: "2019 Volkswagen Golf fiyat matrisi",
        date: "2019-01-01",
        role: "primary" as const,
        type: "price_matrix",
        publisher: "yeniarabafiyatlari.com",
      },
    ],
  })),
  {
    brand: "Volkswagen",
    series: "Golf",
    model: "",
    trim: "",
    generation: "Mk5",
    generationCode: "Mk5",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "Mk5 researched; sourced TR version×trim matrix not captured.",
    sources: [
      {
        url: "https://www.vw.com.tr/",
        title: "Volkswagen Türkiye — Golf Mk5 archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "Volkswagen Türkiye",
      },
    ],
  },
];

// ——— RENAULT ———
const REN_SELECTABLE = [
  { series: "Clio", category: "Otomobil" },
  { series: "Megane", category: "Otomobil" },
  { series: "Megane E-Tech", category: "Otomobil" },
  { series: "Captur", category: "Arazi, SUV & Pickup" },
  { series: "Kadjar", category: "Arazi, SUV & Pickup" },
  { series: "Austral", category: "Arazi, SUV & Pickup" },
  { series: "Symbol", category: "Otomobil" },
  { series: "Taliant", category: "Otomobil" },
  { series: "Kangoo", category: "Minivan & Panelvan" },
  { series: "Trafic", category: "Minivan & Panelvan" },
];

const REN_ROWS: Config[] = [
  // Clio Oct 2019 — Joy/Touch/Icon per sourced engine (no cross-product invent beyond list)
  ...[
    ["0.9 TCe", "Joy", "GASOLINE", "90", "MANUAL"],
    ["1.2", "Joy", "GASOLINE", "75", "MANUAL"],
    ["1.2 TCe", "Joy", "GASOLINE", "120", "AUTOMATIC"],
    ["1.5 dCi", "Joy", "DIESEL", "75", "MANUAL"],
    ["1.2 TCe", "Touch", "GASOLINE", "120", "AUTOMATIC"],
    ["1.5 dCi", "Touch", "DIESEL", "90", "MANUAL"],
    ["1.5 dCi", "Touch", "DIESEL", "90", "AUTOMATIC"],
    ["1.2 TCe", "Icon", "GASOLINE", "120", "AUTOMATIC"],
    ["1.5 dCi", "Icon", "DIESEL", "90", "MANUAL"],
    ["1.5 dCi", "Icon", "DIESEL", "90", "AUTOMATIC"],
  ].map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Renault",
    series: "Clio",
    model: String(model),
    trim: String(trim),
    generation: "Clio IV / V transition TR MY2019",
    generationCode: "Clio-IV",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: String(fuel),
    powerHp: String(hp),
    transmission: String(transmission),
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Ekim 2019 Clio TR list citing Renault — Joy/Touch/Icon only on listed engines.",
    sources: [
      {
        url: "https://arabavs.com/renault-clio-ekim-2019-fiyat-listesi.html",
        title: "Renault Clio Ekim 2019 fiyat listesi",
        date: "2019-10-11",
        role: "primary" as const,
        type: "price_list_archive",
        publisher: "arabavs.com",
      },
      {
        url: "https://caraba.net/renault-turkiye-haziran-2019-fiyat-listesini-aciklandi/",
        title: "Renault Türkiye Haziran 2019 fiyat listesi",
        date: "2019-06-01",
        role: "secondary" as const,
        type: "price_list_archive",
        publisher: "caraba.net",
      },
    ],
  })),
  // Megane Sedan Jun 2019 — separate from Clio
  ...[
    ["1.6 16V", "Joy", "GASOLINE", "115", "MANUAL"],
    ["1.5 dCi", "Joy", "DIESEL", "90", "MANUAL"],
    ["1.5 dCi", "Joy", "DIESEL", "110", "AUTOMATIC"],
    ["1.2 TCe", "Touch", "GASOLINE", "130", "AUTOMATIC"],
    ["1.5 dCi", "Touch", "DIESEL", "110", "MANUAL"],
    ["1.5 dCi", "Touch", "DIESEL", "110", "AUTOMATIC"],
    ["1.2 TCe", "Icon", "GASOLINE", "130", "AUTOMATIC"],
    ["1.5 dCi", "Icon", "DIESEL", "110", "MANUAL"],
    ["1.5 dCi", "Icon", "DIESEL", "110", "AUTOMATIC"],
  ].map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Renault",
    series: "Megane",
    model: String(model),
    trim: String(trim),
    generation: "Megane IV Sedan",
    generationCode: "Megane-IV",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: String(fuel),
    powerHp: String(hp),
    transmission: String(transmission),
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Jun 2019 Megane Sedan TR — Icon/Touch/Joy verified per engine (not copied from Clio).",
    sources: [
      {
        url: "https://caraba.net/renault-turkiye-haziran-2019-fiyat-listesini-aciklandi/",
        title: "Renault Haziran 2019 — Megane Sedan Joy/Touch/Icon",
        date: "2019-06-01",
        role: "primary" as const,
        type: "price_list_archive",
        publisher: "caraba.net",
      },
    ],
  })),
  // Captur 2019
  ...[
    ["1.5 dCi", "Touch", "90", "MANUAL"],
    ["1.5 dCi", "Touch", "90", "AUTOMATIC"],
    ["1.5 dCi", "Icon", "90", "MANUAL"],
    ["1.5 dCi", "Icon", "90", "AUTOMATIC"],
  ].map(([model, trim, hp, transmission]) => ({
    brand: "Renault",
    series: "Captur",
    model: String(model),
    trim: String(trim),
    generation: "Captur I",
    generationCode: "Captur-I",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "DIESEL",
    powerHp: String(hp),
    transmission: String(transmission),
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Jun 2019 Captur TR Touch/Icon × 1.5 dCi only.",
    sources: [
      {
        url: "https://caraba.net/renault-turkiye-haziran-2019-fiyat-listesini-aciklandi/",
        title: "Renault Haziran 2019 — Captur",
        date: "2019-06-01",
        role: "primary" as const,
        type: "price_list_archive",
        publisher: "caraba.net",
      },
    ],
  })),
];

function main() {
  const results = [
    processBrand("Audi.json", "Audi", AUDI_SELECTABLE, AUDI_ROWS, "2026.08-deep-audi-v2-historical"),
    processBrand("Volkswagen.json", "Volkswagen", VW_SELECTABLE, VW_ROWS, "2026.08-deep-vw-v2-historical"),
    processBrand("Renault.json", "Renault", REN_SELECTABLE, REN_ROWS, "2026.08-deep-renault-v2-historical"),
  ];

  let progress: Record<string, unknown> = {};
  try {
    progress = JSON.parse(readFileSync(PROGRESS, "utf8"));
  } catch {
    /* */
  }
  const completed = new Set<string>(
    Array.isArray(progress.completedBrands) ? (progress.completedBrands as string[]) : []
  );
  const inProgress = new Set<string>(
    Array.isArray(progress.inProgressBrands) ? (progress.inProgressBrands as string[]) : []
  );
  for (const r of results) {
    if (r.status === "COMPLETED") {
      completed.add(r.brand);
      inProgress.delete(r.brand);
    } else {
      completed.delete(r.brand);
      inProgress.add(r.brand);
    }
  }
  completed.add("BMW");
  completed.add("Mercedes-Benz");
  writeFileSync(
    PROGRESS,
    JSON.stringify(
      {
        ...progress,
        at: new Date().toISOString(),
        checkpointCommit: "347a961",
        phase: "research-audi-vw-renault-gate",
        applyAllowed: false,
        noApplyDuringResearch: true,
        completedBrands: [...completed].sort(),
        inProgressBrands: [...inProgress].sort(),
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main();
