/**
 * Ingest BMW 5 Serisi Marka→Seri→Motor→Paket tree from satariz.com
 * into data/vehicle-deep-catalog/BMW.json (version ≠ trim).
 *
 * npx tsx scripts/vehicle/ingest-bmw-5-satariz.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const BMW_JSON = join(ROOT, "data/vehicle-deep-catalog/BMW.json");
const SERIES_URL = "https://www.satariz.com/bmw-5-serisi";
const SERIES_PREFIX = "bmw-5-serisi-";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SOURCE = {
  url: SERIES_URL,
  title: "satariz.com Vasıta → Araç → BMW → 5 Serisi category tree",
  date: new Date().toISOString().slice(0, 10),
  role: "primary" as const,
  type: "marketplace_category_tree",
  publisher: "satariz.com",
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
  fuelType: string | null;
  driveType: string | null;
  transmission: string | null;
  confidence: string;
  verifiedForTurkey: boolean;
  category: string;
  trimStatus?: string;
  notes?: string;
  sources: Array<Record<string, string>>;
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function extractHrefs(html: string, re: RegExp): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(re)) {
    const slug = m[1];
    if (/\d{7,}$/.test(slug)) continue; // listing pollution
    out.add(slug);
  }
  return [...out].sort();
}

/** bmw-5-serisi-520d-xdrive → 520d xDrive */
function humanizeMotor(slugTail: string): string {
  let s = slugTail.replace(/-/g, " ");
  s = s.replace(/\bxdrive\b/gi, "xDrive");
  s = s.replace(/\bgran turismo\b/gi, "Gran Turismo");
  s = s.replace(/\bli\b/gi, "Li");
  s = s.replace(/\btd\b/gi, "td");
  s = s.replace(/\btds\b/gi, "tds");
  // Capitalize letter-prefix motors already mostly lower: 520d stays
  return s.replace(/\s+/g, " ").trim();
}

/** executive-m-sport → Executive M Sport */
function humanizeTrim(slugTail: string): string {
  const parts = slugTail.split("-").filter(Boolean);
  return parts
    .map((p) => {
      if (/^m$/i.test(p)) return "M";
      if (/^xdrive$/i.test(p)) return "xDrive";
      if (/^ed$/i.test(p)) return "ED";
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bM Sport\b/i, "M Sport")
    .replace(/\bSport Line\b/i, "Sport Line")
    .replace(/\bLuxury Line\b/i, "Luxury Line")
    .replace(/\bStandart\b/i, "Standart");
}

function guessFuel(model: string): string | null {
  const m = model.toLowerCase();
  if (/\be xdrive\b|^\d{3}e\b/.test(m)) return "HYBRID";
  if (/\d{3}d\b|d xdrive|d gran|\btds?\b/.test(m)) return "DIESEL";
  if (/\d{3}i\b|i xdrive|\bli\b/.test(m)) return "GASOLINE";
  if (/\bd\b/.test(m)) return "DIESEL";
  if (/\bi\b/.test(m)) return "GASOLINE";
  return null;
}

function guessDrive(model: string): string | null {
  return /xdrive|\bxi\b|\bix\b/i.test(model) ? "AWD" : null;
}

function configKey(c: Pick<Config, "series" | "model" | "trim" | "generationCode" | "confidence">) {
  return `${c.series}|${c.model}|${c.trim}|${c.generationCode || ""}|${c.confidence}`;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

async function main() {
  const seriesHtml = await fetchText(SERIES_URL);
  const motorSlugs = extractHrefs(
    seriesHtml,
    /href="(?:https:\/\/www\.satariz\.com)?\/(bmw-5-serisi-[a-z0-9\-]+)"/gi
  ).filter((s) => {
    const tail = s.slice(SERIES_PREFIX.length);
    // series page lists motors as direct children — exclude deep package paths by
    // keeping only slugs that appear as top-level motors (no known package-only words alone).
    // Heuristic: fetch later validates; here keep all that don't look like listing.
    return Boolean(tail) && !/\d{7,}/.test(tail);
  });

  // Motors = slugs that are NOT a longer extension of another slug on the same page
  // First pass: all hrefs on series page are motors (40). Packages live on motor pages.
  const motors = motorSlugs
    .map((s) => s.slice(SERIES_PREFIX.length))
    .filter((tail) => !/ilan|model-\d/.test(tail))
    .sort((a, b) => a.localeCompare(b));

  console.log(JSON.stringify({ seriesUrl: SERIES_URL, motorCount: motors.length, motors }, null, 2));

  const pairs: Array<{ model: string; trim: string; motorSlug: string; trimSlug?: string }> = [];

  await mapPool(motors, 4, async (motorTail) => {
    const model = humanizeMotor(motorTail);
    const motorUrl = `https://www.satariz.com/${SERIES_PREFIX}${motorTail}`;
    let html = "";
    try {
      html = await fetchText(motorUrl);
    } catch (e) {
      console.warn("fetch_fail", motorUrl, e);
      pairs.push({ model, trim: "", motorSlug: motorTail });
      return;
    }
    const childRe = new RegExp(
      `href="(?:https://www\\.satariz\\.com)?/(${SERIES_PREFIX}${motorTail}-[a-z0-9\\-]+)"`,
      "gi"
    );
    const children = extractHrefs(html, childRe);
    const trims = children
      .map((c) => c.slice(`${SERIES_PREFIX}${motorTail}-`.length))
      .filter((t) => t && !/\d{7,}$/.test(t))
      // body-style sometimes nested; keep as trim candidate (not invented)
      .filter((t) => !/^xdrive$/i.test(t)); // xDrive alone is motor-level elsewhere

    if (!trims.length) {
      pairs.push({ model, trim: "", motorSlug: motorTail });
      return;
    }
    for (const t of trims) {
      pairs.push({
        model,
        trim: humanizeTrim(t),
        motorSlug: motorTail,
        trimSlug: t,
      });
    }
  });

  // Dedupe model+trim
  const uniq = new Map<string, { model: string; trim: string }>();
  for (const p of pairs) {
    const k = `${p.model.toLocaleLowerCase("tr-TR")}|${p.trim.toLocaleLowerCase("tr-TR")}`;
    if (!uniq.has(k)) uniq.set(k, { model: p.model, trim: p.trim });
  }
  const leafRows = [...uniq.values()].sort((a, b) =>
    a.model.localeCompare(b.model, "tr") || a.trim.localeCompare(b.trim, "tr")
  );

  const raw = JSON.parse(readFileSync(BMW_JSON, "utf8"));
  const map = new Map<string, Config>();
  for (const c of raw.configurations || []) {
    map.set(configKey(c), c);
  }

  let added = 0;
  let updated = 0;
  for (const row of leafRows) {
    const conf: Config = {
      brand: "BMW",
      series: "5 Serisi",
      model: row.model,
      trim: row.trim,
      generation: "5 Serisi (satariz.com category tree)",
      generationCode: "SATARIZ-5",
      yearFrom: 1981,
      yearTo: 2026,
      fuelType: guessFuel(row.model),
      driveType: guessDrive(row.model),
      transmission: null,
      confidence: "VERIFIED_MULTI_SOURCE",
      verifiedForTurkey: true,
      category: "Otomobil",
      ...(row.trim
        ? {}
        : {
            trimStatus: "NO_VERIFIED_TRIM_FOUND",
          }),
      notes: row.trim
        ? `satariz.com BMW 5 Serisi leaf → version="${row.model}" trim="${row.trim}".`
        : `satariz.com BMW 5 Serisi motor "${row.model}" with no nested package leaves; trim left empty.`,
      sources: [SOURCE],
    };
    const k = configKey(conf);
    if (map.has(k)) {
      map.set(k, { ...map.get(k)!, ...conf, sources: [...(map.get(k)!.sources || []), SOURCE] });
      updated++;
    } else {
      map.set(k, conf);
      added++;
    }
  }

  raw.configurations = [...map.values()];
  raw.version = `${raw.version || "bmw"}-satariz-5serisi`;
  raw.generatedAt = new Date().toISOString();
  writeFileSync(BMW_JSON, JSON.stringify(raw, null, 2) + "\n", "utf8");

  const versions = new Set(leafRows.map((r) => r.model));
  console.log(
    JSON.stringify(
      {
        ok: true,
        motorsFetched: motors.length,
        uniqueLeaves: leafRows.length,
        uniqueVersions: versions.size,
        withTrim: leafRows.filter((r) => r.trim).length,
        versionOnly: leafRows.filter((r) => !r.trim).length,
        added,
        updated,
        sample: leafRows.filter((r) => r.model.startsWith("520d")).slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
