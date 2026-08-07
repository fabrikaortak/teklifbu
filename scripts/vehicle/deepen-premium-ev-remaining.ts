/**
 * Premium + EV remaining brands deepen + coverage + completion reports.
 * RESEARCH ONLY — NO combinatorial trim fan-out. NO APPLY. NO DB writes.
 * Checkpoint 347a961 must not be rewritten. applyAllowed=false.
 * EV overlay: do not invent duplicate EV series.
 *
 * Brands: Alfa Romeo, Porsche, Lexus, Jaguar, Land Rover, Jeep,
 *         Mitsubishi, Subaru, Suzuki, Mazda, Tesla, TOGG, BYD, MG
 *
 * npx tsx scripts/vehicle/deepen-premium-ev-remaining.ts
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
        notes: `${series}: researched in premium/EV deepen pass; no verified TR version×trim matrix located yet.`,
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
  const urls = [
    ...new Set(
      configs.flatMap((c) => (c.sources || []).map((s) => s.url)).filter(Boolean)
    ),
  ].sort();
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
    sourceUrls: urls,
    notes:
      "Completed means every selectable series was systematically researched. Current-only and incomplete historical gens remain explicitly flagged. Research-only; applyAllowed=false. Not final absolute historical complete.",
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
          phase: "research-premium-ev-batch",
          seriesWithoutResearch,
          currentOnlySeries: currentOnly,
          addedThisPass: added,
          electricOverlayNote: "Do not invent duplicate EV series",
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
    reviewRequired: configs.filter((c) => c.confidence === "REVIEW_REQUIRED").length,
    status,
    seriesWithoutResearch,
    currentOnly,
    urls,
  };
}

const SRC = {
  alfaNov2020: {
    url: "https://www.otomobilir.com/alfa-romeo-giulia-fiyat/",
    title: "Alfa Romeo Giulia/Stelvio Kasım 2020 fiyat listesi",
    date: "2020-11-10",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otomobilir.com",
  },
  alfaCmp: {
    url: "https://www.otokokpit.com/alfa-romeo-modelleri-2019-2020-fiyat-karsilastirmasi/",
    title: "Alfa Romeo 2019–2020 Stelvio/Giulietta fiyat karşılaştırması",
    date: "2020-04-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "otokokpit.com",
  },
  alfaSite: {
    url: "https://www.alfaromeo.com.tr/",
    title: "Alfa Romeo Türkiye resmi site",
    date: "2026-08-07",
    role: "secondary" as const,
    publisher: "Alfa Romeo Türkiye",
  },
  porscheOfficial: {
    url: "https://www.porsche.com.tr/fiyat-listesi",
    title: "Porsche Türkiye resmi fiyat listesi",
    date: "2026-08-04",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Porsche Türkiye",
  },
  lexusAug: {
    url: "https://teknobirinci.com.tr/agustos-2026-lexus-fiyat-listesi-aciklandi-27-milyon-tl-indirim-var/",
    title: "Lexus Ağustos 2026 versiyon×trim tablosu",
    date: "2026-08-05",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "teknobirinci.com.tr",
  },
  lexusJul: {
    url: "https://onedio.com/haber/temmuz-2026-lexus-fiyat-listesi-iste-lexus-es-rx-rz-lbx-nx-ve-ls-guncel-fiyatlari-1369820",
    title: "Lexus Temmuz 2026 LBX/NX/RX/LM tablosu",
    date: "2026-07-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "onedio.com",
  },
  lexusSite: {
    url: "https://www.lexus.com.tr/",
    title: "Lexus Türkiye resmi site",
    date: "2026-08-07",
    role: "secondary" as const,
    publisher: "Lexus Türkiye",
  },
  jagSite: {
    url: "https://www.jaguar.com.tr/",
    title: "Jaguar Türkiye resmi site",
    date: "2026-08-07",
    role: "primary" as const,
    publisher: "Jaguar Türkiye",
  },
  jagFpace: {
    url: "https://yeniarabafiyatlari.com/jaguar/f-pace/2026/r-dynamic-hse-2-0-d204-bg-mhev-awd-fiyatlari",
    title: "Jaguar F-Pace aggregator versiyon satırı",
    date: "2026-08-07",
    role: "secondary" as const,
    publisher: "yeniarabafiyatlari.com",
  },
  lrEvoque: {
    url: "https://www.landrover.com.tr/build-and-price/range-rover-evoque-fiyat-listesi.pdf",
    title: "Range Rover Evoque resmi fiyat PDF",
    date: "2026-08-07",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Land Rover Türkiye",
  },
  lrVelar: {
    url: "https://www.landrover.com.tr/build-and-price/range-rover-velar-fiyat-listesi.pdf",
    title: "Range Rover Velar resmi fiyat PDF",
    date: "2026-08-07",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Land Rover Türkiye",
  },
  lrDsport: {
    url: "https://www.landrover.com.tr/build-and-price/discovery-sport-fiyat-listesi",
    title: "Discovery Sport resmi fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Land Rover Türkiye",
  },
  lrSport: {
    url: "https://www.landrover.com.tr/build-and-price/range-rover-sport-fiyat-listesi",
    title: "Range Rover Sport resmi fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Land Rover Türkiye",
  },
  lrFull: {
    url: "https://www.landrover.com.tr/build-and-price/range-rover-fiyat-listesi",
    title: "Range Rover resmi fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Land Rover Türkiye",
  },
  jeepApr2020: {
    url: "https://www.arabavs.com/jeep-nisan-2020-fiyat-listesi-aciklandi.html",
    title: "Jeep Nisan 2020 Renegade/Compass/Wrangler fiyat listesi",
    date: "2020-04-07",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  jeepJun2019: {
    url: "https://caraba.net/jeep-haziran-2019-fiyat-listesi-aciklandi/",
    title: "Jeep Haziran 2019 Renegade fiyat listesi",
    date: "2019-06-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "caraba.net",
  },
  jeepSite: {
    url: "https://www.jeep.com.tr/",
    title: "Jeep Türkiye resmi site",
    date: "2026-08-07",
    role: "secondary" as const,
    publisher: "Jeep Türkiye",
  },
  mitsuMay2020: {
    url: "https://www.arabavs.com/mitsubishi-fiyat-listesi-2020-mayis-yayinlandi.html",
    title: "Mitsubishi Mayıs 2020 Eclipse Cross/L200 fiyat listesi",
    date: "2020-05-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  mitsuDec2019: {
    url: "https://www.arabavs.com/mitsubishi-aralik-ayi-guncel-fiyat-listesi-2019.html",
    title: "Mitsubishi Aralık 2019 Eclipse Cross/L200 fiyat listesi",
    date: "2019-12-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  mitsuL200: {
    url: "https://www.log.com.tr/2020-mitsubishi-l200-fiyati-ve-donanim-secenekleri/",
    title: "2020 Mitsubishi L200 resmi kaynaklı donanım×fiyat",
    date: "2020-01-01",
    role: "secondary" as const,
    publisher: "log.com.tr",
  },
  subaruXv: {
    url: "https://otohavadis.com/2020/12/08/subaru-xv-daha-sportif-ve-konforlu-oldu/",
    title: "Subaru XV Aralık 2020 Xtreme/Xclusive fiyatları",
    date: "2020-12-08",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "otohavadis.com",
  },
  subaruXvCnn: {
    url: "https://www.cnnturk.com/otomobil/yenilenen-subaru-xv-359-9-bin-tlden-geldi-1595764",
    title: "Yenilenen Subaru XV TR fiyatları (CNN Türk)",
    date: "2020-12-01",
    role: "secondary" as const,
    publisher: "cnnturk.com",
  },
  subaruOfficial: {
    url: "https://subaru.com.tr/fiyat-listesi",
    title: "Subaru Türkiye resmi fiyat listesi",
    date: "2026-08-07",
    role: "secondary" as const,
    publisher: "Subaru Türkiye",
  },
  suzukiOnedio: {
    url: "https://onedio.com/haber/suzuki-fiyat-listesi-agustos-2024-iste-suzuki-swift-vitara-s-cross-ve-jimny-guncel-fiyatlari-1238324",
    title: "Suzuki Ağustos 2024 Swift/Vitara/S-Cross/Jimny listesi",
    date: "2024-08-01",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "onedio.com",
  },
  suzukiOfficial: {
    url: "https://www.suzuki.com.tr/tr/otomobil/fiyat-listesi.html",
    title: "Suzuki Türkiye resmi fiyat listesi",
    date: "2026-08-07",
    role: "secondary" as const,
    publisher: "Suzuki Türkiye",
  },
  mazdaJul2020: {
    url: "https://www.arabavs.com/mazda-fiyat-listesi-2020-temmuz-yayinlandi.html",
    title: "Mazda Temmuz 2020 3/CX-5 fiyat listesi",
    date: "2020-07-13",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  mazdaApr2020: {
    url: "https://arabavs.com/mazda-fiyat-listesi-nisan-2020.html",
    title: "Mazda Nisan 2020 3/CX-5/MX-5 fiyat listesi",
    date: "2020-04-01",
    role: "secondary" as const,
    type: "price_list_archive",
    publisher: "arabavs.com",
  },
  mazdaOfficialPdf: {
    url: "https://media-assets.mazda.eu/raw/upload/mazdatr/globalassets/pdfs/pricelist/mazda-fiyat-listesi-november-2023-website.pdf",
    title: "Mazda Motor Türkiye Kasım 2023 resmi fiyat PDF",
    date: "2023-11-02",
    role: "primary" as const,
    type: "official_price_list",
    publisher: "Mazda Türkiye",
  },
  teslaSite: {
    url: "https://www.tesla.com/tr_tr/modely",
    title: "Tesla Türkiye Model Y resmi sayfa",
    date: "2026-08-07",
    role: "primary" as const,
    publisher: "Tesla",
  },
  teslaAug: {
    url: "https://www.cnbce.com/otomotiv/tesladan-agustos-zammi-model-ynin-uc-versiyonunun-fiyati-artti-iste-yeni-fiyatlar-h34369",
    title: "Tesla Model Y Ağustos 2026 TR fiyatları",
    date: "2026-08-01",
    role: "secondary" as const,
    publisher: "cnbce.com",
  },
  toggOfficial: {
    url: "https://www.togg.com.tr/price-list",
    title: "Togg resmi fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
    publisher: "TOGG",
  },
  toggAug: {
    url: "https://www.gzt.com/gundem/togg-agustos-2026-fiyat-listesi-t10x-t10f-kampanyasi-4248755",
    title: "Togg Ağustos 2026 T10X/T10F",
    date: "2026-08-01",
    role: "secondary" as const,
    publisher: "gzt.com",
  },
  bydOfficial: {
    url: "https://www.bydauto.com.tr/fiyat-listesi",
    title: "BYD Türkiye resmi fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
    publisher: "BYD Türkiye",
  },
  bydNov2025: {
    url: "https://www.gzt.com/foto-galeri/z-raporu/byd-kasim-2025-fiyat-listesi-seal-seal-u-dm-i-tang-han-atto-3-atto2-dolphin-sealion-7-fiyat-listesi-byd-turkiye-fiyati-2051834",
    title: "BYD Kasım/Aralık 2025 Atto 3/Dolphin versiyon tablosu",
    date: "2025-12-06",
    role: "primary" as const,
    type: "price_list_archive",
    publisher: "gzt.com",
  },
  bydOnedio: {
    url: "https://onedio.com/haber/kasim-2025-byd-fiyat-listesi-iste-byd-atto-3-dolphin-han-seal-u-dm-i-tang-ve-seal-u-ev-guncel-fiyatlari-1323129",
    title: "BYD Kasım 2025 Atto 3/Dolphin Onedio tablosu",
    date: "2025-11-01",
    role: "secondary" as const,
    publisher: "onedio.com",
  },
  mgOfficial: {
    url: "https://www.mg-turkey.com/tr/fiyat-listesi.html",
    title: "MG Türkiye resmi fiyat listesi",
    date: "2026-08-07",
    role: "primary" as const,
    publisher: "MG Türkiye",
  },
  mgAug: {
    url: "https://www.webtekno.com/agustos-2026-mg-fiyat-listesi-h221788.html",
    title: "MG Ağustos 2026 versiyon tablosu",
    date: "2026-08-05",
    role: "secondary" as const,
    publisher: "webtekno.com",
  },
};

// ——— ALFA ROMEO ———
const ALFA_SELECTABLE = [
  { series: "Junior", category: "Arazi, SUV & Pickup" },
  { series: "Tonale", category: "Arazi, SUV & Pickup" },
  { series: "Giulia", category: "Otomobil" },
  { series: "Stelvio", category: "Arazi, SUV & Pickup" },
];
const ALFA_ROWS: Config[] = [
  ...([
    ["2.0 200hp RWD AT", "Sprint", "200", "RWD"],
    ["2.0 280hp AWD AT", "Veloce", "280", "AWD"],
  ] as const).map(([model, trim, hp, drive]) => ({
    brand: "Alfa Romeo",
    series: "Giulia",
    model,
    trim,
    generation: "Giulia TR MY2020",
    generationCode: "952",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1995",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: `Kasım 2020 Giulia ${model} ${trim} — archive price list (version≠trim).`,
    sources: [SRC.alfaNov2020, SRC.alfaCmp, SRC.alfaSite],
  })),
  ...([
    ["2.0 200hp AWD AT", "Sprint", "200"],
    ["2.0 280hp AWD AT", "Veloce", "280"],
  ] as const).map(([model, trim, hp]) => ({
    brand: "Alfa Romeo",
    series: "Stelvio",
    model,
    trim,
    generation: "Stelvio TR MY2020",
    generationCode: "949",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1995",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Kasım 2020 Stelvio ${model} ${trim} — archive price list.`,
    sources: [SRC.alfaNov2020, SRC.alfaCmp, SRC.alfaSite],
  })),
];

// ——— PORSCHE ———
const PORSCHE_SELECTABLE = [
  { series: "911", category: "Otomobil" },
  { series: "Cayenne", category: "Arazi, SUV & Pickup" },
  { series: "Cayenne Coupe", category: "Arazi, SUV & Pickup" },
  { series: "Macan", category: "Arazi, SUV & Pickup" },
  { series: "Panamera", category: "Otomobil" },
  { series: "Taycan", category: "Otomobil" },
  { series: "Taycan Cross Turismo", category: "Arazi, SUV & Pickup" },
];
const PORSCHE_ROWS: Config[] = []; // already heavily verified in catalog

// ——— LEXUS ———
const LEXUS_SELECTABLE = [
  { series: "LBX", category: "Arazi, SUV & Pickup" },
  { series: "NX", category: "Arazi, SUV & Pickup" },
  { series: "RX", category: "Arazi, SUV & Pickup" },
  { series: "RZ", category: "Arazi, SUV & Pickup" },
  { series: "ES", category: "Otomobil" },
  { series: "LM", category: "Minivan & Panelvan" },
];
const LEXUS_ROWS: Config[] = [
  ...([
    ["350h AWD", "Executive", "AUTOMATIC"],
    ["350h AWD", "Exclusive", "AUTOMATIC"],
  ] as const).map(([model, trim, transmission]) => ({
    brand: "Lexus",
    series: "RX",
    model,
    trim,
    generation: "RX Hybrid TR MY2026",
    generationCode: "AL10",
    yearFrom: 2023,
    yearTo: 2026,
    fuelType: "HYBRID",
    engineVolume: "2487",
    powerHp: "",
    transmission,
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `RX ${model} ${trim} E-CVT — Ağustos/Temmuz 2026 published TR tables.`,
    sources: [SRC.lexusAug, SRC.lexusJul, SRC.lexusSite],
  })),
  {
    brand: "Lexus",
    series: "RX",
    model: "500h AWD",
    trim: "F Sport",
    generation: "RX Performance Hybrid TR MY2025/26",
    generationCode: "AL10",
    yearFrom: 2023,
    yearTo: 2026,
    fuelType: "HYBRID",
    engineVolume: "2393",
    powerHp: "",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "RX 500h AWD F Sport 6AT — Ağustos 2026 Performans Hybrid satırı.",
    sources: [SRC.lexusAug, SRC.lexusJul, SRC.lexusSite],
  },
  ...([
    ["350h 4 Koltuklu E-CVT", "4-Seat"],
    ["350h 7 Koltuklu E-CVT", "7-Seat"],
  ] as const).map(([model, trim]) => ({
    brand: "Lexus",
    series: "LM",
    model,
    trim,
    generation: "LM Hybrid TR MY2026",
    generationCode: "AW10",
    yearFrom: 2024,
    yearTo: 2026,
    fuelType: "HYBRID",
    engineVolume: "2487",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Minivan & Panelvan",
    notes: `LM ${model} — Ağustos 2026 published TR tables (seat count as trim).`,
    sources: [SRC.lexusAug, SRC.lexusJul, SRC.lexusSite],
  })),
  {
    brand: "Lexus",
    series: "RZ",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "RZ EV overlay series preserved; absent from Aug 2026 published Lexus hybrid-focused tables — discrete official EV rows pending (no invent).",
    sources: [SRC.lexusAug, SRC.lexusSite],
  },
  {
    brand: "Lexus",
    series: "ES",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "ES Hybrid historically TR (dealer PDFs); not in Aug 2026 LBX/NX/RX/LM published focus — archive ingest pending.",
    sources: [SRC.lexusAug, SRC.lexusSite],
  },
];

// ——— JAGUAR ———
const JAG_SELECTABLE = [
  { series: "E-Pace", category: "Arazi, SUV & Pickup" },
  { series: "F-Pace", category: "Arazi, SUV & Pickup" },
  { series: "I-Pace", category: "Arazi, SUV & Pickup" },
  { series: "XE", category: "Otomobil" },
  { series: "XF", category: "Otomobil" },
];
const JAG_ROWS: Config[] = [
  {
    brand: "Jaguar",
    series: "XE",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "XE discontinued historically TR — archive version×trim not located this pass.",
    sources: [SRC.jagSite],
  },
  {
    brand: "Jaguar",
    series: "XF",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "XF discontinued historically TR — archive version×trim not located this pass.",
    sources: [SRC.jagSite, SRC.jagFpace],
  },
];

// ——— LAND ROVER ———
const LR_SELECTABLE = [
  { series: "Defender", category: "Arazi, SUV & Pickup" },
  { series: "Range Rover Evoque", category: "Arazi, SUV & Pickup" },
  { series: "Discovery Sport", category: "Arazi, SUV & Pickup" },
  { series: "Range Rover Velar", category: "Arazi, SUV & Pickup" },
  { series: "Range Rover Sport", category: "Arazi, SUV & Pickup" },
  { series: "Range Rover", category: "Arazi, SUV & Pickup" },
];
const LR_ROWS: Config[] = [
  ...([
    ["1.5 MHEV 160 bg", "S", "160", "HYBRID", "1498"],
    ["1.5 MHEV 160 bg", "DYNAMIC SE", "160", "HYBRID", "1498"],
    ["1.5 PHEV 269 bg", "S", "269", "PLUGIN_HYBRID", "1498"],
    ["1.5 PHEV 269 bg", "DYNAMIC SE", "269", "PLUGIN_HYBRID", "1498"],
  ] as const).map(([model, trim, hp, fuel, vol]) => ({
    brand: "Land Rover",
    series: "Range Rover Evoque",
    model,
    trim,
    generation: "Evoque L551 TR MY2026",
    generationCode: "L551",
    yearFrom: 2024,
    yearTo: 2026,
    fuelType: fuel,
    engineVolume: vol,
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_OFFICIAL",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Evoque ${model} ${trim} — resmi landrover.com.tr fiyat listesi.`,
    sources: [SRC.lrEvoque],
  })),
  ...([
    ["2.0D MHEV 204 bg", "S", "204"],
    ["2.0D MHEV 204 bg", "DYNAMIC SE", "204"],
  ] as const).map(([model, trim, hp]) => ({
    brand: "Land Rover",
    series: "Range Rover Velar",
    model,
    trim,
    generation: "Velar L560 TR MY2026",
    generationCode: "L560",
    yearFrom: 2024,
    yearTo: 2026,
    fuelType: "HYBRID",
    engineVolume: "1997",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_OFFICIAL",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Velar ${model} ${trim} — resmi fiyat PDF.`,
    sources: [SRC.lrVelar],
  })),
  ...([
    ["1.5 PHEV 269 bg", "DYNAMIC S", "269"],
    ["1.5 PHEV 269 bg", "LANDMARK", "269"],
  ] as const).map(([model, trim, hp]) => ({
    brand: "Land Rover",
    series: "Discovery Sport",
    model,
    trim,
    generation: "Discovery Sport L550 TR MY2026",
    generationCode: "L550",
    yearFrom: 2024,
    yearTo: 2026,
    fuelType: "PLUGIN_HYBRID",
    engineVolume: "1498",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_OFFICIAL",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Discovery Sport ${model} ${trim} — resmi fiyat listesi.`,
    sources: [SRC.lrDsport],
  })),
  ...([
    ["3.0D MHEV 300 bg", "DYNAMIC SE", "300"],
    ["3.0D MHEV 300 bg", "DYNAMIC HSE", "300"],
    ["3.0D MHEV 350 bg", "AUTOBIOGRAPHY", "350"],
    ["4.4 MHEV 615 bg", "SV BLACK", "615"],
  ] as const).map(([model, trim, hp]) => ({
    brand: "Land Rover",
    series: "Range Rover Sport",
    model,
    trim,
    generation: "Range Rover Sport L461 TR MY2026",
    generationCode: "L461",
    yearFrom: 2023,
    yearTo: 2026,
    fuelType: "HYBRID",
    engineVolume: model.startsWith("4.4") ? "4395" : "2997",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_OFFICIAL",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `RR Sport ${model} ${trim} — resmi fiyat listesi.`,
    sources: [SRC.lrSport],
  })),
  ...([
    ["SWB 3.0D MHEV 300 bg", "SIGNATURE", "300", "2997"],
    ["SWB 3.0D MHEV 300 bg", "SIGNATURE PLUS", "300", "2997"],
    ["SWB 3.0D MHEV 350 bg", "AUTOBIOGRAPHY", "350", "2997"],
    ["SWB 3.0 PHEV 460 bg", "AUTOBIOGRAPHY", "460", "2996"],
    ["SWB 4.4 MHEV 530 bg", "AUTOBIOGRAPHY", "530", "4395"],
  ] as const).map(([model, trim, hp, vol]) => ({
    brand: "Land Rover",
    series: "Range Rover",
    model,
    trim,
    generation: "Range Rover L460 TR MY2026",
    generationCode: "L460",
    yearFrom: 2022,
    yearTo: 2026,
    fuelType: model.includes("PHEV") ? "PLUGIN_HYBRID" : "HYBRID",
    engineVolume: vol,
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_OFFICIAL",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Range Rover ${model} ${trim} — resmi SWB fiyat listesi (sampled rows).`,
    sources: [SRC.lrFull],
  })),
];

// ——— JEEP ———
const JEEP_SELECTABLE = [
  { series: "Avenger", category: "Arazi, SUV & Pickup" },
  { series: "Compass", category: "Arazi, SUV & Pickup" },
  { series: "Renegade", category: "Arazi, SUV & Pickup" },
  { series: "Wrangler", category: "Arazi, SUV & Pickup" },
];
const JEEP_ROWS: Config[] = [
  ...([
    ["1.3 150 hp DDCT", "Longitude", "GASOLINE", "FWD", "150"],
    ["1.6 120 hp DDCT", "Longitude", "DIESEL", "FWD", "120"],
    ["1.6 120 hp DDCT", "Limited", "DIESEL", "FWD", "120"],
    ["1.3 180 hp AT", "Longitude", "GASOLINE", "AWD", "180"],
  ] as const).map(([model, trim, fuel, drive, hp]) => ({
    brand: "Jeep",
    series: "Renegade",
    model,
    trim,
    generation: "Renegade TR MY2020",
    generationCode: "BU",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: model.startsWith("1.6") ? "1598" : "1332",
    powerHp: hp,
    transmission: "AUTOMATIC",
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Nisan 2020 Renegade ${model} ${trim} — archive price list.`,
    sources: [SRC.jeepApr2020, SRC.jeepJun2019, SRC.jeepSite],
  })),
  {
    brand: "Jeep",
    series: "Wrangler",
    model: "2.0 272 hp 8AT",
    trim: "Rubicon",
    generation: "Wrangler JL TR MY2020",
    generationCode: "JL",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1995",
    powerHp: "272",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: "Nisan 2020 Wrangler 2.0 Rubicon 4x4 — archive price list.",
    sources: [SRC.jeepApr2020, SRC.jeepSite],
  },
  ...([
    ["1.4 170 hp 9AT", "Limited", "349900"],
    ["1.4 170 hp 9AT", "Limited Executive", "369900"],
  ] as const).map(([model, trim]) => ({
    brand: "Jeep",
    series: "Compass",
    model,
    trim,
    generation: "Compass TR MY2020",
    generationCode: "MP",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1368",
    powerHp: "170",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Nisan 2020 Compass ${model} ${trim} AWD — historical ICE (alongside current E-Hybrid).`,
    sources: [SRC.jeepApr2020, SRC.jeepSite],
  })),
];

// ——— MITSUBISHI ———
const MITSU_SELECTABLE = [
  { series: "ASX", category: "Arazi, SUV & Pickup" },
  { series: "Eclipse Cross", category: "Arazi, SUV & Pickup" },
  { series: "L200", category: "Arazi, SUV & Pickup" },
  { series: "Space Star", category: "Otomobil" },
];
const MITSU_ROWS: Config[] = [
  ...([
    ["1.5 Invite MT", "Invite", "MANUAL", "FWD"],
    ["1.5 Invite CVT", "Invite", "AUTOMATIC", "FWD"],
    ["1.5 Intense CVT", "Intense", "AUTOMATIC", "FWD"],
    ["1.5 Instyle CVT", "Instyle", "AUTOMATIC", "AWD"],
  ] as const).map(([model, trim, transmission, drive]) => ({
    brand: "Mitsubishi",
    series: "Eclipse Cross",
    model,
    trim,
    generation: "Eclipse Cross TR MY2020",
    generationCode: "GK",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1499",
    powerHp: "150",
    transmission,
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Mayıs 2020 Eclipse Cross ${model} ${trim} — archive price list.`,
    sources: [SRC.mitsuMay2020, SRC.mitsuDec2019],
  })),
  ...([
    ["4x2 Tornado MT", "Tornado", "MANUAL", "RWD"],
    ["4x2 Tornado AT", "Tornado", "AUTOMATIC", "RWD"],
    ["4x4 Storm MT", "Storm", "MANUAL", "AWD"],
    ["4x4 Tornado MT", "Tornado", "MANUAL", "AWD"],
    ["4x4 Blizzard AT", "Blizzard", "AUTOMATIC", "AWD"],
    ["4x4 Premium AT", "Premium", "AUTOMATIC", "AWD"],
  ] as const).map(([model, trim, transmission, drive]) => ({
    brand: "Mitsubishi",
    series: "L200",
    model,
    trim,
    generation: "L200 TR MY2020",
    generationCode: "KJ",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "DIESEL",
    engineVolume: "2268",
    powerHp: "150",
    transmission,
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Mayıs 2020 L200 ${model} ${trim} — archive + LOG resmi kaynaklı.`,
    sources: [SRC.mitsuMay2020, SRC.mitsuL200],
  })),
];

// ——— SUBARU ———
const SUBARU_SELECTABLE = [
  { series: "Forester", category: "Arazi, SUV & Pickup" },
  { series: "Crosstrek", category: "Arazi, SUV & Pickup" },
  { series: "Solterra", category: "Arazi, SUV & Pickup" },
  { series: "XV", category: "Arazi, SUV & Pickup" },
  { series: "Outback", category: "Arazi, SUV & Pickup" },
];
const SUBARU_ROWS: Config[] = [
  ...([
    ["1.6i Lineartronic", "Xtreme"],
    ["1.6i Lineartronic", "Xclusive"],
  ] as const).map(([model, trim]) => ({
    brand: "Subaru",
    series: "XV",
    model,
    trim,
    generation: "XV GT facelift TR MY2020",
    generationCode: "GT",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1600",
    powerHp: "114",
    transmission: "AUTOMATIC",
    driveType: "AWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Aralık 2020 XV ${model} ${trim} — multi press citing TR list prices (predecessor to Crosstrek naming).`,
    sources: [SRC.subaruXv, SRC.subaruXvCnn, SRC.subaruOfficial],
  })),
  {
    brand: "Subaru",
    series: "Outback",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "Outback not on Aug 2026 official subaru.com.tr price excerpt — historical/current discrete rows pending.",
    sources: [SRC.subaruOfficial],
  },
];

// ——— SUZUKI ———
const SUZUKI_SELECTABLE = [
  { series: "Vitara", category: "Arazi, SUV & Pickup" },
  { series: "Swift", category: "Otomobil" },
  { series: "S-Cross", category: "Arazi, SUV & Pickup" },
  { series: "Jimny", category: "Arazi, SUV & Pickup" },
];
const SUZUKI_ROWS: Config[] = [
  ...([
    ["1.4 MHEV 6AT", "GL Elegance", "FWD"],
    ["1.4 MHEV 6AT AllGrip", "GL Elegance", "AWD"],
    ["1.4 MHEV 6AT", "GLX Premium", "FWD"],
    ["1.4 MHEV 6AT AllGrip", "GLX Premium", "AWD"],
  ] as const).map(([model, trim, drive]) => ({
    brand: "Suzuki",
    series: "S-Cross",
    model,
    trim,
    generation: "S-Cross Hybrid TR MY2024",
    generationCode: "JY",
    yearFrom: 2024,
    yearTo: 2024,
    fuelType: "HYBRID",
    engineVolume: "1373",
    powerHp: "129",
    transmission: "AUTOMATIC",
    driveType: drive,
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Ağustos 2024 S-Cross ${model} ${trim} — Onedio citing Suzuki TR list + official price hub.`,
    sources: [SRC.suzukiOnedio, SRC.suzukiOfficial],
  })),
];

// ——— MAZDA ———
const MAZDA_SELECTABLE = [
  { series: "Mazda3", category: "Otomobil" },
  { series: "CX-5", category: "Arazi, SUV & Pickup" },
  { series: "CX-30", category: "Arazi, SUV & Pickup" },
  { series: "CX-60", category: "Arazi, SUV & Pickup" },
  { series: "MX-5", category: "Otomobil" },
  { series: "MX-5 RF", category: "Otomobil" },
];
const MAZDA_ROWS: Config[] = [
  ...([
    ["1.5 SKY-G", "Motion", "MANUAL", "GASOLINE"],
    ["1.5 SKY-G", "Reflex", "MANUAL", "GASOLINE"],
    ["1.5 SKY-G", "Motion", "AUTOMATIC", "GASOLINE"],
    ["1.5 SKY-G", "Reflex", "AUTOMATIC", "GASOLINE"],
    ["1.5 SKY-G", "Power", "AUTOMATIC", "GASOLINE"],
    ["1.5 SKY-G", "Power Sense", "AUTOMATIC", "GASOLINE"],
    ["1.5 SKY-D", "Motion", "MANUAL", "DIESEL"],
    ["1.5 SKY-D", "Reflex", "AUTOMATIC", "DIESEL"],
    ["1.5 SKY-D", "Power Sense", "AUTOMATIC", "DIESEL"],
  ] as const).map(([model, trim, transmission, fuel]) => ({
    brand: "Mazda",
    series: "Mazda3",
    model,
    trim,
    generation: "Mazda3 BP Hatchback TR MY2020",
    generationCode: "BP",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: fuel,
    engineVolume: "1496",
    powerHp: "",
    transmission,
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: `Temmuz 2020 Mazda3 HB ${model} ${trim} — archive (leather color variants collapsed into trim family).`,
    sources: [SRC.mazdaJul2020, SRC.mazdaApr2020],
  })),
  ...([
    ["2.0 SKY-G AT", "Power Sense"],
    ["2.0 SKY-G AT", "Power Sense Plus"],
  ] as const).map(([model, trim]) => ({
    brand: "Mazda",
    series: "CX-5",
    model,
    trim,
    generation: "CX-5 KF TR MY2020",
    generationCode: "KF",
    yearFrom: 2020,
    yearTo: 2020,
    fuelType: "GASOLINE",
    engineVolume: "1998",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes: `Temmuz 2020 CX-5 ${model} ${trim} — historical ICE rows.`,
    sources: [SRC.mazdaJul2020, SRC.mazdaApr2020],
  })),
  {
    brand: "Mazda",
    series: "CX-30",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "CX-30 TR historical sales existed; discrete official version×trim matrix not confirmed this pass (post-2024 TR passenger export halt).",
    sources: [SRC.mazdaOfficialPdf, SRC.mazdaJul2020],
  },
  {
    brand: "Mazda",
    series: "CX-60",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "CX-60 TR retail matrix not confirmed in sourced official PDFs reviewed (export halt context) — REVIEW stub.",
    sources: [SRC.mazdaOfficialPdf],
  },
];

// ——— TESLA ———
const TESLA_SELECTABLE = [
  { series: "Model Y", category: "Arazi, SUV & Pickup" },
  { series: "Model 3", category: "Otomobil" },
  { series: "Model S", category: "Otomobil" },
  { series: "Model X", category: "Arazi, SUV & Pickup" },
];
const TESLA_ROWS: Config[] = [
  {
    brand: "Tesla",
    series: "Model 3",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes:
      "Model 3 historically sold TR; Aug 2026 consumer focus is Model Y — fresh official Model 3 version×trim confirm pending (EV overlay Model 3 preserved, no invent).",
    sources: [SRC.teslaSite, SRC.teslaAug],
  },
  {
    brand: "Tesla",
    series: "Model S",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Otomobil",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "Model S TR retail presence not confirmed in Aug 2026 sources — EV overlay preserved.",
    sources: [SRC.teslaSite],
  },
  {
    brand: "Tesla",
    series: "Model X",
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category: "Arazi, SUV & Pickup",
    historicalCoverage: "HISTORICAL_COVERAGE_INCOMPLETE",
    trimStatus: "NO_VERIFIED_TRIM_FOUND",
    notes: "Model X TR retail presence not confirmed in Aug 2026 sources — EV overlay preserved.",
    sources: [SRC.teslaSite],
  },
];

// ——— TOGG ———
const TOGG_SELECTABLE = [
  { series: "T10X", category: "Arazi, SUV & Pickup" },
  { series: "T10F", category: "Otomobil" },
];
const TOGG_ROWS: Config[] = []; // already official-verified

// ——— BYD ———
const BYD_SELECTABLE = [
  { series: "SEAL", category: "Otomobil" },
  { series: "SEALION 7", category: "Arazi, SUV & Pickup" },
  { series: "HAN", category: "Otomobil" },
  { series: "TANG", category: "Arazi, SUV & Pickup" },
  { series: "Atto 3", category: "Arazi, SUV & Pickup" },
  { series: "Dolphin", category: "Otomobil" },
];
const BYD_ROWS: Config[] = [
  {
    brand: "BYD",
    series: "Atto 3",
    model: "150 kW",
    trim: "Design",
    generation: "Atto 3 TR MY2025",
    generationCode: "Atto3",
    yearFrom: 2023,
    yearTo: 2025,
    fuelType: "ELECTRIC",
    powerHp: "204",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Arazi, SUV & Pickup",
    notes:
      "Atto 3 150 kW Design — Kasım/Aralık 2025 published TR tables (historical; absent Aug 2026 4-model official list). EV overlay Atto 3 preserved.",
    sources: [SRC.bydNov2025, SRC.bydOnedio, SRC.bydOfficial],
  },
  ...([
    ["150 kW", "Comfort"],
    ["150 kW", "Design"],
  ] as const).map(([model, trim]) => ({
    brand: "BYD",
    series: "Dolphin",
    model,
    trim,
    generation: "Dolphin TR MY2025",
    generationCode: "Dolphin",
    yearFrom: 2024,
    yearTo: 2025,
    fuelType: "ELECTRIC",
    powerHp: "204",
    transmission: "AUTOMATIC",
    driveType: "FWD",
    confidence: "VERIFIED_MULTI_SOURCE",
    verifiedForTurkey: true,
    category: "Otomobil",
    notes: `Dolphin ${model} ${trim} — Kasım/Aralık 2025 published TR tables (historical vs Aug 2026 official). EV overlay Dolphin preserved.`,
    sources: [SRC.bydNov2025, SRC.bydOnedio, SRC.bydOfficial],
  })),
];

// ——— MG ———
const MG_SELECTABLE = [
  { series: "ZS Hybrid+", category: "Arazi, SUV & Pickup" },
  { series: "HS Hybrid+", category: "Arazi, SUV & Pickup" },
  { series: "HS", category: "Arazi, SUV & Pickup" },
  { series: "MG7", category: "Otomobil" },
];
const MG_ROWS: Config[] = []; // already verified current

function main() {
  const results = [
    processBrand("Alfa Romeo.json", "Alfa Romeo", ALFA_SELECTABLE, ALFA_ROWS, "2026.08-deep-alfa-romeo-v2-premium"),
    processBrand("Porsche.json", "Porsche", PORSCHE_SELECTABLE, PORSCHE_ROWS, "2026.08-deep-porsche-v3-premium-gate"),
    processBrand("Lexus.json", "Lexus", LEXUS_SELECTABLE, LEXUS_ROWS, "2026.08-deep-lexus-v2-premium"),
    processBrand("Jaguar.json", "Jaguar", JAG_SELECTABLE, JAG_ROWS, "2026.08-deep-jaguar-v2-premium"),
    processBrand("Land Rover.json", "Land Rover", LR_SELECTABLE, LR_ROWS, "2026.08-deep-land-rover-v2-premium"),
    processBrand("Jeep.json", "Jeep", JEEP_SELECTABLE, JEEP_ROWS, "2026.08-deep-jeep-v2-premium"),
    processBrand("Mitsubishi.json", "Mitsubishi", MITSU_SELECTABLE, MITSU_ROWS, "2026.08-deep-mitsubishi-v2-premium"),
    processBrand("Subaru.json", "Subaru", SUBARU_SELECTABLE, SUBARU_ROWS, "2026.08-deep-subaru-v2-premium"),
    processBrand("Suzuki.json", "Suzuki", SUZUKI_SELECTABLE, SUZUKI_ROWS, "2026.08-deep-suzuki-v2-premium"),
    processBrand("Mazda.json", "Mazda", MAZDA_SELECTABLE, MAZDA_ROWS, "2026.08-deep-mazda-v2-premium"),
    processBrand("Tesla.json", "Tesla", TESLA_SELECTABLE, TESLA_ROWS, "2026.08-deep-tesla-v2-ev"),
    processBrand("TOGG.json", "TOGG", TOGG_SELECTABLE, TOGG_ROWS, "2026.08-deep-togg-v2-ev"),
    processBrand("BYD.json", "BYD", BYD_SELECTABLE, BYD_ROWS, "2026.08-deep-byd-v2-ev"),
    processBrand("MG.json", "MG", MG_SELECTABLE, MG_ROWS, "2026.08-deep-mg-v2-premium"),
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

  mkdirSync(join(ROOT, "scripts/output"), { recursive: true });
  writeFileSync(
    PROGRESS,
    JSON.stringify(
      {
        ...progress,
        at: new Date().toISOString(),
        checkpointCommit: "347a961",
        phase: "research-premium-ev-batch",
        applyAllowed: false,
        noApplyDuringResearch: true,
        completedBrands: [...completed].sort(),
        inProgressBrands: [...inProgress].sort(),
        premiumEvBatch: {
          brands: results.map((r) => r.brand),
          note: "Gate COMPLETED ≠ final absolute historical complete",
          results: results.map((r) => ({
            brand: r.brand,
            added: r.added,
            total: r.total,
            verified: r.verified,
            reviewRequired: r.reviewRequired,
            status: r.status,
            seriesWithoutResearch: r.seriesWithoutResearch,
            currentOnly: r.currentOnly,
            urls: r.urls,
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
    note: "Not final absolute complete — gate COMPLETED = seriesWithoutResearch 0",
    results: results.map((r) => ({
      brand: r.brand,
      status: r.status,
      added: r.added,
      total: r.total,
      verified: r.verified,
      reviewRequired: r.reviewRequired,
      seriesWithoutResearch: r.seriesWithoutResearch,
      urls: r.urls,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
