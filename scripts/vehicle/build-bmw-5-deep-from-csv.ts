/**
 * Build BMW deep-catalog JSON + BMW 5 Series gate summary from research CSV.
 * npx tsx scripts/vehicle/build-bmw-5-deep-from-csv.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const CSV = join(ROOT, "docs/vehicle-research/bmw-5-series-deep-catalog.csv");

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cols: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = cols[i] ?? "";
    });
    rows.push(o);
  }
  return rows;
}

function main() {
  const rows = parseCsv(readFileSync(CSV, "utf8"));
  const verified = rows.filter(
    (r) => r.confidence === "VERIFIED_OFFICIAL" || r.confidence === "VERIFIED_MULTI_SOURCE"
  );
  const review = rows.filter((r) => r.confidence === "REVIEW_REQUIRED");
  const rejected = rows.filter((r) => r.confidence === "REJECTED");

  const configs = verified
    .filter((r) => r.model && r.trim)
    .map((r) => ({
      brand: r.brand,
      series: r.series,
      model: r.model,
      trim: r.trim,
      generation: r.generation,
      generationCode: r.generationCode,
      yearFrom: r.yearFrom ? Number(r.yearFrom) : null,
      yearTo: r.yearTo ? Number(r.yearTo) : null,
      fuelType: r.fuelType || null,
      engineVolume: r.engineVolume || null,
      powerHp: r.powerHp || null,
      transmission: r.transmission || null,
      driveType: r.driveType || null,
      confidence: r.confidence,
      verifiedForTurkey: r.verifiedForTurkey === "true",
      category: r.category,
      notes: r.notes,
      sources: [
        { url: r.officialSource, title: r.sourceTitle, date: r.sourceDate, role: "primary" as const },
        ...(r.secondarySource
          ? [{ url: r.secondarySource, title: r.sourceTitle, date: r.sourceDate, role: "secondary" as const }]
          : []),
      ],
    }));

  const seen = new Set<string>();
  const unique = configs.filter((c) => {
    const k = [c.brand, c.series, c.model, c.trim, c.generationCode, c.yearFrom, c.yearTo].join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const trims520i = [...new Set(unique.filter((u) => u.model === "520i").map((u) => u.trim))];
  const trims520d = [
    ...new Set(
      unique.filter((u) => u.model === "520d" || u.model === "520d xDrive").map((u) => u.trim)
    ),
  ];
  const models = [...new Set(unique.map((u) => u.model))];
  const gens = [...new Set(unique.map((u) => u.generationCode).filter(Boolean))];

  mkdirSync(join(ROOT, "data/vehicle-deep-catalog"), { recursive: true });
  mkdirSync(join(ROOT, "scripts/output"), { recursive: true });
  mkdirSync(join(ROOT, "docs/vehicle-research"), { recursive: true });

  writeFileSync(
    join(ROOT, "data/vehicle-deep-catalog/BMW.json"),
    JSON.stringify(
      {
        brand: "BMW",
        brandSlug: "bmw",
        version: "2026.08-deep-bmw-5-series-v1",
        generatedAt: new Date().toISOString(),
        seriesCovered: ["5 Serisi"],
        status: "IN_PROGRESS",
        configurations: unique,
      },
      null,
      2
    )
  );

  const gate = {
    has520iWithTrims: trims520i.length >= 2,
    has520dFamilyWithTrims: trims520d.length >= 2,
    mSportIsTrimNotModel: !unique.some((u) => u.model === "M Sport") && unique.some((u) => u.trim === "M Sport"),
    pass: trims520i.length >= 2 && trims520d.length >= 2,
  };

  const summary = {
    bmw5Series: {
      totalRows: rows.length,
      verifiedOfficial: rows.filter((r) => r.confidence === "VERIFIED_OFFICIAL").length,
      verifiedMultiSource: rows.filter((r) => r.confidence === "VERIFIED_MULTI_SOURCE").length,
      reviewRequired: review.length,
      rejected: rejected.length,
      distinctModelsWithVerifiedTrim: models.length,
      models,
      distinctTrims520i: trims520i,
      distinctTrims520dFamily: trims520d,
      generationCodes: gens,
      uniqueVerifiedConfigs: unique.length,
      gate,
    },
  };

  writeFileSync(join(ROOT, "docs/vehicle-research/bmw-5-series-gate-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(
    join(ROOT, "scripts/output/deep-catalog-progress.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checkpointCommit: "b3414b3",
        phase: "bmw-5-series-proof",
        completedBrands: [],
        inProgressBrand: "BMW",
        remainingBrands: [
          "BMW",
          "Mercedes-Benz",
          "Audi",
          "Volkswagen",
          "Renault",
          "Fiat",
          "Ford",
          "Toyota",
          "Peugeot",
          "Opel",
          "Hyundai",
          "Honda",
          "Skoda",
          "Seat",
          "Citroen",
          "Volvo",
          "Nissan",
          "Kia",
          "Dacia",
          "Alfa Romeo",
          "Cupra",
          "Mini",
          "Porsche",
          "Lexus",
          "Jaguar",
          "Land Rover",
          "Jeep",
          "Mitsubishi",
          "Subaru",
          "Suzuki",
          "Mazda",
          "Tesla",
          "TOGG",
          "BYD",
          "MG",
          "(other selectable)",
        ],
        verifiedModels: models.length,
        verifiedTrims: [...new Set(unique.map((u) => u.trim))].length,
        verifiedConfigurations: unique.length,
        reviewRequired: review.length,
        rejected: rejected.length,
        bmw5Gate: gate,
        dbApplyStarted: false,
        notes:
          "Research-only phase. Current pack versions mix engine+package; deep files separate model(engine) vs trim(package). No DB write yet.",
      },
      null,
      2
    )
  );

  console.log(JSON.stringify(summary, null, 2));
}

main();
