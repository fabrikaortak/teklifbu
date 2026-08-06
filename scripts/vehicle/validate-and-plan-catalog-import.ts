/**
 * Dry-run: validate supplied Vasıta catalog datasets vs current Stage1 catalog/DB.
 * Writes plans + invalid/pending CSVs. NEVER writes catalog mutations to DB.
 *
 * npx tsx scripts/vehicle/validate-and-plan-catalog-import.ts
 */
import "dotenv/config";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROOT = process.cwd();
const SRC = join(ROOT, "docs/vehicle-import/source");
const OUT_DOCS = join(ROOT, "docs/vehicle-import");
const OUT_SCRIPTS = join(ROOT, "scripts/output");

const FILES = {
  json: "teklifbu_vasita_kategori_marka_alt_agaclari.json",
  csv: "teklifbu_vasita_kategori_marka_alt_agaclari.csv",
  xlsx: "teklifbu_vasita_kategori_marka_alt_agaclari.xlsx",
  md: "teklifbu_vasita_kategori_marka_alt_agaclari.md",
  summary: "teklifbu_vasita_katalog_ozet.json",
  review: "teklifbu_vasita_dogrulama_gerekenler.csv",
} as const;

type FlatRow = {
  category: string;
  subcategory: string;
  brand: string;
  series: string;
  modelVariant: string;
  level: string;
  name: string;
  slug: string;
  fullPath: string;
  source: string;
  status: string;
  notes: string;
  canonicalRef: string;
};

type Decision =
  | "KEEP_EXISTING"
  | "CREATE_SAFE"
  | "UPDATE_NAME_SAFE"
  | "MOVE_SAFE"
  | "MERGE_DUPLICATE"
  | "SOURCE_INVALID"
  | "CONFLICT"
  | "MANUAL_REVIEW"
  | "SKIP_OVERLAY";

type PlanRow = {
  category: string;
  subcategory: string;
  brand: string;
  series: string;
  modelVariant: string;
  sourceStatus: string;
  existingId: string;
  existingPath: string;
  targetPath: string;
  decision: Decision;
  confidence: "high" | "medium" | "low";
  reason: string;
  willPreserveId: "yes" | "no" | "n/a";
  relationCount: number;
  manualReviewRequired: "yes" | "no";
  categoryPath: string;
  brandSlug: string;
  modelSlug: string;
  versionSlug: string;
  versionName: string;
};

type InvalidRow = {
  sourceFile: string;
  rowOrPath: string;
  category: string;
  brand: string;
  series: string;
  modelVariant: string;
  errorType: string;
  originalValue: string;
  suggestedCorrection: string;
  automaticFixSafe: "yes" | "no";
  notes: string;
};

type CatalogEntry = {
  categoryPaths: string[];
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  generationCode: string;
  generationLabel: string;
  versions: Array<{ slug: string; name: string }>;
  modelYears: number[];
  fuelTypes: string[];
  transmissions: string[];
  bodyTypes: string[];
  source: string;
  verified: boolean;
  market: string;
  active: boolean;
};

const CATEGORY_MAP: Record<string, string | null> = {
  Otomobil: "arac/otomobil",
  "Arazi, SUV & Pickup": "arac/arazi-suv-pickup",
  Motosiklet: "arac/motosiklet",
  "Minivan & Panelvan": "arac/minivan-panelvan",
  "Ticari Araçlar": "arac/ticari-araclar",
  ATV: "arac/atv",
  UTV: "arac/utv",
  Karavan: "arac/karavan",
  "Deniz Araçları": "arac/deniz-araclari",
  "Hava Araçları": "arac/hava-araclari",
  "Elektrikli Araçlar": null,
  "Kiralık Araçlar": null,
  "Hasarlı Araçlar": null,
  "Klasik Araçlar": null,
  "Engelli Plakalı Araçlar": null,
};

/** Promote electric-only series into canonical categories (safe known mapping). */
const ELECTRIC_CANONICAL: Record<string, { brand: string; series: string; category: string }> = {
  "tesla|model-y": { brand: "Tesla", series: "Model Y", category: "Arazi, SUV & Pickup" },
  "tesla|cybertruck": { brand: "Tesla", series: "Cybertruck", category: "Arazi, SUV & Pickup" },
};

const BANNED_EXACT = new Set(["undefined", "null", "default", "standart", "genel", "test", "asdf"]);
const DEFAULT_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

function slugify(s: string): string {
  const tr: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    İ: "i",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  let out = s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => tr[ch] || ch);
  out = out.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  out = out.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return out || "";
}

function resolveBrandSlug(categoryPath: string, brandName: string): string {
  let slug = slugify(brandName);
  if (categoryPath === "arac/motosiklet" && slug === "bmw") return "bmw-motorrad";
  return slug;
}

function brandDisplayName(categoryPath: string, brandName: string, slug: string): string {
  if (slug === "bmw-motorrad") return "BMW Motorrad";
  return brandName;
}

function parseCsv(text: string): FlatRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: FlatRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push({
      category: obj.category || "",
      subcategory: obj.subcategory || "",
      brand: obj.brand || "",
      series: obj.series || "",
      modelVariant: obj.modelVariant || "",
      level: obj.level || "",
      name: obj.name || "",
      slug: obj.slug || "",
      fullPath: obj.fullPath || "",
      source: obj.source || "",
      status: obj.status || "",
      notes: obj.notes || "",
      canonicalRef: obj.canonicalRef || "",
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function flattenJson(tree: { level?: string; name?: string; slug?: string; status?: string; source?: string; notes?: string; canonicalRef?: string; children?: unknown[] }): FlatRow[] {
  const flat: FlatRow[] = [];
  function walk(
    node: {
      level?: string;
      name?: string;
      slug?: string;
      status?: string;
      source?: string;
      notes?: string;
      canonicalRef?: string;
      children?: unknown[];
    },
    ctx: Partial<FlatRow>
  ) {
    const newCtx: Partial<FlatRow> = { ...ctx };
    const level = node.level || "";
    const name = node.name || "";
    if (level === "VEHICLE_CATEGORY") {
      Object.assign(newCtx, { category: name, subcategory: "", brand: "", series: "", modelVariant: "" });
    } else if (level === "SUBCATEGORY") {
      Object.assign(newCtx, { subcategory: name, brand: "", series: "", modelVariant: "" });
    } else if (level === "BRAND") {
      Object.assign(newCtx, { brand: name, series: "", modelVariant: "" });
    } else if (level === "SERIES") {
      Object.assign(newCtx, { series: name, modelVariant: "" });
    } else if (level === "MODEL_VARIANT") {
      newCtx.modelVariant = name;
    }
    const pathParts = [
      "Vasıta",
      newCtx.category || "",
      newCtx.subcategory || "",
      newCtx.brand || "",
      newCtx.series || "",
      newCtx.modelVariant || "",
    ].filter(Boolean);
    if (level !== "ROOT") {
      flat.push({
        category: newCtx.category || "",
        subcategory: newCtx.subcategory || "",
        brand: newCtx.brand || "",
        series: newCtx.series || "",
        modelVariant: newCtx.modelVariant || "",
        level,
        name,
        slug: node.slug || "",
        fullPath: pathParts.join(" > "),
        source: node.source || "",
        status: node.status || "",
        notes: node.notes || "",
        canonicalRef: node.canonicalRef || "",
      });
    }
    for (const child of (node.children || []) as typeof node[]) {
      walk(child, newCtx);
    }
  }
  walk(tree, {});
  return flat;
}

function toCsv(rows: Array<Record<string, string | number>>, cols: string[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
}

function isMalformedName(name: string): string | null {
  const n = name.trim();
  if (!n) return "empty_name";
  if (BANNED_EXACT.has(n.toLowerCase())) return "banned_exact_name";
  if (n.includes(";;")) return "double_semicolon";
  if (/PremiumLegacy/i.test(n)) return "merged_brand_model_PremiumLegacy";
  if (/Justy;;/i.test(n)) return "subaru_smart_corruption";
  if (/undefined|null/i.test(n) && n.length < 20) return "nullish_token";
  if (/Vas[ıi]ta\s*>/i.test(n) || /Otomobil\s*>/i.test(n)) return "path_in_name";
  if (/^#\d+\|/.test(n)) return "pipe_merged_variant";
  return null;
}

function levelCounts(rows: FlatRow[]) {
  const c: Record<string, number> = {};
  for (const r of rows) c[r.level] = (c[r.level] || 0) + 1;
  return c;
}

async function main() {
  mkdirSync(OUT_DOCS, { recursive: true });
  mkdirSync(OUT_SCRIPTS, { recursive: true });
  mkdirSync(join(OUT_DOCS, "backups"), { recursive: true });

  const missingFiles: string[] = [];
  for (const f of Object.values(FILES)) {
    if (!existsSync(join(SRC, f))) missingFiles.push(f);
  }

  const jsonRaw = readFileSync(join(SRC, FILES.json), "utf8");
  const csvRaw = readFileSync(join(SRC, FILES.csv), "utf8");
  const summary = JSON.parse(readFileSync(join(SRC, FILES.summary), "utf8"));
  const reviewRows = parseCsv(readFileSync(join(SRC, FILES.review), "utf8"));
  const mdExists = existsSync(join(SRC, FILES.md));
  const xlsxExists = existsSync(join(SRC, FILES.xlsx));

  const tree = JSON.parse(jsonRaw);
  const jsonFlat = flattenJson(tree);
  const csvFlat = parseCsv(csvRaw);

  // Consistency JSON vs CSV
  const jsonByPath = new Map(jsonFlat.map((r) => [r.fullPath, r]));
  const csvByPath = new Map(csvFlat.map((r) => [r.fullPath, r]));
  const onlyJson = [...jsonByPath.keys()].filter((p) => !csvByPath.has(p));
  const onlyCsv = [...csvByPath.keys()].filter((p) => !jsonByPath.has(p));
  const fieldConflicts: Array<{ path: string; field: string; json: string; csv: string }> = [];
  for (const [path, jr] of jsonByPath) {
    const cr = csvByPath.get(path);
    if (!cr) continue;
    for (const field of ["level", "name", "slug", "status", "brand", "series", "modelVariant", "category"] as const) {
      if ((jr[field] || "") !== (cr[field] || "")) {
        fieldConflicts.push({ path, field, json: jr[field] || "", csv: cr[field] || "" });
      }
    }
  }
  const jsonCsvConsistent = onlyJson.length === 0 && onlyCsv.length === 0 && fieldConflicts.length === 0;

  const invalid: InvalidRow[] = [];
  const pending: FlatRow[] = [];
  const plan: PlanRow[] = [];

  // Duplicate fullPath inside JSON
  const pathCount = new Map<string, number>();
  for (const r of jsonFlat) pathCount.set(r.fullPath, (pathCount.get(r.fullPath) || 0) + 1);
  for (const [path, n] of pathCount) {
    if (n > 1) {
      invalid.push({
        sourceFile: FILES.json,
        rowOrPath: path,
        category: "",
        brand: "",
        series: "",
        modelVariant: "",
        errorType: "duplicate_fullPath",
        originalValue: path,
        suggestedCorrection: "Deduplicate source row",
        automaticFixSafe: "no",
        notes: `count=${n}`,
      });
    }
  }

  // Same parent duplicate names
  const parentKids = new Map<string, Map<string, FlatRow[]>>();
  for (const r of jsonFlat) {
    if (!["BRAND", "SERIES", "MODEL_VARIANT"].includes(r.level)) continue;
    const parent =
      r.level === "BRAND"
        ? `Vasıta > ${r.category}${r.subcategory ? ` > ${r.subcategory}` : ""}`
        : r.level === "SERIES"
          ? `Vasıta > ${r.category}${r.subcategory ? ` > ${r.subcategory}` : ""} > ${r.brand}`
          : `Vasıta > ${r.category}${r.subcategory ? ` > ${r.subcategory}` : ""} > ${r.brand} > ${r.series}`;
    if (!parentKids.has(parent)) parentKids.set(parent, new Map());
    const m = parentKids.get(parent)!;
    const key = r.name.trim().toLocaleLowerCase("tr-TR");
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  for (const [parent, kids] of parentKids) {
    for (const [, rows] of kids) {
      if (rows.length > 1) {
        invalid.push({
          sourceFile: FILES.json,
          rowOrPath: rows[0].fullPath,
          category: rows[0].category,
          brand: rows[0].brand,
          series: rows[0].series,
          modelVariant: rows[0].modelVariant,
          errorType: "duplicate_name_under_parent",
          originalValue: rows[0].name,
          suggestedCorrection: `Keep one under ${parent}`,
          automaticFixSafe: "no",
          notes: `siblings=${rows.length}`,
        });
      }
    }
  }

  // Scan malformed + known Subaru/Smart corruption patterns in raw files
  for (const [label, raw] of [
    [FILES.json, jsonRaw],
    [FILES.csv, csvRaw],
    [FILES.md, mdExists ? readFileSync(join(SRC, FILES.md), "utf8") : ""],
  ] as const) {
    if (!raw) continue;
    for (const pat of ["PremiumLegacy", "Justy;;", ";;#1", "#1|PremiumLegacy"]) {
      if (raw.includes(pat)) {
        invalid.push({
          sourceFile: label,
          rowOrPath: pat,
          category: "Otomobil",
          brand: "Subaru/Smart",
          series: "",
          modelVariant: "",
          errorType: "subaru_smart_corruption",
          originalValue: pat,
          suggestedCorrection: "Smart → #1 → Premium; Subaru → Legacy → 2.0 AWD",
          automaticFixSafe: "no",
          notes: "Known source corruption pattern",
        });
      }
    }
  }

  // Per-node structural validation (use JSON as SoT when consistent)
  const sourceRows = jsonCsvConsistent ? jsonFlat : jsonFlat;
  if (!jsonCsvConsistent) {
    invalid.push({
      sourceFile: "JSON+CSV",
      rowOrPath: "consistency",
      category: "",
      brand: "",
      series: "",
      modelVariant: "",
      errorType: "json_csv_conflict",
      originalValue: `onlyJson=${onlyJson.length};onlyCsv=${onlyCsv.length};fieldConflicts=${fieldConflicts.length}`,
      suggestedCorrection: "Manual reconcile before import",
      automaticFixSafe: "no",
      notes: "Auto-apply blocked for conflicted fields",
    });
  }

  const invalidPaths = new Set<string>();
  for (const r of sourceRows) {
    const bad = isMalformedName(r.name);
    if (bad) {
      // Allow legitimate "Standart Menzil" variant labels (not exact "standart")
      if (bad === "banned_exact_name" || bad !== "banned_exact_name") {
        if (!(bad === "banned_exact_name" && false)) {
          if (bad === "banned_exact_name" || ["empty_name", "double_semicolon", "merged_brand_model_PremiumLegacy", "subaru_smart_corruption", "nullish_token", "path_in_name", "pipe_merged_variant"].includes(bad)) {
            invalid.push({
              sourceFile: FILES.json,
              rowOrPath: r.fullPath,
              category: r.category,
              brand: r.brand,
              series: r.series,
              modelVariant: r.modelVariant,
              errorType: bad,
              originalValue: r.name,
              suggestedCorrection: "Exclude from production import",
              automaticFixSafe: "no",
              notes: `level=${r.level}`,
            });
            invalidPaths.add(r.fullPath);
          }
        }
      }
    }
    if (!r.slug || r.slug !== slugify(r.name) && slugify(r.name) && r.slug.includes(" ")) {
      // soft: slug mismatch note only for brands/series
    }
    if (["BRAND", "SERIES", "MODEL_VARIANT"].includes(r.level)) {
      if (r.level === "BRAND" && !r.category) {
        invalid.push({
          sourceFile: FILES.json,
          rowOrPath: r.fullPath,
          category: "",
          brand: r.brand,
          series: "",
          modelVariant: "",
          errorType: "orphan_brand",
          originalValue: r.name,
          suggestedCorrection: "Attach to vehicle category",
          automaticFixSafe: "no",
          notes: "",
        });
        invalidPaths.add(r.fullPath);
      }
      if (r.level === "SERIES" && !r.brand) {
        invalid.push({
          sourceFile: FILES.json,
          rowOrPath: r.fullPath,
          category: r.category,
          brand: "",
          series: r.series,
          modelVariant: "",
          errorType: "series_without_brand",
          originalValue: r.name,
          suggestedCorrection: "Attach under brand",
          automaticFixSafe: "no",
          notes: "",
        });
        invalidPaths.add(r.fullPath);
      }
    }
    // Artificial SUV children under Arazi
    if (
      r.level === "SUBCATEGORY" &&
      r.category === "Arazi, SUV & Pickup" &&
      ["SUV", "Crossover", "Arazi", "Pickup", "Arazi Aracı"].includes(r.name)
    ) {
      invalid.push({
        sourceFile: FILES.json,
        rowOrPath: r.fullPath,
        category: r.category,
        brand: "",
        series: "",
        modelVariant: "",
        errorType: "forbidden_arazi_body_subtype_node",
        originalValue: r.name,
        suggestedCorrection: "Remove; brands must hang directly under Arazi, SUV & Pickup",
        automaticFixSafe: "no",
        notes: "",
      });
      invalidPaths.add(r.fullPath);
    }
  }

  // Empty brand branches
  const emptyBrandBranches: string[] = summary.emptyBrandBranches || [];
  for (const path of emptyBrandBranches) {
    invalid.push({
      sourceFile: FILES.summary,
      rowOrPath: path,
      category: "",
      brand: "",
      series: "",
      modelVariant: "",
      errorType: "empty_brand_branch",
      originalValue: path,
      suggestedCorrection: "Add series later or exclude from cascade UI",
      automaticFixSafe: "no",
      notes: "Brand verified for nav but no series/model",
    });
  }

  // Baseline = tagged Stage1 catalog (ignore previously mutated worktree pack).
  const stage1Path = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
  const stage1TagBackup = join(OUT_DOCS, "backups", "vehicle-stage1-catalog-from-tag.json");
  const stage1Backup = join(OUT_DOCS, "backups", `vehicle-stage1-catalog-workdir-${Date.now()}.json`);
  if (existsSync(stage1Path)) copyFileSync(stage1Path, stage1Backup);
  const baselinePath = existsSync(stage1TagBackup) ? stage1TagBackup : stage1Path;
  const baselineRaw = readFileSync(baselinePath, "utf8").replace(/^\uFEFF/, "");
  const stage1 = baselineRaw ? JSON.parse(baselineRaw) : { entries: [] };
  const existingEntries: CatalogEntry[] = (stage1.entries || []).map((e: CatalogEntry) => {
    // Architecture remaps for known baseline mistakes
    if (e.brandSlug === "tesla" && e.modelSlug === "model-y") {
      return { ...e, categoryPaths: ["arac/arazi-suv-pickup"] };
    }
    if (e.brandSlug === "tesla" && e.modelSlug === "cybertruck") {
      return { ...e, categoryPaths: ["arac/arazi-suv-pickup"] };
    }
    return e;
  });
  console.error(`[validate] baseline=${baselinePath} entries=${existingEntries.length}`);
  const existingByModel = new Map<string, CatalogEntry[]>();
  for (const e of existingEntries) {
    const k = `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}`;
    if (!existingByModel.has(k)) existingByModel.set(k, []);
    existingByModel.get(k)!.push(e);
  }

  const dbBrands = await prisma.brand.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, managedBySeed: true },
  });
  const dbBrandBySlug = new Map(dbBrands.map((b) => [b.slug, b]));

  const dbModels = await prisma.productModel.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      brandId: true,
      managedBySeed: true,
      brand: { select: { slug: true } },
      categoryModels: { select: { category: { select: { path: true } } } },
      _count: { select: { products: true } },
    },
  });
  const dbModelKey = new Map<string, (typeof dbModels)[0]>();
  for (const m of dbModels) {
    dbModelKey.set(`${m.brand.slug}|${m.slug}`, m);
  }

  const listingCount = await prisma.listing.count({
    where: { category: { path: { startsWith: "arac" } } },
  });

  // Build series-level candidates from source (canonical categories only)
  type SeriesCand = {
    category: string;
    subcategory: string;
    brand: string;
    series: string;
    status: string;
    variants: Array<{ name: string; slug: string; status: string }>;
    fromElectricPromote?: boolean;
  };

  const seriesMap = new Map<string, SeriesCand>();
  for (const r of sourceRows) {
    if (r.level !== "SERIES") continue;
    if (invalidPaths.has(r.fullPath)) continue;
    const mapped = CATEGORY_MAP[r.category];
    if (mapped === null) {
      // electric promote?
      const key = `${slugify(r.brand)}|${slugify(r.series)}`;
      const promo = ELECTRIC_CANONICAL[key];
      if (promo && r.category === "Elektrikli Araçlar") {
        const ck = `${promo.category}|${promo.brand}|${promo.series}`;
        if (!seriesMap.has(ck)) {
          seriesMap.set(ck, {
            category: promo.category,
            subcategory: "",
            brand: promo.brand,
            series: promo.series,
            status: "CURATED_REVIEW",
            variants: [],
            fromElectricPromote: true,
          });
        }
      }
      plan.push({
        category: r.category,
        subcategory: r.subcategory,
        brand: r.brand,
        series: r.series,
        modelVariant: "",
        sourceStatus: r.status,
        existingId: "",
        existingPath: r.fullPath,
        targetPath: r.fullPath,
        decision: "SKIP_OVERLAY",
        confidence: "high",
        reason: "Elektrikli/kiralık/hasarlı/klasik/engelli overlay — kanonik CategoryBrand seed yok",
        willPreserveId: "n/a",
        relationCount: 0,
        manualReviewRequired: "no",
        categoryPath: "",
        brandSlug: "",
        modelSlug: "",
        versionSlug: "",
        versionName: "",
      });
      continue;
    }
    if (mapped === undefined) {
      plan.push({
        category: r.category,
        subcategory: r.subcategory,
        brand: r.brand,
        series: r.series,
        modelVariant: "",
        sourceStatus: r.status,
        existingId: "",
        existingPath: r.fullPath,
        targetPath: r.fullPath,
        decision: "MANUAL_REVIEW",
        confidence: "low",
        reason: "Unmapped vehicle category",
        willPreserveId: "n/a",
        relationCount: 0,
        manualReviewRequired: "yes",
        categoryPath: "",
        brandSlug: "",
        modelSlug: "",
        versionSlug: "",
        versionName: "",
      });
      pending.push(r);
      continue;
    }

    const ck = `${r.category}|${r.brand}|${r.series}`;
    if (!seriesMap.has(ck)) {
      seriesMap.set(ck, {
        category: r.category,
        subcategory: r.subcategory,
        brand: r.brand,
        series: r.series,
        status: r.status,
        variants: [],
      });
    }
  }

  // Attach variants
  for (const r of sourceRows) {
    if (r.level !== "MODEL_VARIANT") continue;
    if (invalidPaths.has(r.fullPath)) continue;
    if (CATEGORY_MAP[r.category] === null) {
      const key = `${slugify(r.brand)}|${slugify(r.series)}`;
      const promo = ELECTRIC_CANONICAL[key];
      if (promo) {
        const ck = `${promo.category}|${promo.brand}|${promo.series}`;
        const s = seriesMap.get(ck);
        if (s) s.variants.push({ name: r.name, slug: r.slug || slugify(r.name), status: r.status });
      }
      continue;
    }
    if (!CATEGORY_MAP[r.category]) continue;
    const ck = `${r.category}|${r.brand}|${r.series}`;
    const s = seriesMap.get(ck);
    if (!s) continue;
    const bad = isMalformedName(r.name);
    if (bad && bad !== "banned_exact_name") {
      // "Standart Menzil" contains standart as substring but not exact — allow
    }
    if (bad && ["empty_name", "double_semicolon", "merged_brand_model_PremiumLegacy", "subaru_smart_corruption", "nullish_token", "path_in_name", "pipe_merged_variant", "banned_exact_name"].includes(bad)) {
      invalid.push({
        sourceFile: FILES.json,
        rowOrPath: r.fullPath,
        category: r.category,
        brand: r.brand,
        series: r.series,
        modelVariant: r.modelVariant,
        errorType: bad,
        originalValue: r.name,
        suggestedCorrection: "Exclude variant",
        automaticFixSafe: "no",
        notes: "",
      });
      continue;
    }
    s.variants.push({ name: r.name, slug: r.slug || slugify(r.name), status: r.status });
  }

  // Architecture checks BMW / Tesla / TOGG
  const architectureIssues: string[] = [];
  const seriesIn = (brand: string, series: string, cat: string) =>
    [...seriesMap.values()].some((s) => s.brand === brand && s.series === series && s.category === cat);
  if (![...seriesMap.values()].filter((s) => s.brand === "BMW" && s.series === "3 Serisi").every((s) => s.category === "Otomobil")) {
    architectureIssues.push("BMW 3 Serisi not exclusively under Otomobil");
  }
  for (const x of ["X1", "X2", "X3", "X4", "X5", "X6", "X7"]) {
    const rows = [...seriesMap.values()].filter((s) => s.brand === "BMW" && s.series === x);
    if (rows.some((s) => s.category !== "Arazi, SUV & Pickup")) {
      architectureIssues.push(`BMW ${x} appears outside Arazi, SUV & Pickup`);
    }
  }
  if (!seriesIn("Tesla", "Model 3", "Otomobil")) architectureIssues.push("Tesla Model 3 missing under Otomobil");
  if (!seriesIn("Tesla", "Model Y", "Arazi, SUV & Pickup")) architectureIssues.push("Tesla Model Y missing under Arazi after promote");
  if (!seriesIn("TOGG", "T10X", "Arazi, SUV & Pickup")) architectureIssues.push("TOGG T10X missing under Arazi");
  if (!seriesIn("TOGG", "T10F", "Otomobil")) architectureIssues.push("TOGG T10F missing under Otomobil");

  // Decision per series
  const safeEntries: CatalogEntry[] = [];
  const gensPreserved: CatalogEntry[] = [];

  for (const s of seriesMap.values()) {
    const categoryPath = CATEGORY_MAP[s.category];
    if (!categoryPath) continue;
    const brandSlug = resolveBrandSlug(categoryPath, s.brand);
    const brandName = brandDisplayName(categoryPath, s.brand, brandSlug);
    const modelSlug = slugify(s.series);
    if (!brandSlug || !modelSlug) {
      plan.push({
        category: s.category,
        subcategory: s.subcategory,
        brand: s.brand,
        series: s.series,
        modelVariant: "",
        sourceStatus: s.status,
        existingId: "",
        existingPath: "",
        targetPath: `Vasıta > ${s.category} > ${s.brand} > ${s.series}`,
        decision: "SOURCE_INVALID",
        confidence: "high",
        reason: "Empty slug after normalize",
        willPreserveId: "n/a",
        relationCount: 0,
        manualReviewRequired: "yes",
        categoryPath,
        brandSlug,
        modelSlug,
        versionSlug: "",
        versionName: "",
      });
      continue;
    }

    // CURATED_REVIEW gate
    const statuses = [s.status, ...s.variants.map((v) => v.status)];
    const hasCurated = statuses.some((st) => st === "CURATED_REVIEW");
    const structureOk =
      !!s.brand &&
      !!s.series &&
      !isMalformedName(s.brand) &&
      !isMalformedName(s.series) &&
      !invalidPaths.has(`Vasıta > ${s.category} > ${s.brand} > ${s.series}`);

    // Category type conflicts: passenger series under SUV etc. — light heuristics
    let categoryConflict = false;
    if (s.brand === "BMW" && s.series === "3 Serisi" && s.category !== "Otomobil") categoryConflict = true;
    if (s.brand === "BMW" && /^X[1-7]$/.test(s.series) && s.category !== "Arazi, SUV & Pickup") categoryConflict = true;

    if (categoryConflict) {
      plan.push({
        category: s.category,
        subcategory: s.subcategory,
        brand: s.brand,
        series: s.series,
        modelVariant: "",
        sourceStatus: s.status,
        existingId: "",
        existingPath: "",
        targetPath: `Vasıta > ${s.category} > ${s.brand} > ${s.series}`,
        decision: "CONFLICT",
        confidence: "high",
        reason: "Category type conflict with architecture rules",
        willPreserveId: "n/a",
        relationCount: 0,
        manualReviewRequired: "yes",
        categoryPath,
        brandSlug,
        modelSlug,
        versionSlug: "",
        versionName: "",
      });
      continue;
    }

    if (hasCurated && !structureOk) {
      pending.push({
        category: s.category,
        subcategory: s.subcategory,
        brand: s.brand,
        series: s.series,
        modelVariant: "",
        level: "SERIES",
        name: s.series,
        slug: modelSlug,
        fullPath: `Vasıta > ${s.category} > ${s.brand} > ${s.series}`,
        source: "curated",
        status: "CURATED_REVIEW",
        notes: "Failed curated auto-apply gates",
        canonicalRef: "",
      });
      plan.push({
        category: s.category,
        subcategory: s.subcategory,
        brand: s.brand,
        series: s.series,
        modelVariant: "",
        sourceStatus: s.status,
        existingId: "",
        existingPath: "",
        targetPath: `Vasıta > ${s.category} > ${s.brand} > ${s.series}`,
        decision: "MANUAL_REVIEW",
        confidence: "low",
        reason: "CURATED_REVIEW failed structural gates",
        willPreserveId: "n/a",
        relationCount: 0,
        manualReviewRequired: "yes",
        categoryPath,
        brandSlug,
        modelSlug,
        versionSlug: "",
        versionName: "",
      });
      continue;
    }

    const dbKey = `${brandSlug}|${modelSlug}`;
    const dbModel = dbModelKey.get(dbKey);
    const existingPaths = (dbModel?.categoryModels.map((cm) => cm.category.path).filter((p): p is string => !!p) || []) as string[];
    const stageKey = `${categoryPath}|${brandSlug}|${modelSlug}`;
    const stageRows = existingByModel.get(stageKey) || [];
    const relationCount = dbModel?._count.products || 0;

    const versions =
      s.variants.length > 0
        ? dedupeVersions(s.variants.map((v) => ({ slug: slugify(v.name) || v.slug, name: v.name })))
        : [{ slug: modelSlug, name: s.series }];

    let decision: Decision = "CREATE_SAFE";
    let reason = "New series under mapped category";
    let confidence: PlanRow["confidence"] = s.fromElectricPromote ? "medium" : "high";
    let willPreserveId: PlanRow["willPreserveId"] = "n/a";

    if (dbModel) {
      willPreserveId = "yes";
      if (existingPaths.includes(categoryPath)) {
        if (dbModel.name !== s.series && dbModel.managedBySeed !== false) {
          decision = "UPDATE_NAME_SAFE";
          reason = `Rename ProductModel ${dbModel.name} → ${s.series}`;
        } else {
          decision = "KEEP_EXISTING";
          reason = "Brand/model already linked to target category";
        }
      } else if (existingPaths.length > 0) {
        const fromVehicle = existingPaths.some((p) => !!p && p.startsWith("arac/"));
        const crossBody =
          fromVehicle &&
          ((existingPaths.some((p) => !!p && p.includes("otomobil")) && categoryPath.includes("arazi")) ||
            (existingPaths.some((p) => !!p && p.includes("arazi")) && categoryPath.includes("otomobil")) ||
            (existingPaths.some((p) => !!p && p.includes("ticari")) && categoryPath.includes("minivan")) ||
            (existingPaths.some((p) => !!p && p.includes("minivan")) && categoryPath.includes("ticari")));
        if (crossBody) {
          decision = "MANUAL_REVIEW";
          reason = `Cross body-type category move blocked: [${existingPaths.join(",")}] → ${categoryPath}`;
          confidence = "low";
        } else if (relationCount === 0 && dbModel.managedBySeed !== false) {
          decision = "MOVE_SAFE";
          reason = `Relink CategoryModel from [${existingPaths.join(",")}] to ${categoryPath}`;
        } else {
          decision = "MANUAL_REVIEW";
          reason = `Model exists under other categories with relationCount=${relationCount}`;
          confidence = "low";
        }
      } else {
        decision = "CREATE_SAFE";
        reason = "Brand/model exists globally; add CategoryBrand/CategoryModel link";
        willPreserveId = "yes";
      }
    } else if (stageRows.length > 0) {
      decision = "CREATE_SAFE";
      reason = "In baseline Stage1 pack but missing DB model/link — ensure on apply";
      confidence = "high";
    }

    if (dbModel?.managedBySeed === false && decision !== "KEEP_EXISTING") {
      decision = "MANUAL_REVIEW";
      reason = "Admin-edited model (managedBySeed=false)";
      confidence = "low";
    }

    plan.push({
      category: s.category,
      subcategory: s.subcategory,
      brand: s.brand,
      series: s.series,
      modelVariant: versions.map((v) => v.name).join(" | "),
      sourceStatus: s.status,
      existingId: dbModel?.id || "",
      existingPath: existingPaths.join(" | "),
      targetPath: `Vasıta > ${s.category} > ${s.brand} > ${s.series}`,
      decision,
      confidence,
      reason: s.fromElectricPromote ? `${reason} (promoted from Elektrikli overlay)` : reason,
      willPreserveId,
      relationCount,
      manualReviewRequired: ["MANUAL_REVIEW", "CONFLICT", "SOURCE_INVALID"].includes(decision) ? "yes" : "no",
      categoryPath,
      brandSlug,
      modelSlug,
      versionSlug: versions[0]?.slug || "",
      versionName: versions[0]?.name || "",
    });

    if (["CREATE_SAFE", "UPDATE_NAME_SAFE", "MOVE_SAFE", "KEEP_EXISTING"].includes(decision)) {
      if (stageRows.some((e) => e.generationCode)) {
        for (const g of stageRows) {
          gensPreserved.push({
            ...g,
            brandSlug,
            brandName,
            modelSlug,
            modelName: s.series,
            versions: g.versions?.length ? g.versions : versions,
            verified: true,
            active: true,
          });
        }
      } else {
        safeEntries.push({
          categoryPaths: [categoryPath],
          brandSlug,
          brandName,
          modelSlug,
          modelName: s.series,
          generationCode: "",
          generationLabel: "",
          versions,
          modelYears: DEFAULT_YEARS,
          fuelTypes: [],
          transmissions: [],
          bodyTypes: [],
          source: s.fromElectricPromote ? "electric-canonical-promote" : "vasita-file-import-2026.08",
          verified: true,
          market: "TR",
          active: true,
        });
      }
    }
  }

  // Merge preserved gens + safe entries; also keep existing stage1 entries not superseded
  const outEntriesMap = new Map<string, CatalogEntry>();
  for (const e of existingEntries) {
    const k = `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}|${e.generationCode}`;
    outEntriesMap.set(k, e);
  }
  for (const e of [...gensPreserved, ...safeEntries]) {
    const k = `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}|${e.generationCode}`;
    // Prefer new versions if expanding
    const prev = outEntriesMap.get(k);
    if (prev) {
      const mergedVersions = dedupeVersions([...(prev.versions || []), ...(e.versions || [])]);
      outEntriesMap.set(k, { ...prev, ...e, versions: mergedVersions.length ? mergedVersions : prev.versions });
    } else {
      outEntriesMap.set(k, e);
    }
  }
  const plannedPackEntries = [...outEntriesMap.values()];

  const counts = {
    sourceTotal: sourceRows.length,
    validSeries: [...seriesMap.values()].length,
    invalidTotal: invalid.length,
    duplicateTotal: invalid.filter((i) => i.errorType.startsWith("duplicate")).length,
    existingTotal: plan.filter((p) => p.decision === "KEEP_EXISTING").length,
    createSafeTotal: plan.filter((p) => p.decision === "CREATE_SAFE").length,
    updateSafeTotal: plan.filter((p) => p.decision === "UPDATE_NAME_SAFE").length,
    moveSafeTotal: plan.filter((p) => p.decision === "MOVE_SAFE").length,
    conflictTotal: plan.filter((p) => p.decision === "CONFLICT").length,
    manualReviewTotal: plan.filter((p) => p.decision === "MANUAL_REVIEW").length,
    skipOverlayTotal: plan.filter((p) => p.decision === "SKIP_OVERLAY").length,
    emptyBrandBranches: emptyBrandBranches.length,
    malformedSourceRecords: invalid.filter((i) => i.errorType !== "empty_brand_branch").length,
    categoryMismatch: architectureIssues.length,
    electricMappingErrors: architectureIssues.filter((x) => /Tesla Model Y|Elektrikli|iX/.test(x)).length,
    listingCount,
    jsonCsvConsistent,
    architectureIssues,
    missingFiles,
  };

  // Final pack artifact for apply (not written to stage1 yet)
  const plannedPack = {
    version: "vehicle-stage1-catalog-v3-safe-import",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "validated-file-import",
    notes: [
      "Built by validate-and-plan-catalog-import.ts — only CREATE/UPDATE/MOVE/KEEP safe series.",
      "Elektrikli hub skipped; Tesla Model Y/Cybertruck promoted to Arazi when missing.",
      "Real generation codes from prior Stage1 pack preserved.",
      "Never emits generationCode default / generationLabel Standart.",
    ],
    entries: plannedPackEntries,
  };

  // Write CSVs
  writeFileSync(
    join(OUT_DOCS, "invalid-source-records.csv"),
    toCsv(invalid as unknown as Array<Record<string, string | number>>, [
      "sourceFile",
      "rowOrPath",
      "category",
      "brand",
      "series",
      "modelVariant",
      "errorType",
      "originalValue",
      "suggestedCorrection",
      "automaticFixSafe",
      "notes",
    ]),
    "utf8"
  );

  const pendingCsvRows = [
    ...pending,
    ...reviewRows.filter((r) => r.level === "SERIES" || r.level === "MODEL_VARIANT").slice(0, 0),
  ];
  // pending = failed curated + unmapped; also include plan MANUAL_REVIEW series
  for (const p of plan.filter((x) => x.manualReviewRequired === "yes")) {
    pendingCsvRows.push({
      category: p.category,
      subcategory: p.subcategory,
      brand: p.brand,
      series: p.series,
      modelVariant: p.modelVariant,
      level: "SERIES",
      name: p.series,
      slug: p.modelSlug,
      fullPath: p.targetPath,
      source: "plan",
      status: p.sourceStatus,
      notes: p.reason,
      canonicalRef: "",
    });
  }
  writeFileSync(
    join(OUT_DOCS, "pending-manual-review.csv"),
    toCsv(pendingCsvRows as unknown as Array<Record<string, string | number>>, [
      "category",
      "subcategory",
      "brand",
      "series",
      "modelVariant",
      "level",
      "name",
      "slug",
      "fullPath",
      "source",
      "status",
      "notes",
      "canonicalRef",
    ]),
    "utf8"
  );

  writeFileSync(
    join(OUT_DOCS, "catalog-import-plan.csv"),
    toCsv(plan as unknown as Array<Record<string, string | number>>, [
      "category",
      "subcategory",
      "brand",
      "series",
      "modelVariant",
      "sourceStatus",
      "existingId",
      "existingPath",
      "targetPath",
      "decision",
      "confidence",
      "reason",
      "willPreserveId",
      "relationCount",
      "manualReviewRequired",
    ]),
    "utf8"
  );

  writeFileSync(join(OUT_SCRIPTS, "vehicle-catalog-import-planned-pack.json"), JSON.stringify(plannedPack, null, 2));
  writeFileSync(
    join(OUT_SCRIPTS, "vehicle-catalog-import-plan.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        dryRun: true,
        files: Object.values(FILES).map((f) => ({
          name: f,
          present: existsSync(join(SRC, f)),
          bytes: existsSync(join(SRC, f)) ? readFileSync(join(SRC, f)).byteLength : 0,
        })),
        summaryFileCounts: summary.levelCounts,
        jsonLevelCounts: levelCounts(jsonFlat),
        csvLevelCounts: levelCounts(csvFlat),
        jsonTotal: jsonFlat.length,
        csvTotal: csvFlat.length,
        summaryTotal: summary.totalRows,
        jsonCsvConsistent,
        onlyJsonCount: onlyJson.length,
        onlyCsvCount: onlyCsv.length,
        fieldConflictCount: fieldConflicts.length,
        fieldConflictsSample: fieldConflicts.slice(0, 20),
        applyBlocked: !jsonCsvConsistent || architectureIssues.length > 0 && architectureIssues.some((a) => a.includes("BMW 3")),
        applyAllowed:
          jsonCsvConsistent &&
          missingFiles.length === 0 &&
          !architectureIssues.some((a) => a.includes("BMW 3 Serisi")),
        counts,
        bmwChecks: {
          series3: [...seriesMap.values()].filter((s) => s.brand === "BMW" && s.series === "3 Serisi").map((s) => s.category),
          x3: [...seriesMap.values()].filter((s) => s.brand === "BMW" && s.series === "X3").map((s) => s.category),
          iX3: [...seriesMap.values()].filter((s) => s.brand === "BMW" && s.series === "iX3").map((s) => s.category),
        },
        teslaChecks: {
          model3: [...seriesMap.values()].filter((s) => s.brand === "Tesla" && s.series === "Model 3").map((s) => s.category),
          modelY: [...seriesMap.values()].filter((s) => s.brand === "Tesla" && s.series === "Model Y").map((s) => s.category),
        },
        toggChecks: {
          t10x: [...seriesMap.values()].filter((s) => s.brand === "TOGG" && s.series === "T10X").map((s) => s.category),
          t10f: [...seriesMap.values()].filter((s) => s.brand === "TOGG" && s.series === "T10F").map((s) => s.category),
        },
        stage1Backup,
        plannedEntries: plannedPackEntries.length,
        plannedBrands: new Set(plannedPackEntries.map((e) => e.brandSlug)).size,
        plannedModels: new Set(plannedPackEntries.map((e) => `${e.brandSlug}/${e.modelSlug}`)).size,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        jsonCsvConsistent,
        applyAllowed:
          jsonCsvConsistent &&
          missingFiles.length === 0 &&
          !architectureIssues.some((a) => a.includes("BMW 3 Serisi")),
        counts,
        architectureIssues,
        plannedEntries: plannedPackEntries.length,
        out: {
          planJson: join(OUT_SCRIPTS, "vehicle-catalog-import-plan.json"),
          plannedPack: join(OUT_SCRIPTS, "vehicle-catalog-import-planned-pack.json"),
          invalidCsv: join(OUT_DOCS, "invalid-source-records.csv"),
          pendingCsv: join(OUT_DOCS, "pending-manual-review.csv"),
          planCsv: join(OUT_DOCS, "catalog-import-plan.csv"),
        },
      },
      null,
      2
    )
  );
}

function dedupeVersions(versions: Array<{ slug: string; name: string }>) {
  const seen = new Set<string>();
  const out: Array<{ slug: string; name: string }> = [];
  for (const v of versions) {
    const slug = v.slug || slugify(v.name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name: v.name });
  }
  return out;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
