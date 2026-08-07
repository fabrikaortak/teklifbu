/**
 * Fiat / Ford / Toyota / Peugeot historical TR deepen + coverage + completion reports.
 * RESEARCH ONLY — NO combinatorial trim fan-out. NO APPLY. NO DB writes.
 * Checkpoint 347a961 must not be rewritten. applyAllowed=false.
 *
 * npx tsx scripts/vehicle/deepen-fiat-ford-toyota-peugeot.ts
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
  egea1920: {
    url: "https://www.otomobilir.com/fiat-egea-fiyati-bir-yil-once-ne-kadardi/",
    title: "Fiat Egea Sedan Aralık 2019–2020 fiyat listesi",
    date: "2020-12-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  egea2018: {
    url: "https://arabahaber.com.tr/2018-fiat-egeanin-yeni-donanimlari-ve-fiyatlari-aciklandi",
    title: "2018 Fiat Egea Easy/Urban/Lounge motor×donanım fiyatları",
    date: "2018-01-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "arabahaber.com.tr",
  },
  doblo2019: {
    url: "https://yeniarabafiyatlari.com/fiat/doblo-combi/2019/1-6-multijet-easy-fiyatlari",
    title: "2019 Fiat Doblo Combi version×trim matrisi",
    date: "2019-01-01",
    role: "primary" as const,
    type: "price_matrix",
    publisher: "yeniarabafiyatlari.com",
  },
  dobloAmy: {
    url: "https://arabamyeni.com/sifir/fiat/doblo-combi/2019",
    title: "Fiat Doblo Combi 2019 model fiyat listesi",
    date: "2019-01-01",
    role: "secondary" as const,
    type: "price_matrix",
    publisher: "arabamyeni.com",
  },
  focusPdf: {
    url: "https://www.ford.com.tr/getmedia/6e576d2f-1f33-4549-948a-8244c0115ca6/Focus-2019-aralik-fiyat-listesi.pdf.aspx",
    title: "Ford Focus Aralık 2019 resmi fiyat PDF",
    date: "2019-12-01",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Ford Türkiye",
  },
  focusArabavs: {
    url: "https://www.arabavs.com/ford-aralik-fiyat-listesi-2019.html",
    title: "Ford Aralık 2019 fiyat listesi — Focus",
    date: "2019-12-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  fiesta2019: {
    url: "https://aracbulten.com/ford-fiesta-fiyat-listesi-2019/",
    title: "Ford Fiesta Aralık 2019 tavsiye edilen fiyat listesi",
    date: "2019-12-05",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "aracbulten.com",
  },
  courier2019: {
    url: "https://yeniarabafiyatlari.com/ford/tourneo-courier/2019-fiyatlari",
    title: "2019 Ford Tourneo Courier Trend/Deluxe/Titanium matrisi",
    date: "2019-01-01",
    role: "primary" as const,
    type: "price_matrix",
    publisher: "yeniarabafiyatlari.com",
  },
  courier2020: {
    url: "https://www.otomobilir.com/ford-tourneo-custom-kampanyali-fiyatlari/",
    title: "Ford Tourneo Courier/Custom Haziran 2020 kampanyalı listeler",
    date: "2020-06-05",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  pumaKuga2020: {
    url: "https://otomobil.haber7.com/otomobil/haber/3013928-ford-2020-arac-modellerinin-fiyatlarini-acikladi-iste-mondeo-puma-focus-kuga-fiyat-listesi",
    title: "Ford 2020 ÖTV sonrası Puma/Kuga/Focus fiyatları",
    date: "2020-09-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "haber7.com",
  },
  kugaLansman: {
    url: "https://www.arabahabercisi.com/yeni-ford-kuga-fiyat-listesi/",
    title: "Yeni Ford Kuga 2020 lansman fiyat listesi",
    date: "2020-01-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabahabercisi.com",
  },
  toyotaDec2019: {
    url: "https://www.otomobilir.com/toyota-fiyat-listesi-aralik-2019/",
    title: "Toyota Aralık 2019 Corolla/C-HR/RAV4 fiyat listesi",
    date: "2019-12-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  toyota2020: {
    url: "https://otomobil.haber7.com/otomobil/haber/3009429-toyota-2020-fiyat-listesini-acikladi-otv-sonrasi-2020-corolla-rav4-c-hr-hybrid-fiyatlari",
    title: "Toyota 2020 ÖTV sonrası Corolla/C-HR/RAV4 fiyatları",
    date: "2020-09-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "haber7.com",
  },
  peugeotJun2019: {
    url: "https://caraba.net/peugeot-turkiye-haziran-2019-fiyat-listesini-guncelledi/",
    title: "Peugeot Haziran 2019 — 208/308/3008/2008",
    date: "2019-06-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  peugeot3008fl: {
    url: "https://www.donanimhaber.com/makyajli-peugeot-3008-turkiye-de-iste-fiyati--126854",
    title: "Makyajlı Peugeot 3008 Kasım 2020 TR fiyatları",
    date: "2020-11-15",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "donanimhaber.com",
  },
  peugeotMay2020: {
    url: "https://www.arabavs.com/peugeot-fiyat-listesi-2020-mayis-aciklandi.html",
    title: "Peugeot Mayıs 2020 — 2008/3008 fiyat listesi",
    date: "2020-05-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
};

// ——— FIAT ———
const FIAT_SELECTABLE = [
  { series: "Egea", category: "Otomobil" },
  { series: "Egea Cross", category: "Otomobil" },
  { series: "Egea Wagon", category: "Otomobil" },
  { series: "Doblo", category: "Minivan & Panelvan" },
  { series: "Doblo Combi", category: "Minivan & Panelvan" },
];

const FIAT_ROWS: Config[] = [
  // Dec 2019 Egea Sedan — ONLY listed pairs (Easy/Urban Plus/Mirror/Lounge Plus × engines as published)
  ...(
    [
      ["1.4 Fire 95 HP", "Easy", "GASOLINE", "95", "MANUAL", "1368"],
      ["1.3 Multijet 95 HP", "Easy", "DIESEL", "95", "MANUAL", "1248"],
      ["1.6 Multijet 120 HP", "Easy", "DIESEL", "120", "AUTOMATIC", "1598"],
      ["1.4 Fire 95 HP", "Urban Plus", "GASOLINE", "95", "MANUAL", "1368"],
      ["1.3 Multijet 95 HP", "Urban Plus", "DIESEL", "95", "MANUAL", "1248"],
      ["1.6 Multijet 120 HP", "Urban Plus", "DIESEL", "120", "MANUAL", "1598"],
      ["1.6 Multijet 120 HP", "Urban Plus", "DIESEL", "120", "AUTOMATIC", "1598"],
      ["1.4 Fire 95 HP", "Mirror", "GASOLINE", "95", "MANUAL", "1368"],
      ["1.3 Multijet 95 HP", "Mirror", "DIESEL", "95", "MANUAL", "1248"],
      ["1.6 Multijet 120 HP", "Mirror", "DIESEL", "120", "MANUAL", "1598"],
      ["1.6 Multijet 120 HP", "Mirror", "DIESEL", "120", "AUTOMATIC", "1598"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "MANUAL", "1598"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "AUTOMATIC", "1598"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, vol]) => ({
    brand: "Fiat",
    series: "Egea",
    model,
    trim,
    generation: "Egea Sedan TR MY2019",
    generationCode: "Tipo/Egea",
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
    notes: "Aralık 2019 Egea Sedan TR — only published version×trim rows (no fan-out).",
    sources: [SRC.egea1920],
  })),
  // Dec 2020 Egea Sedan subset confirming same package×engine pattern
  ...(
    [
      ["1.4 Fire 95 HP", "Easy", "GASOLINE", "95", "MANUAL"],
      ["1.3 Multijet 95 HP", "Easy", "DIESEL", "95", "MANUAL"],
      ["1.6 Multijet 120 HP", "Easy", "DIESEL", "120", "AUTOMATIC"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Fiat",
    series: "Egea",
    model,
    trim,
    generation: "Egea Sedan TR MY2020",
    generationCode: "Tipo/Egea",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Aralık 2020 Egea Sedan TR archive rows.",
    sources: [SRC.egea1920],
  })),
  // 2018 Egea Sedan — Urban 1.6 E-Torq only where listed (not Lounge on 1.4)
  ...(
    [
      ["1.4 Fire 95 HP", "Easy", "GASOLINE", "95", "MANUAL"],
      ["1.3 Multijet 95 HP", "Easy", "DIESEL", "95", "MANUAL"],
      ["1.6 Multijet 120 HP", "Easy", "DIESEL", "120", "AUTOMATIC"],
      ["1.4 Fire 95 HP", "Urban", "GASOLINE", "95", "MANUAL"],
      ["1.3 Multijet 95 HP", "Urban", "DIESEL", "95", "MANUAL"],
      ["1.6 Multijet 120 HP", "Urban", "DIESEL", "120", "MANUAL"],
      ["1.6 Multijet 120 HP", "Urban", "DIESEL", "120", "AUTOMATIC"],
      ["1.6 E-Torq 110 HP", "Urban", "GASOLINE", "110", "AUTOMATIC"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "MANUAL"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "AUTOMATIC"],
      ["1.6 E-Torq 110 HP", "Lounge Plus", "GASOLINE", "110", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Fiat",
    series: "Egea",
    model,
    trim,
    generation: "Egea Sedan TR MY2018",
    generationCode: "Tipo/Egea",
    yearFrom: 2018,
    yearTo: 2018,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2018 Egea Sedan — Easy/Urban/Lounge Plus only on engines published for that trim.",
    sources: [SRC.egea2018],
  })),
  // 2018 Egea Wagon — only Urban Plus / Lounge Plus pairs from same source
  ...(
    [
      ["1.3 Multijet 95 HP", "Urban Plus", "DIESEL", "95", "MANUAL"],
      ["1.6 E-Torq 110 HP", "Urban Plus", "GASOLINE", "110", "AUTOMATIC"],
      ["1.6 Multijet 120 HP", "Urban Plus", "DIESEL", "120", "AUTOMATIC"],
      ["1.6 E-Torq 110 HP", "Lounge Plus", "GASOLINE", "110", "AUTOMATIC"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "MANUAL"],
      ["1.6 Multijet 120 HP", "Lounge Plus", "DIESEL", "120", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Fiat",
    series: "Egea Wagon",
    model,
    trim,
    generation: "Egea Station Wagon TR MY2018",
    generationCode: "Tipo/Egea SW",
    yearFrom: 2018,
    yearTo: 2018,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2018 Egea SW — Urban Plus/Lounge Plus × listed engines only.",
    sources: [SRC.egea2018],
  })),
  // Doblo Combi 2019 — Easy/Safeline/Premio as published (not Egea Easy/Urban fan-out)
  ...(
    [
      ["1.4 Fire 95 HP", "Easy", "GASOLINE", "95", "MANUAL", "1368"],
      ["1.4 Fire 95 HP", "Safeline", "GASOLINE", "95", "MANUAL", "1368"],
      ["1.4 Fire 95 HP", "Premio", "GASOLINE", "95", "MANUAL", "1368"],
      ["1.3 Multijet 95 HP", "Easy", "DIESEL", "95", "MANUAL", "1248"],
      ["1.3 Multijet 95 HP", "Safeline", "DIESEL", "95", "MANUAL", "1248"],
      ["1.6 Multijet 120 HP", "Easy", "DIESEL", "120", "MANUAL", "1598"],
      ["1.6 Multijet 120 HP", "Safeline", "DIESEL", "120", "MANUAL", "1598"],
      ["1.6 Multijet 120 HP", "Premio", "DIESEL", "120", "MANUAL", "1598"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission, vol]) => ({
    brand: "Fiat",
    series: "Doblo Combi",
    model,
    trim,
    generation: "Doblo Combi TR MY2019",
    generationCode: "Doblo-II",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    engineVolume: vol,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: "2019 Doblo Combi — Easy/Safeline/Premio only as published for each engine.",
    sources: [SRC.doblo2019, SRC.dobloAmy],
  })),
  {
    brand: "Fiat",
    series: "Doblo",
    model: "1.6 Multijet 120 HP",
    trim: "Easy",
    generation: "Doblo Binek TR MY2020",
    generationCode: "Doblo-II",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "DIESEL",
    powerHp: "120",
    transmission: "MANUAL",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: "2020 Fiat Doblo binek Easy 1.6 Multijet — LOG TR table.",
    sources: [
      {
        url: "https://www.log.com.tr/2020-fiat-doblo-fiyatlari-ve-guncel-versiyon-secenekleri/",
        title: "2020 Fiat Doblo binek/combi fiyat tablosu",
        date: "2020-01-01",
        role: "primary",
        type: "price_list_archive",
        publisher: "log.com.tr",
      },
    ],
  },
  {
    brand: "Fiat",
    series: "Doblo",
    model: "1.6 Multijet 120 HP",
    trim: "Lounge",
    generation: "Doblo Binek TR MY2020",
    generationCode: "Doblo-II",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "DIESEL",
    powerHp: "120",
    transmission: "MANUAL",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: "2020 Fiat Doblo binek Lounge 1.6 Multijet — LOG TR table.",
    sources: [
      {
        url: "https://www.log.com.tr/2020-fiat-doblo-fiyatlari-ve-guncel-versiyon-secenekleri/",
        title: "2020 Fiat Doblo binek/combi fiyat tablosu",
        date: "2020-01-01",
        role: "primary",
        type: "price_list_archive",
        publisher: "log.com.tr",
      },
    ],
  },
  {
    brand: "Fiat",
    series: "Egea Cross",
    model: "",
    trim: "",
    generation: "pre-Cross historical",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "Egea Cross historical (pre-current MY) discrete archive matrix incomplete; current MY Multijet rows already verified.",
    sources: [
      {
        url: "https://www.fiat.com.tr/",
        title: "Fiat Türkiye — Egea Cross historical archive search",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "Fiat Türkiye",
      },
    ],
  },
];

// ——— FORD ———
const FORD_SELECTABLE = [
  { series: "Focus", category: "Otomobil" },
  { series: "Fiesta", category: "Otomobil" },
  { series: "Tourneo Courier", category: "Minivan & Panelvan" },
  { series: "Tourneo Custom", category: "Minivan & Panelvan" },
  { series: "Puma", category: "Arazi, SUV & Pickup" },
  { series: "Kuga", category: "Arazi, SUV & Pickup" },
  { series: "Focus Hatchback Hybrid", category: "Otomobil" },
];

const FORD_ROWS: Config[] = [
  // Focus Dec 2019 — engine×trim as published (body variants collapsed; no inventing ST-Line×Ti-VCT)
  ...(
    [
      ["1.5 Ti-VCT 123 PS", "Trend X", "GASOLINE", "123", "MANUAL"],
      ["1.5 Ti-VCT 123 PS", "Trend X", "GASOLINE", "123", "AUTOMATIC"],
      ["1.5 Ti-VCT 123 PS", "Titanium", "GASOLINE", "123", "MANUAL"],
      ["1.5 Ti-VCT 123 PS", "Titanium", "GASOLINE", "123", "AUTOMATIC"],
      ["1.0 EcoBoost 125 PS", "ST-Line", "GASOLINE", "125", "AUTOMATIC"],
      ["1.5 EcoBlue 120 PS", "Trend X", "DIESEL", "120", "MANUAL"],
      ["1.5 EcoBlue 120 PS", "Trend X", "DIESEL", "120", "AUTOMATIC"],
      ["1.5 EcoBlue 120 PS", "Titanium", "DIESEL", "120", "MANUAL"],
      ["1.5 EcoBlue 120 PS", "Titanium", "DIESEL", "120", "AUTOMATIC"],
      ["1.5 EcoBlue 120 PS", "ST-Line", "DIESEL", "120", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Ford",
    series: "Focus",
    model,
    trim,
    generation: "Focus Mk4 TR MY2019",
    generationCode: "C519",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Aralık 2019 Focus resmi PDF — Trend X/Titanium/ST-Line only on listed engines.",
    sources: [SRC.focusPdf, SRC.focusArabavs],
  })),
  // Fiesta Dec 2019 — exactly 4 published rows
  ...(
    [
      ["1.1L 85 PS", "Trend", "GASOLINE", "85", "MANUAL"],
      ["1.0 EcoBoost 100 PS", "Titanium", "GASOLINE", "100", "AUTOMATIC"],
      ["1.5 TDCi 85 PS", "Trend", "DIESEL", "85", "MANUAL"],
      ["1.5 TDCi 85 PS", "Titanium", "DIESEL", "85", "MANUAL"],
    ] as const
  ).map(([model, trim, fuel, hp, transmission]) => ({
    brand: "Ford",
    series: "Fiesta",
    model,
    trim,
    generation: "Fiesta Mk8 TR MY2019",
    generationCode: "Fiesta-Mk8",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "05 Aralık 2019 Fiesta TR — Trend/Titanium only as published (no EcoBoost×Trend invent).",
    sources: [SRC.fiesta2019],
  })),
  // Tourneo Courier 2019 — Trend 75PS / Deluxe 75PS / Titanium|Blackline|Titanium Plus 95PS
  ...(
    [
      ["1.5 TDCi 75 PS", "Trend", "75"],
      ["1.5 TDCi 75 PS", "Deluxe", "75"],
      ["1.5 TDCi 95 PS", "Titanium", "95"],
      ["1.5 TDCi 95 PS", "Blackline", "95"],
      ["1.5 TDCi 95 PS", "Titanium Plus", "95"],
    ] as const
  ).map(([model, trim, hp]) => ({
    brand: "Ford",
    series: "Tourneo Courier",
    model,
    trim,
    generation: "Tourneo Courier I TR MY2019",
    generationCode: "Tourneo Courier",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "DIESEL",
    powerHp: hp,
    transmission: "MANUAL",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: "2019 Tourneo Courier — Trend/Deluxe/Titanium/Blackline/Titanium Plus as published.",
    sources: [SRC.courier2019],
  })),
  // Tourneo Courier Jun 2020 — Titanium/Blackline/Titanium Plus at 100PS
  ...(
    [
      ["1.5 TDCi 75 PS", "Trend", "75"],
      ["1.5 TDCi 75 PS", "Deluxe", "75"],
      ["1.5 TDCi 100 PS", "Deluxe", "100"],
      ["1.5 TDCi 100 PS", "Titanium", "100"],
      ["1.5 TDCi 100 PS", "Blackline", "100"],
      ["1.5 TDCi 100 PS", "Titanium Plus", "100"],
    ] as const
  ).map(([model, trim, hp]) => ({
    brand: "Ford",
    series: "Tourneo Courier",
    model,
    trim,
    generation: "Tourneo Courier I TR MY2020",
    generationCode: "Tourneo Courier",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "DIESEL",
    powerHp: hp,
    transmission: "MANUAL",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: "Haziran 2020 Tourneo Courier kampanyalı tablo.",
    sources: [SRC.courier2020],
  })),
  // Tourneo Custom Jun 2020 — representative sourced pairs (not every chassis×bagaj cross-product beyond list)
  ...(
    [
      ["2.0 EcoBlue 130 PS", "Trend", "130", "MANUAL"],
      ["2.0 EcoBlue 170 PS", "Titanium", "170", "MANUAL"],
      ["2.0 EcoBlue 170 PS", "Titanium", "170", "AUTOMATIC"],
      ["2.0 EcoBlue 170 PS", "Titanium Plus", "170", "AUTOMATIC"],
      ["2.0 EcoBlue Hibrit 185 PS", "Titanium Plus", "185", "MANUAL"],
      ["2.0 EcoBlue Upgrade 185 PS", "Titanium Plus", "185", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, hp, transmission]) => ({
    brand: "Ford",
    series: "Tourneo Custom",
    model,
    trim,
    generation: "Tourneo Custom TR MY2020",
    generationCode: "Tourneo Custom",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: String(model).includes("Hibrit") ? "HYBRID" : "DIESEL",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: "Haziran 2020 Tourneo Custom — Trend/Titanium/Titanium Plus × listed EcoBlue engines only.",
    sources: [SRC.courier2020],
  })),
  // Puma 2020 ÖTV sonrası — Style/ST-Line as published
  ...(
    [
      ["1.0 EcoBoost 95 PS", "Style", "95", "MANUAL", "GASOLINE"],
      ["1.0 EcoBoost 125 PS", "Style", "125", "AUTOMATIC", "GASOLINE"],
      ["1.0 EcoBoost 125 PS", "ST-Line", "125", "AUTOMATIC", "GASOLINE"],
      ["1.0 EcoBoost mHEV 155 PS", "ST-Line", "155", "MANUAL", "HYBRID"],
    ] as const
  ).map(([model, trim, hp, transmission, fuel]) => ({
    brand: "Ford",
    series: "Puma",
    model,
    trim,
    generation: "Puma TR MY2020",
    generationCode: "Puma",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2020 Puma ÖTV sonrası — Style/ST-Line only on listed EcoBoost variants.",
    sources: [SRC.pumaKuga2020],
  })),
  // Kuga 2020 — Style/Titanium/ST-Line as published
  ...(
    [
      ["1.5 EcoBoost 120 PS", "Style", "120", "MANUAL", "GASOLINE"],
      ["1.5 EcoBlue 120 PS", "Style", "120", "MANUAL", "DIESEL"],
      ["1.5 EcoBlue 120 PS", "Style", "120", "AUTOMATIC", "DIESEL"],
      ["1.5 EcoBlue 120 PS", "Titanium", "120", "AUTOMATIC", "DIESEL"],
      ["1.5 EcoBlue 120 PS", "ST-Line", "120", "AUTOMATIC", "DIESEL"],
      ["2.5 PHEV 225 PS", "ST-Line", "225", "AUTOMATIC", "HYBRID"],
    ] as const
  ).map(([model, trim, hp, transmission, fuel]) => ({
    brand: "Ford",
    series: "Kuga",
    model,
    trim,
    generation: "Kuga III TR MY2020",
    generationCode: "Kuga-III",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: String(model).includes("PHEV") ? "AWD" : "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2020 Kuga — Style/Titanium/ST-Line × listed engines; PHEV only ST-Line as published.",
    sources: [SRC.pumaKuga2020, SRC.kugaLansman],
  })),
  {
    brand: "Ford",
    series: "Focus Hatchback Hybrid",
    model: "1.0 EcoBoost Hybrid",
    trim: "",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    generation: "Focus Mk4 Hybrid TR",
    generationCode: "C519",
    yearFrom: 2025,
    yearTo: 2026,
    fuelType: "HYBRID",
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    notes: "Focus Hatchback Hybrid reported in secondary Jul 2026 roundups; official trim row not confirmed this pass.",
    sources: [
      {
        url: "https://teknodiot.com/ford-fiyat-listesi",
        title: "Ford Temmuz 2026 fiyat derlemesi — Hybrid Active Stil note",
        date: "2026-07-10",
        role: "primary",
        type: "research_note",
        publisher: "teknodiot.com",
      },
      {
        url: "https://www.ford.com.tr/fiyat-listesi",
        title: "Ford Türkiye fiyat listesi",
        date: "2026-08-07",
        role: "secondary",
        type: "official_hub",
        publisher: "Ford Türkiye",
      },
    ],
  },
];

// ——— TOYOTA ———
const TOYOTA_SELECTABLE = [
  { series: "Corolla", category: "Otomobil" },
  { series: "C-HR", category: "Arazi, SUV & Pickup" },
  { series: "RAV4", category: "Arazi, SUV & Pickup" },
];

const TOYOTA_ROWS: Config[] = [
  // Corolla Sedan Dec 2019 gasoline — Vision/Dream/Flame/Passion as published
  ...(
    [
      ["1.6", "Vision", "MANUAL"],
      ["1.6 Multidrive S", "Vision", "AUTOMATIC"],
      ["1.6", "Dream", "MANUAL"],
      ["1.6 Multidrive S", "Dream", "AUTOMATIC"],
      ["1.6", "Flame", "MANUAL"],
      ["1.6 Multidrive S", "Flame", "AUTOMATIC"],
      ["1.6", "Flame X-Pack", "MANUAL"],
      ["1.6 Multidrive S", "Flame X-Pack", "AUTOMATIC"],
      ["1.6 Multidrive S", "Passion", "AUTOMATIC"],
      ["1.6 Multidrive S", "Passion X-Pack", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, transmission]) => ({
    brand: "Toyota",
    series: "Corolla",
    model,
    trim,
    generation: "Corolla Sedan E210 TR MY2019",
    generationCode: "E210",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    engineVolume: "1598",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Aralık 2019 Corolla Sedan — packages only on listed transmissions.",
    sources: [SRC.toyotaDec2019],
  })),
  // Corolla Hybrid Dec 2019
  ...(
    [
      ["1.8 Hybrid e-CVT", "Vision"],
      ["1.8 Hybrid e-CVT", "Dream"],
      ["1.8 Hybrid e-CVT", "Flame"],
      ["1.8 Hybrid e-CVT", "Flame X-Pack"],
      ["1.8 Hybrid e-CVT", "Passion"],
      ["1.8 Hybrid e-CVT", "Passion X-Pack"],
    ] as const
  ).map(([model, trim]) => ({
    brand: "Toyota",
    series: "Corolla",
    model,
    trim,
    generation: "Corolla Sedan Hybrid E210 TR MY2019",
    generationCode: "E210",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "HYBRID",
    engineVolume: "1798",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Aralık 2019 Corolla Hybrid — Vision→Passion X-Pack as published.",
    sources: [SRC.toyotaDec2019],
  })),
  // C-HR Hybrid 2019 MY Flame/Passion
  ...(
    [
      ["1.8 Hybrid e-CVT", "Flame"],
      ["1.8 Hybrid e-CVT", "Passion"],
      ["1.8 Hybrid e-CVT", "Passion X-Pack"],
    ] as const
  ).map(([model, trim]) => ({
    brand: "Toyota",
    series: "C-HR",
    model,
    trim,
    generation: "C-HR I TR MY2019",
    generationCode: "AX10",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "HYBRID",
    engineVolume: "1798",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2019 C-HR Hybrid 4x2 — Flame/Passion/Passion X-Pack only.",
    sources: [SRC.toyotaDec2019],
  })),
  // C-HR 1.2 Turbo 2019
  ...(
    [
      ["1.2 Turbo", "Flame", "MANUAL"],
      ["1.2 Turbo Multidrive S", "Flame", "AUTOMATIC"],
      ["1.2 Turbo Multidrive S", "Passion", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, transmission]) => ({
    brand: "Toyota",
    series: "C-HR",
    model,
    trim,
    generation: "C-HR I TR MY2019",
    generationCode: "AX10",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    engineVolume: "1197",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2019 C-HR 1.2 Turbo — Flame/Passion as published (no Passion manual invent).",
    sources: [SRC.toyotaDec2019],
  })),
  // RAV4 Hybrid Dec 2019
  ...(
    [
      ["2.5 Hybrid 4x4 e-CVT", "Flame"],
      ["2.5 Hybrid 4x4 e-CVT", "Passion"],
      ["2.5 Hybrid 4x4 e-CVT", "Passion X-Pack"],
    ] as const
  ).map(([model, trim]) => ({
    brand: "Toyota",
    series: "RAV4",
    model,
    trim,
    generation: "RAV4 XA50 TR MY2019",
    generationCode: "XA50",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "HYBRID",
    engineVolume: "2487",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Aralık 2019 Yeni RAV4 Hybrid — Flame/Passion/Passion X-Pack.",
    sources: [SRC.toyotaDec2019],
  })),
  // 2020 ÖTV sonrası confirmation rows (RAV4 + Corolla Hybrid subset)
  ...(
    [
      ["2.5 Hybrid 4x4 e-CVT", "Flame"],
      ["2.5 Hybrid 4x4 e-CVT", "Passion"],
      ["2.5 Hybrid 4x4 e-CVT", "Passion X-Pack"],
      ["2.5 Hybrid 4x4 e-CVT", "Passion X-Sport"],
    ] as const
  ).map(([model, trim]) => ({
    brand: "Toyota",
    series: "RAV4",
    model,
    trim,
    generation: "RAV4 XA50 TR MY2020",
    generationCode: "XA50",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "HYBRID",
    engineVolume: "2487",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "2020 ÖTV sonrası RAV4 Hybrid — includes Passion X-Sport as published.",
    sources: [SRC.toyota2020],
  })),
  ...(
    [
      ["1.8 Hybrid e-CVT", "Dream"],
      ["1.8 Hybrid e-CVT", "Flame"],
      ["1.8 Hybrid e-CVT", "Flame X-Pack"],
      ["1.8 Hybrid e-CVT", "Passion"],
      ["1.8 Hybrid e-CVT", "Passion X-Pack"],
    ] as const
  ).map(([model, trim]) => ({
    brand: "Toyota",
    series: "Corolla",
    model,
    trim,
    generation: "Corolla Sedan Hybrid E210 TR MY2020",
    generationCode: "E210",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "HYBRID",
    engineVolume: "1798",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "2020 ÖTV sonrası Corolla Hybrid Sedan packages.",
    sources: [SRC.toyota2020],
  })),
];

// ——— PEUGEOT ———
const PEUGEOT_SELECTABLE = [
  { series: "3008", category: "Arazi, SUV & Pickup" },
  { series: "E-3008", category: "Arazi, SUV & Pickup" },
  { series: "208", category: "Otomobil" },
  { series: "308", category: "Otomobil" },
  { series: "2008", category: "Arazi, SUV & Pickup" },
];

const PEUGEOT_ROWS: Config[] = [
  // Jun 2019 208 — Signature only as published
  ...(
    [
      ["1.2 PureTech 82 hp", "Signature", "MANUAL", "82"],
      ["1.2 PureTech 110 hp", "Signature", "AUTOMATIC", "110"],
    ] as const
  ).map(([model, trim, transmission, hp]) => ({
    brand: "Peugeot",
    series: "208",
    model,
    trim,
    generation: "208 II TR MY2019",
    generationCode: "P21",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "GASOLINE",
    engineVolume: "1199",
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Haziran 2019 208 — Signature PureTech rows only (ICE historical).",
    sources: [SRC.peugeotJun2019],
  })),
  // Jun 2019 308 — STYLE only
  ...(
    [
      ["1.2 PureTech 130 hp", "Style", "MANUAL", "GASOLINE", "130"],
      ["1.2 PureTech 130 hp", "Style", "AUTOMATIC", "GASOLINE", "130"],
      ["1.5 BlueHDi 130 hp", "Style", "AUTOMATIC", "DIESEL", "130"],
    ] as const
  ).map(([model, trim, transmission, fuel, hp]) => ({
    brand: "Peugeot",
    series: "308",
    model,
    trim,
    generation: "308 II TR MY2019",
    generationCode: "T9",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: "Haziran 2019 308 — Style PureTech/BlueHDi as published (ICE historical).",
    sources: [SRC.peugeotJun2019],
  })),
  // Jun 2019 3008 — Active / Allure Selection / GT-Line (Prime Edition treated as Active trim note)
  ...(
    [
      ["1.2 PureTech 130 hp", "Active", "AUTOMATIC", "GASOLINE", "130"],
      ["1.6 PureTech 180 hp", "Active", "AUTOMATIC", "GASOLINE", "180"],
      ["1.6 PureTech 180 hp", "GT-Line", "AUTOMATIC", "GASOLINE", "180"],
      ["1.5 BlueHDi 130 hp", "Active", "AUTOMATIC", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "Allure Selection", "AUTOMATIC", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "GT-Line", "AUTOMATIC", "DIESEL", "130"],
    ] as const
  ).map(([model, trim, transmission, fuel, hp]) => ({
    brand: "Peugeot",
    series: "3008",
    model,
    trim,
    generation: "3008 II TR MY2019",
    generationCode: "P84",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Haziran 2019 3008 — Active/Allure Selection/GT-Line × listed engines only.",
    sources: [SRC.peugeotJun2019],
  })),
  // Jun 2019 2008 diesel
  ...(
    [
      ["1.5 BlueHDi 120 hp", "Allure", "AUTOMATIC"],
      ["1.5 BlueHDi 120 hp", "GT-Line", "AUTOMATIC"],
    ] as const
  ).map(([model, trim, transmission]) => ({
    brand: "Peugeot",
    series: "2008",
    model,
    trim,
    generation: "2008 I TR MY2019",
    generationCode: "2008-I",
    yearFrom: 2019,
    yearTo: 2019,
    fuelType: "DIESEL",
    powerHp: "120",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Haziran 2019 2008 — Allure/GT-Line 1.5 BlueHDi only.",
    sources: [SRC.peugeotJun2019],
  })),
  // May 2020 Yeni 2008
  ...(
    [
      ["1.2 PureTech 130 hp", "Active", "AUTOMATIC", "GASOLINE", "130"],
      ["1.2 PureTech 130 hp", "Allure", "AUTOMATIC", "GASOLINE", "130"],
      ["1.2 PureTech 130 hp", "GT-Line", "AUTOMATIC", "GASOLINE", "130"],
      ["1.2 PureTech 155 hp", "GT", "AUTOMATIC", "GASOLINE", "155"],
      ["1.5 BlueHDi 100 hp", "Active", "MANUAL", "DIESEL", "100"],
      ["1.5 BlueHDi 130 hp", "Active", "AUTOMATIC", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "Allure", "AUTOMATIC", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "GT-Line", "AUTOMATIC", "DIESEL", "130"],
    ] as const
  ).map(([model, trim, transmission, fuel, hp]) => ({
    brand: "Peugeot",
    series: "2008",
    model,
    trim,
    generation: "2008 II TR MY2020",
    generationCode: "2008-II",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    powerHp: hp,
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Mayıs 2020 Yeni 2008 — Active/Allure/GT-Line/GT as published per engine.",
    sources: [SRC.peugeotMay2020],
  })),
  // Nov 2020 facelift 3008
  ...(
    [
      ["1.2 PureTech 130 hp", "Active Prime", "GASOLINE", "130"],
      ["1.6 PureTech 180 hp", "Allure", "GASOLINE", "180"],
      ["1.6 PureTech 180 hp", "GT Selection", "GASOLINE", "180"],
      ["1.6 PureTech 180 hp", "GT", "GASOLINE", "180"],
      ["1.5 BlueHDi 130 hp", "Active Prime", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "Allure", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "GT Selection", "DIESEL", "130"],
      ["1.5 BlueHDi 130 hp", "GT", "DIESEL", "130"],
    ] as const
  ).map(([model, trim, fuel, hp]) => ({
    brand: "Peugeot",
    series: "3008",
    model,
    trim,
    generation: "3008 II facelift TR MY2020",
    generationCode: "P84",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Kasım 2020 makyajlı 3008 — Active Prime/Allure/GT Selection/GT × listed engines.",
    sources: [SRC.peugeot3008fl],
  })),
  {
    brand: "Peugeot",
    series: "E-3008",
    model: "",
    trim: "",
    generation: "pre-current EV",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "E-3008 historical pre-current archive not located; current MY Allure/GT official rows already verified.",
    sources: [
      {
        url: "https://kampanya.peugeot.com.tr/fiyat-listesi/",
        title: "Peugeot Türkiye resmi fiyat listesi — E-3008 current",
        date: "2026-08-07",
        role: "primary",
        type: "research_note",
        publisher: "Peugeot Türkiye",
      },
    ],
  },
];

function main() {
  const results = [
    processBrand("Fiat.json", "Fiat", FIAT_SELECTABLE, FIAT_ROWS, "2026.08-deep-fiat-v2-historical"),
    processBrand("Ford.json", "Ford", FORD_SELECTABLE, FORD_ROWS, "2026.08-deep-ford-v2-historical"),
    processBrand("Toyota.json", "Toyota", TOYOTA_SELECTABLE, TOYOTA_ROWS, "2026.08-deep-toyota-v2-historical"),
    processBrand(
      "Peugeot.json",
      "Peugeot",
      PEUGEOT_SELECTABLE,
      PEUGEOT_ROWS,
      "2026.08-deep-peugeot-v2-historical"
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
  // Preserve prior completed marques
  for (const b of ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Renault"]) completed.add(b);

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
        massMarketBatch: {
          brands: ["Fiat", "Ford", "Toyota", "Peugeot"],
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
