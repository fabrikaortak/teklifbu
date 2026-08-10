/**
 * Extract satariz.com Otomobil (Araç) schema: Brand → Series only.
 * Output JSON / CSV / MD for review before deep motor/trim crawl.
 *
 * npx tsx scripts/vehicle/extract-satariz-otomobil-schema.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ARAC_URL = "https://www.satariz.com/arac";
const OUT_DIR = join(process.env.USERPROFILE || process.cwd(), "Downloads");

const SKIP_SLUG = new Set([
  "arac",
  "vasita",
  "emlak",
  "ilan",
  "auth",
  "hesabim",
  "favoriler",
  "ara",
  "kiralik",
  "misafir",
  "uye",
  "card",
  "payment",
  "media",
  "storage",
  "api",
  "login",
  "static",
  "cdn",
  "vitrin",
  "ilan-ver",
  "uye-ol",
  "giris-yap",
  "misafir-favoriler",
  "alisveris",
  "motosiklet",
  "karavan",
  "elektrik-enerji",
  "is-yeri",
  "konut",
  "sanayi",
  "tarim-makineleri",
  "toprak",
  "komple-bina-2",
]);

type Brand = { slug: string; name: string; url: string };
type Series = { slug: string; name: string; url: string; brandSlug: string };
type Schema = {
  metadata: {
    title: string;
    source: string;
    category: string;
    extractedAt: string;
    brandCount: number;
    seriesCount: number;
    note: string;
  };
  brands: Array<{
    brand: string;
    brandSlug: string;
    url: string;
    series: Array<{ name: string; slug: string; url: string }>;
  }>;
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/-\d+$/, "")
    .split("-")
    .filter(Boolean)
    .map((p) => {
      if (/^(bmw|mg|byd|vw|dfsk|dfm|bmc|ds)$/i.test(p)) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

function extractBrandPairs(html: string): Brand[] {
  const map = new Map<string, Brand>();
  const re =
    /href="(?:https:\/\/www\.satariz\.com)?\/([a-z0-9\-]+)"[^>]*>\s*([^<]{1,60}?)\s*</gi;
  for (const m of html.matchAll(re)) {
    const slug = m[1].toLowerCase();
    let name = m[2].replace(/\s+/g, " ").trim();
    if (SKIP_SLUG.has(slug)) continue;
    if (slug.includes("vasita-") || slug.includes("emlak-") || slug.includes("ilan")) continue;
    if (slug.startsWith("kiralik-") || slug.startsWith("klasik-") || slug.startsWith("hasarli-")) continue;
    if (slug.startsWith("ticari-") || slug.includes("minibus") || slug.includes("otobus")) continue;
    if (name.length < 2 || name.length > 40) continue;
    if (/^(tümü|daha fazla|filtre|kategori|yeni)/i.test(name)) continue;
    // Prefer first clean name; overwrite if current looks like junk
    const prev = map.get(slug);
    if (!prev || (prev.name.length < name.length && !/^\d+$/.test(name))) {
      map.set(slug, { slug, name, url: `https://www.satariz.com/${slug}` });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function extractSeriesForBrand(html: string, brand: Brand): Series[] {
  const baseSlug = brand.slug.replace(/-\d+$/, "");
  const escaped = baseSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = `${baseSlug}-`;
  const map = new Map<string, Series>();
  const re = new RegExp(
    `href="(?:https://www\\.satariz\\.com)?/(${escaped}-[a-z0-9\\-]+)"[^>]*>\\s*([^<]{1,80}?)\\s*<`,
    "gi"
  );
  for (const m of html.matchAll(re)) {
    const fullSlug = m[1].toLowerCase();
    if (/\d{7,}$/.test(fullSlug)) continue;
    if (fullSlug === brand.slug || fullSlug === baseSlug) continue;
    const seriesPart = fullSlug.slice(prefix.length);
    if (!seriesPart) continue;
    let name = m[2].replace(/\s+/g, " ").trim();
    if (!name || name.length > 60) name = humanizeSlug(seriesPart);
    if (/^(tümü|filtre|kategori)/i.test(name)) continue;
    map.set(fullSlug, {
      slug: fullSlug,
      name,
      url: `https://www.satariz.com/${fullSlug}`,
      brandSlug: brand.slug,
    });
  }

  // Drop motor/package nodes that extend another series slug on the same page
  const slugs = [...map.keys()].sort((a, b) => a.length - b.length);
  const seriesSlugs = new Set<string>();
  for (const s of slugs) {
    const parent = [...seriesSlugs].find((p) => s.startsWith(p + "-"));
    if (parent) {
      map.delete(s);
      continue;
    }
    seriesSlugs.add(s);
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      await sleep(80);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("fetch", ARAC_URL);
  const aracHtml = await fetchText(ARAC_URL);
  let brands = extractBrandPairs(aracHtml);
  // Deduplicate near-duplicates (acura vs acura-1): keep longer/more specific slug with better name
  const byNorm = new Map<string, Brand>();
  for (const b of brands) {
    const norm = b.slug.replace(/-\d+$/, "");
    const prev = byNorm.get(norm);
    if (!prev) byNorm.set(norm, b);
    else if (b.slug.length >= prev.slug.length) byNorm.set(norm, b);
  }
  brands = [...byNorm.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  console.log("brands", brands.length);

  const brandRows = await mapPool(brands, 5, async (brand, idx) => {
    process.stdout.write(`[${idx + 1}/${brands.length}] ${brand.slug}\n`);
    try {
      const html = await fetchText(brand.url);
      const series = extractSeriesForBrand(html, brand);
      return { brand, series, error: null as string | null };
    } catch (e) {
      return { brand, series: [] as Series[], error: e instanceof Error ? e.message : String(e) };
    }
  });

  const schema: Schema = {
    metadata: {
      title: "Satariz Otomobil (Araç) — Marka → Seri şema",
      source: ARAC_URL,
      category: "Otomobil / Araç",
      extractedAt: new Date().toISOString(),
      brandCount: brandRows.length,
      seriesCount: brandRows.reduce((n, r) => n + r.series.length, 0),
      note: "Sadece Marka→Seri. Motor/Paket (version/trim) bir sonraki derin crawl adımında.",
    },
    brands: brandRows.map((r) => ({
      brand: r.brand.name,
      brandSlug: r.brand.slug,
      url: r.brand.url,
      series: r.series.map((s) => ({
        name: s.name,
        slug: s.slug.replace(new RegExp(`^${r.brand.slug.replace(/-\d+$/, "")}-`), ""),
        url: s.url,
      })),
      ...(r.error ? { error: r.error } : {}),
    })),
  };

  const base = join(OUT_DIR, "teklifbu_satariz_otomobil_marka_seri_sema");
  writeFileSync(base + ".json", JSON.stringify(schema, null, 2) + "\n", "utf8");

  const csvLines = ["index,brand,brandSlug,series,seriesSlug,url,seriesCountOnBrand"];
  let i = 0;
  for (const b of schema.brands) {
    if (!b.series.length) {
      csvLines.push([i++, JSON.stringify(b.brand), b.brandSlug, "", "", b.url, 0].join(","));
      continue;
    }
    for (const s of b.series) {
      csvLines.push(
        [
          i++,
          JSON.stringify(b.brand),
          b.brandSlug,
          JSON.stringify(s.name),
          s.slug,
          s.url,
          b.series.length,
        ].join(",")
      );
    }
  }
  writeFileSync(base + ".csv", csvLines.join("\n") + "\n", "utf8");

  const md: string[] = [
    `# Satariz Otomobil — Marka → Seri şema`,
    ``,
    `- Kaynak: ${ARAC_URL}`,
    `- Çıkarım: ${schema.metadata.extractedAt}`,
    `- Marka: **${schema.metadata.brandCount}**`,
    `- Seri: **${schema.metadata.seriesCount}**`,
    ``,
    `> Derinlik: yalnızca Marka → Seri (motor/paket yok).`,
    ``,
  ];
  for (const b of schema.brands) {
    md.push(`## ${b.brand}`);
    md.push(`- slug: \`${b.brandSlug}\` — ${b.url}`);
    if (!b.series.length) md.push(`- _(seri bulunamadı)_`);
    for (const s of b.series) md.push(`- **${s.name}** (\`${s.slug}\`)`);
    md.push(``);
  }
  writeFileSync(base + ".md", md.join("\n"), "utf8");

  const empty = schema.brands.filter((b) => !b.series.length).map((b) => b.brand);
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: [base + ".json", base + ".csv", base + ".md"],
        brandCount: schema.metadata.brandCount,
        seriesCount: schema.metadata.seriesCount,
        emptySeriesBrands: empty.slice(0, 30),
        emptyCount: empty.length,
        sampleBmw: schema.brands.find((b) => b.brandSlug === "bmw"),
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
