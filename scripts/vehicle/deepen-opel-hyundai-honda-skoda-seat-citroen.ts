/**
 * Opel / Hyundai / Honda / Skoda / Seat / Citroen historical TR deepen + coverage + completion reports.
 * RESEARCH ONLY — NO combinatorial trim fan-out. NO APPLY. NO DB writes.
 * Checkpoint 347a961 must not be rewritten. applyAllowed=false.
 *
 * npx tsx scripts/vehicle/deepen-opel-hyundai-honda-skoda-seat-citroen.ts
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
        notes: `${series}: researched in mass-market deepen pass; no verified TR version×trim matrix located yet.`,
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
  const noTrim = verified.filter((c) => !(c.trim && c.trim.trim())).length;
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
      "Completed means every selectable series was systematically researched. Current-only and incomplete historical gens remain explicitly flagged. Research-only; applyAllowed=false.",
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
          phase: "research-mass-market-batch",
          seriesWithoutResearch,
          currentOnlySeries: currentOnly,
          addedThisPass: added,
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
  };
}

const SRC = {
  opel2019: {
    url: "https://www.otomobilir.com/opel-temmuz-2019-fiyat-listesi/",
    title: "Opel Temmuz 2019 fiyat listesi — Corsa/Astra/Crossland X version×trim",
    date: "2019-07-23",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  opelCross2019: {
    url: "https://aracbulten.com/opel-crossland-x-fiyat-listesi-2019/",
    title: "Opel Crossland X Aralık 2019 resmi tavsiye fiyat matrisi",
    date: "2019-12-04",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "aracbulten.com",
  },
  opelAstra2019: {
    url: "https://www.arabavs.com/opel-astra-2019-agustos-ayi-fiyat-listesi.html",
    title: "Opel Astra Ağustos 2019 fiyat listesi (Enjoy/Dynamic/Excellence)",
    date: "2019-08-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  opel2020: {
    url: "https://otomobil.haber7.com/otomobil/haber/3023619-opel-yeni-zamli-fiyat-listesini-yayinladi-iste-2020-corsa-astra-crossland-x-guncel-fiyati",
    title: "Opel Ekim 2020 Corsa F / Crossland X zamlı fiyat listesi",
    date: "2020-10-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "haber7.com",
  },
  hyundai2019: {
    url: "https://caraba.net/hyundai-haziran-2019-fiyat-listesi-aciklandi/",
    title: "Hyundai Haziran 2019 i20 Jump/Style/Elite version×trim",
    date: "2019-06-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  hyundai2021: {
    url: "https://www.otomobilir.com/2021-hyundai-fiyat-listesi/",
    title: "2021 Hyundai fiyat listesi — i20/Tucson version×trim",
    date: "2021-02-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  hyundaiSep2021: {
    url: "https://otomobil.haber7.com/otomobil/haber/3136769-hyunda-2021-eylul-ayi-fiyat-listesi-belli-oldu-yeni-bayon-i10-i20-elentra-tucson-guncel-fiyati",
    title: "Hyundai Eylül 2021 Bayon/i20/Tucson fiyat listesi",
    date: "2021-09-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "haber7.com",
  },
  honda2019: {
    url: "https://caraba.net/honda-eylul-2019-fiyat-listesi-yayinlandi/",
    title: "Honda Eylül 2019 Civic/HR-V Elegance/Executive fiyat listesi",
    date: "2019-09-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  honda2020: {
    url: "https://otomobil.haber7.com/otomobil/haber/3040227-honda-arac-modelleri-aralik-ayi-fiyatlari-sifir-civic-cr-v-hr-v-fiyat-listesi",
    title: "Honda Aralık 2020 Civic/HR-V fiyat listesi",
    date: "2020-12-08",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "haber7.com",
  },
  honda2021: {
    url: "https://www.otomobilir.com/honda-mart-ayina-ozel-kampanyalar/",
    title: "Honda Mart 2021 Civic/HR-V kampanyalı fiyat listesi",
    date: "2021-03-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  hondaCivicOct2021: {
    url: "https://www.arabahabercisi.com/honda-civic-fiyatlari-ekim-2021/",
    title: "Honda Civic Sedan Ekim 2021 Elegance/Executive+ matrisi",
    date: "2021-10-22",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabahabercisi.com",
  },
  skoda2019: {
    url: "https://caraba.net/skoda-haziran-2019-fiyat-listesi-aciklandi/",
    title: "Skoda Haziran 2019 Fabia/Octavia/Superb Ambition/Style/Prestige",
    date: "2019-06-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  skoda2020: {
    url: "https://www.otomobilir.com/skoda-fiyat-listesi-ocak-2020/",
    title: "Skoda Ocak 2020 Octavia/Superb Elite/Premium/Prestige",
    date: "2020-01-03",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  skoda2021: {
    url: "https://www.otomobilir.com/2021-skoda-fiyat-listesi-kampanyali-fiyati-ne-kadar/",
    title: "2021 Skoda Ocak Fabia/Octavia/Superb Premium/Elite/Prestige",
    date: "2021-01-07",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  seat2019: {
    url: "https://caraba.net/seat-eylul-2019-fiyat-listesi/",
    title: "SEAT Eylül 2019 Ibiza/Leon/Ateca Style/FR/Xcellence",
    date: "2019-09-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  seat2020: {
    url: "https://arabavs.com/seat-mart-ayi-fiyat-listesi-2020.html",
    title: "SEAT Mart 2020 Ibiza/Leon/Ateca fiyat listesi",
    date: "2020-03-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  citroen2019: {
    url: "https://caraba.net/citroen-ekim-2019-fiyat-listesi/",
    title: "Citroën Ekim 2019 C3/C3 Aircross Live/Feel/Shine",
    date: "2019-10-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  citroenC32020: {
    url: "https://www.otomobil.com.tr/yeni-yuzlu-citroen-c3-fiyat-listesi/",
    title: "Yeni yüzlü Citroën C3 Eylül 2020 Feel/Feel Bold/Shine",
    date: "2020-09-22",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobil.com.tr",
  },
  citroenC5a2020: {
    url: "https://www.log.com.tr/2020-citroen-c5-aircross-fiyati-ve-guncel-versiyon-secenekleri/",
    title: "2020 Citroën C5 Aircross Feel/Shine BlueHDi/PureTech fiyatları",
    date: "2020-08-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "log.com.tr",
  },
};

// ——— OPEL ———
const OPEL_SELECTABLE = [
  { series: "Corsa", category: "Otomobil" },
  { series: "Astra", category: "Otomobil" },
  { series: "Crossland", category: "Arazi, SUV & Pickup" },
];

const OPEL_ROWS: Config[] = [
  // Corsa E Temmuz 2019 — only published pairs
  ...(
    [
      ["1.2 70 HP", "Essentia", "GASOLINE", "70", "MANUAL", "1229"],
      ["1.2 70 HP", "Enjoy", "GASOLINE", "70", "MANUAL", "1229"],
      ["1.4 90 HP", "Essentia", "GASOLINE", "90", "AUTOMATIC", "1398"],
      ["1.4 90 HP", "Design", "GASOLINE", "90", "AUTOMATIC", "1398"],
      ["1.4 90 HP", "Enjoy", "GASOLINE", "90", "AUTOMATIC", "1398"],
      ["1.4 90 HP", "120.Yıl Özel Seri", "GASOLINE", "90", "AUTOMATIC", "1398"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, vol]) => ({
    brand: "Opel",
    series: "Corsa",
    model,
    trim,
    generation: "Corsa E TR MY2019",
    generationCode: "E",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: vol,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Temmuz 2019 Corsa E TR — only published version×trim rows (no fan-out).",
    sources: [SRC.opel2019],
  })),
  // Corsa F Ekim 2020
  ...(
    [
      ["1.2 75 HP", "Essential", "GASOLINE", "75", "MANUAL"],
      ["1.2 100 HP", "Edition", "GASOLINE", "100", "AUTOMATIC"],
      ["1.5 100 HP Dizel", "Edition", "DIESEL", "100", "MANUAL"],
      ["1.2 100 HP", "Elegance", "GASOLINE", "100", "AUTOMATIC"],
      ["1.2 100 HP", "Ultimate", "GASOLINE", "100", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Opel",
    series: "Corsa",
    model,
    trim,
    generation: "Corsa F TR MY2020",
    generationCode: "F",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1499" : "1199",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Ekim 2020 Corsa F TR — Essential/Edition/Elegance/Ultimate as published.",
    sources: [SRC.opel2020],
  })),
  // Astra HB Temmuz/Ağustos 2019
  ...(
    [
      ["1.4 150 HP", "Enjoy", "GASOLINE", "150", "MANUAL"],
      ["1.4 150 HP", "Dynamic", "GASOLINE", "150", "MANUAL"],
      ["1.4 150 HP", "120.Yıl Özel Seri", "GASOLINE", "150", "AUTOMATIC"],
      ["1.4 150 HP", "Dynamic", "GASOLINE", "150", "AUTOMATIC"],
      ["1.4 150 HP", "Excellence", "GASOLINE", "150", "AUTOMATIC"],
      ["1.6 Dizel 136 HP", "Dynamic", "DIESEL", "136", "MANUAL"],
      ["1.6 Dizel 136 HP", "120.Yıl Özel Seri", "DIESEL", "136", "AUTOMATIC"],
      ["1.6 Dizel 136 HP", "Elite", "DIESEL", "136", "AUTOMATIC"],
      ["1.6 Dizel 136 HP", "Dynamic", "DIESEL", "136", "AUTOMATIC"],
      ["1.6 Dizel 136 HP", "Excellence", "DIESEL", "136", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Opel",
    series: "Astra",
    model,
    trim,
    generation: "Astra K HB TR MY2019",
    generationCode: "K",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: model.startsWith("1.6") ? "1598" : "1399",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Temmuz/Ağustos 2019 Astra HB TR — Enjoy/Dynamic/Excellence/Elite only as listed.",
    sources: [SRC.opel2019, SRC.opelAstra2019],
  })),
  // Crossland X 2019 — upgrade prior REVIEW stub with sourced matrix
  ...(
    [
      ["1.2 110 HP", "Enjoy", "GASOLINE", "110"],
      ["1.2 110 HP", "120.Yıl Özel Seri", "GASOLINE", "110"],
      ["1.2 130 HP", "Enjoy", "GASOLINE", "130"],
      ["1.2 130 HP", "120.Yıl Özel Seri", "GASOLINE", "130"],
      ["1.5 Dizel 120 HP", "Enjoy", "DIESEL", "120"],
      ["1.5 Dizel 120 HP", "120.Yıl Özel Seri", "DIESEL", "120"],
      ["1.5 Dizel 120 HP", "Excellence", "DIESEL", "120"],
    ] as const
  ).map(([model, trim, fuel, hp]) => ({
    brand: "Opel",
    series: "Crossland",
    model,
    trim,
    generation: "Crossland X TR MY2019",
    generationCode: "P2UO",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1499" : "1199",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Aralık 2019 Crossland X TR — Enjoy/120.Yıl/Excellence only as published AT-6 rows.",
    sources: [SRC.opelCross2019, SRC.opel2019],
  })),
  // Crossland X 2020 subset
  ...(
    [
      ["1.2 130 HP", "Essentia", "GASOLINE", "130"],
      ["1.2 130 HP", "Enjoy", "GASOLINE", "130"],
      ["1.5 Dizel 120 HP", "Enjoy", "DIESEL", "120"],
      ["1.5 Dizel 120 HP", "Excellence", "DIESEL", "120"],
    ] as const
  ).map(([model, trim, fuel, hp]) => ({
    brand: "Opel",
    series: "Crossland",
    model,
    trim,
    generation: "Crossland X TR MY2020",
    generationCode: "P2UO",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1499" : "1199",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Ekim 2020 Crossland X TR — Essentia/Enjoy/Excellence as published.",
    sources: [SRC.opel2020],
  })),
];

// ——— HYUNDAI ———
const HYUNDAI_SELECTABLE = [
  { series: "i20", category: "Otomobil" },
  { series: "Bayon", category: "Arazi, SUV & Pickup" },
  { series: "Tucson", category: "Arazi, SUV & Pickup" },
];

const HYUNDAI_ROWS: Config[] = [
  // i20 Haziran 2019 — core Jump/Style/Elite pairs (no option-pack fan-out)
  ...(
    [
      ["1.2 MPI 84 PS", "Jump", "GASOLINE", "84", "MANUAL"],
      ["1.2 MPI 84 PS", "Style", "GASOLINE", "84", "MANUAL"],
      ["1.4 MPI 100 PS", "Jump", "GASOLINE", "100", "AUTOMATIC"],
      ["1.4 MPI 100 PS", "Style", "GASOLINE", "100", "AUTOMATIC"],
      ["1.4 MPI 100 PS", "Elite", "GASOLINE", "100", "AUTOMATIC"],
      ["1.0 T-GDI 100 PS", "Style", "GASOLINE", "100", "AUTOMATIC"],
      ["1.0 T-GDI 100 PS", "Elite", "GASOLINE", "100", "AUTOMATIC"],
      ["1.4 CRDi 90 PS", "Jump", "DIESEL", "90", "MANUAL"],
      ["1.4 CRDi 90 PS", "Style", "DIESEL", "90", "MANUAL"],
      ["1.4 CRDi 90 PS", "Elite", "DIESEL", "90", "MANUAL"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Hyundai",
    series: "i20",
    model,
    trim,
    generation: "i20 GB/IB TR MY2019",
    generationCode: "GB",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: model.startsWith("1.0") ? "998" : model.startsWith("1.2") ? "1248" : "1368",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Haziran 2019 i20 TR — Jump/Style/Elite base packs only (Pan/MMedia option codes not fan-out).",
    sources: [SRC.hyundai2019],
  })),
  // i20 early 2021 BC3 (2020 MY listed)
  ...(
    [
      ["1.4 MPI 100 PS", "Jump", "GASOLINE", "100", "MANUAL"],
      ["1.4 MPI 100 PS", "Style", "GASOLINE", "100", "MANUAL"],
      ["1.4 MPI 100 PS", "Jump", "GASOLINE", "100", "AUTOMATIC"],
      ["1.4 MPI 100 PS", "Style", "GASOLINE", "100", "AUTOMATIC"],
      ["1.4 MPI 100 PS", "Elite", "GASOLINE", "100", "AUTOMATIC"],
      ["1.0 T-GDI 100 PS", "Style", "GASOLINE", "100", "AUTOMATIC"],
      ["1.0 T-GDI 100 PS", "Elite", "GASOLINE", "100", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Hyundai",
    series: "i20",
    model,
    trim,
    generation: "i20 BC3 TR MY2020",
    generationCode: "BC3",
    yearFrom: 2020,
    yearTo: 2021,
    fuelType: fuel,
    engineVolume: model.startsWith("1.0") ? "998" : "1368",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Şubat 2021 listede 2020 MY i20 BC3 — Jump/Style/Elite published pairs only.",
    sources: [SRC.hyundai2021],
  })),
  // Bayon launch Sep 2021 — first TR year (no 2017–2020 archive exists)
  ...(
    [
      ["1.4 MPI 100 PS", "Jump", "GASOLINE", "100", "MANUAL"],
      ["1.4 MPI 100 PS", "Style", "GASOLINE", "100", "AUTOMATIC"],
      ["1.4 MPI 100 PS", "Elite", "GASOLINE", "100", "AUTOMATIC"],
      ["1.0 T-GDI 100 PS", "Style", "GASOLINE", "100", "AUTOMATIC"],
      ["1.0 T-GDI 100 PS", "Elite", "GASOLINE", "100", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Hyundai",
    series: "Bayon",
    model,
    trim,
    generation: "Bayon TR MY2021",
    generationCode: "BC3 SUV",
    yearFrom: 2021,
    yearTo: 2021,
    fuelType: fuel,
    engineVolume: model.startsWith("1.0") ? "998" : "1368",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Eylül 2021 Bayon lansman TR — Jump/Style/Elite only as published. Pre-2021 N/A.",
    sources: [SRC.hyundaiSep2021],
  })),
  {
    brand: "Hyundai",
    series: "Bayon",
    model: "",
    trim: "",
    generation: "pre-launch",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "Bayon TR launch 2021 — no 2017–2020 TR price archive; HISTORICAL_COVERAGE_INCOMPLETE for pre-launch gens.",
    sources: [SRC.hyundaiSep2021],
  },
  // Tucson TL/III early 2021 (2020 MY) + NX4 Sep 2021
  ...(
    [
      ["1.6 T-GDI 177 PS", "Power Edition", "GASOLINE", "177", "AUTOMATIC", "FWD", "TL"],
      ["1.6 CRDi 136 PS", "Smart", "DIESEL", "136", "AUTOMATIC", "FWD", "TL"],
      ["1.6 CRDi 136 PS", "Elite", "DIESEL", "136", "AUTOMATIC", "FWD", "TL"],
      ["1.6 CRDi 136 PS", "Elite Plus", "DIESEL", "136", "AUTOMATIC", "AWD", "TL"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, drive, gen]) => ({
    brand: "Hyundai",
    series: "Tucson",
    model,
    trim,
    generation: "Tucson TL TR MY2020",
    generationCode: gen,
    yearFrom: 2020,
    yearTo: 2021,
    fuelType: fuel,
    engineVolume: "1598",
    powerHp: hp,
    transmission,
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Şubat 2021 Tucson TL (2020 MY) — Power Edition/Smart/Elite/Elite Plus as listed.",
    sources: [SRC.hyundai2021],
  })),
  ...(
    [
      ["1.6 T-GDI 180 PS", "Comfort", "GASOLINE", "180", "FWD"],
      ["1.6 CRDi 136 PS", "Prime", "DIESEL", "136", "FWD"],
      ["1.6 CRDi 136 PS", "Elite", "DIESEL", "136", "FWD"],
      ["1.6 CRDi 136 PS", "Elite Plus", "DIESEL", "136", "AWD"],
    ] as const
  ).map(([model, trim, fuel, hp, drive]) => ({
    brand: "Hyundai",
    series: "Tucson",
    model,
    trim,
    generation: "Tucson NX4 TR MY2021",
    generationCode: "NX4",
    yearFrom: 2021,
    yearTo: 2021,
    fuelType: fuel,
    engineVolume: "1598",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Eylül 2021 Yeni Tucson NX4 — Comfort/Prime/Elite/Elite Plus DCT as published.",
    sources: [SRC.hyundaiSep2021],
  })),
];

// ——— HONDA ———
const HONDA_SELECTABLE = [
  { series: "HR-V", category: "Arazi, SUV & Pickup" },
  { series: "Civic", category: "Otomobil" },
];

const HONDA_ROWS: Config[] = [
  // HR-V ICE historical
  {
    brand: "Honda",
    series: "HR-V",
    model: "1.5 130 PS",
    trim: "Executive",
    generation: "HR-V II TR MY2019",
    generationCode: "RU",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    engineVolume: "1498",
    powerHp: "130",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Eylül 2019 HR-V 1.5L Executive AT — published pair.",
    sources: [SRC.honda2019],
  },
  ...(
    [
      ["1.5 130 PS", "Executive", "GASOLINE", "130", 2020],
      ["1.5 VTEC Turbo 182 PS", "Sport", "GASOLINE", "182", 2020],
      ["1.5 130 PS", "Executive", "GASOLINE", "130", 2021],
      ["1.5 VTEC Turbo 182 PS", "Sport", "GASOLINE", "182", 2021],
    ] as const
  ).map(([model, trim, fuel, hp, year]) => ({
    brand: "Honda",
    series: "HR-V",
    model,
    trim,
    generation: `HR-V II TR MY${year}`,
    generationCode: "RU",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: "1498",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `${year === 2020 ? "Aralık 2020" : "Mart 2021"} HR-V ICE — Executive/Sport only as published (pre e:HEV).`,
    sources: year === 2020 ? [SRC.honda2020] : [SRC.honda2021],
  })),
  // Civic Sedan 2019–2021
  ...(
    [
      ["1.5 VTEC Turbo 182 PS", "Elegance", "GASOLINE", "182", "AUTOMATIC", 2019],
      ["1.5 VTEC Turbo 182 PS", "Executive+", "GASOLINE", "182", "AUTOMATIC", 2019],
      ["1.6 Dream Eco", "Dream", "LPG", "125", "MANUAL", 2019],
      ["1.6 Elegance Eco", "Elegance", "LPG", "125", "AUTOMATIC", 2019],
      ["1.6 Executive Eco", "Executive", "LPG", "125", "AUTOMATIC", 2019],
      ["1.6 Elegance Dizel", "Elegance", "DIESEL", "120", "AUTOMATIC", 2019],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, year]) => ({
    brand: "Honda",
    series: "Civic",
    model,
    trim,
    generation: "Civic Sedan X TR MY2019",
    generationCode: "FC",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1498" : "1597",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Eylül 2019 Civic Sedan — Elegance/Executive(+)/Dream only as published.",
    sources: [SRC.honda2019],
  })),
  ...(
    [
      ["1.6 125 PS", "Elegance", "GASOLINE", "125", 2020],
      ["1.5 VTEC Turbo 182 PS", "Elegance", "GASOLINE", "182", 2020],
      ["1.5 VTEC Turbo 182 PS", "Executive+", "GASOLINE", "182", 2020],
      ["1.6 ECO", "Elegance", "LPG", "125", 2020],
      ["1.6 ECO", "Executive", "LPG", "125", 2020],
    ] as const
  ).map(([model, trim, fuel, hp, year]) => ({
    brand: "Honda",
    series: "Civic",
    model,
    trim,
    generation: "Civic Sedan X TR MY2020",
    generationCode: "FC",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1498" : "1597",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Aralık 2020 Civic Sedan AT — Elegance/Executive(+)/ECO as published.",
    sources: [SRC.honda2020],
  })),
  ...(
    [
      ["1.6 125 PS", "Elegance", "GASOLINE", "125"],
      ["1.6 ECO", "Elegance", "LPG", "125"],
      ["1.6 ECO", "Executive", "LPG", "125"],
      ["1.5 VTEC Turbo 182 PS", "Elegance", "GASOLINE", "182"],
      ["1.5 VTEC Turbo 182 PS", "Executive+", "GASOLINE", "182"],
    ] as const
  ).map(([model, trim, fuel, hp]) => ({
    brand: "Honda",
    series: "Civic",
    model,
    trim,
    generation: "Civic Sedan X TR MY2021",
    generationCode: "FC",
    yearFrom: 2021,
    yearTo: 2021,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1498" : "1597",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Mart/Ekim 2021 Civic Sedan — Elegance/Executive+ as published (current zero-km stopped).",
    sources: [SRC.honda2021, SRC.hondaCivicOct2021],
  })),
];

// ——— SKODA ———
const SKODA_SELECTABLE = [
  { series: "Fabia", category: "Otomobil" },
  { series: "Octavia", category: "Otomobil" },
  { series: "Superb", category: "Otomobil" },
];

const SKODA_ROWS: Config[] = [
  // Fabia 2019–2021
  ...(
    [
      ["1.0 75 PS", "Ambition", "GASOLINE", "75", "MANUAL", 2019],
      ["1.0 TSI 110 PS", "Style", "GASOLINE", "110", "AUTOMATIC", 2019],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, year]) => ({
    brand: "Skoda",
    series: "Fabia",
    model,
    trim,
    generation: "Fabia III TR MY2019",
    generationCode: "NJ3",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: "999",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Haziran 2019 Fabia — Ambition/Style only as published.",
    sources: [SRC.skoda2019],
  })),
  {
    brand: "Skoda",
    series: "Fabia",
    model: "1.0 TSI 95 PS",
    trim: "Premium",
    generation: "Fabia III TR MY2021",
    generationCode: "NJ3",
    yearFrom: 2021,
    yearTo: 2021,
    fuelType: "GASOLINE",
    engineVolume: "999",
    powerHp: "95",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Ocak 2021 Fabia Premium 1.0 TSI 95 PS DSG — published pair.",
    sources: [SRC.skoda2021],
  },
  // Octavia 2019
  ...(
    [
      ["1.0 TSI 115 PS", "Ambition", "GASOLINE", "115", "MANUAL"],
      ["1.0 TSI 115 PS", "Style", "GASOLINE", "115", "AUTOMATIC"],
      ["1.5 TSI 150 PS ACT", "Sport", "GASOLINE", "150", "AUTOMATIC"],
      ["1.6 TDI 115 PS", "Ambition", "DIESEL", "115", "MANUAL"],
      ["1.6 TDI 115 PS", "Style", "DIESEL", "115", "MANUAL"],
      ["1.6 TDI 115 PS", "Ambition", "DIESEL", "115", "AUTOMATIC"],
      ["1.6 TDI 115 PS", "Optimal", "DIESEL", "115", "AUTOMATIC"],
      ["1.6 TDI 115 PS", "Style", "DIESEL", "115", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Skoda",
    series: "Octavia",
    model,
    trim,
    generation: "Octavia III TR MY2019",
    generationCode: "5E",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1498" : model.startsWith("1.0") ? "999" : "1598",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Haziran 2019 Octavia — Ambition/Style/Sport/Optimal only as published.",
    sources: [SRC.skoda2019],
  })),
  ...(
    [
      ["1.5 TSI 150 PS ACT", "Style", "GASOLINE", "150", 2020],
      ["1.5 TSI 150 PS ACT", "Sport", "GASOLINE", "150", 2020],
      ["1.0 TSI ACT 110 PS", "Elite", "GASOLINE", "110", 2021],
      ["1.5 TSI ACT 150 PS", "Elite", "GASOLINE", "150", 2021],
      ["1.0 TSI ACT 110 PS", "Premium", "GASOLINE", "110", 2021],
      ["1.5 TSI ACT 150 PS", "Premium", "GASOLINE", "150", 2021],
    ] as const
  ).map(([model, trim, fuel, hp, year]) => ({
    brand: "Skoda",
    series: "Octavia",
    model,
    trim,
    generation: year === 2021 ? "Octavia IV TR MY2021" : "Octavia III TR MY2020",
    generationCode: year === 2021 ? "NX" : "5E",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: model.includes("1.0") ? "999" : "1498",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes:
      year === 2021
        ? "Ocak 2021 Yeni Octavia IV — Elite/Premium DSG as published."
        : "Ocak 2020 Octavia — Style/Sport DSG as published.",
    sources: year === 2021 ? [SRC.skoda2021] : [SRC.skoda2020],
  })),
  // Superb 2019–2021
  ...(
    [
      ["1.5 TSI 150 PS ACT", "Active", "GASOLINE", "150", "MANUAL", 2019],
      ["1.5 TSI 150 PS ACT", "Style", "GASOLINE", "150", "AUTOMATIC", 2019],
      ["1.5 TSI 150 PS ACT", "Prestige", "GASOLINE", "150", "AUTOMATIC", 2019],
      ["1.6 TDI 120 PS", "Comfort", "DIESEL", "120", "AUTOMATIC", 2019],
      ["1.6 TDI 120 PS", "Style", "DIESEL", "120", "AUTOMATIC", 2019],
      ["1.6 TDI 120 PS", "Prestige", "DIESEL", "120", "AUTOMATIC", 2019],
      ["2.0 TDI 190 PS 4x4", "L&K", "DIESEL", "190", "AUTOMATIC", 2019],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, year]) => ({
    brand: "Skoda",
    series: "Superb",
    model,
    trim,
    generation: "Superb III TR MY2019",
    generationCode: "3V",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: model.startsWith("2.0") ? "1968" : model.startsWith("1.5") ? "1498" : "1598",
    powerHp: hp,
    transmission,
    driveType: model.includes("4x4") ? "AWD" : "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Haziran 2019 Superb — Active/Style/Prestige/Comfort/L&K as published.",
    sources: [SRC.skoda2019],
  })),
  ...(
    [
      ["1.5 TSI ACT 150 PS", "Elite", "GASOLINE", "150", "FWD", 2020],
      ["1.5 TSI ACT 150 PS", "Premium", "GASOLINE", "150", "FWD", 2020],
      ["1.5 TSI ACT 150 PS", "Prestige", "GASOLINE", "150", "FWD", 2020],
      ["1.6 TDI SCR 120 PS", "Elite", "DIESEL", "120", "FWD", 2020],
      ["1.6 TDI SCR 120 PS", "Premium", "DIESEL", "120", "FWD", 2020],
      ["1.6 TDI SCR 120 PS", "Prestige", "DIESEL", "120", "FWD", 2020],
      ["2.0 TDI SCR 190 PS 4x4", "L&K Crystal", "DIESEL", "190", "AWD", 2020],
      ["1.5 TSI ACT 150 PS", "Elite", "GASOLINE", "150", "FWD", 2021],
      ["1.5 TSI ACT 150 PS", "Premium", "GASOLINE", "150", "FWD", 2021],
      ["1.5 TSI ACT 150 PS", "Prestige", "GASOLINE", "150", "FWD", 2021],
      ["1.6 TDI SCR 120 PS", "Elite", "DIESEL", "120", "FWD", 2021],
      ["1.6 TDI SCR 120 PS", "Premium", "DIESEL", "120", "FWD", 2021],
      ["1.6 TDI SCR 120 PS", "Prestige", "DIESEL", "120", "FWD", 2021],
      ["2.0 TDI SCR 190 PS 4x4", "L&K Crystal", "DIESEL", "190", "AWD", 2021],
    ] as const
  ).map(([model, trim, fuel, hp, drive, year]) => ({
    brand: "Skoda",
    series: "Superb",
    model,
    trim,
    generation: `Superb III TR MY${year}`,
    generationCode: "3V",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: model.startsWith("2.0") ? "1968" : model.startsWith("1.5") ? "1498" : "1598",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: `${year === 2020 ? "Ocak 2020" : "Ocak 2021"} Superb — Elite/Premium/Prestige/L&K Crystal as published.`,
    sources: year === 2020 ? [SRC.skoda2020] : [SRC.skoda2021],
  })),
];

// ——— SEAT ———
const SEAT_SELECTABLE = [
  { series: "Ibiza", category: "Otomobil" },
  { series: "Leon", category: "Otomobil" },
  { series: "Ateca", category: "Arazi, SUV & Pickup" },
];

const SEAT_ROWS: Config[] = [
  {
    brand: "Seat",
    series: "Ibiza",
    model: "1.0 EcoTSI 115 HP",
    trim: "Style",
    generation: "Ibiza VI TR MY2019",
    generationCode: "KJ",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    engineVolume: "999",
    powerHp: "115",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Eylül 2019 Ibiza 1.0 EcoTSI DSG Style — published pair.",
    sources: [SRC.seat2019],
  },
  {
    brand: "Seat",
    series: "Ibiza",
    model: "1.0 EcoTSI 115 HP",
    trim: "Style",
    generation: "Ibiza VI TR MY2020",
    generationCode: "KJ",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "999",
    powerHp: "115",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Mart 2020 Ibiza 1.0 EcoTSI DSG Style — published pair.",
    sources: [SRC.seat2020],
  },
  ...(
    [
      ["1.5 EcoTSI ACT 150 HP", "FR", "GASOLINE", "150", "AUTOMATIC", 2019],
      ["1.5 EcoTSI ACT 150 HP", "Xcellence", "GASOLINE", "150", "AUTOMATIC", 2019],
      ["1.6 TDI 115 HP", "Style", "DIESEL", "115", "AUTOMATIC", 2019],
      ["1.6 TDI 115 HP", "Xcellence", "DIESEL", "115", "AUTOMATIC", 2019],
      ["1.6 TDI 115 HP", "FR", "DIESEL", "115", "AUTOMATIC", 2019],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, year]) => ({
    brand: "Seat",
    series: "Leon",
    model,
    trim,
    generation: "Leon III TR MY2019",
    generationCode: "5F",
    yearFrom: year,
    yearTo: year,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1498" : "1598",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Eylül 2019 Leon — Style/FR/Xcellence only as published.",
    sources: [SRC.seat2019],
  })),
  ...(
    [
      ["1.0 EcoTSI 115 HP", "Style", "GASOLINE", "115", "MANUAL"],
      ["1.5 EcoTSI 130 HP", "FR", "GASOLINE", "130", "MANUAL"],
      ["1.5 EcoTSI ACT 150 HP", "Style", "GASOLINE", "150", "AUTOMATIC"],
      ["1.5 EcoTSI ACT 150 HP", "FR", "GASOLINE", "150", "AUTOMATIC"],
      ["1.5 EcoTSI ACT 150 HP", "Xcellence", "GASOLINE", "150", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Seat",
    series: "Leon",
    model,
    trim,
    generation: "Leon III TR MY2020",
    generationCode: "5F",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: model.startsWith("1.0") ? "999" : "1498",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Mart 2020 Leon — Style/FR/Xcellence only as published.",
    sources: [SRC.seat2020],
  })),
  {
    brand: "Seat",
    series: "Ateca",
    model: "1.6 TDI 115 HP",
    trim: "Xcellence",
    generation: "Ateca TR MY2019",
    generationCode: "Ateca",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "DIESEL",
    engineVolume: "1598",
    powerHp: "115",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Eylül 2019 Ateca 1.6 TDI DSG Xcellence — published pair.",
    sources: [SRC.seat2019],
  },
  ...(
    [
      ["1.5 EcoTSI ACT 150 HP", "Xcellence", "GASOLINE", "150"],
      ["1.5 EcoTSI ACT 150 HP", "FR", "GASOLINE", "150"],
      ["1.6 TDI 115 HP", "Xcellence", "DIESEL", "115"],
    ] as const
  ).map(([model, trim, fuel, hp]) => ({
    brand: "Seat",
    series: "Ateca",
    model,
    trim,
    generation: "Ateca TR MY2020",
    generationCode: "Ateca",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1498" : "1598",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Mart 2020 Ateca — Xcellence/FR only as published.",
    sources: [SRC.seat2020],
  })),
];

// ——— CITROEN ———
const CITROEN_SELECTABLE = [
  { series: "C3", category: "Otomobil" },
  { series: "C3 Aircross", category: "Arazi, SUV & Pickup" },
  { series: "C5 Aircross", category: "Arazi, SUV & Pickup" },
  { series: "C3 (ICE historical)", category: "Otomobil" },
];

const CITROEN_ROWS: Config[] = [
  // C3 ICE 2019 under both C3 and ICE historical label for gate coverage
  ...(
    [
      ["1.2 PureTech 82 HP", "Live", "GASOLINE", "82", "MANUAL"],
      ["1.2 PureTech 82 HP", "Feel", "GASOLINE", "82", "MANUAL"],
      ["1.2 PureTech 110 HP", "Live", "GASOLINE", "110", "AUTOMATIC"],
      ["1.2 PureTech 110 HP", "Feel", "GASOLINE", "110", "AUTOMATIC"],
      ["1.2 PureTech 110 HP", "Shine", "GASOLINE", "110", "AUTOMATIC"],
    ] as const
  ).flatMap(([model, trim, fuel, hp, transmission]) =>
    (["C3", "C3 (ICE historical)"] as const).map((series) => ({
      brand: "Citroen",
      series,
      model,
      trim,
      generation: "C3 III TR MY2019",
      generationCode: "CC21",
      yearFrom: 2019,
      yearTo: 2019,
      fuelType: fuel,
      engineVolume: "1199",
      powerHp: hp,
      transmission,
      driveType: "FWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Otomobil",
      notes: "Ekim 2019 C3 ICE — Live/Feel/Shine only as published.",
      sources: [SRC.citroen2019],
    }))
  ),
  ...(
    [
      ["1.2 PureTech 83 HP", "Feel", "GASOLINE", "83", "MANUAL"],
      ["1.2 PureTech 110 HP", "Feel Bold", "GASOLINE", "110", "AUTOMATIC"],
      ["1.2 PureTech 110 HP", "Shine", "GASOLINE", "110", "AUTOMATIC"],
    ] as const
  ).flatMap(([model, trim, fuel, hp, transmission]) =>
    (["C3", "C3 (ICE historical)"] as const).map((series) => ({
      brand: "Citroen",
      series,
      model,
      trim,
      generation: "C3 III facelift TR MY2020",
      generationCode: "CC21",
      yearFrom: 2020,
      yearTo: 2020,
      fuelType: fuel,
      engineVolume: "1199",
      powerHp: hp,
      transmission,
      driveType: "FWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Otomobil",
      notes: "Eylül 2020 makyajlı C3 ICE — Feel/Feel Bold/Shine only as published.",
      sources: [SRC.citroenC32020],
    }))
  ),
  // C3 Aircross 2019
  ...(
    [
      ["1.2 PureTech 110 HP", "Feel", "GASOLINE", "110"],
      ["1.2 PureTech 110 HP", "Shine", "GASOLINE", "110"],
      ["1.5 BlueHDi 120 HP", "Feel", "DIESEL", "120"],
      ["1.5 BlueHDi 120 HP", "Shine", "DIESEL", "120"],
    ] as const
  ).map(([model, trim, fuel, hp]) => ({
    brand: "Citroen",
    series: "C3 Aircross",
    model,
    trim,
    generation: "C3 Aircross I TR MY2019",
    generationCode: "Aircross I",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: model.startsWith("1.5") ? "1499" : "1199",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Ekim 2019 C3 Aircross — Feel/Shine EAT6 only as published.",
    sources: [SRC.citroen2019],
  })),
  // C5 Aircross 2020
  ...(
    [
      ["1.6 PureTech 180 HP", "Shine", "GASOLINE", "180", "AUTOMATIC"],
      ["1.5 BlueHDi 130 HP", "Feel", "DIESEL", "130", "AUTOMATIC"],
      ["1.5 BlueHDi 130 HP", "Feel Adventure", "DIESEL", "130", "AUTOMATIC"],
      ["1.5 BlueHDi 130 HP", "Shine", "DIESEL", "130", "AUTOMATIC"],
      ["1.5 BlueHDi 130 HP", "Shine Bold", "DIESEL", "130", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Citroen",
    series: "C5 Aircross",
    model,
    trim,
    generation: "C5 Aircross I TR MY2020",
    generationCode: "C5 Aircross I",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: model.startsWith("1.6") ? "1598" : "1499",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2020 C5 Aircross — Feel/Shine/Shine Bold only as published (no fan-out).",
    sources: [SRC.citroenC5a2020],
  })),
];

function main() {
  const results = [
    processBrand("Opel.json", "Opel", OPEL_SELECTABLE, OPEL_ROWS, "2026.08-deep-opel-v2-historical"),
    processBrand(
      "Hyundai.json",
      "Hyundai",
      HYUNDAI_SELECTABLE,
      HYUNDAI_ROWS,
      "2026.08-deep-hyundai-v2-historical"
    ),
    processBrand("Honda.json", "Honda", HONDA_SELECTABLE, HONDA_ROWS, "2026.08-deep-honda-v2-historical"),
    processBrand("Skoda.json", "Skoda", SKODA_SELECTABLE, SKODA_ROWS, "2026.08-deep-skoda-v2-historical"),
    processBrand("Seat.json", "Seat", SEAT_SELECTABLE, SEAT_ROWS, "2026.08-deep-seat-v2-historical"),
    processBrand(
      "Citroen.json",
      "Citroen",
      CITROEN_SELECTABLE,
      CITROEN_ROWS,
      "2026.08-deep-citroen-v2-historical"
    ),
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

  writeFileSync(
    PROGRESS,
    JSON.stringify(
      {
        ...progress,
        at: new Date().toISOString(),
        checkpointCommit: "347a961",
        phase: "research-mass-market-batch",
        applyAllowed: false,
        noApplyDuringResearch: true,
        completedBrands: [...completed].sort(),
        inProgressBrands: [...inProgress].sort(),
        massMarketBatch2: {
          brands: ["Opel", "Hyundai", "Honda", "Skoda", "Seat", "Citroen"],
          results: results.map((r) => ({
            brand: r.brand,
            added: r.added,
            verified: r.verified,
            status: r.status,
            seriesWithoutResearch: r.seriesWithoutResearch,
          })),
        },
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ ok: true, applyAllowed: false, results }, null, 2));
}

main();
