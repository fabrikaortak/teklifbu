/**
 * Build full satariz Otomobil menu tree (Brand → Series → Version → Trim)
 * as a single ASCII tree file for external review (ChatGPT etc.).
 *
 * Uses existing schema JSON for Brand→Series, then deep-crawls each series.
 *
 * npx tsx scripts/vehicle/export-satariz-otomobil-menu-tree.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const OUT_DIR = join(process.env.USERPROFILE || process.cwd(), "Downloads");
const SCHEMA = join(OUT_DIR, "teklifbu_satariz_otomobil_marka_seri_sema.json");
const PROGRESS = join(OUT_DIR, "teklifbu_satariz_otomobil_menu_tree.progress.json");
const OUT_TXT = join(OUT_DIR, "teklifbu_satariz_otomobil_MENU_AGACI.txt");
const OUT_MD = join(OUT_DIR, "teklifbu_satariz_otomobil_MENU_AGACI.md");

const SKIP_BRANDS = new Set(["is-makineleri", "kral"]); // non-car / empty noise

type Schema = {
  brands: Array<{
    brand: string;
    brandSlug: string;
    url: string;
    series: Array<{ name: string; slug: string; url: string }>;
  }>;
};

type MotorNode = { name: string; trims: string[] };
type SeriesNode = { name: string; motors: MotorNode[] };
type BrandNode = { name: string; series: SeriesNode[] };

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanizeMotor(slugTail: string): string {
  return slugTail
    .replace(/-/g, " ")
    .replace(/\bxdrive\b/gi, "xDrive")
    .replace(/\bgran turismo\b/gi, "Gran Turismo")
    .replace(/\bli\b/gi, "Li")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeTrim(slugTail: string): string {
  return slugTail
    .split("-")
    .filter(Boolean)
    .map((p) => {
      if (/^m$/i.test(p)) return "M";
      if (/^xdrive$/i.test(p)) return "xDrive";
      if (/^ed$/i.test(p)) return "ED";
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bM Sport\b/i, "M Sport")
    .replace(/\bSport Line\b/i, "Sport Line")
    .replace(/\bLuxury Line\b/i, "Luxury Line");
}

function extractHrefs(html: string, re: RegExp): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(re)) {
    const slug = m[1].toLowerCase();
    if (/\d{7,}$/.test(slug)) continue;
    out.add(slug);
  }
  return [...out].sort();
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()));
  return out;
}

async function crawlSeries(seriesUrl: string, seriesFullSlug: string): Promise<MotorNode[]> {
  const html = await fetchText(seriesUrl);
  const escaped = seriesFullSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const childRe = new RegExp(
    `href="(?:https://www\\.satariz\\.com)?/(${escaped}-[a-z0-9\\-]+)"`,
    "gi"
  );
  const children = extractHrefs(html, childRe).map((s) => s.slice(seriesFullSlug.length + 1));

  // Motors = children that are not extensions of a shorter sibling
  const sorted = [...children].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const motors: string[] = [];
  for (const c of sorted) {
    if (motors.some((m) => c === m || c.startsWith(m + "-"))) continue;
    // if a longer one exists that this prefixes, still keep shorter as motor
    motors.push(c);
  }
  // Recompute: true motors are those not extending another motor candidate
  const motorTails: string[] = [];
  for (const c of sorted) {
    const parent = motorTails.find((m) => c.startsWith(m + "-"));
    if (parent) continue;
    motorTails.push(c);
  }

  const motorNodes = await mapPool(motorTails, 4, async (motorTail) => {
    const model = humanizeMotor(motorTail);
    const motorUrl = `https://www.satariz.com/${seriesFullSlug}-${motorTail}`;
    let trims: string[] = [];
    try {
      const mHtml = await fetchText(motorUrl);
      const mEsc = `${seriesFullSlug}-${motorTail}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mRe = new RegExp(`href="(?:https://www\\.satariz\\.com)?/(${mEsc}-[a-z0-9\\-]+)"`, "gi");
      trims = extractHrefs(mHtml, mRe)
        .map((s) => s.slice(`${seriesFullSlug}-${motorTail}-`.length))
        .filter((t) => t && !/\d{7,}$/.test(t) && !/^xdrive$/i.test(t))
        .map(humanizeTrim);
      trims = [...new Set(trims)].sort((a, b) => a.localeCompare(b, "tr"));
    } catch {
      trims = [];
    }
    await sleep(40);
    return { name: model, trims };
  });

  return motorNodes.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function renderTree(brands: BrandNode[]): string {
  const lines: string[] = [];
  for (let bi = 0; bi < brands.length; bi++) {
    const brand = brands[bi];
    lines.push(brand.name);
    for (let si = 0; si < brand.series.length; si++) {
      const series = brand.series[si];
      const sLast = si === brand.series.length - 1;
      const sBranch = sLast ? "└── " : "├── ";
      const sPad = sLast ? "    " : "│   ";
      lines.push(`${sBranch}${series.name}`);
      for (let mi = 0; mi < series.motors.length; mi++) {
        const motor = series.motors[mi];
        const mLast = mi === series.motors.length - 1;
        const mBranch = mLast ? "└── " : "├── ";
        lines.push(`${sPad}${mBranch}${motor.name}`);
        const mPad = sPad + (mLast ? "    " : "│   ");
        for (let ti = 0; ti < motor.trims.length; ti++) {
          const tLast = ti === motor.trims.length - 1;
          lines.push(`${mPad}${tLast ? "└── " : "├── "}${motor.trims[ti]}`);
        }
      }
    }
    if (bi < brands.length - 1) lines.push("");
  }
  return lines.join("\n") + "\n";
}

async function main() {
  if (!existsSync(SCHEMA)) {
    throw new Error(`Schema missing: ${SCHEMA}. Run extract-satariz-otomobil-schema.ts first.`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8")) as Schema;

  type Progress = { brands: BrandNode[]; doneSeriesKeys: string[] };
  let progress: Progress = { brands: [], doneSeriesKeys: [] };
  if (existsSync(PROGRESS)) {
    try {
      progress = JSON.parse(readFileSync(PROGRESS, "utf8"));
    } catch {
      /* fresh */
    }
  }
  const done = new Set(progress.doneSeriesKeys || []);
  const brandMap = new Map<string, BrandNode>();
  for (const b of progress.brands || []) brandMap.set(b.name, b);

  const brands = schema.brands.filter((b) => !SKIP_BRANDS.has(b.brandSlug));
  let seriesTotal = brands.reduce((n, b) => n + b.series.length, 0);
  let seriesDone = done.size;
  console.log(JSON.stringify({ brands: brands.length, seriesTotal, alreadyDone: seriesDone }));

  for (const b of brands) {
    if (!brandMap.has(b.brand)) brandMap.set(b.brand, { name: b.brand, series: [] });
    const brandNode = brandMap.get(b.brand)!;
    const baseSlug = b.brandSlug.replace(/-\d+$/, "");

    for (const s of b.series) {
      const key = `${b.brandSlug}::${s.slug}`;
      if (done.has(key)) continue;
      const seriesFullSlug = `${baseSlug}-${s.slug}`;
      const seriesUrl = s.url || `https://www.satariz.com/${seriesFullSlug}`;
      process.stdout.write(`[${++seriesDone}/${seriesTotal}] ${b.brand} / ${s.name}\n`);
      let motors: MotorNode[] = [];
      try {
        motors = await crawlSeries(seriesUrl, seriesFullSlug);
      } catch (e) {
        console.warn("series_fail", seriesUrl, e instanceof Error ? e.message : e);
        motors = [];
      }
      // replace if partial exists
      brandNode.series = brandNode.series.filter((x) => x.name !== s.name);
      brandNode.series.push({ name: s.name, motors });
      brandNode.series.sort((a, c) => a.name.localeCompare(c.name, "tr"));
      done.add(key);
      progress = { brands: [...brandMap.values()].sort((a, c) => a.name.localeCompare(c.name, "tr")), doneSeriesKeys: [...done] };
      writeFileSync(PROGRESS, JSON.stringify(progress), "utf8");
      await sleep(60);
    }
  }

  const treeBrands = [...brandMap.values()].sort((a, c) => a.name.localeCompare(c.name, "tr"));
  const tree = renderTree(treeBrands);

  const motorCount = treeBrands.reduce(
    (n, b) => n + b.series.reduce((m, s) => m + s.motors.length, 0),
    0
  );
  const trimCount = treeBrands.reduce(
    (n, b) => n + b.series.reduce((m, s) => m + s.motors.reduce((t, x) => t + x.trims.length, 0), 0),
    0
  );

  const header = [
    "TEKLIFBU / satariz.com — Otomobil (Araç) tam menü ağacı",
    "Hiyerarşi: Marka → Seri → Version/Motor → Trim/Paket",
    `Çıkarım: ${new Date().toISOString()}`,
    `Marka: ${treeBrands.length} | Seri: ${treeBrands.reduce((n, b) => n + b.series.length, 0)} | Motor: ${motorCount} | Paket: ${trimCount}`,
    "Kaynak: https://www.satariz.com/arac",
    "",
    "────────────────────────────────────────",
    "",
  ].join("\n");

  writeFileSync(OUT_TXT, header + tree, "utf8");
  writeFileSync(
    OUT_MD,
    `# Otomobil menü ağacı (satariz)\n\n\`\`\`\n${header}${tree}\`\`\`\n`,
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outTxt: OUT_TXT,
        outMd: OUT_MD,
        brands: treeBrands.length,
        series: treeBrands.reduce((n, b) => n + b.series.length, 0),
        motors: motorCount,
        trims: trimCount,
        sampleBmw5: treeBrands
          .find((b) => b.name === "BMW")
          ?.series.find((s) => s.name === "5 Serisi"),
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
