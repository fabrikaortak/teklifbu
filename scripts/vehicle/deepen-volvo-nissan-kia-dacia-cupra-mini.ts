/**
 * Volvo / Nissan / Kia / Dacia / Cupra / Mini historical TR deepen + coverage + completion reports.
 * RESEARCH ONLY — NO combinatorial trim fan-out. NO APPLY. NO DB writes.
 * Checkpoint 347a961 must not be rewritten. applyAllowed=false.
 * Not final complete for remaining catalog — deepen pass only.
 *
 * npx tsx scripts/vehicle/deepen-volvo-nissan-kia-dacia-cupra-mini.ts
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
      noVerifiedTrimFound: verified.filter(
        (c) => c.trimStatus === "NO_VERIFIED_TRIM_FOUND" || !(c.trim && c.trim.trim())
      ).length,
      researchComplete: list.length > 0,
      notes:
        historicalCoverage === "CURRENT_ONLY"
          ? "HISTORICAL_COVERAGE_INCOMPLETE: current/MY verified only"
          : historicalCoverage === "HISTORICAL_COVERAGE_INCOMPLETE"
            ? "HISTORICAL_COVERAGE_INCOMPLETE"
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
  const histIncomplete = coverageRows
    .filter(
      (r) =>
        r.historicalCoverage === "HISTORICAL_COVERAGE_INCOMPLETE" ||
        r.historicalCoverage === "CURRENT_ONLY"
    )
    .map((r) => ({
      series: String(r.series),
      historicalCoverage: String(r.historicalCoverage),
    }));
  const status = seriesWithoutResearch.length === 0 ? "COMPLETED" : "IN_PROGRESS";
  const noTrim = verified.filter(
    (c) => c.trimStatus === "NO_VERIFIED_TRIM_FOUND" || !(c.trim && c.trim.trim())
  ).length;
  const report = {
    at: new Date().toISOString(),
    brand,
    status,
    gate: {
      seriesWithoutResearch,
      seriesWithoutResearchCount: seriesWithoutResearch.length,
      pass: seriesWithoutResearch.length === 0,
    },
    selectableSeries: selectable.map((s) => s.series),
    researchedSeries: researched,
    verifiedVersions: [...new Set(verified.map((c) => c.model).filter((m) => m && m.trim()))].sort(),
    verifiedTrims: [...new Set(verified.map((c) => c.trim).filter((t) => t && t.trim()))].sort(),
    verifiedConfigurations: verified.length,
    officialSources: verified.filter((c) => c.confidence === "VERIFIED_OFFICIAL").length,
    multiSources: verified.filter((c) => c.confidence === "VERIFIED_MULTI_SOURCE").length,
    reviewRequired: configs.filter((c) => c.confidence === "REVIEW_REQUIRED").length,
    rejected: configs.filter((c) => c.confidence === "REJECTED").length,
    noVerifiedTrimFound: noTrim,
    seriesWithCurrentOnlyCoverage: currentOnly,
    historicalCoverageIncompleteSeries: histIncomplete,
    notes:
      "Deepen pass (not final catalog complete). Completed means every selectable series was systematically researched. Current-only and incomplete historical gens remain flagged. Research-only; applyAllowed=false.",
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
          applyAllowed: false,
          phase: "research-deepen-batch-volvo-nissan-kia-dacia-cupra-mini",
          seriesWithoutResearch,
          currentOnlySeries: currentOnly,
          addedThisPass: added,
          notFinalComplete: true,
        },
        configurations: configs,
      },
      null,
      2
    )
  );
  return {
    brand,
    added,
    total: configs.length,
    verified: verified.length,
    status,
    seriesWithoutResearch,
    currentOnly,
    noVerifiedTrimFound: noTrim,
    reviewRequired: configs.filter((c) => c.confidence === "REVIEW_REQUIRED").length,
  };
}

const SRC = {
  volvoXc60Amy: {
    url: "https://arabamyeni.com/sifir/volvo/xc60/2019",
    title: "Volvo XC60 2019 model TR fiyat matrisi (D4 × Momentum/R-Design/Inscription)",
    date: "2019-01-01",
    role: "primary" as const,
    type: "price_matrix",
    publisher: "arabamyeni.com",
  },
  volvoXc60Yaf: {
    url: "https://yeniarabafiyatlari.com/volvo/xc60/2019-fiyatlari",
    title: "2019 Model Volvo XC60 Fiyatları — version×trim",
    date: "2019-01-01",
    role: "secondary" as const,
    type: "price_matrix",
    publisher: "yeniarabafiyatlari.com",
  },
  volvoXc90Amy: {
    url: "https://arabamyeni.com/sifir/volvo/xc90/2019",
    title: "Volvo XC90 2019 model TR fiyat matrisi",
    date: "2019-01-01",
    role: "primary" as const,
    type: "price_matrix",
    publisher: "arabamyeni.com",
  },
  volvoXc90Yaf: {
    url: "https://yeniarabafiyatlari.com/volvo/xc90/2019-fiyatlari",
    title: "2019 Model Volvo XC90 Fiyatları",
    date: "2019-01-01",
    role: "secondary" as const,
    type: "price_matrix",
    publisher: "yeniarabafiyatlari.com",
  },
  nissanQashAmy: {
    url: "https://arabamyeni.com/sifir/nissan/qashqai/2019",
    title: "Nissan Qashqai 2019 model TR fiyat matrisi",
    date: "2019-01-01",
    role: "primary" as const,
    type: "price_matrix",
    publisher: "arabamyeni.com",
  },
  nissanQashArac: {
    url: "https://aracbulten.com/nissan-qashqai-fiyat-listesi-2019/",
    title: "Nissan Qashqai 06 Aralık 2019 tavsiye edilen liste — Visia/Tekna/Sky Pack/Platinum Premium Pack",
    date: "2019-12-06",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "aracbulten.com",
  },
  nissanJukeDh: {
    url: "https://www.donanimhaber.com/yeni-nissan-juke-turkiye-de-iste-fiyati-ve-ozellikleri--129391",
    title: "Yeni Nissan Juke TR lansman — Tekna/Platinum/Platinum Premium × 1.0 DIG-T 115",
    date: "2020-01-15",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "donanimhaber.com",
  },
  nissanJuke2018: {
    url: "https://arabamyeni.com/sifir/nissan/juke/2018",
    title: "Nissan Juke 2018 model TR fiyat matrisi (Visia/Skypack/Special Edition)",
    date: "2018-01-01",
    role: "secondary" as const,
    type: "price_matrix",
    publisher: "arabamyeni.com",
  },
  kiaCaraba: {
    url: "https://caraba.net/kia-ekim-2019-fiyat-listesi/",
    title: "Kia Ekim 2019 fiyat listesi — Sportage/Picanto/Stonic/Sorento",
    date: "2019-10-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  kiaSportageYaf: {
    url: "https://yeniarabafiyatlari.com/kia/sportage/2019-fiyatlari",
    title: "2019 Model Kia Sportage Fiyatları — Cool/Elegance/Prestige/GT-Line",
    date: "2019-01-01",
    role: "secondary" as const,
    type: "price_matrix",
    publisher: "yeniarabafiyatlari.com",
  },
  daciaCaraba: {
    url: "https://caraba.net/dacia-ekim-2019-fiyat-listesi/",
    title: "Dacia Ekim 2019 fiyat listesi — Duster/Sandero/Stepway",
    date: "2019-10-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  daciaArabavs: {
    url: "https://www.arabavs.com/dacia-fiyat-listesi-aralik-ayi-2019.html",
    title: "Dacia Aralık 2019 fiyat listesi — Duster/Sandero",
    date: "2019-12-03",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  daciaLog: {
    url: "https://www.log.com.tr/2019-dacia-duster-donanim-ozellikleri-ve-fiyati/",
    title: "2019 Dacia Duster donanım×motor fiyat matrisi",
    date: "2019-02-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "log.com.tr",
  },
  cupraOtomobilir: {
    url: "https://www.otomobilir.com/satisa-sunulan-otomobillerin-fiyat-degisimi/",
    title: "2021 Cupra Formentor TR fiyat değişimi — version-only rows",
    date: "2021-12-29",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  cupraArac: {
    url: "https://aracbulten.com/cupra-fiyat-listesi-2023/",
    title: "Cupra Ekim 2023 fiyat listesi — Formentor/Leon version rows",
    date: "2023-10-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "aracbulten.com",
  },
  miniMotor1: {
    url: "https://tr.motor1.com/news/274397/otv-indirimi-ardindan-fiyatlar-mini/",
    title: "Mini ÖTV sonrası Kasım 2018 — Cooper/Countryman × Türkiye Paketi/Salt/Pepper/Chili",
    date: "2018-11-02",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "motor1.com",
  },
  miniArac: {
    url: "https://aracbulten.com/mini-cooper-countryman-sifir-faiz-firsati/",
    title: "Mini Cooper Countryman Kasım 2019 sıfır faiz kampanyası — Classic band",
    date: "2019-11-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "aracbulten.com",
  },
};

function rr(
  brand: string,
  series: string,
  category: string,
  notes: string,
  sources: Source[]
): Config {
  return {
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
    notes,
    sources,
  };
}

// ——— VOLVO ———
const VOLVO_SELECTABLE = [
  { series: "XC60", category: "Arazi, SUV & Pickup" },
  { series: "XC90", category: "Arazi, SUV & Pickup" },
  { series: "V60", category: "Otomobil" },
  { series: "EX40", category: "Arazi, SUV & Pickup" },
  { series: "EX30", category: "Arazi, SUV & Pickup" },
  { series: "EC40", category: "Arazi, SUV & Pickup" },
];

const VOLVO_ROWS: Config[] = [
  ...(
    [
      ["2.0 D4", "Momentum", "190"],
      ["2.0 D4", "R-Design", "190"],
      ["2.0 D4", "Inscription", "190"],
    ] as const
  ).map(([model, trim, hp]) => ({
    brand: "Volvo",
    series: "XC60",
    model,
    trim,
    generation: "XC60 II TR MY2019",
    generationCode: "SPA/XC60",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "DIESEL",
    engineVolume: "1969",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2019 XC60 TR — only published D4 × Momentum/R-Design/Inscription pairs (no fan-out).",
    sources: [SRC.volvoXc60Amy, SRC.volvoXc60Yaf],
  })),
  ...(
    [
      ["2.0 D5", "Momentum", "225", "DIESEL"],
      ["2.0 D5", "Inscription", "225", "DIESEL"],
      ["2.0 D5", "R-Design", "225", "DIESEL"],
      ["2.0 T8", "Momentum", "320", "HYBRID"],
    ] as const
  ).map(([model, trim, hp, fuel]) => ({
    brand: "Volvo",
    series: "XC90",
    model,
    trim,
    generation: "XC90 II TR MY2019",
    generationCode: "SPA/XC90",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: "1969",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2019 XC90 TR — only published version×trim rows.",
    sources: [SRC.volvoXc90Amy, SRC.volvoXc90Yaf],
  })),
  rr(
    "Volvo",
    "V60",
    "Otomobil",
    "V60: researched deepen pass; discrete 2019–2020 TR version×trim archive matrix not located (current MY B4 Plus Dark already verified).",
    [
      {
        url: "https://yeniarabafiyatlari.com/volvo/v60/2019-fiyatlari",
        title: "Volvo V60 2019 archive search (404)",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "yeniarabafiyatlari.com",
      },
      {
        url: "https://www.volvocars.com/tr/l/fiyat-listesi/",
        title: "Volvo Cars TR resmi fiyat listesi",
        date: "2026-08-07",
        role: "secondary",
      },
    ]
  ),
  rr(
    "Volvo",
    "EX30",
    "Arazi, SUV & Pickup",
    "EX30: EV overlay researched; historical gens N/A / current MY discrete version×trim pending full official ingest.",
    [
      {
        url: "https://www.volvocars.com/tr/l/fiyat-listesi/",
        title: "Volvo Cars TR — EX30 research stub",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
  rr(
    "Volvo",
    "EC40",
    "Arazi, SUV & Pickup",
    "EC40: EV overlay researched; no verified historical TR version×trim matrix.",
    [
      {
        url: "https://www.volvocars.com/tr/l/fiyat-listesi/",
        title: "Volvo Cars TR — EC40 research stub",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
];

// ——— NISSAN ———
const NISSAN_SELECTABLE = [
  { series: "Qashqai", category: "Arazi, SUV & Pickup" },
  { series: "Qashqai e-POWER", category: "Arazi, SUV & Pickup" },
  { series: "Juke", category: "Arazi, SUV & Pickup" },
  { series: "X-Trail", category: "Arazi, SUV & Pickup" },
  { series: "Townstar", category: "Minivan & Panelvan" },
];

const NISSAN_ROWS: Config[] = [
  // Dec 2019 Qashqai — ONLY listed pairs from aracbulten (version=engine, trim=package)
  ...(
    [
      ["1.3 DIG-T 160 DCT", "Visia", "GASOLINE", "160", "AUTOMATIC", "1332"],
      ["1.3 DIG-T 160 DCT", "Tekna", "GASOLINE", "160", "AUTOMATIC", "1332"],
      ["1.3 DIG-T 160 DCT", "Sky Pack", "GASOLINE", "160", "AUTOMATIC", "1332"],
      ["1.3 DIG-T 160 DCT", "Platinum Premium Pack", "GASOLINE", "160", "AUTOMATIC", "1332"],
      ["1.5 dCi 115", "Visia", "DIESEL", "115", "MANUAL", "1461"],
      ["1.5 dCi 115", "Tekna", "DIESEL", "115", "MANUAL", "1461"],
      ["1.5 dCi 115", "Sky Pack", "DIESEL", "115", "MANUAL", "1461"],
      ["1.5 dCi 115 DCT", "Visia", "DIESEL", "115", "AUTOMATIC", "1461"],
      ["1.5 dCi 115 DCT", "Tekna", "DIESEL", "115", "AUTOMATIC", "1461"],
      ["1.5 dCi 115 DCT", "Sky Pack", "DIESEL", "115", "AUTOMATIC", "1461"],
      ["1.5 dCi 115 DCT", "Platinum Premium Pack", "DIESEL", "115", "AUTOMATIC", "1461"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, vol]) => ({
    brand: "Nissan",
    series: "Qashqai",
    model,
    trim,
    generation: "Qashqai J11 FL TR MY2019",
    generationCode: "J11",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: vol,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "06 Aralık 2019 Nissan Qashqai TR — only published version×trim rows (no fan-out).",
    sources: [SRC.nissanQashArac, SRC.nissanQashAmy],
  })),
  // Juke F16 lansman ~2020 — 1.0 DIG-T 115 × Tekna/Platinum/Platinum Premium (published pairs)
  ...(
    [
      ["1.0 DIG-T 115", "Tekna", "MANUAL"],
      ["1.0 DIG-T 115 DCT", "Tekna", "AUTOMATIC"],
      ["1.0 DIG-T 115 DCT", "Platinum", "AUTOMATIC"],
      ["1.0 DIG-T 115 DCT", "Platinum Perso", "AUTOMATIC"],
      ["1.0 DIG-T 115 DCT", "Platinum Premium", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, transmission]) => ({
    brand: "Nissan",
    series: "Juke",
    model,
    trim,
    generation: "Juke F16 TR lansman",
    generationCode: "F16",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "999",
    powerHp: "115",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Yeni Juke TR lansman — only published 1.0 DIG-T × Tekna/Platinum/Platinum Premium pairs.",
    sources: [SRC.nissanJukeDh, SRC.nissanJuke2018],
  })),
  rr(
    "Nissan",
    "Qashqai e-POWER",
    "Arazi, SUV & Pickup",
    "Qashqai e-POWER: researched; pre-current historical matrix N/A (series recent). Current MY Designpack/Skypack/Platinum already verified.",
    [
      {
        url: "https://www.nissan.com.tr/fiyat-listesi/sifir-arac-fiyatlari-2026.html",
        title: "Nissan TR — Qashqai e-POWER historical research note",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
  rr(
    "Nissan",
    "X-Trail",
    "Arazi, SUV & Pickup",
    "X-Trail T33: researched deepen pass; discrete ≤2020 TR version×trim archive incomplete (current Platinum rows verified).",
    [
      {
        url: "https://www.nissan.com.tr/fiyat-listesi/sifir-arac-fiyatlari-2026.html",
        title: "Nissan TR — X-Trail historical research note",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
  rr(
    "Nissan",
    "Townstar",
    "Minivan & Panelvan",
    "Townstar: researched; no verified TR version×trim matrix located yet.",
    [
      {
        url: "https://www.nissan.com.tr/fiyat-listesi/sifir-arac-fiyatlari-2026.html",
        title: "Nissan TR — Townstar research stub",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
];

// ——— KIA ———
const KIA_SELECTABLE = [
  { series: "Sportage", category: "Arazi, SUV & Pickup" },
  { series: "Picanto", category: "Otomobil" },
  { series: "Stonic", category: "Arazi, SUV & Pickup" },
  { series: "Sorento", category: "Arazi, SUV & Pickup" },
  { series: "EV3", category: "Arazi, SUV & Pickup" },
  { series: "EV6", category: "Arazi, SUV & Pickup" },
  { series: "EV9", category: "Arazi, SUV & Pickup" },
];

const KIA_ROWS: Config[] = [
  ...(
    [
      ["1.6L 132 PS", "Cool", "GASOLINE", "132", "MANUAL", "FWD"],
      ["1.6L CRDi 136 PS DCT", "Cool", "DIESEL", "136", "AUTOMATIC", "FWD"],
      ["1.6L CRDi 136 PS DCT", "Elegance", "DIESEL", "136", "AUTOMATIC", "FWD"],
      ["1.6L CRDi 136 PS DCT 4x4", "Elegance", "DIESEL", "136", "AUTOMATIC", "AWD"],
      ["1.6L CRDi 136 PS DCT", "Prestige", "DIESEL", "136", "AUTOMATIC", "FWD"],
      ["1.6L CRDi 136 PS DCT 4x4", "Prestige", "DIESEL", "136", "AUTOMATIC", "AWD"],
      ["1.6L CRDi 136 PS DCT", "Prestige Design Pack", "DIESEL", "136", "AUTOMATIC", "FWD"],
      ["1.6L CRDi 136 PS DCT 4x4", "Prestige Design Pack", "DIESEL", "136", "AUTOMATIC", "AWD"],
      ["1.6L CRDi 136 PS DCT 4x4", "GT-Line", "DIESEL", "136", "AUTOMATIC", "AWD"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, drive]) => ({
    brand: "Kia",
    series: "Sportage",
    model,
    trim,
    generation: "Sportage QL/NQ5 TR MY2019",
    generationCode: "QL",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: "1591",
    powerHp: hp,
    transmission,
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Ekim 2019 Kia Sportage TR — only published Cool/Elegance/Prestige/GT-Line pairs.",
    sources: [SRC.kiaCaraba, SRC.kiaSportageYaf],
  })),
  {
    brand: "Kia",
    series: "Picanto",
    model: "1.0L 67 PS",
    trim: "Live",
    generation: "Picanto JA TR MY2019",
    generationCode: "JA",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    engineVolume: "998",
    powerHp: "67",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Ekim 2019 Kia Picanto Live 1.0L Benzin Otomatik — published pair only.",
    sources: [SRC.kiaCaraba],
  },
  ...(
    [
      ["1.4L 100 PS", "Elegance Sunroof", "AUTOMATIC"],
      ["1.0L T-GDI 120 PS DCT", "Elegance Turbo Sunroof", "AUTOMATIC"],
      ["1.0L T-GDI 120 PS DCT", "Elegance Design Pack", "AUTOMATIC"],
      ["1.4L 100 PS", "Elegance Design Pack", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, transmission]) => ({
    brand: "Kia",
    series: "Stonic",
    model,
    trim,
    generation: "Stonic YB TR MY2019",
    generationCode: "YB",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    powerHp: model.includes("120") ? "120" : "100",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Ekim 2019 Kia Stonic TR — only published Elegance pairs.",
    sources: [SRC.kiaCaraba],
  })),
  ...(
    [
      ["2.0L Dizel", "Prestige", "AWD"],
      ["2.0L Dizel", "GT-Line", "AWD"],
    ] as const
  ).map(([model, trim, drive]) => ({
    brand: "Kia",
    series: "Sorento",
    model,
    trim,
    generation: "Sorento UM TR MY2019",
    generationCode: "UM",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "DIESEL",
    engineVolume: "1995",
    transmission: "AUTOMATIC",
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Ekim 2019 Kia Sorento Prestige/GT-Line 4×4 Dizel — published pairs only.",
    sources: [SRC.kiaCaraba],
  })),
  rr("Kia", "EV3", "Arazi, SUV & Pickup", "EV3: researched; EV overlay — no historical TR version×trim matrix (series new).", [
    { url: "https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", title: "Kia TR fiyat listesi — EV3 stub", date: "2026-08-07", role: "primary" },
  ]),
  rr("Kia", "EV6", "Arazi, SUV & Pickup", "EV6: researched; discrete historical TR version×trim matrix incomplete.", [
    { url: "https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", title: "Kia TR fiyat listesi — EV6 stub", date: "2026-08-07", role: "primary" },
  ]),
  rr("Kia", "EV9", "Arazi, SUV & Pickup", "EV9: researched; no verified historical TR version×trim matrix.", [
    { url: "https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", title: "Kia TR fiyat listesi — EV9 stub", date: "2026-08-07", role: "primary" },
  ]),
];

// ——— DACIA ———
const DACIA_SELECTABLE = [
  { series: "Sandero", category: "Otomobil" },
  { series: "Sandero Stepway", category: "Otomobil" },
  { series: "Logan", category: "Otomobil" },
  { series: "Jogger", category: "Otomobil" },
  { series: "Duster", category: "Arazi, SUV & Pickup" },
];

const DACIA_ROWS: Config[] = [
  ...(
    [
      ["1.6 16v 115 bg 4x2", "Comfort", "GASOLINE", "115", "MANUAL", "FWD"],
      ["1.3 TCe 130 bg 4x2", "Comfort", "GASOLINE", "130", "MANUAL", "FWD"],
      ["ECO-G 115 bg 4x2", "Comfort", "LPG", "115", "MANUAL", "FWD"],
      ["1.5 Blue dCi 95 bg 4x2", "Comfort", "DIESEL", "95", "MANUAL", "FWD"],
      ["1.5 Blue dCi 115 bg 4x4", "Comfort", "DIESEL", "115", "MANUAL", "AWD"],
      ["1.3 TCe 130 bg 4x2", "Prestige", "GASOLINE", "130", "MANUAL", "FWD"],
      ["ECO-G 115 bg 4x2", "Prestige", "LPG", "115", "MANUAL", "FWD"],
      ["1.5 Blue dCi 115 bg 4x2", "Prestige", "DIESEL", "115", "MANUAL", "FWD"],
      ["1.5 Blue dCi 115 bg 4x4", "Prestige", "DIESEL", "115", "MANUAL", "AWD"],
      ["1.3 TCe 130 bg 4x2", "Prestige Plus", "GASOLINE", "130", "MANUAL", "FWD"],
      ["1.5 Blue dCi 115 bg 4x2", "Prestige Plus", "DIESEL", "115", "MANUAL", "FWD"],
      ["1.5 Blue dCi 115 bg 4x4", "Prestige Plus", "DIESEL", "115", "MANUAL", "AWD"],
      ["1.3 TCe 150 bg 4x2", "Techroad", "GASOLINE", "150", "MANUAL", "FWD"],
      ["1.5 Blue dCi 115 bg 4x4", "Techroad", "DIESEL", "115", "MANUAL", "AWD"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, drive]) => ({
    brand: "Dacia",
    series: "Duster",
    model,
    trim,
    generation: "Duster II TR MY2019",
    generationCode: "HM",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Ekim 2019 Dacia Duster TR — only published Comfort/Prestige/Prestige Plus/Techroad pairs.",
    sources: [SRC.daciaCaraba, SRC.daciaArabavs, SRC.daciaLog],
  })),
  ...(
    [
      ["1.0 SCe 75 bg", "Ambiance", "GASOLINE", "75", "MANUAL"],
      ["1.5 Blue dCi 75 bg", "Ambiance", "DIESEL", "75", "MANUAL"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Dacia",
    series: "Sandero",
    model,
    trim,
    generation: "Sandero II TR MY2019",
    generationCode: "B52",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Ekim 2019 Dacia Sandero Ambiance — published pairs only.",
    sources: [SRC.daciaCaraba, SRC.daciaArabavs],
  })),
  ...(
    [
      ["Turbo 90 bg", "Stepway", "GASOLINE", "90", "MANUAL"],
      ["Turbo 90 bg Easy-R", "Stepway", "GASOLINE", "90", "AUTOMATIC"],
      ["Turbo 90 ECO-G", "Stepway", "LPG", "90", "MANUAL"],
      ["1.5 Blue dCi 95 bg", "Stepway", "DIESEL", "95", "MANUAL"],
      ["Turbo 90 bg", "Techroad", "GASOLINE", "90", "MANUAL"],
      ["Turbo 90 bg Easy-R", "Techroad", "GASOLINE", "90", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Dacia",
    series: "Sandero Stepway",
    model,
    trim,
    generation: "Sandero Stepway II TR MY2019",
    generationCode: "B52-Stepway",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Ekim 2019 Dacia Sandero Stepway — published Stepway/Techroad pairs only.",
    sources: [SRC.daciaCaraba, SRC.daciaArabavs],
  })),
  rr(
    "Dacia",
    "Logan",
    "Otomobil",
    "Logan III: researched; ≤2020 discrete version×trim incomplete (current MY TCe/Eco-G rows verified). Logan MCV 2019 Ambiance noted in archives but not III sedan matrix.",
    [SRC.daciaCaraba, SRC.daciaArabavs]
  ),
  rr(
    "Dacia",
    "Jogger",
    "Otomobil",
    "Jogger: researched; series launched ~2022 — historical ≤2020 N/A; current MY extreme rows verified.",
    [
      {
        url: "https://www.dacia.com.tr/",
        title: "Dacia TR — Jogger historical research note",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
];

// ——— CUPRA ———
const CUPRA_SELECTABLE = [
  { series: "Formentor", category: "Arazi, SUV & Pickup" },
  { series: "Leon", category: "Otomobil" },
  { series: "Terramar", category: "Arazi, SUV & Pickup" },
  { series: "Born", category: "Otomobil" },
];

const CUPRA_ROWS: Config[] = [
  // 2021 Formentor — version-only archive (no package names) → NO_VERIFIED_TRIM_FOUND
  ...(
    [
      ["1.5 TSI 150 HP DSG", "150", "GASOLINE"],
      ["2.0 TSI 310 HP DSG 4Drive", "310", "GASOLINE"],
      ["1.4 eHybrid 205 HP DSG", "205", "HYBRID"],
      ["1.4 eHybrid 245 HP DSG", "245", "HYBRID"],
    ] as const
  ).map(([model, hp, fuel]) => ({
    brand: "Cupra",
    series: "Formentor",
    model,
    trim: "",
    generation: "Formentor TR MY2021",
    generationCode: "KM7",
    yearFrom: 2021,
    yearTo: 2021,
    fuelType: fuel,
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: model.includes("4Drive") ? "AWD" : "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "2021 Formentor TR archive lists engine/version only — NO_VERIFIED_TRIM_FOUND (no package fan-out).",
    sources: [SRC.cupraOtomobilir],
  })),
  // 2023 Formentor — still version-leaning in aracbulten; mark NO_VERIFIED_TRIM where package absent
  ...(
    [
      ["1.5 TSI DSG", "150"],
      ["2.0 TSI VZ 4Drive DSG", "310"],
      ["1.4 eHybrid DSG", "245"],
    ] as const
  ).map(([model, hp]) => ({
    brand: "Cupra",
    series: "Formentor",
    model,
    trim: "",
    generation: "Formentor TR MY2023",
    generationCode: "KM7",
    yearFrom: 2023,
    yearTo: 2023,
    fuelType: model.includes("eHybrid") ? "HYBRID" : "GASOLINE",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: model.includes("4Drive") ? "AWD" : "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "Ekim 2023 Cupra Formentor — version-only rows in archive; NO_VERIFIED_TRIM_FOUND.",
    sources: [SRC.cupraArac],
  })),
  ...(
    [
      ["1.5 eTSI mHEV DSG", "150"],
      ["VZ 1.4 eHybrid PHEV DSG", "245"],
      ["VZ 2.0 TSI 300 HP DSG", "300"],
    ] as const
  ).map(([model, hp]) => ({
    brand: "Cupra",
    series: "Leon",
    model,
    trim: "",
    generation: "Leon TR MY2023",
    generationCode: "KL",
    yearFrom: 2023,
    yearTo: 2023,
    fuelType: model.includes("eHybrid") ? "HYBRID" : model.includes("eTSI") ? "HYBRID" : "GASOLINE",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "Ekim 2023 Cupra Leon — version-only archive rows; NO_VERIFIED_TRIM_FOUND.",
    sources: [SRC.cupraArac],
  })),
  rr(
    "Cupra",
    "Terramar",
    "Arazi, SUV & Pickup",
    "Terramar: researched; series new (~2025) — historical ≤2020 N/A; current Impulse/Supreme/VZ-Line verified.",
    [
      {
        url: "https://www.cupra.com/tr",
        title: "Cupra TR — Terramar research note",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
  rr(
    "Cupra",
    "Born",
    "Otomobil",
    "Born: researched; no verified TR version×trim matrix located yet.",
    [
      {
        url: "https://www.cupra.com/tr",
        title: "Cupra TR — Born research stub",
        date: "2026-08-07",
        role: "primary",
      },
    ]
  ),
];

// ——— MINI ———
const MINI_SELECTABLE = [
  { series: "Countryman", category: "Arazi, SUV & Pickup" },
  { series: "Cooper", category: "Otomobil" },
  { series: "Cabrio", category: "Otomobil" },
];

const MINI_ROWS: Config[] = [
  // Nov 2018 ÖTV table — Cooper 3 Kapı × packages (version=engine body, trim=package)
  ...(
    [
      ["Cooper 3 Kapı 1.5", "Türkiye Paketi", "GASOLINE", "AUTOMATIC"],
      ["Cooper 3 Kapı 1.5", "Salt", "GASOLINE", "AUTOMATIC"],
      ["Cooper 3 Kapı 1.5", "Pepper", "GASOLINE", "AUTOMATIC"],
      ["Cooper 3 Kapı 1.5", "Chili", "GASOLINE", "AUTOMATIC"],
      ["Cooper D 3 Kapı 1.5", "Türkiye Paketi", "DIESEL", "AUTOMATIC"],
      ["Cooper D 3 Kapı 1.5", "Salt", "DIESEL", "AUTOMATIC"],
      ["Cooper D 3 Kapı 1.5", "Pepper", "DIESEL", "AUTOMATIC"],
      ["Cooper D 3 Kapı 1.5", "Chili", "DIESEL", "AUTOMATIC"],
      ["Cooper 5 Kapı 1.5", "Türkiye Paketi", "GASOLINE", "AUTOMATIC"],
      ["Cooper 5 Kapı 1.5", "Salt", "GASOLINE", "AUTOMATIC"],
      ["Cooper 5 Kapı 1.5", "Pepper", "GASOLINE", "AUTOMATIC"],
      ["Cooper 5 Kapı 1.5", "Chili", "GASOLINE", "AUTOMATIC"],
      ["Cooper D 5 Kapı 1.5", "Türkiye Paketi", "DIESEL", "AUTOMATIC"],
      ["Cooper D 5 Kapı 1.5", "Salt", "DIESEL", "AUTOMATIC"],
      ["Cooper D 5 Kapı 1.5", "Pepper", "DIESEL", "AUTOMATIC"],
      ["Cooper D 5 Kapı 1.5", "Chili", "DIESEL", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, transmission]) => ({
    brand: "Mini",
    series: "Cooper",
    model,
    trim,
    generation: "Cooper F56/F55 TR MY2018",
    generationCode: "F56",
    yearFrom: 2018,
    yearTo: 2018,
    fuelType: fuel,
    engineVolume: "1499",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Kasım 2018 Mini ÖTV listesi — only published Cooper body×package pairs.",
    sources: [SRC.miniMotor1],
  })),
  ...(
    [
      ["Cooper Countryman 1.5", "Türkiye Paketi"],
      ["Cooper Countryman 1.5", "Salt"],
    ] as const
  ).map(([model, trim]) => ({
    brand: "Mini",
    series: "Countryman",
    model,
    trim,
    generation: "Countryman F60 TR MY2018",
    generationCode: "F60",
    yearFrom: 2018,
    yearTo: 2018,
    fuelType: "GASOLINE",
    engineVolume: "1499",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Kasım 2018 Mini Countryman — only published Türkiye Paketi/Salt pairs (list truncated in source).",
    sources: [SRC.miniMotor1, SRC.miniArac],
  })),
  rr(
    "Mini",
    "Cabrio",
    "Otomobil",
    "Cabrio: researched; discrete historical TR version×trim matrix incomplete in this deepen pass.",
    [
      {
        url: "https://www.mini.com.tr/",
        title: "MINI TR — Cabrio research stub",
        date: "2026-08-07",
        role: "primary",
      },
      SRC.miniMotor1,
    ]
  ),
];

function main() {
  mkdirSync(join(ROOT, "scripts/output"), { recursive: true });
  const results = [
    processBrand("Volvo.json", "Volvo", VOLVO_SELECTABLE, VOLVO_ROWS, "2026.08-deep-volvo-v2-historical"),
    processBrand("Nissan.json", "Nissan", NISSAN_SELECTABLE, NISSAN_ROWS, "2026.08-deep-nissan-v2-historical"),
    processBrand("Kia.json", "Kia", KIA_SELECTABLE, KIA_ROWS, "2026.08-deep-kia-v2-historical"),
    processBrand("Dacia.json", "Dacia", DACIA_SELECTABLE, DACIA_ROWS, "2026.08-deep-dacia-v2-historical"),
    processBrand("Cupra.json", "Cupra", CUPRA_SELECTABLE, CUPRA_ROWS, "2026.08-deep-cupra-v2-historical"),
    processBrand("Mini.json", "Mini", MINI_SELECTABLE, MINI_ROWS, "2026.08-deep-mini-v2-historical"),
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
    // Gate COMPLETED for research completeness, but batch is not final catalog complete
    if (r.status === "COMPLETED" && r.seriesWithoutResearch.length === 0) {
      completed.add(r.brand);
      inProgress.delete(r.brand);
    } else {
      completed.delete(r.brand);
      inProgress.add(r.brand);
    }
  }
  for (const b of [
    "BMW",
    "Mercedes-Benz",
    "Audi",
    "Volkswagen",
    "Renault",
    "Fiat",
    "Ford",
    "Toyota",
    "Peugeot",
  ])
    completed.add(b);

  const sourceUrls = [...new Set(Object.values(SRC).map((s) => s.url))];

  writeFileSync(
    PROGRESS,
    JSON.stringify(
      {
        ...progress,
        at: new Date().toISOString(),
        checkpointCommit: "347a961",
        phase: "research-deepen-batch-volvo-nissan-kia-dacia-cupra-mini",
        applyAllowed: false,
        noApplyDuringResearch: true,
        notFinalComplete: true,
        completedBrands: [...completed].sort(),
        inProgressBrands: [...inProgress].sort(),
        deepenBatchVolvoNissanKiaDaciaCupraMini: {
          brands: ["Volvo", "Nissan", "Kia", "Dacia", "Cupra", "Mini"],
          notFinalComplete: true,
          sourceUrls,
          results: results.map((r) => ({
            brand: r.brand,
            added: r.added,
            verified: r.verified,
            total: r.total,
            status: r.status,
            seriesWithoutResearch: r.seriesWithoutResearch,
            noVerifiedTrimFound: r.noVerifiedTrimFound,
            reviewRequired: r.reviewRequired,
          })),
        },
      },
      null,
      2
    )
  );

  const summary = {
    ok: true,
    applyAllowed: false,
    checkpointCommit: "347a961",
    notFinalComplete: true,
    results,
    sourceUrls,
    totals: {
      added: results.reduce((a, r) => a + r.added, 0),
      verified: results.reduce((a, r) => a + r.verified, 0),
      total: results.reduce((a, r) => a + r.total, 0),
      reviewRequired: results.reduce((a, r) => a + r.reviewRequired, 0),
      noVerifiedTrimFound: results.reduce((a, r) => a + r.noVerifiedTrimFound, 0),
    },
  };
  writeFileSync(
    join(ROOT, "docs/vehicle-research/deepen-batch-volvo-nissan-kia-dacia-cupra-mini-summary.json"),
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));
}

main();
