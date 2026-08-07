/**
 * One-shot generator for Turkey deep vehicle catalogs (remaining brands).
 * Sources researched 2026-08-07. Do not invent rows without sources.
 */
import fs from "fs";
import path from "path";

const OUT = path.resolve("data/vehicle-deep-catalog");
const DATE = "2026-08-07";
const GEN = "2026-08-07T12:05:00.000Z";

const src = (url, title, date = DATE, role = "primary") => ({ url, title, date, role });

function cfg(base) {
  return {
    brand: base.brand,
    series: base.series,
    model: base.model ?? "",
    trim: base.trim ?? "",
    generation: base.generation ?? "",
    generationCode: base.generationCode ?? "",
    yearFrom: base.yearFrom ?? null,
    yearTo: base.yearTo ?? null,
    fuelType: base.fuelType ?? "",
    engineVolume: base.engineVolume ?? "",
    powerHp: base.powerHp ?? "",
    transmission: base.transmission ?? "",
    driveType: base.driveType ?? "",
    confidence: base.confidence,
    verifiedForTurkey: base.verifiedForTurkey ?? base.confidence?.startsWith("VERIFIED"),
    category: base.category ?? "Otomobil",
    notes: base.notes ?? "",
    sources: base.sources ?? [],
  };
}

function stub(brand, series, notes, sources, category = "Otomobil") {
  return cfg({
    brand,
    series,
    confidence: "REVIEW_REQUIRED",
    verifiedForTurkey: false,
    category,
    notes,
    sources,
  });
}

function writeBrand(doc) {
  const file = path.join(OUT, `${doc.brand === "Alfa Romeo" ? "Alfa Romeo" : doc.brand === "Land Rover" ? "Land Rover" : doc.brand}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  const v = doc.configurations.filter((c) => String(c.confidence).startsWith("VERIFIED")).length;
  const r = doc.configurations.filter((c) => c.confidence === "REVIEW_REQUIRED").length;
  console.log(`${doc.brand.padEnd(14)} verified=${v} review=${r} -> ${path.basename(file)}`);
}

// ——— KIA ———
writeBrand({
  brand: "Kia",
  brandSlug: "kia",
  version: "2026.08-deep-kia-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Sportage", "Picanto", "Stonic", "Sorento", "EV3", "EV6", "EV9"],
  status: "IN_PROGRESS",
  notes: "Sportage official kia.com.tr Aug 2026 price rows. Other series researched — stubs pending fuller PDF ingest.",
  configurations: [
    ...[
      ["1.6L 150 PS DCT", "Live", "FWD", "150"],
      ["1.6L 150 PS DCT", "Vision", "FWD", "150"],
      ["1.6L 150 PS DCT", "Cool", "FWD", "150"],
      ["1.6L 150 PS DCT", "Elegance", "FWD", "150"],
      ["1.6L 150 PS DCT", "Prestige", "FWD", "150"],
      ["1.6L 180 PS 4X4 DCT", "GT-Line", "AWD", "180"],
    ].map(([model, trim, drive, hp]) =>
      cfg({
        brand: "Kia",
        series: "Sportage",
        model,
        trim,
        generation: "NQ5 PE TR MY2026",
        generationCode: "NQ5",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: "GASOLINE",
        engineVolume: "1598",
        powerHp: hp,
        transmission: "AUTOMATIC",
        driveType: drive,
        confidence: "VERIFIED_OFFICIAL",
        category: "Arazi, SUV & Pickup",
        notes: `Sportage ${model} ${trim} — resmi kia.com.tr fiyat 01/08/2026`,
        sources: [
          src("https://www.kia.com/tr/modeller/sportage-nq5-pe/fiyat-listesi.html", "Kia Sportage resmi fiyat listesi (2026)"),
          src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi", DATE, "secondary"),
          src("https://www.cnbce.com/otomotiv/kia-agustos-fiyatlarini-acikladi-en-ucuz-modele-zam-elektrikliler-indirimde-h34560", "Kia Ağustos 2026 fiyat özeti", "2026-08-01", "secondary"),
        ],
      })
    ),
    stub("Kia", "Picanto", "Picanto Feel/Cool listed in Aug 2026 media citing Kia TR; discrete engine+trim PDF rows need full official table ingest.", [
      src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi"),
    ]),
    stub("Kia", "Stonic", "Stonic Cool listed Aug 2026 aggregators; engine/trim pairing needs official row confirmation.", [
      src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi"),
    ]),
    stub("Kia", "Sorento", "Sorento hybrid Prestige Smart rows in dealer tables; official discrete version+trim pending.", [
      src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi"),
    ], "Arazi, SUV & Pickup"),
    stub("Kia", "EV3", "EV overlay: EV3 on official TR list — version/trim rows pending full official ingest (no inventing).", [
      src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi"),
    ], "Arazi, SUV & Pickup"),
    stub("Kia", "EV6", "EV overlay series present TR — discrete configs REVIEW.", [
      src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi"),
    ], "Arazi, SUV & Pickup"),
    stub("Kia", "EV9", "EV overlay series present TR — discrete configs REVIEW.", [
      src("https://www.kia.com/tr/satis-merkezi/fiyat-listesi.html", "Kia Türkiye fiyat listesi"),
    ], "Arazi, SUV & Pickup"),
  ],
  researchNotes: {
    researchedSeriesPass: ["Sportage", "Picanto", "Stonic", "Sorento", "EV3", "EV6", "EV9"],
    reviewRequiredSeries: ["Picanto", "Stonic", "Sorento", "EV3", "EV6", "EV9"],
  },
});

// ——— DACIA ———
const daciaSrc = [
  src("https://www.dacia.com.tr/", "Dacia Türkiye resmi site (başlangıç fiyatları)"),
  src("https://www.dacia.com.tr/dacia-fiyat-listesi.html", "Dacia resmi fiyat listesi sayfası", DATE, "secondary"),
  src("https://www.turkiyegazetesi.com.tr/t-otomobil/sandero-stepway-logan-jogger-dacia-agustos-2026-fiyatlarini-acikladi-1806663", "Dacia Ağustos 2026 versiyon tablosu", "2026-08-02", "secondary"),
];
writeBrand({
  brand: "Dacia",
  brandSlug: "dacia",
  version: "2026.08-deep-dacia-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Sandero", "Sandero Stepway", "Logan", "Jogger"],
  status: "IN_PROGRESS",
  notes: "Sandero/Stepway/Logan/Jogger Aug 2026 rows from dacia.com.tr + published TR tables.",
  configurations: [
    cfg({ brand: "Dacia", series: "Sandero", model: "TCe 100", trim: "essential", generation: "III TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", engineVolume: "999", powerHp: "100", transmission: "MANUAL", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Sandero essential TCe 100 MY2026 — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Sandero", model: "TCe 100", trim: "expression", generation: "III TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", engineVolume: "999", powerHp: "100", transmission: "MANUAL", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Sandero expression TCe 100 MY2026 — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Sandero Stepway", model: "Eco-G 120", trim: "expression", generation: "Stepway TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "LPG", engineVolume: "999", powerHp: "120", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Stepway expression Eco-G 120 auto — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Sandero Stepway", model: "Eco-G 120", trim: "extreme", generation: "Stepway TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "LPG", engineVolume: "999", powerHp: "120", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Stepway extreme Eco-G 120 auto — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Logan", model: "TCe 100", trim: "essential", generation: "III TR MY2026", yearFrom: 2026, yearTo: 2026, fuelType: "GASOLINE", engineVolume: "999", powerHp: "100", transmission: "MANUAL", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Logan essential TCe 100 — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Logan", model: "Eco-G 120", trim: "expression", generation: "III TR MY2026", yearFrom: 2026, yearTo: 2026, fuelType: "LPG", engineVolume: "999", powerHp: "120", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Logan expression Eco-G 120 auto — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Logan", model: "Eco-G 120", trim: "journey", generation: "III TR MY2026", yearFrom: 2026, yearTo: 2026, fuelType: "LPG", engineVolume: "999", powerHp: "120", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Logan journey Eco-G 120 auto — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Jogger", model: "TCe 110 7K", trim: "extreme", generation: "Jogger TR MY2026", yearFrom: 2023, yearTo: 2026, fuelType: "GASOLINE", engineVolume: "999", powerHp: "110", transmission: "MANUAL", driveType: "FWD", category: "Minivan & Panelvan", confidence: "VERIFIED_MULTI_SOURCE", notes: "Jogger extreme TCe 110 7 koltuk — Ağustos 2026 TR", sources: daciaSrc }),
    cfg({ brand: "Dacia", series: "Jogger", model: "Eco-G 120 7K", trim: "extreme", generation: "Jogger TR MY2026", yearFrom: 2023, yearTo: 2026, fuelType: "LPG", engineVolume: "999", powerHp: "120", transmission: "AUTOMATIC", driveType: "FWD", category: "Minivan & Panelvan", confidence: "VERIFIED_MULTI_SOURCE", notes: "Jogger extreme Eco-G 120 auto 7K — Ağustos 2026 TR", sources: daciaSrc }),
    stub("Dacia", "Duster", "Prior Duster generations high-volume used TR; not in current Aug 2026 new-car Sandero/Logan/Jogger published focus — archive rows needed.", daciaSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Sandero", "Sandero Stepway", "Logan", "Jogger", "Duster"], reviewRequiredSeries: ["Duster"] },
});

// ——— NISSAN ———
const nissanSrc = [
  src("https://www.nissan.com.tr/fiyat-listesi/sifir-arac-fiyatlari-2026.html", "Nissan Türkiye sıfır araç fiyatları 2026"),
  src("https://www.webtekno.com/agustos-2026-nissan-fiyat-listesi-h221662.html", "Nissan Ağustos 2026 detaylı versiyon tablosu", "2026-08-05", "secondary"),
  src("https://onedio.com/haber/agustos-2026-nissan-fiyat-listesi-iste-nissan-qashqai-juke-qashqai-e-power-ve-x-trail-guncel-fiyatlari-1373751", "Nissan Ağustos 2026 Onedio tablosu", "2026-08-05", "secondary"),
];
writeBrand({
  brand: "Nissan",
  brandSlug: "nissan",
  version: "2026.08-deep-nissan-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Qashqai", "Qashqai e-POWER", "Juke", "X-Trail", "Townstar"],
  status: "IN_PROGRESS",
  notes: "Qashqai/Juke/X-Trail Aug 2026 from nissan.com.tr-cited tables. Townstar stub.",
  configurations: [
    ...[
      ["1.3 DIG-T Mild Hybrid 158PS", "Designpack", "FWD"],
      ["1.3 DIG-T Mild Hybrid 158PS", "Skypack", "FWD"],
      ["1.3 DIG-T Mild Hybrid 158PS", "Skypack", "AWD"],
      ["1.3 DIG-T Mild Hybrid 158PS", "N-Design", "FWD"],
      ["1.3 DIG-T Mild Hybrid 158PS", "Platinum", "FWD"],
      ["1.3 DIG-T Mild Hybrid 158PS", "Platinum Premium", "FWD"],
    ].map(([model, trim, drive]) =>
      cfg({
        brand: "Nissan",
        series: "Qashqai",
        model,
        trim: drive === "AWD" ? `${trim} 4x4` : trim,
        generation: "J12 TR MY2026",
        generationCode: "J12",
        yearFrom: 2022,
        yearTo: 2026,
        fuelType: "HYBRID",
        engineVolume: "1332",
        powerHp: "158",
        transmission: "AUTOMATIC",
        driveType: drive,
        category: "Arazi, SUV & Pickup",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Qashqai ${model} Auto ${trim}${drive === "AWD" ? " 4x4" : ""} — Ağustos 2026 TR`,
        sources: nissanSrc,
      })
    ),
    ...[
      ["e-POWER 190PS", "Designpack"],
      ["e-POWER 190PS", "Skypack"],
      ["e-POWER 190PS", "Platinum"],
    ].map(([model, trim]) =>
      cfg({
        brand: "Nissan",
        series: "Qashqai e-POWER",
        model,
        trim,
        generation: "J12 e-POWER TR MY2026",
        generationCode: "J12",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: "HYBRID",
        engineVolume: "",
        powerHp: "190",
        transmission: "AUTOMATIC",
        driveType: "FWD",
        category: "Arazi, SUV & Pickup",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Qashqai e-POWER ${model} ${trim} — Ağustos 2026 TR (series kept separate from ICE mild-hybrid Qashqai)`,
        sources: nissanSrc,
      })
    ),
    ...[
      ["1.0 DIG-T 115PS", "Tekna Plus"],
      ["1.0 DIG-T 115PS", "Platinum"],
      ["1.0 DIG-T 115PS", "Platinum Premium"],
    ].map(([model, trim]) =>
      cfg({
        brand: "Nissan",
        series: "Juke",
        model,
        trim,
        generation: "F16 TR MY2026",
        generationCode: "F16",
        yearFrom: 2020,
        yearTo: 2026,
        fuelType: "GASOLINE",
        engineVolume: "999",
        powerHp: "115",
        transmission: "AUTOMATIC",
        driveType: "FWD",
        category: "Arazi, SUV & Pickup",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `Juke ${model} DCT ${trim} — Ağustos 2026 TR`,
        sources: nissanSrc,
      })
    ),
    cfg({ brand: "Nissan", series: "X-Trail", model: "1.5 VC-T Mild Hybrid 163PS", trim: "Platinum", generation: "T33 TR MY2025", generationCode: "T33", yearFrom: 2023, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1497", powerHp: "163", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "X-Trail 1.5 VC-T MHEV Auto Platinum — Ağustos 2026 TR", sources: nissanSrc }),
    cfg({ brand: "Nissan", series: "X-Trail", model: "1.5 VC-T Mild Hybrid 163PS", trim: "Platinum Premium", generation: "T33 TR MY2025", generationCode: "T33", yearFrom: 2023, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1497", powerHp: "163", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "X-Trail 1.5 VC-T MHEV Auto Platinum Premium — Ağustos 2026 TR", sources: nissanSrc }),
    stub("Nissan", "Townstar", "Townstar Van / Combi EV on Nissan TR price pages — discrete engine+trim rows pending.", nissanSrc, "Minivan & Panelvan"),
  ],
  researchNotes: { researchedSeriesPass: ["Qashqai", "Qashqai e-POWER", "Juke", "X-Trail", "Townstar"], reviewRequiredSeries: ["Townstar"] },
});

// ——— TOGG ———
const toggSrc = [
  src("https://www.togg.com.tr/price-list", "Togg resmi fiyat listesi (T10X)"),
  src("https://www.gzt.com/gundem/togg-agustos-2026-fiyat-listesi-t10x-t10f-kampanyasi-4248755", "Togg Ağustos 2026 T10X/T10F", "2026-08-01", "secondary"),
  src("https://www.webtekno.com/temmuz-2026-togg-fiyat-listesi-h219591.html", "Togg Temmuz 2026 detay tablo", "2026-07-01", "secondary"),
];
writeBrand({
  brand: "TOGG",
  brandSlug: "togg",
  version: "2026.08-deep-togg-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["T10X", "T10F"],
  status: "IN_PROGRESS",
  notes: "Pure EV brand — preserve electric overlay series T10X/T10F only; no invented ICE series. Official togg.com.tr price-list.",
  configurations: [
    ...[
      ["RWD Standart Menzil", "V1", "RWD", "160"],
      ["RWD Uzun Menzil", "V1", "RWD", "160"],
      ["RWD Uzun Menzil", "V2", "RWD", "160"],
      ["4More AWD", "V2 Obsidiyen", "AWD", "320"],
    ].map(([model, trim, drive, kw]) =>
      cfg({
        brand: "TOGG",
        series: "T10X",
        model,
        trim,
        generation: "T10X C-SUV TR",
        generationCode: "T10X",
        yearFrom: 2023,
        yearTo: 2026,
        fuelType: "ELECTRIC",
        engineVolume: "",
        powerHp: `${kw} kW`,
        transmission: "AUTOMATIC",
        driveType: drive,
        category: "Arazi, SUV & Pickup",
        confidence: "VERIFIED_OFFICIAL",
        notes: `T10X ${trim} ${model} — resmi togg.com.tr (15/06/2026+); EV overlay series T10X`,
        sources: toggSrc,
      })
    ),
    ...[
      ["RWD Standart Menzil", "V1", "RWD", "160"],
      ["RWD Uzun Menzil", "V1", "RWD", "160"],
      ["RWD Uzun Menzil", "V2", "RWD", "160"],
      ["4More AWD", "V2", "AWD", "320"],
    ].map(([model, trim, drive, kw]) =>
      cfg({
        brand: "TOGG",
        series: "T10F",
        model,
        trim,
        generation: "T10F Fastback TR",
        generationCode: "T10F",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: "ELECTRIC",
        engineVolume: "",
        powerHp: `${kw} kW`,
        transmission: "AUTOMATIC",
        driveType: drive,
        category: "Otomobil",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `T10F ${trim} ${model} — Aug 2026 published TR tables + togg.com.tr; EV overlay series T10F`,
        sources: toggSrc,
      })
    ),
  ],
  researchNotes: { researchedSeriesPass: ["T10X", "T10F"], reviewRequiredSeries: [], electricOverlayNote: "Do not invent duplicate EV series beyond T10X/T10F" },
});

// ——— BYD ———
const bydSrc = [
  src("https://www.bydauto.com.tr/fiyat-listesi", "BYD Türkiye resmi fiyat listesi"),
  src("https://www.turkiyegazetesi.com.tr/t-otomobil/seal-sealion-han-tang-byd-agustos-2026-fiyat-listesi-aciklandi-1806628", "BYD Ağustos 2026 özet", "2026-08-02", "secondary"),
];
writeBrand({
  brand: "BYD",
  brandSlug: "byd",
  version: "2026.08-deep-byd-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["SEAL", "SEALION 7", "HAN", "TANG", "Atto 3", "Dolphin"],
  status: "IN_PROGRESS",
  notes: "Current official Aug 2026 list is EV-only SEAL/SEALION7/HAN/TANG. Prior Atto/Dolphin historical stubs — no inventing re-listings.",
  configurations: [
    cfg({ brand: "BYD", series: "SEAL", model: "390 kW AWD", trim: "Excellence", generation: "SEAL TR MY2025", yearFrom: 2024, yearTo: 2026, fuelType: "ELECTRIC", powerHp: "530", transmission: "AUTOMATIC", driveType: "AWD", confidence: "VERIFIED_OFFICIAL", notes: "SEAL 390 kW AWD Excellence — resmi bydauto.com.tr (7.8.2026)", sources: bydSrc }),
    cfg({ brand: "BYD", series: "SEALION 7", model: "390 kW AWD", trim: "Excellence", generation: "SEALION 7 TR MY2025", yearFrom: 2025, yearTo: 2026, fuelType: "ELECTRIC", powerHp: "530", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "SEALION 7 390 kW AWD Excellence — resmi", sources: bydSrc }),
    cfg({ brand: "BYD", series: "HAN", model: "380 kW AWD", trim: "Executive", generation: "HAN TR MY2025", yearFrom: 2024, yearTo: 2026, fuelType: "ELECTRIC", powerHp: "517", transmission: "AUTOMATIC", driveType: "AWD", confidence: "VERIFIED_OFFICIAL", notes: "HAN 380 kW AWD Executive — resmi", sources: bydSrc }),
    cfg({ brand: "BYD", series: "TANG", model: "380 kW AWD", trim: "Flagship", generation: "TANG TR MY2025", yearFrom: 2024, yearTo: 2026, fuelType: "ELECTRIC", powerHp: "517", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "TANG 380 kW AWD Flagship — resmi", sources: bydSrc }),
    stub("BYD", "Atto 3", "Atto 3 previously sold TR; absent from Aug 2026 official 4-model EV list — historical archive ingest required (EV overlay series preserved).", bydSrc, "Arazi, SUV & Pickup"),
    stub("BYD", "Dolphin", "Dolphin previously marketed TR; absent Aug 2026 official list — archive rows required.", bydSrc),
  ],
  researchNotes: { researchedSeriesPass: ["SEAL", "SEALION 7", "HAN", "TANG", "Atto 3", "Dolphin"], reviewRequiredSeries: ["Atto 3", "Dolphin"], electricOverlayNote: "No duplicate EV series invention" },
});

// ——— TESLA ———
const teslaSrc = [
  src("https://www.tesla.com/tr_tr/modely", "Tesla Türkiye Model Y resmi sayfa"),
  src("https://www.cnbce.com/otomotiv/tesladan-agustos-zammi-model-ynin-uc-versiyonunun-fiyati-artti-iste-yeni-fiyatlar-h34369", "Tesla Model Y Ağustos 2026 fiyatları", "2026-08-01", "secondary"),
  src("https://otonomhaber.com/2026/07/tesla-temmuz-2026-turkiye-model-y-fiyat-listesini-guncelledi/", "Tesla Temmuz 2026 Model Y tablo", "2026-07-01", "secondary"),
];
writeBrand({
  brand: "Tesla",
  brandSlug: "tesla",
  version: "2026.08-deep-tesla-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Model Y", "Model 3", "Model S", "Model X"],
  status: "IN_PROGRESS",
  notes: "Pure EV brand — Model Y verified Aug 2026. Model 3/S/X TR availability REVIEW (no inventing). Preserve electric overlay series names.",
  configurations: [
    cfg({ brand: "Tesla", series: "Model Y", model: "RWD", trim: "", generation: "Juniper / New Model Y TR", yearFrom: 2025, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "RWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Model Y Arkadan Çekiş — Ağustos 2026 TR (tesla.com + multi press)", sources: teslaSrc }),
    cfg({ brand: "Tesla", series: "Model Y", model: "Long Range RWD", trim: "Premium", generation: "Juniper / New Model Y TR", yearFrom: 2025, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "RWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Model Y Premium Long Range RWD — Ağustos 2026 TR", sources: teslaSrc }),
    cfg({ brand: "Tesla", series: "Model Y", model: "Long Range AWD", trim: "Premium", generation: "Juniper / New Model Y TR", yearFrom: 2025, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Model Y Premium Long Range 4 Çeker — Ağustos 2026 TR", sources: teslaSrc }),
    cfg({ brand: "Tesla", series: "Model Y", model: "Performance AWD", trim: "", generation: "Juniper / New Model Y TR", yearFrom: 2025, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Model Y Performance 4 Çeker — Ağustos 2026 TR", sources: teslaSrc }),
    stub("Tesla", "Model 3", "Model 3 historically sold TR; current Aug 2026 consumer price focus is Model Y — discrete Model 3 rows need fresh official confirm (EV overlay preserved).", teslaSrc),
    stub("Tesla", "Model S", "Model S TR retail presence not confirmed in Aug 2026 sources reviewed.", teslaSrc),
    stub("Tesla", "Model X", "Model X TR retail presence not confirmed in Aug 2026 sources reviewed.", teslaSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Model Y", "Model 3", "Model S", "Model X"], reviewRequiredSeries: ["Model 3", "Model S", "Model X"] },
});

// ——— VOLVO ———
const volvoSrc = [
  src("https://www.volvocars.com/tr/l/fiyat-listesi/", "Volvo Cars TR resmi fiyat listesi"),
  src("https://azure-eu-assets.contentstack.com/v3/assets/blt84e01a6904dbd2e8/bltbbdb4e75b36d9a02/69f97729a2c428b3f125cc16/Tu%CC%88rkiye_Tavsiye_Edilen_Anahtar_Teslim_Fiyat_Listesi_MY26-04.05.26.pdf", "Volvo TR MY26 resmi PDF fiyat listesi", "2026-05-04"),
  src("https://www.webtekno.com/haziran-2026-volvo-fiyat-listesi-h217906.html", "Volvo Haziran 2026 yayınlanan tablo", "2026-06-01", "secondary"),
];
writeBrand({
  brand: "Volvo",
  brandSlug: "volvo",
  version: "2026.08-deep-volvo-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["XC60", "EX40", "V60", "XC90", "EX30", "EC40"],
  status: "IN_PROGRESS",
  notes: "XC60/EX40 from official Volvo TR MY26 PDF. Bright/Dark are style packs mapped into trim.",
  configurations: [
    cfg({ brand: "Volvo", series: "XC60", model: "B5 AWD Mild hybrid", trim: "Plus Dark", generation: "SPA MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1969", powerHp: "250", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "XC60 B5 AWD MHEV Plus Dark — resmi MY26 PDF", sources: volvoSrc }),
    cfg({ brand: "Volvo", series: "XC60", model: "B5 AWD Mild hybrid", trim: "Plus Bright", generation: "SPA MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1969", powerHp: "250", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "XC60 B5 AWD MHEV Plus Bright — resmi MY26 PDF", sources: volvoSrc }),
    cfg({ brand: "Volvo", series: "XC60", model: "T8 AWD Plug-in hybrid", trim: "Plus Dark", generation: "SPA MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "PLUGIN_HYBRID", engineVolume: "1969", powerHp: "310+145", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "XC60 T8 AWD PHEV Plus Dark — resmi MY26 PDF", sources: volvoSrc }),
    cfg({ brand: "Volvo", series: "EX40", model: "Single Motor Extended Range 150kW", trim: "Ultra", generation: "EX40 TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "ELECTRIC", powerHp: "204", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "EX40 Single Motor Ext Range Ultra — resmi; EV overlay EX40 (no duplicate XC40 Recharge invent)", sources: volvoSrc }),
    cfg({ brand: "Volvo", series: "V60", model: "B4 FWD Mild hybrid", trim: "Plus Dark", generation: "SPA MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1969", powerHp: "197", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_OFFICIAL", notes: "V60 B4 FWD MHEV Plus Dark — resmi MY26 PDF", sources: volvoSrc }),
    stub("Volvo", "XC90", "XC90 on Volvo TR price pages / build — discrete MY26 version+trim rows pending fuller PDF parse.", volvoSrc, "Arazi, SUV & Pickup"),
    stub("Volvo", "EX30", "EX30 listed in Jun 2026 published tables — official PDF row pairing pending.", volvoSrc, "Arazi, SUV & Pickup"),
    stub("Volvo", "EC40", "EC40 on official price list — discrete configs pending.", volvoSrc),
  ],
  researchNotes: { researchedSeriesPass: ["XC60", "EX40", "V60", "XC90", "EX30", "EC40"], reviewRequiredSeries: ["XC90", "EX30", "EC40"] },
});

// ——— MG ———
const mgSrc = [
  src("https://www.mg-turkey.com/tr/fiyat-listesi.html", "MG Türkiye resmi fiyat listesi"),
  src("https://www.webtekno.com/agustos-2026-mg-fiyat-listesi-h221788.html", "MG Ağustos 2026 versiyon tablosu", "2026-08-05", "secondary"),
  src("https://www.donanimhaber.com/mg-fiyat-listesi-sifir-mg-araba-fiyatlari--158913", "MG Ağustos 2026 DonanımHaber", "2026-08-01", "secondary"),
];
writeBrand({
  brand: "MG",
  brandSlug: "mg",
  version: "2026.08-deep-mg-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["ZS Hybrid+", "HS Hybrid+", "HS", "MG7"],
  status: "IN_PROGRESS",
  notes: "ZS Hybrid+ Luxury from official mg-turkey.com notes + Aug 2026 published tables.",
  configurations: [
    cfg({ brand: "MG", series: "ZS Hybrid+", model: "Hybrid+ 197 PS", trim: "Luxury Cam Tavanlı", generation: "ZS Hybrid+ TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", engineVolume: "", powerHp: "197", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "ZS Hybrid+ Luxury Cam Tavanlı MY2026 — resmi fiyat listesi notları + Aug tables", sources: mgSrc }),
    cfg({ brand: "MG", series: "HS Hybrid+", model: "Hybrid+", trim: "Luxury", generation: "HS Hybrid+ TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", powerHp: "", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "HS Hybrid+ Luxury — Ağustos 2026 TR published tables", sources: mgSrc }),
    cfg({ brand: "MG", series: "HS", model: "Gasoline", trim: "Luxury", generation: "HS TR MY2025/26", yearFrom: 2025, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "HS Luxury benzin — Ağustos 2026 TR", sources: mgSrc }),
    cfg({ brand: "MG", series: "MG7", model: "Gasoline", trim: "Excellence", generation: "MG7 TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "MG7 Excellence MY2026 — Ağustos 2026 TR", sources: mgSrc }),
    cfg({ brand: "MG", series: "MG7", model: "Gasoline", trim: "Excellence Red Edition", generation: "MG7 TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "MG7 Excellence Red Edition MY2026 — Ağustos 2026 TR", sources: mgSrc }),
  ],
  researchNotes: { researchedSeriesPass: ["ZS Hybrid+", "HS Hybrid+", "HS", "MG7"], reviewRequiredSeries: [] },
});

// ——— CUPRA ———
const cupraSrc = [
  src("https://www.cupra.com/tr", "Cupra Türkiye resmi site", DATE, "secondary"),
  src("https://teknobirinci.com.tr/agustos-2026-cupra-fiyat-listesi-aciklandi/", "Cupra Ağustos 2026 versiyon tablosu", "2026-08-05"),
];
writeBrand({
  brand: "Cupra",
  brandSlug: "cupra",
  version: "2026.08-deep-cupra-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Formentor", "Leon", "Terramar", "Born"],
  status: "IN_PROGRESS",
  notes: "Formentor/Leon/Terramar 1.5 eTSI Impulse/Supreme/VZ-Line from Aug 2026 published TR tables. Born EV stub.",
  configurations: [
    ...[
      ["Formentor", "1.5 eTSI ACT 150 PS", "Impulse"],
      ["Formentor", "1.5 eTSI ACT 150 PS", "Supreme"],
      ["Formentor", "1.5 eTSI ACT 150 PS", "VZ-Line"],
    ].map(([series, model, trim]) =>
      cfg({ brand: "Cupra", series, model, trim, generation: "Formentor TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1498", powerHp: "150", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: `Formentor ${model} DSG ${trim} — Ağustos 2026 TR`, sources: cupraSrc })
    ),
    cfg({ brand: "Cupra", series: "Leon", model: "1.5 eTSI ACT 150 PS", trim: "Impulse", generation: "Leon TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1498", powerHp: "150", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Leon 1.5 eTSI ACT 150 PS DSG Impulse — Ağustos 2026 TR", sources: cupraSrc }),
    ...[
      ["Impulse"],
      ["Supreme"],
      ["VZ-Line"],
    ].map(([trim]) =>
      cfg({ brand: "Cupra", series: "Terramar", model: "1.5 eTSI ACT 150 PS", trim, generation: "Terramar TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1498", powerHp: "150", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: `Terramar 1.5 eTSI ACT 150 PS DSG ${trim} — Ağustos 2026 TR`, sources: cupraSrc })
    ),
    stub("Cupra", "Born", "Cupra Born EV TR availability/config rows not confirmed in Aug 2026 Formentor/Leon/Terramar tables — EV overlay preserve if listed later.", cupraSrc),
  ],
  researchNotes: { researchedSeriesPass: ["Formentor", "Leon", "Terramar", "Born"], reviewRequiredSeries: ["Born"] },
});

// ——— JEEP ———
const jeepSrc = [
  src("https://www.jeep.com.tr/", "Jeep Türkiye resmi site", DATE, "secondary"),
  src("https://teknobirinci.com.tr/agustos-2026-jeep-fiyat-listesi-aciklandi-280-bin-tl-indirim/", "Jeep Ağustos 2026 versiyon tablosu", "2026-08-05"),
];
writeBrand({
  brand: "Jeep",
  brandSlug: "jeep",
  version: "2026.08-deep-jeep-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Compass", "Avenger", "Renegade", "Wrangler"],
  status: "IN_PROGRESS",
  notes: "Compass E-Hybrid + Avenger family from Aug 2026 published TR tables.",
  configurations: [
    cfg({ brand: "Jeep", series: "Compass", model: "E-Hybrid", trim: "Limited", generation: "New Compass TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Yeni Compass E-Hybrid Limited Auto 4x2 — Ağustos 2026 TR", sources: jeepSrc }),
    cfg({ brand: "Jeep", series: "Compass", model: "E-Hybrid", trim: "Summit", generation: "New Compass TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Yeni Compass E-Hybrid Summit Auto 4x2 — Ağustos 2026 TR", sources: jeepSrc }),
    cfg({ brand: "Jeep", series: "Avenger", model: "1.2 110 HP E-Hybrid", trim: "Summit", generation: "Avenger TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1199", powerHp: "110", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Avenger E-Hybrid 1.2 110 HP Summit DCT — Ağustos 2026 TR", sources: jeepSrc }),
    cfg({ brand: "Jeep", series: "Avenger", model: "1.2 145 HP 4xe", trim: "Overland", generation: "Avenger TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "PLUGIN_HYBRID", engineVolume: "1199", powerHp: "145", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Avenger 4xe 1.2 145 HP Overland — Ağustos 2026 TR", sources: jeepSrc }),
    cfg({ brand: "Jeep", series: "Avenger", model: "115 kW Electric", trim: "Summit", generation: "Avenger EV TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "ELECTRIC", powerHp: "156", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Avenger %100 Elektrikli 115 kW Summit — EV overlay Avenger; Ağustos 2026 TR", sources: jeepSrc }),
    stub("Jeep", "Renegade", "Renegade historical TR volume; not in Aug 2026 Avenger/Compass published focus — archive needed.", jeepSrc, "Arazi, SUV & Pickup"),
    stub("Jeep", "Wrangler", "Wrangler TR specialty — discrete official rows pending.", jeepSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Compass", "Avenger", "Renegade", "Wrangler"], reviewRequiredSeries: ["Renegade", "Wrangler"] },
});

// ——— ALFA ROMEO ———
const alfaSrc = [
  src("https://www.alfaromeo.com.tr/", "Alfa Romeo Türkiye resmi site", DATE, "secondary"),
  src("https://teknobirinci.com.tr/temmuz-2026-alfa-romeo-fiyat-listesi-aciklandi/", "Alfa Romeo Temmuz 2026 versiyon tablosu", "2026-07-01"),
];
writeBrand({
  brand: "Alfa Romeo",
  brandSlug: "alfa-romeo",
  version: "2026.08-deep-alfa-romeo-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Junior", "Tonale", "Giulia", "Stelvio"],
  status: "IN_PROGRESS",
  notes: "Junior Elettrica/Ibrida + Tonale from Jul 2026 published TR tables. Giulia/Stelvio stubs.",
  configurations: [
    cfg({ brand: "Alfa Romeo", series: "Junior", model: "Elettrica", trim: "Speciale+", generation: "Junior EV TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Junior Elettrica Speciale+ — Temmuz 2026 TR; EV overlay Junior", sources: alfaSrc }),
    cfg({ brand: "Alfa Romeo", series: "Junior", model: "Ibrida", trim: "Speciale+", generation: "Junior Hybrid TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Junior Ibrida Speciale+ DCT — Temmuz 2026 TR", sources: alfaSrc }),
    cfg({ brand: "Alfa Romeo", series: "Tonale", model: "Hybrid DCT", trim: "Speciale", generation: "Tonale TR MY2026", yearFrom: 2023, yearTo: 2026, fuelType: "HYBRID", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Tonale Hybrid Speciale DCT — Temmuz 2026 TR", sources: alfaSrc }),
    cfg({ brand: "Alfa Romeo", series: "Tonale", model: "Diesel DCT", trim: "Ti", generation: "Tonale TR MY2026", yearFrom: 2023, yearTo: 2026, fuelType: "DIESEL", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Tonale Dizel Ti DCT — Temmuz 2026 TR", sources: alfaSrc }),
    stub("Alfa Romeo", "Giulia", "Giulia historically TR — not in Jul 2026 Junior/Tonale published focus; archive needed.", alfaSrc),
    stub("Alfa Romeo", "Stelvio", "Stelvio historically TR — archive rows needed.", alfaSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Junior", "Tonale", "Giulia", "Stelvio"], reviewRequiredSeries: ["Giulia", "Stelvio"] },
});

// ——— LAND ROVER ———
const lrSrc = [
  src("https://www.landrover.com.tr/build-and-price/defender-fiyat-listesi", "Land Rover Defender resmi fiyat listesi"),
  src("https://www.landrover.com.tr/", "Land Rover Türkiye", DATE, "secondary"),
];
writeBrand({
  brand: "Land Rover",
  brandSlug: "land-rover",
  version: "2026.08-deep-land-rover-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Defender", "Range Rover Evoque", "Discovery Sport", "Range Rover Velar", "Range Rover Sport", "Range Rover"],
  status: "IN_PROGRESS",
  notes: "Defender 110/130 official landrover.com.tr price rows. Other Range Rover family stubs.",
  configurations: [
    cfg({ brand: "Land Rover", series: "Defender", model: "110 3.0D Mild Hybrid 200 bg", trim: "ULTIMATE", generation: "L663 Defender 110", generationCode: "L663", yearFrom: 2020, yearTo: 2026, fuelType: "HYBRID", engineVolume: "2997", powerHp: "200", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Defender 110 Dizel MHEV ULTIMATE 2.997cc 200 bg — resmi", sources: lrSrc }),
    cfg({ brand: "Land Rover", series: "Defender", model: "110 2.0 PHEV 300 bg", trim: "X-DYNAMIC HSE", generation: "L663 Defender 110", generationCode: "L663", yearFrom: 2020, yearTo: 2026, fuelType: "PLUGIN_HYBRID", engineVolume: "1997", powerHp: "300", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Defender 110 PHEV X-DYNAMIC HSE — resmi", sources: lrSrc }),
    cfg({ brand: "Land Rover", series: "Defender", model: "110 4.4 Mild Hybrid 635 bg", trim: "OCTA", generation: "L663 Defender 110", generationCode: "L663", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", engineVolume: "4395", powerHp: "635", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Defender 110 OCTA — resmi", sources: lrSrc }),
    cfg({ brand: "Land Rover", series: "Defender", model: "130 3.0D Mild Hybrid 350 bg", trim: "X-DYNAMIC HSE", generation: "L663 Defender 130", generationCode: "L663", yearFrom: 2022, yearTo: 2026, fuelType: "HYBRID", engineVolume: "2997", powerHp: "350", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Defender 130 Dizel MHEV X-DYNAMIC HSE — resmi", sources: lrSrc }),
    stub("Land Rover", "Range Rover Evoque", "Evoque on official LR TR price hub — discrete version+trim ingest pending.", lrSrc, "Arazi, SUV & Pickup"),
    stub("Land Rover", "Discovery Sport", "Discovery Sport on official price hub — rows pending.", lrSrc, "Arazi, SUV & Pickup"),
    stub("Land Rover", "Range Rover Velar", "Velar on official price hub — rows pending.", lrSrc, "Arazi, SUV & Pickup"),
    stub("Land Rover", "Range Rover Sport", "RR Sport on official price hub — rows pending.", lrSrc, "Arazi, SUV & Pickup"),
    stub("Land Rover", "Range Rover", "Range Rover on official price hub — rows pending.", lrSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Defender", "Range Rover Evoque", "Discovery Sport", "Range Rover Velar", "Range Rover Sport", "Range Rover"], reviewRequiredSeries: ["Range Rover Evoque", "Discovery Sport", "Range Rover Velar", "Range Rover Sport", "Range Rover"] },
});

// ——— SUBARU ———
const subaruSrc = [
  src("https://subaru.com.tr/fiyat-listesi", "Subaru Türkiye resmi fiyat listesi"),
];
writeBrand({
  brand: "Subaru",
  brandSlug: "subaru",
  version: "2026.08-deep-subaru-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Forester", "Crosstrek", "Solterra", "XV", "Outback"],
  status: "IN_PROGRESS",
  notes: "Forester/Crosstrek/Solterra from official subaru.com.tr Aug 2026 price page.",
  configurations: [
    cfg({ brand: "Subaru", series: "Forester", model: "2.0i e-BOXER", trim: "Style", generation: "Forester e-BOXER TR MY2026", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1995", powerHp: "", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Yeni Forester e-BOXER 2.0i Style MY2026 — resmi subaru.com.tr (1.8.2026)", sources: subaruSrc }),
    cfg({ brand: "Subaru", series: "Forester", model: "2.0i e-BOXER", trim: "Fun", generation: "Forester e-BOXER TR MY2025", yearFrom: 2025, yearTo: 2025, fuelType: "HYBRID", engineVolume: "1995", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Forester e-BOXER 2.0i Fun MY2025 — resmi", sources: subaruSrc }),
    cfg({ brand: "Subaru", series: "Crosstrek", model: "2.0i e-BOXER", trim: "Xclusive", generation: "Crosstrek e-BOXER TR MY2025", yearFrom: 2025, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1995", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Crosstrek e-BOXER 2.0i Xclusive MY2025 — resmi", sources: subaruSrc }),
    cfg({ brand: "Subaru", series: "Solterra", model: "Electric", trim: "e-Xcellent", generation: "Solterra TR MY2023", yearFrom: 2023, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Solterra e-Xcellent — resmi; EV overlay Solterra", sources: subaruSrc }),
    cfg({ brand: "Subaru", series: "Solterra", model: "Electric", trim: "e-Xtreme", generation: "Solterra TR MY2023", yearFrom: 2023, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Solterra e-Xtreme — resmi", sources: subaruSrc }),
    stub("Subaru", "XV", "XV predecessor naming vs Crosstrek — historical TR archive pending.", subaruSrc, "Arazi, SUV & Pickup"),
    stub("Subaru", "Outback", "Outback TR current listing not on Aug 2026 official price page excerpt — pending.", subaruSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Forester", "Crosstrek", "Solterra", "XV", "Outback"], reviewRequiredSeries: ["XV", "Outback"] },
});

// ——— SUZUKI ———
const suzukiSrc = [
  src("https://www.suzuki.com.tr/tr/otomobil/firsat/vitara-4x4-firsati.html", "Suzuki Vitara 4x4 resmi kampanya (version+trim+fiyat)"),
  src("https://www.suzuki.com.tr/", "Suzuki Türkiye", DATE, "secondary"),
  src("https://www.otomotivsayfasi.com/kampanyalar/suzuki-vitara-kampanyasinda-neler-var/26283/", "Suzuki Vitara Ağustos kampanya özeti", "2026-08-01", "secondary"),
];
writeBrand({
  brand: "Suzuki",
  brandSlug: "suzuki",
  version: "2026.08-deep-suzuki-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Vitara", "Swift", "S-Cross", "Jimny"],
  status: "IN_PROGRESS",
  notes: "Vitara 1.4 MHEV AllGrip GL Elegance from official suzuki.com.tr campaign page.",
  configurations: [
    cfg({ brand: "Suzuki", series: "Vitara", model: "1.4 MHEV 6AT AllGrip", trim: "GL Elegance", generation: "Vitara TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "HYBRID", engineVolume: "1373", powerHp: "", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_OFFICIAL", notes: "Vitara 1.4 MHEV 6AT AllGrip GL Elegance (Tek Renk) MY2026 — resmi kampanya sayfası", sources: suzukiSrc }),
    stub("Suzuki", "Swift", "Swift high-volume TR historically; current official discrete engine+trim price rows pending.", suzukiSrc),
    stub("Suzuki", "S-Cross", "S-Cross AllGrip mentioned in Aug campaigns — discrete version+trim pending.", suzukiSrc, "Arazi, SUV & Pickup"),
    stub("Suzuki", "Jimny", "Jimny specialty TR — official current rows pending.", suzukiSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Vitara", "Swift", "S-Cross", "Jimny"], reviewRequiredSeries: ["Swift", "S-Cross", "Jimny"] },
});

// ——— LEXUS ———
const lexusSrc = [
  src("https://www.lexus.com.tr/", "Lexus Türkiye resmi site", DATE, "secondary"),
  src("https://teknobirinci.com.tr/agustos-2026-lexus-fiyat-listesi-aciklandi-27-milyon-tl-indirim-var/", "Lexus Ağustos 2026 versiyon tablosu", "2026-08-05"),
  src("https://onedio.com/haber/temmuz-2026-lexus-fiyat-listesi-iste-lexus-es-rx-rz-lbx-nx-ve-ls-guncel-fiyatlari-1369820", "Lexus Temmuz 2026 LBX tablosu", "2026-07-01", "secondary"),
];
writeBrand({
  brand: "Lexus",
  brandSlug: "lexus",
  version: "2026.08-deep-lexus-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["LBX", "NX", "RX", "RZ", "ES", "LM"],
  status: "IN_PROGRESS",
  notes: "LBX Hybrid trims from Aug/Jul 2026 published TR tables citing Lexus list prices.",
  configurations: [
    ...[
      ["LBX", ""],
      ["LBX", "Elegant"],
      ["LBX", "Emotion"],
      ["LBX", "Relax"],
      ["LBX", "Cool"],
    ].map(([modelBase, trim]) =>
      cfg({
        brand: "Lexus",
        series: "LBX",
        model: "1.5 Hybrid E-CVT",
        trim: trim || "Base",
        generation: "LBX Hybrid TR MY2026",
        yearFrom: 2024,
        yearTo: 2026,
        fuelType: "HYBRID",
        engineVolume: "1490",
        powerHp: "",
        transmission: "AUTOMATIC",
        driveType: "FWD",
        category: "Arazi, SUV & Pickup",
        confidence: "VERIFIED_MULTI_SOURCE",
        notes: `LBX ${trim || ""} E-CVT 1490 cc Hybrid MY2026 — Ağustos/Temmuz 2026 TR tables`,
        sources: lexusSrc,
      })
    ),
    cfg({ brand: "Lexus", series: "NX", model: "350h AWD", trim: "Business Plus", generation: "NX Hybrid TR MY2026", yearFrom: 2022, yearTo: 2026, fuelType: "HYBRID", engineVolume: "2487", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "NX 350h 4x4 Business Plus E-CVT — published TR 2026 lists", sources: lexusSrc }),
    cfg({ brand: "Lexus", series: "NX", model: "350h AWD", trim: "Executive", generation: "NX Hybrid TR MY2026", yearFrom: 2022, yearTo: 2026, fuelType: "HYBRID", engineVolume: "2487", transmission: "AUTOMATIC", driveType: "AWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "NX 350h 4x4 Executive — published TR 2026 lists", sources: lexusSrc }),
    stub("Lexus", "RX", "RX Hybrid / RX 500h on Aug lists — fuller version+trim ingest pending.", lexusSrc, "Arazi, SUV & Pickup"),
    stub("Lexus", "RZ", "RZ EV overlay series — discrete TR configs pending.", lexusSrc, "Arazi, SUV & Pickup"),
    stub("Lexus", "ES", "ES hybrid TR presence needs fresh official confirmation.", lexusSrc),
    stub("Lexus", "LM", "LM Hybrid listed Aug 2026 aggregators — official row pairing pending.", lexusSrc, "Minivan & Panelvan"),
  ],
  researchNotes: { researchedSeriesPass: ["LBX", "NX", "RX", "RZ", "ES", "LM"], reviewRequiredSeries: ["RX", "RZ", "ES", "LM"] },
});

// ——— MINI ———
const miniSrc = [
  src("https://www.mini.com.tr/", "MINI Türkiye resmi site", DATE, "secondary"),
  src("https://www.turkiyegazetesi.com.tr/t-otomobil/fiyati-14-milyon-tl-birden-yukseldi-iste-mini-agustos-2026-fiyat-listesi-1807060", "MINI Ağustos 2026 fiyat listesi", "2026-08-01"),
];
writeBrand({
  brand: "Mini",
  brandSlug: "mini",
  version: "2026.08-deep-mini-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Cooper", "Countryman", "Cabrio"],
  status: "IN_PROGRESS",
  notes: "Cooper/Countryman Aug 2026 published TR list. EV Countryman E preserved as Countryman series (no duplicate EV series invent).",
  configurations: [
    cfg({ brand: "Mini", series: "Countryman", model: "Countryman E", trim: "Favoured Plus", generation: "Countryman U25 EV TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "ELECTRIC", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "MINI Countryman E Favoured Plus — Ağustos 2026 TR; EV under Countryman series", sources: miniSrc }),
    cfg({ brand: "Mini", series: "Countryman", model: "Countryman C", trim: "Favoured", generation: "Countryman U25 TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Countryman C Favoured — Ağustos 2026 TR", sources: miniSrc }),
    cfg({ brand: "Mini", series: "Countryman", model: "Countryman C", trim: "John Cooper Works", generation: "Countryman U25 TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", category: "Arazi, SUV & Pickup", confidence: "VERIFIED_MULTI_SOURCE", notes: "Countryman C JCW — Ağustos 2026 TR", sources: miniSrc }),
    cfg({ brand: "Mini", series: "Cooper", model: "Cooper 3 Kapı", trim: "Favoured", generation: "Cooper J01 TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Cooper 3 Kapı Favoured — Ağustos 2026 TR", sources: miniSrc }),
    cfg({ brand: "Mini", series: "Cooper", model: "Cooper S 3 Kapı", trim: "Favoured", generation: "Cooper J01 TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Cooper S 3 Kapı Favoured — Ağustos 2026 TR", sources: miniSrc }),
    cfg({ brand: "Mini", series: "Cooper", model: "Cooper 5 Kapı", trim: "Favoured", generation: "Cooper J01 TR MY2026", yearFrom: 2024, yearTo: 2026, fuelType: "GASOLINE", transmission: "AUTOMATIC", driveType: "FWD", confidence: "VERIFIED_MULTI_SOURCE", notes: "Cooper 5 Kapı Favoured — Ağustos 2026 TR", sources: miniSrc }),
    stub("Mini", "Cabrio", "Cabrio rows in Aug list — fuller engine+trim pairing pending dedicated ingest.", miniSrc),
  ],
  researchNotes: { researchedSeriesPass: ["Cooper", "Countryman", "Cabrio"], reviewRequiredSeries: ["Cabrio"] },
});

// ——— PORSCHE (conservative — weak official scrape) ———
const porscheSrc = [
  src("https://www.porsche.com/turkey/", "Porsche Türkiye resmi site"),
  src("https://otoviraj.com/porsche-fiyat-listesi/", "Porsche TR fiyat derlemesi (Doğuş Oto bağlamı)", "2026-01-09", "secondary"),
];
writeBrand({
  brand: "Porsche",
  brandSlug: "porsche",
  version: "2026.08-deep-porsche-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Macan", "Cayenne", "911", "Taycan", "Panamera"],
  status: "IN_PROGRESS",
  notes: "Official porsche.com/turkey present; discrete version+trim from non-PDF aggregators only — REVIEW_REQUIRED until official PDF ingest. EV Taycan overlay preserved as series stub.",
  configurations: [
    stub("Porsche", "Macan", "Macan 4 / Turbo EV listed in 2026 TR aggregators (~8.8M+) — need official Porsche TR PDF/configurator row before VERIFIED.", porscheSrc, "Arazi, SUV & Pickup"),
    stub("Porsche", "Cayenne", "Cayenne family TR — official discrete engine+trim pending.", porscheSrc, "Arazi, SUV & Pickup"),
    stub("Porsche", "911", "911 TR specialty — official rows pending.", porscheSrc),
    stub("Porsche", "Taycan", "Taycan EV overlay series — official TR price PDF rows pending (no inventing).", porscheSrc),
    stub("Porsche", "Panamera", "Panamera TR — official rows pending.", porscheSrc),
  ],
  researchNotes: { researchedSeriesPass: ["Macan", "Cayenne", "911", "Taycan", "Panamera"], reviewRequiredSeries: ["Macan", "Cayenne", "911", "Taycan", "Panamera"], note: "Researched but no VERIFIED row this pass without official PDF" },
});

// ——— JAGUAR ———
const jagSrc = [
  src("https://www.jaguar.com.tr/", "Jaguar Türkiye resmi site"),
  src("https://yeniarabafiyatlari.com/jaguar/f-pace/2026/r-dynamic-hse-2-0-d204-bg-mhev-awd-fiyatlari", "Jaguar F-Pace 2026 aggregator versiyon", DATE, "secondary"),
];
writeBrand({
  brand: "Jaguar",
  brandSlug: "jaguar",
  version: "2026.08-deep-jaguar-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["F-Pace", "E-Pace", "I-Pace", "XE", "XF"],
  status: "IN_PROGRESS",
  notes: "Jaguar TR model run-out / EV transition period. Aggregator F-Pace rows exist but official jaguar.com.tr price PDF not captured — REVIEW_REQUIRED.",
  configurations: [
    stub("Jaguar", "F-Pace", "F-Pace 2.0 D204 MHEV SE/R-Dynamic HSE appear on aggregators MY2026 — official JLR TR price confirmation required before VERIFIED.", jagSrc, "Arazi, SUV & Pickup"),
    stub("Jaguar", "E-Pace", "E-Pace TR current official rows not confirmed this pass.", jagSrc, "Arazi, SUV & Pickup"),
    stub("Jaguar", "I-Pace", "I-Pace EV overlay — TR availability/config pending official confirm.", jagSrc, "Arazi, SUV & Pickup"),
    stub("Jaguar", "XE", "XE discontinued historically — archive only.", jagSrc),
    stub("Jaguar", "XF", "XF discontinued historically — archive only.", jagSrc),
  ],
  researchNotes: { researchedSeriesPass: ["F-Pace", "E-Pace", "I-Pace", "XE", "XF"], reviewRequiredSeries: ["F-Pace", "E-Pace", "I-Pace", "XE", "XF"] },
});

// ——— MAZDA ———
const mazdaSrc = [
  src("https://www.mazda.com.tr/", "Mazda Türkiye resmi site"),
];
writeBrand({
  brand: "Mazda",
  brandSlug: "mazda",
  version: "2026.08-deep-mazda-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Mazda3", "CX-5", "CX-30", "CX-60", "MX-5"],
  status: "IN_PROGRESS",
  notes: "Mazda TR site researched; discrete Aug 2026 official version+trim price rows not captured this pass — REVIEW_REQUIRED stubs only (no inventing).",
  configurations: [
    stub("Mazda", "Mazda3", "High-volume historically; need official mazda.com.tr fiyat PDF rows.", mazdaSrc),
    stub("Mazda", "CX-5", "CX-5 TR — official current engine+trim pending.", mazdaSrc, "Arazi, SUV & Pickup"),
    stub("Mazda", "CX-30", "CX-30 TR — official rows pending.", mazdaSrc, "Arazi, SUV & Pickup"),
    stub("Mazda", "CX-60", "CX-60 TR — official rows pending.", mazdaSrc, "Arazi, SUV & Pickup"),
    stub("Mazda", "MX-5", "MX-5 specialty — official rows pending.", mazdaSrc),
  ],
  researchNotes: { researchedSeriesPass: ["Mazda3", "CX-5", "CX-30", "CX-60", "MX-5"], reviewRequiredSeries: ["Mazda3", "CX-5", "CX-30", "CX-60", "MX-5"] },
});

// ——— MITSUBISHI ———
const mitsuSrc = [
  src("https://www.mitsubishi-motors.com.tr/", "Mitsubishi Türkiye resmi site"),
  src("https://www.arabava.com/mitsubishi-fiyat-listesi-2026-mayis/", "Mitsubishi Mayıs 2026 derleme (fiyatlar belirlenmedi)", "2026-05-01", "secondary"),
];
writeBrand({
  brand: "Mitsubishi",
  brandSlug: "mitsubishi",
  version: "2026.08-deep-mitsubishi-v1-current-tr",
  generatedAt: GEN,
  seriesCovered: ["Space Star", "ASX", "Eclipse Cross", "L200"],
  status: "IN_PROGRESS",
  notes: "May 2026 aggregators show Space Star rows as fiyat belirlenmedi — no VERIFIED invent. REVIEW stubs only.",
  configurations: [
    stub("Mitsubishi", "Space Star", "Space Star Intense CVT historically TR; May 2026 aggregator prices unset — official confirmation required.", mitsuSrc),
    stub("Mitsubishi", "ASX", "ASX TR current official version+trim pending.", mitsuSrc, "Arazi, SUV & Pickup"),
    stub("Mitsubishi", "Eclipse Cross", "Eclipse Cross TR — official rows pending.", mitsuSrc, "Arazi, SUV & Pickup"),
    stub("Mitsubishi", "L200", "L200 pickup TR — official ticari rows pending.", mitsuSrc, "Arazi, SUV & Pickup"),
  ],
  researchNotes: { researchedSeriesPass: ["Space Star", "ASX", "Eclipse Cross", "L200"], reviewRequiredSeries: ["Space Star", "ASX", "Eclipse Cross", "L200"] },
});

console.log("\nDone.");
