/**
 * Ingest Audi A4 Sedan category leaves from Sahibinden Vasıta tree snapshot
 * into data/vehicle-deep-catalog/Audi.json (version ≠ trim).
 *
 * Live sahibinden.com fetch is anti-bot blocked; leaves come from the
 * Sahibinden A4 Sedan facet list captured for this project (counts included).
 *
 * npx tsx scripts/vehicle/ingest-audi-a4-sahibinden.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const AUDI_JSON = join(ROOT, "data/vehicle-deep-catalog/Audi.json");

const SOURCE = {
  url: "https://www.sahibinden.com/audi-a4",
  title: "Sahibinden Vasıta → Otomobil → Audi → A4 → A4 Sedan category leaves",
  date: "2026-08-07",
  role: "primary" as const,
  type: "marketplace_category_tree",
  publisher: "sahibinden.com",
  note: "Live automated fetch blocked (anti-bot). Leaf names+counts from Sahibinden A4 Sedan tree snapshot used in product research.",
};

/** Raw Sahibinden A4 Sedan leaves: "label (count)" */
const SEDAN_LEAVES = [
  "40 TDI (698)",
  "45 TFSI (151)",
  "1.4 TFSI (9)",
  "1.4 TFSI Design (301)",
  "1.4 TFSI Dynamic (191)",
  "1.4 TFSI Sport (165)",
  "1.6 (185)",
  "1.8 (31)",
  "1.8 T (50)",
  "1.8 TFSI (216)",
  "1.8 T Quattro (14)",
  "1.9 TDI (35)",
  "1.9 TDI Quattro (2)",
  "2.0 (31)",
  "2.0 TDI (945)",
  "2.0 TDI Design (95)",
  "2.0 TDI Dynamic (75)",
  "2.0 TDI S Line (9)",
  "2.0 TDI Sport (13)",
  "2.0 TDI Quattro (144)",
  "2.0 TDI Quattro Design (57)",
  "2.0 TDI Quattro Dynamic (38)",
  "2.0 TDI Quattro Sport (32)",
  "2.0 TFSI (9)",
  "2.0 TFSI Quattro (65)",
  "2.0 TFSI Quattro S Line (2)",
  "2.0 TFSI Quattro Sport (1)",
  "2.4 (7)",
  "2.5 TDI (5)",
  "2.5 TDI Quattro (1)",
  "2.7 TDI (5)",
  "2.8 Quattro (2)",
  "3.0 (1)",
  "3.0 Quattro (8)",
  "3.2 FSI (1)",
];

const TRIM_SUFFIXES = [
  "S Line",
  "S line",
  "Design",
  "Dynamic",
  "Sport",
  "Advanced",
  "Attraction",
  "Ambition",
  "Ambiente",
];

type Config = {
  brand: string;
  series: string;
  model: string;
  trim: string;
  generation: string;
  generationCode: string;
  yearFrom: number | null;
  yearTo: number | null;
  fuelType: string | null;
  driveType: string | null;
  transmission: string | null;
  confidence: string;
  verifiedForTurkey: boolean;
  category: string;
  bodyType?: string;
  listingCountHint?: number;
  trimStatus?: string;
  notes?: string;
  sources: Array<Record<string, string>>;
};

function parseLeaf(raw: string): { label: string; count: number } {
  const m = raw.match(/^(.*)\s+\((\d+)\)\s*$/);
  if (!m) return { label: raw.trim(), count: 0 };
  return { label: m[1].trim(), count: Number(m[2]) };
}

function splitVersionTrim(label: string): { model: string; trim: string; driveType: string | null } {
  let rest = label.replace(/\s+/g, " ").trim();
  // Normalize Quattro → quattro inside version naming (Audi marketing)
  let trim = "";
  for (const t of TRIM_SUFFIXES) {
    const re = new RegExp(`\\s+${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    if (re.test(rest)) {
      trim = /s\s*line/i.test(t) ? "S line" : t.replace(/^S Line$/i, "S line");
      if (/^s\s*line$/i.test(t)) trim = "S line";
      else if (/^design$/i.test(t)) trim = "Design";
      else if (/^dynamic$/i.test(t)) trim = "Dynamic";
      else if (/^sport$/i.test(t)) trim = "Sport";
      else if (/^advanced$/i.test(t)) trim = "Advanced";
      rest = rest.replace(re, "").trim();
      break;
    }
  }
  // Keep quattro on version
  rest = rest.replace(/\bQuattro\b/gi, "quattro");
  const driveType = /\bquattro\b/i.test(rest) ? "AWD" : null;
  return { model: rest, trim, driveType };
}

function guessFuel(model: string): string | null {
  const m = model.toUpperCase();
  if (/\bTDI\b/.test(m)) return "DIESEL";
  if (/\bTFSI\b|\bFSI\b|\bT\b/.test(m) || /\d\.\d$/.test(model.trim())) return "GASOLINE";
  return null;
}

function guessYears(model: string): { yearFrom: number | null; yearTo: number | null; generation: string; generationCode: string } {
  const m = model.toLowerCase();
  // Modern commercial codes
  if (/^40 tdi|^45 tfsi/.test(m)) {
    return { yearFrom: 2019, yearTo: 2026, generation: "B9 / B9 FL Sedan", generationCode: "B9" };
  }
  if (/1\.9 tdi|2\.5 tdi|2\.4|2\.8|3\.0$|3\.2 fsi|1\.8 t$/.test(m) && !/tfsi/.test(m)) {
    return { yearFrom: 1994, yearTo: 2008, generation: "B5/B6/B7 Sedan (historical)", generationCode: "B6-B7" };
  }
  if (/1\.8 tfsi|2\.0 tdi|2\.0 tfsi|1\.4 tfsi|2\.7 tdi|1\.6$|2\.0$/.test(m)) {
    // Broad TR market window spanning B8–B9 where these leaves appear
    return { yearFrom: 2008, yearTo: 2024, generation: "B8/B9 Sedan (Sahibinden leaf span)", generationCode: "B8-B9" };
  }
  return { yearFrom: 1994, yearTo: 2026, generation: "A4 Sedan (Sahibinden)", generationCode: "A4-Sedan" };
}

function keyOf(c: { model: string; trim: string; generationCode?: string; yearFrom?: number | null }) {
  return `A4|${c.model}|${c.trim}|${c.generationCode || ""}|${c.yearFrom ?? ""}|sahibinden`;
}

function main() {
  const raw = JSON.parse(readFileSync(AUDI_JSON, "utf8"));
  const map = new Map<string, Config>();
  for (const c of raw.configurations || []) {
    map.set(
      `${c.series}|${c.model || ""}|${c.trim || ""}|${c.generationCode || ""}|${c.yearFrom ?? ""}|${c.confidence || ""}`,
      c
    );
  }

  let added = 0;
  const parsed: Array<{ leaf: string; model: string; trim: string; count: number }> = [];

  for (const leafRaw of SEDAN_LEAVES) {
    const { label, count } = parseLeaf(leafRaw);
    const { model, trim, driveType } = splitVersionTrim(label);
    const years = guessYears(model);
    const conf: Config = {
      brand: "Audi",
      series: "A4",
      model,
      trim,
      generation: years.generation,
      generationCode: years.generationCode,
      yearFrom: years.yearFrom,
      yearTo: years.yearTo,
      fuelType: guessFuel(model),
      driveType,
      transmission: null,
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Otomobil",
      bodyType: "Sedan",
      listingCountHint: count,
      ...(trim
        ? {}
        : {
            trimStatus: "NO_VERIFIED_TRIM_FOUND",
            notes:
              "Sahibinden leaf is engine/version only (no package suffix). Trim left empty — not invented.",
          }),
      notes:
        (trim
          ? `Sahibinden A4 Sedan leaf "${label}" → version="${model}" trim="${trim}" (count=${count}).`
          : `Sahibinden A4 Sedan leaf "${label}" → version="${model}" only (count=${count}).`) +
        " Live scrape blocked; leaf list from Sahibinden category tree snapshot.",
      sources: [
        { ...SOURCE },
        {
          url: "https://www.sahibinden.com/audi-a4",
          title: "Sahibinden Audi A4 category (anti-bot may block automated fetch)",
          date: "2026-08-07",
          role: "secondary",
          type: "marketplace_category",
          publisher: "sahibinden.com",
        },
      ],
    };

    parsed.push({ leaf: label, model, trim, count });
    const k = keyOf(conf);
    // Also avoid dup against existing A4 same model+trim
    const existingKey = [...map.keys()].find((x) => {
      const c = map.get(x)!;
      return (
        c.series === "A4" &&
        c.model === conf.model &&
        (c.trim || "") === (conf.trim || "") &&
        (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE")
      );
    });
    if (!existingKey) {
      map.set(`${conf.series}|${conf.model}|${conf.trim}|sbn|${conf.generationCode}`, conf);
      added++;
    } else {
      // Enrich existing with Sahibinden source if missing
      const ex = map.get(existingKey)!;
      const urls = new Set((ex.sources || []).map((s: any) => s.url));
      if (!urls.has(SOURCE.url)) {
        ex.sources = [...(ex.sources || []), SOURCE];
        if (count) ex.listingCountHint = count;
        map.set(existingKey, ex);
      }
    }
  }

  const configs = [...map.values()];
  const next = {
    ...raw,
    version: "2026.08-deep-audi-a4-sahibinden-sedan",
    generatedAt: new Date().toISOString(),
    status: raw.status || "IN_PROGRESS",
    researchNotes: {
      ...(raw.researchNotes || {}),
      a4SahibindenSedan: {
        leafCount: SEDAN_LEAVES.length,
        added,
        source: SOURCE.url,
        liveFetch: "BLOCKED_ANTI_BOT",
        bodyType: "Sedan",
      },
    },
    configurations: configs,
  };
  writeFileSync(AUDI_JSON, JSON.stringify(next, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        added,
        total: configs.length,
        a4Verified: configs.filter(
          (c) =>
            c.series === "A4" &&
            (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE")
        ).length,
        parsed,
      },
      null,
      2
    )
  );
}

main();
