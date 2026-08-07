/**
 * One-shot generator for Turkey-market deep vehicle catalogs.
 * Sources: official *.com.tr price lists + published Aug/Jul 2026 archives.
 */
import { writeFileSync } from "fs";
import { join } from "path";

const OUT = join(process.cwd(), "data/vehicle-deep-catalog");
const NOW = "2026-08-07T12:00:00.000Z";
const D = "2026-08-07";

function src(url, title, role = "primary", date = D) {
  return { url, title, date, role };
}

function cfg(partial) {
  return {
    generation: partial.generation ?? "Current TR MY",
    generationCode: partial.generationCode ?? "",
    yearFrom: partial.yearFrom ?? 2025,
    yearTo: partial.yearTo ?? 2026,
    driveType: partial.driveType ?? "FWD",
    verifiedForTurkey: partial.confidence === "REVIEW_REQUIRED" ? false : true,
    category: partial.category ?? "Otomobil",
    ...partial,
  };
}

function stub(brand, series, notes, sources) {
  return cfg({
    brand,
    series,
    model: "",
    trim: "",
    generation: "",
    generationCode: "",
    yearFrom: null,
    yearTo: null,
    fuelType: "",
    transmission: "",
    driveType: "",
    engineVolume: "",
    powerHp: "",
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    notes,
    sources,
  });
}

function writeBrand(file, payload) {
  writeFileSync(join(OUT, file), JSON.stringify(payload, null, 2) + "\n", "utf8");
  const configs = payload.configurations;
  const vo = configs.filter((c) => c.confidence === "VERIFIED_OFFICIAL").length;
  const vm = configs.filter((c) => c.confidence === "VERIFIED_MULTI_SOURCE").length;
  const rr = configs.filter((c) => c.confidence === "REVIEW_REQUIRED").length;
  console.log(`${file}: total=${configs.length} VO=${vo} VM=${vm} RR=${rr}`);
}

// ——— FIAT ———
{
  const fiatPrimary = src(
    "https://onedio.com/haber/agustos-2026-fiat-fiyat-listesi-iste-egea-sedan-cross-wagon-panda-ve-fiat-600-guncel-fiyatlari-1374040",
    "Fiat Ağustos 2026 fiyat listesi (resmi site satırları)",
    "primary"
  );
  const fiatOfficial = src("https://www.fiat.com.tr/", "Fiat Türkiye resmi site", "secondary");
  const egeaTech = src(
    "https://otozellik.com/fiat-egea-2026-teknik-ozellikleri-ve-fiyatlari/",
    "Fiat Egea 2026 teknik/donanım özeti",
    "secondary"
  );

  const configs = [];
  for (const [trim, tx, powerNote] of [
    ["Easy", "MANUAL", "130"],
    ["Easy", "AUTOMATIC", "130"],
    ["Urban", "MANUAL", "130"],
    ["Urban", "AUTOMATIC", "130"],
    ["Lounge", "MANUAL", "130"],
    ["Lounge", "AUTOMATIC", "130"],
  ]) {
    configs.push(
      cfg({
        brand: "Fiat",
        series: "Egea",
        model: "1.6 Multijet 130 HP",
        trim,
        generation: "Egea Sedan TR MY2026",
        generationCode: "Tipo/Egea",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: "DIESEL",
        engineVolume: "1598",
        powerHp: powerNote,
        transmission: tx,
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Egea Sedan ${trim} 1.6 Multijet 130 HP ${tx === "MANUAL" ? "Manuel" : "DCT"} — Ağustos 2026 TR fiyat satırı`,
        sources: [fiatPrimary, fiatOfficial, egeaTech],
      })
    );
  }
  for (const trim of ["Street", "Urban", "Lounge", "Limited"]) {
    configs.push(
      cfg({
        brand: "Fiat",
        series: "Egea Cross",
        model: "1.6 Multijet 130 HP Traction+",
        trim,
        generation: "Egea Cross TR MY2026",
        generationCode: "Tipo/Egea Cross",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: "DIESEL",
        engineVolume: "1598",
        powerHp: "130",
        transmission: "AUTOMATIC",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Egea Cross ${trim} DCT Traction+ — Ağustos 2026 TR fiyat satırı`,
        sources: [fiatPrimary, fiatOfficial, egeaTech],
      })
    );
  }
  configs.push(
    stub(
      "Fiat",
      "Egea Wagon",
      "Egea Station Wagon historical TR rows need dedicated official archive; not inventing from global Tipo SW.",
      [fiatOfficial, fiatPrimary]
    ),
    stub(
      "Fiat",
      "Egea (historical gasoline)",
      "Pre-2024 gasoline 1.4/1.6 FireFly TR archive rows pending official PDF ingest.",
      [fiatOfficial]
    )
  );

  writeBrand("Fiat.json", {
    brand: "Fiat",
    brandSlug: "fiat",
    version: "2026.08-deep-fiat-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["Egea", "Egea Cross", "Egea Wagon", "Egea (historical gasoline)"],
    status: "IN_PROGRESS",
    notes:
      "Current TR Egea Sedan/Cross Multijet rows from Aug 2026 published price tables citing fiat.com.tr. Historical gasoline/Wagon still REVIEW.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["Egea", "Egea Cross", "Egea Wagon"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["Egea Wagon", "Egea (historical gasoline)"],
    },
  });
}

// ——— FORD ———
{
  const fordPrimary = src(
    "https://onedio.com/haber/temmuz-2026-ford-fiyat-listesi-iste-ford-focus-puma-kuga-journey-courier-edge-ve-ranger-guncel-fiyatlari-1369315",
    "Ford Temmuz 2026 fiyat listesi (ford.com.tr kaynaklı)",
    "primary",
    "2026-07-10"
  );
  const fordOfficial = src("https://www.ford.com.tr/fiyat-listesi", "Ford Türkiye fiyat listesi", "secondary");
  const fordTech = src(
    "https://teknodiot.com/ford-fiyat-listesi",
    "Ford Temmuz 2026 fiyat derlemesi",
    "secondary",
    "2026-07-10"
  );
  const fordCommercial = src(
    "https://www.ford.com.tr/fiyat-listesi/ticari/ford-tourneo-connect",
    "Ford Türkiye ticari fiyat listesi hub",
    "secondary"
  );
  const fiestaNote = src(
    "https://borusannext.com/blog/ford-fiyat-listesi",
    "Ford Fiesta üretimi 2023 durduruldu notu",
    "secondary"
  );

  const configs = [
    cfg({
      brand: "Ford",
      series: "Focus",
      model: "1.5 EcoBlue 115 PS",
      trim: "Titanium Stil",
      generation: "Focus Sedan TR MY2025",
      generationCode: "C519",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "DIESEL",
      engineVolume: "1499",
      powerHp: "115",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Focus Sedan 1.5 EcoBlue 115 PS 8AT Titanium Stil — Temmuz 2026 TR (MY2025)",
      sources: [fordPrimary, fordOfficial, fordTech],
    }),
    cfg({
      brand: "Ford",
      series: "Focus",
      model: "1.5 EcoBlue 115 PS",
      trim: "Titanium X",
      generation: "Focus Sedan TR MY2025",
      generationCode: "C519",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "DIESEL",
      engineVolume: "1499",
      powerHp: "115",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Focus Sedan 1.5 EcoBlue 115 PS 8AT Titanium X — Temmuz 2026 TR (MY2025)",
      sources: [fordPrimary, fordOfficial, fordTech],
    }),
    cfg({
      brand: "Ford",
      series: "Tourneo Courier",
      model: "1.0 EcoBoost 125 PS",
      trim: "Deluxe",
      generation: "Journey Courier TR MY2026",
      generationCode: "Tourneo Courier / Journey",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "999",
      powerHp: "125",
      transmission: "MANUAL",
      category: "Ticari",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Yeni Journey Courier Kombi 1.0 EcoBoost 125 PS MT Deluxe — Temmuz 2026 TR (Tourneo Courier successor naming)",
      sources: [fordPrimary, fordOfficial, fordCommercial],
    }),
    cfg({
      brand: "Ford",
      series: "Tourneo Courier",
      model: "1.0 EcoBoost 125 PS",
      trim: "Titanium",
      generation: "Journey Courier TR MY2026",
      generationCode: "Tourneo Courier / Journey",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "999",
      powerHp: "125",
      transmission: "AUTOMATIC",
      category: "Ticari",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Yeni Journey Courier Kombi 1.0 EcoBoost 125 PS 7AT Titanium — Temmuz 2026 TR",
      sources: [fordPrimary, fordOfficial, fordCommercial],
    }),
    cfg({
      brand: "Ford",
      series: "Tourneo Courier",
      model: "100 kW",
      trim: "Titanium",
      generation: "Journey Courier BEV TR MY2026",
      generationCode: "Tourneo Courier BEV",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "136",
      transmission: "AUTOMATIC",
      category: "Ticari",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Journey Courier BEV Titanium Kombi 100 kW — Temmuz 2026 TR",
      sources: [fordPrimary, fordOfficial],
    }),
    stub(
      "Ford",
      "Fiesta",
      "Fiesta production ended 2023; TR historical used-car trims need dedicated archive. No zero-km list.",
      [fiestaNote, fordOfficial]
    ),
    stub(
      "Ford",
      "Tourneo Custom",
      "Tourneo Custom / E-Tourneo Custom TR commercial PDF rows not fully ingested this pass; hub confirms listing exists.",
      [fordCommercial, fordOfficial]
    ),
    stub(
      "Ford",
      "Focus Hatchback Hybrid",
      "Focus Hatchback 1.0 EcoBoost Hybrid Active Stil reported in secondary Jul 2026 roundups; needs official row confirmation.",
      [fordTech, fordOfficial]
    ),
  ];

  writeBrand("Ford.json", {
    brand: "Ford",
    brandSlug: "ford",
    version: "2026.08-deep-ford-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["Focus", "Tourneo Courier", "Fiesta", "Tourneo Custom", "Focus Hatchback Hybrid"],
    status: "IN_PROGRESS",
    notes:
      "Focus Sedan EcoBlue + Journey/Tourneo Courier rows from Jul 2026 ford.com.tr-cited tables. Fiesta/Custom historical pending.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["Focus", "Tourneo Courier", "Fiesta", "Tourneo Custom"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["Fiesta", "Tourneo Custom", "Focus Hatchback Hybrid"],
    },
  });
}

// ——— TOYOTA ———
{
  const toyotaPrimary = src(
    "https://onedio.com/haber/agustos-2026-toyota-fiyat-listesi-toyota-corolla-yaris-cross-camry-ch-r-rav4-ve-hilux-guncel-fiyatlari-1373750",
    "Toyota Ağustos 2026 fiyat listesi (kampanyalı satırlar)",
    "primary"
  );
  const toyotaOfficial = src(
    "https://turkiye.toyota.com.tr/middle/fiyat-listesi/",
    "Toyota Türkiye resmi fiyat listesi (1 Ağustos 2026)",
    "secondary"
  );
  const toyotaDh = src(
    "https://www.donanimhaber.com/toyota-fiyat-listesi-sifir-toyota-araba-fiyatlari--158860",
    "Toyota Temmuz 2026 fiyat tablosu (liste+kampanya)",
    "secondary",
    "2026-07-01"
  );
  const chrPack = src(
    "https://www.arabalar.com.tr/toyota/c-hr",
    "Toyota C-HR donanım paket sıralaması (Flame/Passion/GR Sport)",
    "secondary"
  );

  const configs = [
    ...[
      ["1.5", "Vision Plus", "GASOLINE", "1490", "125"],
      ["1.5", "Dream", "GASOLINE", "1490", "125"],
      ["1.5", "Dream X-Pack", "GASOLINE", "1490", "125"],
      ["1.5", "Flame X-Pack", "GASOLINE", "1490", "125"],
      ["1.5", "Passion X-Pack", "GASOLINE", "1490", "125"],
    ].map(([eng, trim, fuel, vol, hp]) =>
      cfg({
        brand: "Toyota",
        series: "Corolla",
        model: `${eng} Multidrive S`,
        trim,
        generation: "Corolla Sedan E210 TR",
        generationCode: "E210",
        yearFrom: 2023,
        yearTo: 2026,
        fuelType: fuel,
        engineVolume: vol,
        powerHp: hp,
        transmission: "AUTOMATIC",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Corolla Sedan ${eng} ${trim} Multidrive S — Ağustos 2026 TR kampanyalı satır; resmi fiyat listesi sayfası doğrulandı`,
        sources: [toyotaPrimary, toyotaOfficial, toyotaDh],
      })
    ),
    ...[
      ["Dream", "HYBRID"],
      ["Dream X-Pack", "HYBRID"],
      ["Flame X-Pack", "HYBRID"],
    ].map(([trim]) =>
      cfg({
        brand: "Toyota",
        series: "Corolla",
        model: "1.8 Hybrid e-CVT",
        trim,
        generation: "Corolla Sedan Hybrid E210 TR",
        generationCode: "E210",
        yearFrom: 2023,
        yearTo: 2026,
        fuelType: "HYBRID",
        engineVolume: "1798",
        powerHp: "140",
        transmission: "AUTOMATIC",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Corolla Sedan 1.8 Hybrid ${trim} e-CVT — Ağustos 2026 TR`,
        sources: [toyotaPrimary, toyotaOfficial, toyotaDh],
      })
    ),
    ...[
      ["Flame", "HYBRID"],
      ["Passion", "HYBRID"],
      ["Passion X-Sport", "HYBRID"],
      ["GR SPORT", "HYBRID"],
    ].map(([trim]) =>
      cfg({
        brand: "Toyota",
        series: "C-HR",
        model: "1.8 Hybrid e-CVT",
        trim,
        generation: "C-HR II TR MY2024+",
        generationCode: "AX20",
        yearFrom: 2023,
        yearTo: 2026,
        fuelType: "HYBRID",
        engineVolume: "1798",
        powerHp: "140",
        transmission: "AUTOMATIC",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Yeni C-HR 1.8 Hybrid ${trim} e-CVT — Ağustos 2026 TR`,
        sources: [toyotaPrimary, toyotaOfficial, chrPack],
      })
    ),
    stub(
      "Toyota",
      "RAV4",
      "RAV4 Hybrid 2.5 4x4 Passion X-Pack / GR SPORT listed on TR sites but Aug 2026 campaign prices blank in published tables — archive ingest pending.",
      [toyotaOfficial, toyotaDh, toyotaPrimary]
    ),
  ];

  writeBrand("Toyota.json", {
    brand: "Toyota",
    brandSlug: "toyota",
    version: "2026.08-deep-toyota-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["Corolla", "C-HR", "RAV4"],
    status: "IN_PROGRESS",
    notes:
      "Corolla gasoline/hybrid + C-HR Hybrid from Aug 2026 toyota.com.tr-cited tables. RAV4 pricing incomplete in published campaign tables.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["Corolla", "C-HR", "RAV4"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["RAV4"],
    },
  });
}

// ——— PEUGEOT ———
{
  const peugeotOfficial = src(
    "https://kampanya.peugeot.com.tr/fiyat-listesi/print.html",
    "Peugeot Türkiye resmi fiyat listesi (print)",
    "primary"
  );
  const peugeotOfficial2 = src(
    "https://kampanya.peugeot.com.tr/fiyat-listesi/",
    "Peugeot Türkiye resmi fiyat listesi",
    "secondary"
  );
  const peugeotAug = src(
    "https://www.cnbce.com/otomotiv/peugeot-agustos-2026-fiyat-listesi-aciklandi-bu-ay-yine-zam-yok-iste-model-model-kampanyalar-g34557",
    "Peugeot Ağustos 2026 fiyat listesi özeti",
    "secondary"
  );

  const configs = [
    cfg({
      brand: "Peugeot",
      series: "3008",
      model: "1.2 Hybrid 145 hp eDCS6",
      trim: "Allure",
      generation: "3008 III TR MY2026",
      generationCode: "P84/STLA Medium",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "3008 Allure 1.2 Hybrid 145hp eDCS6 — resmi TR fiyat satırı (ICE 136 + e-motor 21 bileşik)",
      sources: [peugeotOfficial, peugeotOfficial2, peugeotAug],
    }),
    cfg({
      brand: "Peugeot",
      series: "3008",
      model: "1.2 Hybrid 145 hp eDCS6",
      trim: "GT",
      generation: "3008 III TR MY2026",
      generationCode: "P84/STLA Medium",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "3008 GT 1.2 Hybrid 145hp eDCS6 — resmi TR fiyat satırı",
      sources: [peugeotOfficial, peugeotOfficial2, peugeotAug],
    }),
    cfg({
      brand: "Peugeot",
      series: "E-3008",
      model: "157 kW (210 hp)",
      trim: "Allure",
      generation: "E-3008 TR MY2026",
      generationCode: "STLA Medium EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "210",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "E-3008 Allure 157kW — resmi TR fiyat satırı",
      sources: [peugeotOfficial, peugeotOfficial2],
    }),
    cfg({
      brand: "Peugeot",
      series: "E-3008",
      model: "157 kW (210 hp)",
      trim: "GT",
      generation: "E-3008 TR MY2026",
      generationCode: "STLA Medium EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "210",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "E-3008 GT 157kW — resmi TR fiyat satırı",
      sources: [peugeotOfficial, peugeotOfficial2],
    }),
    cfg({
      brand: "Peugeot",
      series: "208",
      model: "E-208 100 kW",
      trim: "GT",
      generation: "E-208 TR MY2026",
      generationCode: "P21 EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "136",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "E-208 GT 100kW — resmi TR fiyat satırı (current 208 range is EV-only in Aug 2026 list)",
      sources: [peugeotOfficial, peugeotOfficial2, peugeotAug],
    }),
    cfg({
      brand: "Peugeot",
      series: "308",
      model: "E-308 115 kW",
      trim: "GT",
      generation: "E-308 TR MY2025",
      generationCode: "P51 EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "156",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "E-308 GT 115kW — resmi TR kampanyalı satır (2025 MY)",
      sources: [peugeotOfficial, peugeotOfficial2, peugeotAug],
    }),
    stub(
      "Peugeot",
      "208 (ICE historical)",
      "ICE 208 PureTech/Active-Allure historical TR archives pending; current official list is E-208 only.",
      [peugeotOfficial]
    ),
    stub(
      "Peugeot",
      "308 (ICE historical)",
      "ICE 308 PureTech/BlueHDi historical TR archives pending; current official list is E-308 only.",
      [peugeotOfficial]
    ),
  ];

  writeBrand("Peugeot.json", {
    brand: "Peugeot",
    brandSlug: "peugeot",
    version: "2026.08-deep-peugeot-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["3008", "E-3008", "208", "308", "208 (ICE historical)", "308 (ICE historical)"],
    status: "IN_PROGRESS",
    notes: "Official kampanya.peugeot.com.tr Aug 2026 rows for 3008/E-3008/E-208/E-308. ICE 208/308 historical REVIEW.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["3008", "208", "308"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["208 (ICE historical)", "308 (ICE historical)"],
    },
  });
}

// ——— OPEL ———
{
  const opelPdf = src(
    "https://fiyatlisteleri.opel.com.tr/Assets/files/Opel_Tum_Modeller_Fiyat_Listesi7.8.2026.pdf",
    "Opel resmi Ağustos 2026 tüm modeller fiyat PDF (7.8.2026)",
    "primary"
  );
  const opelWeb = src(
    "https://fiyatlisteleri.opel.com.tr/tum-araclar",
    "Opel resmi fiyat listeleri (tüm araçlar)",
    "secondary"
  );
  const opelCorsa = src(
    "https://fiyatlisteleri.opel.com.tr/arac/corsa",
    "Opel Corsa resmi fiyat listesi",
    "secondary"
  );
  const opelAug = src(
    "https://www.isinolsa.com/opel-agustos-2026-fiyat-listesi-corsada-145-bin-fronterada-350-bin-indirim/",
    "Opel Ağustos 2026 fiyat tablosu özeti",
    "secondary"
  );

  const configs = [
    cfg({
      brand: "Opel",
      series: "Corsa",
      model: "1.2 100 HP",
      trim: "Edition",
      generation: "Corsa F TR MY2026",
      generationCode: "F",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1199",
      powerHp: "100",
      transmission: "MANUAL",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Corsa 1.2 100 HP MT6 Edition — resmi PDF 7.8.2026",
      sources: [opelPdf, opelCorsa, opelWeb],
    }),
    cfg({
      brand: "Opel",
      series: "Corsa",
      model: "1.2 Hybrid 110 (100 HP)",
      trim: "Edition",
      generation: "Corsa F Hybrid TR MY2026",
      generationCode: "F",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "110",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Corsa Hybrid 1.2 110 e-DCT6 Edition — resmi PDF (ICE 100 + e-motor 21)",
      sources: [opelPdf, opelCorsa, opelWeb],
    }),
    cfg({
      brand: "Opel",
      series: "Corsa",
      model: "1.2 Hybrid 145 (136 HP)",
      trim: "GS",
      generation: "Corsa F Hybrid TR MY2026",
      generationCode: "F",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Corsa Hybrid 1.2 145 e-DCT6 GS — resmi PDF (ICE 136 + e-motor 21)",
      sources: [opelPdf, opelCorsa, opelWeb],
    }),
    cfg({
      brand: "Opel",
      series: "Corsa",
      model: "100 kW",
      trim: "GS",
      generation: "Corsa-e TR MY2026",
      generationCode: "F EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "136",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Corsa Elektrik 100 kW GS — resmi PDF 7.8.2026",
      sources: [opelPdf, opelWeb, opelAug],
    }),
    cfg({
      brand: "Opel",
      series: "Astra",
      model: "1.5 130 HP Dizel",
      trim: "Edition",
      generation: "Astra L TR MY2026",
      generationCode: "L",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "DIESEL",
      engineVolume: "1499",
      powerHp: "130",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Yeni Astra 1.5 130 HP Dizel AT8 Edition — resmi PDF 7.8.2026",
      sources: [opelPdf, opelWeb, opelAug],
    }),
    cfg({
      brand: "Opel",
      series: "Astra",
      model: "1.5 130 HP Dizel",
      trim: "GS",
      generation: "Astra L TR MY2026",
      generationCode: "L",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "DIESEL",
      engineVolume: "1499",
      powerHp: "130",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Yeni Astra 1.5 130 HP Dizel AT8 GS — resmi PDF 7.8.2026",
      sources: [opelPdf, opelWeb, opelAug],
    }),
    stub(
      "Opel",
      "Crossland",
      "Crossland not on Aug 2026 official Opel TR price list (replaced by Frontera). Historical Crossland TR archives pending.",
      [opelPdf, opelWeb]
    ),
  ];

  writeBrand("Opel.json", {
    brand: "Opel",
    brandSlug: "opel",
    version: "2026.08-deep-opel-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["Corsa", "Astra", "Crossland"],
    status: "IN_PROGRESS",
    notes: "Official Opel TR PDF 7.8.2026 for Corsa/Astra. Crossland discontinued from current list — historical REVIEW.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["Corsa", "Astra", "Crossland"],
      historicalArchivesIngested: ["2026-08-07 Opel TR PDF"],
      reviewRequiredSeries: ["Crossland"],
    },
  });
}

// ——— HYUNDAI ———
{
  const hyundaiPrimary = src(
    "https://www.webtekno.com/agustos-2026-hyundai-fiyat-listesi-h221782.html",
    "Hyundai Ağustos 2026 fiyat listesi (detaylı versiyon tablosu)",
    "primary",
    "2026-08-05"
  );
  const hyundaiOfficial = src(
    "https://www.hyundai.com/tr/tr/satis/fiyat-listesi.html",
    "Hyundai Motor Türkiye resmi fiyat listesi",
    "secondary"
  );
  const hyundaiDealer = src(
    "https://hyundai.inallar.com.tr/fiyat-listesi",
    "Hyundai yetkili satıcı fiyat listesi (Inallar)",
    "secondary"
  );

  const configs = [
    ...[
      ["Jump", "MANUAL"],
      ["Jump", "AUTOMATIC"],
      ["Style", "AUTOMATIC"],
      ["Elite", "AUTOMATIC"],
    ].map(([trim, tx]) =>
      cfg({
        brand: "Hyundai",
        series: "i20",
        model: "1.0 T-GDI 90 PS",
        trim,
        generation: "i20 BC3 TR MY2026",
        generationCode: "BC3",
        yearFrom: 2023,
        yearTo: 2026,
        fuelType: "GASOLINE",
        engineVolume: "998",
        powerHp: "90",
        transmission: tx,
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `i20 1.0 T-GDI 90 PS ${trim} ${tx === "MANUAL" ? "Manuel" : "DCT"} — Ağustos 2026 TR (GSR2C varyantları ayrı satır; base trim mapped)`,
        sources: [hyundaiPrimary, hyundaiOfficial, hyundaiDealer],
      })
    ),
    ...[
      ["Jump", "MANUAL", "FWD"],
      ["Jump", "AUTOMATIC", "FWD"],
      ["Style", "AUTOMATIC", "FWD"],
      ["Elite", "AUTOMATIC", "FWD"],
    ].map(([trim, tx, drive]) =>
      cfg({
        brand: "Hyundai",
        series: "Bayon",
        model: "1.0 T-GDI 90 PS",
        trim,
        generation: "Bayon TR MY2026",
        generationCode: "BC3 SUV",
        yearFrom: 2021,
        yearTo: 2026,
        fuelType: "GASOLINE",
        engineVolume: "998",
        powerHp: "90",
        transmission: tx,
        driveType: drive,
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Bayon 1.0 T-GDI 90 PS ${trim} ${tx === "MANUAL" ? "Manuel" : "DCT"} — Ağustos 2026 TR`,
        sources: [hyundaiPrimary, hyundaiOfficial, hyundaiDealer],
      })
    ),
    cfg({
      brand: "Hyundai",
      series: "Tucson",
      model: "1.6 T-GDI 180 PS",
      trim: "Comfort",
      generation: "Tucson NX4 TR MY2026",
      generationCode: "NX4",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1598",
      powerHp: "180",
      transmission: "AUTOMATIC",
      driveType: "FWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Tucson 1.6 T-GDI 180 PS 4x2 Comfort DCT — Ağustos 2026 TR",
      sources: [hyundaiPrimary, hyundaiOfficial, hyundaiDealer],
    }),
    cfg({
      brand: "Hyundai",
      series: "Tucson",
      model: "1.6 T-GDI 180 PS",
      trim: "Prime",
      generation: "Tucson NX4 TR MY2026",
      generationCode: "NX4",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1598",
      powerHp: "180",
      transmission: "AUTOMATIC",
      driveType: "FWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Tucson 1.6 T-GDI 180 PS 4x2 Prime DCT — Ağustos 2026 TR",
      sources: [hyundaiPrimary, hyundaiOfficial, hyundaiDealer],
    }),
    cfg({
      brand: "Hyundai",
      series: "Tucson",
      model: "1.6 T-GDI 180 PS",
      trim: "Elite",
      generation: "Tucson NX4 TR MY2026",
      generationCode: "NX4",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1598",
      powerHp: "180",
      transmission: "AUTOMATIC",
      driveType: "FWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Tucson 1.6 T-GDI 180 PS 4x2 Elite DCT — Ağustos 2026 TR",
      sources: [hyundaiPrimary, hyundaiOfficial, hyundaiDealer],
    }),
    cfg({
      brand: "Hyundai",
      series: "Tucson",
      model: "1.6 T-GDI 180 PS",
      trim: "Elite Plus",
      generation: "Tucson NX4 TR MY2026",
      generationCode: "NX4",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1598",
      powerHp: "180",
      transmission: "AUTOMATIC",
      driveType: "AWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Tucson 1.6 T-GDI 180 PS 4x4 Elite Plus DCT — Ağustos 2026 TR",
      sources: [hyundaiPrimary, hyundaiOfficial, hyundaiDealer],
    }),
    cfg({
      brand: "Hyundai",
      series: "Tucson",
      model: "1.6 CRDi 136 PS",
      trim: "Comfort",
      generation: "Tucson NX4 TR MY2026",
      generationCode: "NX4",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "DIESEL",
      engineVolume: "1598",
      powerHp: "136",
      transmission: "AUTOMATIC",
      driveType: "AWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Tucson 1.6 CRDi 136 PS 4x4 Comfort Sunroof DCT — Ağustos 2026 TR",
      sources: [hyundaiPrimary, hyundaiDealer],
    }),
    cfg({
      brand: "Hyundai",
      series: "Tucson",
      model: "1.6 T-GDI 215 PS HEV",
      trim: "Elite",
      generation: "Tucson Hybrid NX4 TR MY2025",
      generationCode: "NX4 HEV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1598",
      powerHp: "215",
      transmission: "AUTOMATIC",
      driveType: "FWD",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Tucson Hibrit 1.6 T-GDI 215 PS HEV 4x2 Elite — Ağustos 2026 TR (2025 MY)",
      sources: [hyundaiPrimary, hyundaiOfficial],
    }),
  ];

  writeBrand("Hyundai.json", {
    brand: "Hyundai",
    brandSlug: "hyundai",
    version: "2026.08-deep-hyundai-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["i20", "Bayon", "Tucson"],
    status: "IN_PROGRESS",
    notes: "i20/Bayon/Tucson Aug 2026 rows from hyundai.com.tr-cited + dealer tables. GSR2C sub-variants collapsed to base trim.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["i20", "Bayon", "Tucson"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: [],
    },
  });
}

// ——— HONDA ———
{
  const hondaOfficial = src(
    "https://www.honda.com.tr/otomobil/otomobil-fiyat-listesi-2026",
    "Honda Türkiye resmi 2026 model yılı fiyat listesi",
    "primary"
  );
  const hondaHrv = src(
    "https://www.honda.com.tr/otomobil/otomobil-fiyat-listesi-2026/honda-hr-v-hibrit-2026-fiyat-listesi",
    "Honda HR-V e:HEV 2026 resmi fiyat listesi",
    "secondary"
  );
  const hondaDealer = src(
    "https://honda.inallar.com.tr/fiyat-listesi",
    "Honda yetkili satıcı fiyat listesi (Inallar)",
    "secondary"
  );
  const civicStop = src(
    "https://www.webtekno.com/ocak-2026-honda-fiyat-listesi-h210003.html",
    "Honda Civic TR satış durdurma (Ocak 2026 listesi)",
    "secondary",
    "2026-01-01"
  );

  const configs = [
    cfg({
      brand: "Honda",
      series: "HR-V",
      model: "1.5 e:HEV 131 PS",
      trim: "Elegance",
      generation: "HR-V III e:HEV TR MY2026",
      generationCode: "RV",
      yearFrom: 2022,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1498",
      powerHp: "131",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "HR-V 1.5 e:HEV Elegance — resmi honda.com.tr 2026 MY",
      sources: [hondaOfficial, hondaHrv, hondaDealer],
    }),
    cfg({
      brand: "Honda",
      series: "HR-V",
      model: "1.5 e:HEV 131 PS",
      trim: "Advance",
      generation: "HR-V III e:HEV TR MY2026",
      generationCode: "RV",
      yearFrom: 2022,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1498",
      powerHp: "131",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "HR-V 1.5 e:HEV Advance — resmi honda.com.tr 2026 MY",
      sources: [hondaOfficial, hondaHrv, hondaDealer],
    }),
    cfg({
      brand: "Honda",
      series: "HR-V",
      model: "1.5 e:HEV 131 PS",
      trim: "Style+",
      generation: "HR-V III e:HEV TR MY2026",
      generationCode: "RV",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1498",
      powerHp: "131",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "HR-V 1.5 e:HEV Style+ — resmi listede; satışlar Ekim 2026 notu ile",
      sources: [hondaOfficial, hondaHrv],
    }),
    stub(
      "Honda",
      "Civic",
      "Civic zero-km TR sales stopped as of Jan 2026 Honda price list. Historical Civic e:HEV/Sport/Executive archive rows pending.",
      [civicStop, hondaOfficial]
    ),
  ];

  writeBrand("Honda.json", {
    brand: "Honda",
    brandSlug: "honda",
    version: "2026.08-deep-honda-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["HR-V", "Civic"],
    status: "IN_PROGRESS",
    notes: "HR-V e:HEV official honda.com.tr 2026 MY. Civic current sales stopped — historical REVIEW.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["HR-V", "Civic"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["Civic"],
    },
  });
}

// ——— SKODA ———
{
  const skodaPrimary = src(
    "https://onedio.com/haber/agustos-2026-skoda-fiyat-listesi-octavia-superb-elroq-scala-kamiq-karoq-fabia-ve-kodiaq-guncel-fiyatlar-1374164",
    "Skoda Ağustos 2026 fiyat listesi",
    "primary"
  );
  const skodaOfficial = src("https://www.skoda.com.tr/fiyat-listesi", "Škoda Türkiye resmi fiyat listesi", "secondary");
  const skodaCnbce = src(
    "https://www.cnbce.com/otomotiv/skodadan-dev-agustos-kampanyasi-en-cok-satan-modelde-ndirimler-884-bin-tlye-ulasti-g34559",
    "Skoda Ağustos 2026 kampanya/liste tablosu",
    "secondary"
  );
  const skodaDealer = src(
    "https://skodacakiroglu.com/skoda-fiyat-listesi/",
    "Skoda yetkili satıcı fiyat listesi",
    "secondary"
  );

  const configs = [
    cfg({
      brand: "Skoda",
      series: "Fabia",
      model: "1.0 TSI 115 PS",
      trim: "Premium",
      generation: "Fabia IV TR MY2026",
      generationCode: "NJ",
      yearFrom: 2022,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "999",
      powerHp: "115",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Fabia Premium 1.0 TSI 115 PS DSG — Ağustos 2026 TR",
      sources: [skodaPrimary, skodaOfficial, skodaCnbce],
    }),
    cfg({
      brand: "Skoda",
      series: "Fabia",
      model: "1.5 TSI 150 PS",
      trim: "Monte Carlo",
      generation: "Fabia IV TR MY2026",
      generationCode: "NJ",
      yearFrom: 2022,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1498",
      powerHp: "150",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Fabia Monte Carlo 1.5 TSI 150 PS DSG — Ağustos 2026 TR",
      sources: [skodaPrimary, skodaOfficial, skodaCnbce],
    }),
    ...[
      ["Elite", "1.5 TSI mHEV 150 PS", "150"],
      ["Premium", "1.5 TSI mHEV 150 PS", "150"],
      ["Prestige", "1.5 TSI mHEV 150 PS", "150"],
      ["Sportline", "1.5 TSI mHEV 150 PS", "150"],
      ["RS", "2.0 TSI 265 PS", "265"],
    ].map(([trim, model, hp]) =>
      cfg({
        brand: "Skoda",
        series: "Octavia",
        model,
        trim,
        generation: "Octavia IV facelift TR MY2026",
        generationCode: "NX",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: trim === "RS" ? "GASOLINE" : "HYBRID",
        engineVolume: trim === "RS" ? "1984" : "1498",
        powerHp: hp,
        transmission: "AUTOMATIC",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Octavia ${trim} ${model} DSG — Ağustos 2026 TR`,
        sources: [skodaPrimary, skodaOfficial, skodaCnbce],
      })
    ),
    cfg({
      brand: "Skoda",
      series: "Octavia",
      model: "1.5 TSI mHEV 150 PS",
      trim: "Sportline",
      generation: "Octavia Combi IV facelift TR MY2026",
      generationCode: "NX Combi",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1498",
      powerHp: "150",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Octavia Combi Sportline 1.5 TSI mHEV 150 PS DSG — Ağustos 2026 TR (Combi body)",
      sources: [skodaPrimary, skodaDealer],
    }),
    ...[
      ["Premium", "1.5 TSI mHEV 150 PS", "150", "HYBRID", "FWD"],
      ["Prestige", "1.5 TSI mHEV 150 PS", "150", "HYBRID", "FWD"],
      ["Sportline", "1.5 TSI mHEV 150 PS", "150", "HYBRID", "FWD"],
      ["L&K Crystal", "1.5 TSI mHEV 150 PS", "150", "HYBRID", "FWD"],
      ["L&K Crystal", "2.0 TDI 4x4", "193", "DIESEL", "AWD"],
    ].map(([trim, model, hp, fuel, drive]) =>
      cfg({
        brand: "Skoda",
        series: "Superb",
        model,
        trim,
        generation: "Superb IV TR MY2026",
        generationCode: "IV",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: fuel,
        engineVolume: model.startsWith("2.0") ? "1968" : "1498",
        powerHp: hp,
        transmission: "AUTOMATIC",
        driveType: drive,
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Superb ${trim} ${model} DSG — Ağustos 2026 TR (TDI PS from dealer archive where Onedio said 265)`,
        sources: [skodaPrimary, skodaOfficial, skodaDealer],
      })
    ),
  ];

  // Fix Superb diesel power note: Onedio said 265 PS for TDI which is likely wrong; dealer said 193 PS — use REVIEW for that one row only
  const superbTdi = configs.find((c) => c.series === "Superb" && c.model === "2.0 TDI 4x4");
  if (superbTdi) {
    superbTdi.confidence = "REVIEW_REQUIRED";
    superbTdi.verifiedForTurkey = false;
    superbTdi.notes =
      "Superb L&K Crystal 2.0 TDI 4x4 listed Aug 2026 but published PS conflict (265 vs 193) — needs official PDF confirm.";
  }

  writeBrand("Skoda.json", {
    brand: "Skoda",
    brandSlug: "skoda",
    version: "2026.08-deep-skoda-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["Fabia", "Octavia", "Superb"],
    status: "IN_PROGRESS",
    notes: "Fabia/Octavia/Superb Aug 2026 skoda.com.tr-cited tables. Superb TDI PS conflict flagged REVIEW.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["Fabia", "Octavia", "Superb"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["Superb TDI power conflict"],
    },
  });
}

// ——— SEAT ———
{
  const seatPrimary = src(
    "https://www.webtekno.com/agustos-2026-seat-fiyat-listesi-h221710.html",
    "SEAT Ağustos 2026 fiyat listesi (SEAT Türkiye kaynaklı)",
    "primary",
    "2026-08-05"
  );
  const seatJul = src(
    "https://onedio.com/haber/temmuz-2026-seat-fiyat-listesi-iste-seat-ibiza-leon-arona-ve-ateca-guncel-fiyatlari-1369727",
    "SEAT Temmuz 2026 fiyat listesi",
    "secondary",
    "2026-07-01"
  );
  const seatJun = src(
    "https://www.webtekno.com/haziran-2026-seat-fiyat-listesi-h217944.html",
    "SEAT Haziran 2026 fiyat listesi (FR Dark Edition satırları)",
    "secondary",
    "2026-06-01"
  );

  const configs = [
    cfg({
      brand: "Seat",
      series: "Ibiza",
      model: "1.0 TSI 116 PS",
      trim: "Style Plus",
      generation: "Ibiza VI TR MY2026",
      generationCode: "KJ",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "999",
      powerHp: "116",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Yeni Ibiza 1.0 TSI 116 PS Style Plus DSG — Ağustos 2026 TR",
      sources: [seatPrimary, seatJul],
    }),
    cfg({
      brand: "Seat",
      series: "Leon",
      model: "1.5 eTSI 116 PS mHEV",
      trim: "Style",
      generation: "Leon IV TR MY2026",
      generationCode: "KL",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1498",
      powerHp: "116",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Leon 1.5 eTSI 116 PS mHEV Style DSG — Ağustos 2026 TR",
      sources: [seatPrimary, seatJul],
    }),
    cfg({
      brand: "Seat",
      series: "Leon",
      model: "1.5 eHybrid 204 PS",
      trim: "FR",
      generation: "Leon IV eHybrid TR MY2025",
      generationCode: "KL PHEV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "PLUGIN_HYBRID",
      engineVolume: "1498",
      powerHp: "204",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Leon 1.5 eHybrid 204 PS FR DSG — Temmuz 2026 TR (2025 MY)",
      sources: [seatJul, seatPrimary],
    }),
    cfg({
      brand: "Seat",
      series: "Ateca",
      model: "1.5 EcoTSI ACT 150 PS",
      trim: "Style Plus",
      generation: "Ateca TR MY2026",
      generationCode: "Ateca",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1498",
      powerHp: "150",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Ateca 1.5 EcoTSI ACT 150 PS Style Plus DSG — Ağustos 2026 TR",
      sources: [seatPrimary, seatJul, seatJun],
    }),
    cfg({
      brand: "Seat",
      series: "Ateca",
      model: "1.5 EcoTSI ACT 150 PS",
      trim: "FR Dark Edition",
      generation: "Ateca TR MY2025",
      generationCode: "Ateca",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "GASOLINE",
      engineVolume: "1498",
      powerHp: "150",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Ateca 1.5 EcoTSI ACT 150 PS FR Dark Edition DSG — Haziran/Temmuz 2026 TR (2025 MY)",
      sources: [seatJun, seatJul],
    }),
  ];

  writeBrand("Seat.json", {
    brand: "Seat",
    brandSlug: "seat",
    version: "2026.08-deep-seat-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["Ibiza", "Leon", "Ateca"],
    status: "IN_PROGRESS",
    notes: "Ibiza/Leon/Ateca from SEAT Türkiye-cited Aug/Jul 2026 price tables.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["Ibiza", "Leon", "Ateca"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: [],
    },
  });
}

// ——— CITROEN ———
{
  const citroenPrimary = src(
    "https://www.webtekno.com/agustos-2026-citroen-fiyat-listesi-h221654.html",
    "Citroën Ağustos 2026 fiyat listesi",
    "primary",
    "2026-08-05"
  );
  const citroenC5 = src(
    "https://talep.citroen.com.tr/fiyat-listesi/arac/yeni-c5-aircross-hibrit",
    "Citroën Yeni C5 Aircross Hybrid resmi fiyat listesi",
    "secondary"
  );
  const citroenC3a = src(
    "https://talep.citroen.com.tr/fiyat-listesi/arac/yeni-c3-aircross-suv?showcontent=true",
    "Citroën C3 Aircross Hybrid resmi fiyat listesi",
    "secondary"
  );
  const citroenHub = src(
    "https://talep.citroen.com.tr/fiyat-listesi",
    "Citroën Türkiye resmi fiyat listesi hub",
    "secondary"
  );

  const configs = [
    cfg({
      brand: "Citroen",
      series: "C3",
      model: "ë-C3 83 kW",
      trim: "Plus",
      generation: "ë-C3 TR MY2026",
      generationCode: "CC21 EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "113",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Elektrikli ë-C3 83 kW Plus — Ağustos 2026 TR (current C3 range is EV-led)",
      sources: [citroenPrimary, citroenHub],
    }),
    cfg({
      brand: "Citroen",
      series: "C3",
      model: "ë-C3 83 kW",
      trim: "Max",
      generation: "ë-C3 TR MY2026",
      generationCode: "CC21 EV",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "113",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Elektrikli ë-C3 83 kW Max — Ağustos 2026 TR",
      sources: [citroenPrimary, citroenHub],
    }),
    cfg({
      brand: "Citroen",
      series: "C5 Aircross",
      model: "1.2 Hybrid 145 eDCS6",
      trim: "Plus",
      generation: "Yeni C5 Aircross Hybrid TR MY2026",
      generationCode: "C5 Aircross III",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Yeni C5 Aircross Hybrid 145 Plus — resmi talep.citroen.com.tr + Ağustos 2026 tablo",
      sources: [citroenC5, citroenPrimary, citroenHub],
    }),
    cfg({
      brand: "Citroen",
      series: "C5 Aircross",
      model: "1.2 Hybrid 145 eDCS6",
      trim: "Max",
      generation: "Yeni C5 Aircross Hybrid TR MY2026",
      generationCode: "C5 Aircross III",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "Yeni C5 Aircross Hybrid 145 Max — resmi talep.citroen.com.tr",
      sources: [citroenC5, citroenPrimary],
    }),
    cfg({
      brand: "Citroen",
      series: "C5 Aircross",
      model: "ë-C5 Aircross 157 kW",
      trim: "Plus",
      generation: "Yeni ë-C5 Aircross TR MY2026",
      generationCode: "C5 Aircross III EV",
      yearFrom: 2025,
      yearTo: 2026,
      fuelType: "ELECTRIC",
      engineVolume: "",
      powerHp: "210",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_MULTI_SOURCE",
      notes: "Yeni ë-C5 Aircross 157 kW Plus — Ağustos 2026 TR",
      sources: [citroenPrimary, citroenHub],
    }),
    // Also include C3 Aircross as adjacent high-volume (sourced) — useful for TR market
    cfg({
      brand: "Citroen",
      series: "C3 Aircross",
      model: "1.2 Hybrid 145 eDCS6",
      trim: "Plus",
      generation: "C3 Aircross Hybrid TR MY2026",
      generationCode: "C3 Aircross II",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "C3 Aircross Hybrid 145 Plus — resmi TR fiyat satırı",
      sources: [citroenC3a, citroenPrimary],
    }),
    cfg({
      brand: "Citroen",
      series: "C3 Aircross",
      model: "1.2 Hybrid 145 eDCS6",
      trim: "Max",
      generation: "C3 Aircross Hybrid TR MY2026",
      generationCode: "C3 Aircross II",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "C3 Aircross Hybrid 145 Max — resmi TR fiyat satırı",
      sources: [citroenC3a, citroenPrimary],
    }),
    cfg({
      brand: "Citroen",
      series: "C3 Aircross",
      model: "1.2 Hybrid 145 eDCS6",
      trim: "Max - 7 Koltuk",
      generation: "C3 Aircross Hybrid TR MY2026",
      generationCode: "C3 Aircross II",
      yearFrom: 2024,
      yearTo: 2026,
      fuelType: "HYBRID",
      engineVolume: "1199",
      powerHp: "145",
      transmission: "AUTOMATIC",
      confidence: "VERIFIED_OFFICIAL",
      notes: "C3 Aircross Hybrid 145 Max 7 Koltuk — resmi TR fiyat satırı",
      sources: [citroenC3a, citroenPrimary],
    }),
    stub(
      "Citroen",
      "C3 (ICE historical)",
      "ICE C3 PureTech Feel/Shine historical TR archives pending; current list is ë-C3 EV.",
      [citroenHub]
    ),
  ];

  writeBrand("Citroen.json", {
    brand: "Citroen",
    brandSlug: "citroen",
    version: "2026.08-deep-citroen-v1-current-tr",
    generatedAt: NOW,
    seriesCovered: ["C3", "C5 Aircross", "C3 Aircross", "C3 (ICE historical)"],
    status: "IN_PROGRESS",
    notes:
      "ë-C3 + C5 Aircross Hybrid/EV + C3 Aircross Hybrid from official citroen.com.tr / Aug 2026 tables. ICE C3 historical REVIEW.",
    configurations: configs,
    researchNotes: {
      researchedSeriesPass: ["C3", "C5 Aircross", "C3 Aircross"],
      historicalArchivesIngested: [],
      reviewRequiredSeries: ["C3 (ICE historical)"],
    },
  });
}

console.log("Done.");
