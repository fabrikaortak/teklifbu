import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  filterTrimsForVersion,
  mergeVersionsForCascade,
  type CatalogVersion,
} from "@/lib/vasitaCatalogNormalize";

/**
 * Vasıta catalog cascade (Marka → Seri → Version/Motor → Trim/Paket).
 *
 * Standard:
 *   GET /api/vasita/catalog?action=brands&subtype=otomobil
 *   GET /api/vasita/catalog?action=models&subtype=otomobil&brand=bmw
 *   GET /api/vasita/catalog?action=generations&subtype=otomobil&brand=bmw&model=5-serisi
 *   GET /api/vasita/catalog?action=generations&subtype=otomobil&brand=bmw&model=5-serisi&generation=G30&year=2019
 *   GET /api/vasita/catalog?action=trims&subtype=otomobil&brand=bmw&model=5-serisi&version=520i&year=2019
 *
 * Electric overlay:
 *   GET /api/vasita/catalog?action=types&subtype=elektrikli-araclar
 *   GET /api/vasita/catalog?action=brands&subtype=elektrikli-otomobil
 *   GET /api/vasita/catalog?action=models&subtype=elektrikli-suv-pickup&brand=bmw
 *   GET /api/vasita/catalog?action=generations&subtype=elektrikli-otomobil&brand=bmw&model=i4
 */

type CatalogPackEntry = {
  categoryPaths: string[];
  brandSlug: string;
  modelSlug: string;
  generationCode: string;
  generationLabel: string;
  versions: Array<{
    slug: string;
    name: string;
    fuelTypes?: string[];
    trims?: Array<{ slug: string; name: string; generationCode?: string; yearFrom?: number; yearTo?: number }>;
    yearFrom?: number;
    yearTo?: number;
    generationCode?: string;
  }>;
  modelYears: number[];
  fuelTypes?: string[];
  verified: boolean;
  active?: boolean;
};

type ElectricOverlayEntry = {
  electricVehicleType: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  canonicalCategoryPath: string;
  fuelTypes: string[];
  versions: Array<{ slug: string; name: string }>;
  active?: boolean;
  selectable?: boolean;
};

type ElectricOverlayPack = {
  vehicleTypes?: Array<{ slug: string; name: string; canonicalCategoryPath: string }>;
  entries?: ElectricOverlayEntry[];
};

const FAKE_GENERATION_VALUES = new Set(["default", "standart", "standard", "genel"]);

const ELECTRIC_TYPE_ALIASES: Record<string, string> = {
  "elektrikli-araclar": "", // hub — use action=types
  "elektrikli-otomobil": "elektrikli-otomobil",
  "elektrikli-suv-pickup": "elektrikli-suv-pickup",
  "elektrikli-suv-ve-pickup": "elektrikli-suv-pickup",
  "elektrikli-minivan-panelvan": "elektrikli-minivan-panelvan",
  "elektrikli-ticari": "elektrikli-ticari",
  "elektrikli-motosiklet": "elektrikli-motosiklet",
  "elektrikli-atv": "elektrikli-atv",
  "elektrikli-utv": "elektrikli-utv",
};

function isElectricSubtype(subtype: string): boolean {
  return subtype.startsWith("elektrikli");
}

async function resolveCategoryBySubtype(subtype: string) {
  const slug = `arac__${subtype}`;
  return prisma.category.findFirst({
    where: { OR: [{ slug }, { path: `arac/${subtype}` }], deletedAt: null },
    select: { id: true },
  });
}

async function getPackEntries(): Promise<CatalogPackEntry[]> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "vasita_stage1_catalog" } });
  const value = setting?.value as { entries?: CatalogPackEntry[] } | null;
  return Array.isArray(value?.entries) ? value!.entries! : [];
}

async function getElectricOverlay(): Promise<ElectricOverlayPack> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "vasita_electric_overlay" } });
  const value = (setting?.value || {}) as ElectricOverlayPack;
  return value;
}

function electricEntriesForType(pack: ElectricOverlayPack, typeSlug: string): ElectricOverlayEntry[] {
  return (pack.entries || []).filter(
    (e) =>
      e.electricVehicleType === typeSlug &&
      e.active !== false &&
      e.selectable !== false &&
      (e.fuelTypes || []).includes("ELECTRIC")
  );
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const action = String(sp.get("action") || "brands").trim();
  const subtype = String(sp.get("subtype") || "").trim();
  const brandSlug = String(sp.get("brand") || "").trim();
  const modelSlug = String(sp.get("model") || "").trim();
  const versionSlug = String(sp.get("version") || "").trim();
  const generationFilter = String(sp.get("generation") || "").trim();
  const yearRaw = String(sp.get("year") || "").trim();
  const yearFilter = yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : null;

  if (!subtype) {
    return NextResponse.json({ ok: false, error: "subtype_required" }, { status: 400 });
  }

  try {
    // -------- Electric overlay path --------
    if (isElectricSubtype(subtype)) {
      const overlay = await getElectricOverlay();

      if (action === "types" || (action === "brands" && subtype === "elektrikli-araclar")) {
        const types = (overlay.vehicleTypes || []).map((t) => ({
          slug: t.slug,
          name: t.name,
          canonicalCategoryPath: t.canonicalCategoryPath,
        }));
        // When asking brands on hub, return types as pseudo-brands? Prefer explicit types.
        if (action === "types" || subtype === "elektrikli-araclar") {
          return NextResponse.json({ ok: true, types, brands: [] });
        }
      }

      const typeSlug = ELECTRIC_TYPE_ALIASES[subtype] || subtype;
      if (!typeSlug) {
        return NextResponse.json({ ok: true, brands: [], types: overlay.vehicleTypes || [] });
      }

      const typed = electricEntriesForType(overlay, typeSlug);

      if (action === "brands" || action === "nav") {
        const byBrand = new Map<string, { slug: string; name: string; models: Array<{ slug: string; name: string }> }>();
        for (const e of typed) {
          if (!byBrand.has(e.brandSlug)) {
            byBrand.set(e.brandSlug, { slug: e.brandSlug, name: e.brandName, models: [] });
          }
          const b = byBrand.get(e.brandSlug)!;
          if (!b.models.find((m) => m.slug === e.modelSlug)) {
            b.models.push({ slug: e.modelSlug, name: e.modelName });
          }
        }
        const brands = [...byBrand.values()]
          .map((b) => ({
            ...b,
            models: b.models.sort((a, c) => a.name.localeCompare(c.name, "tr")),
          }))
          .filter((b) => b.models.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, "tr"));
        return NextResponse.json({ ok: true, brands });
      }

      if (action === "models") {
        if (!brandSlug) return NextResponse.json({ ok: false, error: "brand_required" }, { status: 400 });
        const models = typed
          .filter((e) => e.brandSlug === brandSlug)
          .map((e) => ({ slug: e.modelSlug, name: e.modelName }))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"));
        // dedupe
        const seen = new Set<string>();
        const unique = models.filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)));
        return NextResponse.json({ ok: true, models: unique });
      }

      if (action === "generations") {
        if (!brandSlug || !modelSlug) {
          return NextResponse.json({ ok: false, error: "brand_and_model_required" }, { status: 400 });
        }
        const matches = typed.filter((e) => e.brandSlug === brandSlug && e.modelSlug === modelSlug);
        const versions = mergeVersionsForCascade(
          matches.map((m) => ({
            generationCode: "",
            versions: m.versions || [],
            modelYears: [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018],
          })),
          { generationCode: generationFilter, year: yearFilter }
        );
        return NextResponse.json({
          ok: true,
          generations: [],
          versions,
          years: [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018],
        });
      }

      if (action === "trims") {
        if (!brandSlug || !modelSlug || !versionSlug) {
          return NextResponse.json({ ok: false, error: "brand_model_version_required" }, { status: 400 });
        }
        const matches = typed.filter((e) => e.brandSlug === brandSlug && e.modelSlug === modelSlug);
        const versions = mergeVersionsForCascade(
          matches.map((m) => ({ versions: m.versions || [] })),
          { generationCode: generationFilter, year: yearFilter }
        );
        const trims = filterTrimsForVersion(versions, versionSlug, {
          generationCode: generationFilter,
          year: yearFilter,
        });
        return NextResponse.json({ ok: true, trims });
      }

      return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }

    // -------- Standard category path --------
    if (action === "brands") {
      const category = await resolveCategoryBySubtype(subtype);
      if (!category) return NextResponse.json({ ok: true, brands: [] });
      const rows = await prisma.categoryBrand.findMany({
        where: { categoryId: category.id, brand: { isActive: true, deletedAt: null } },
        orderBy: [{ sortOrder: "asc" }],
        include: { brand: { select: { id: true, slug: true, name: true } } },
      });
      const modelRows = await prisma.categoryModel.findMany({
        where: { categoryId: category.id, model: { isActive: true, deletedAt: null } },
        select: { model: { select: { brandId: true } } },
      });
      const brandIdsWithModels = new Set(modelRows.map((r) => r.model.brandId));
      const brands = rows
        .filter((r) => brandIdsWithModels.has(r.brand.id))
        .map((r) => ({ slug: r.brand.slug, name: r.brand.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      return NextResponse.json({ ok: true, brands });
    }

    if (action === "nav") {
      const category = await resolveCategoryBySubtype(subtype);
      if (!category) return NextResponse.json({ ok: true, brands: [] });
      const brandRows = await prisma.categoryBrand.findMany({
        where: { categoryId: category.id, brand: { isActive: true, deletedAt: null } },
        orderBy: [{ sortOrder: "asc" }],
        include: { brand: { select: { id: true, slug: true, name: true } } },
      });
      const modelRows = await prisma.categoryModel.findMany({
        where: { categoryId: category.id, model: { isActive: true, deletedAt: null } },
        orderBy: [{ sortOrder: "asc" }],
        include: { model: { select: { slug: true, name: true, brandId: true } } },
      });
      const modelsByBrandId = new Map<string, Array<{ slug: string; name: string }>>();
      for (const r of modelRows) {
        const list = modelsByBrandId.get(r.model.brandId) || [];
        list.push({ slug: r.model.slug, name: r.model.name });
        modelsByBrandId.set(r.model.brandId, list);
      }
      const brands = brandRows
        .map((r) => ({
          slug: r.brand.slug,
          name: r.brand.name,
          models: (modelsByBrandId.get(r.brand.id) || []).sort((a, b) => a.name.localeCompare(b.name, "tr")),
        }))
        .filter((b) => b.models.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      return NextResponse.json({ ok: true, brands });
    }

    if (action === "models") {
      if (!brandSlug) return NextResponse.json({ ok: false, error: "brand_required" }, { status: 400 });
      const category = await resolveCategoryBySubtype(subtype);
      const brand = await prisma.brand.findUnique({ where: { slug: brandSlug }, select: { id: true, isActive: true } });
      if (!category || !brand || !brand.isActive) return NextResponse.json({ ok: true, models: [] });
      const rows = await prisma.categoryModel.findMany({
        where: { categoryId: category.id, model: { brandId: brand.id, isActive: true, deletedAt: null } },
        orderBy: [{ sortOrder: "asc" }],
        include: { model: { select: { slug: true, name: true } } },
      });
      const models = rows
        .map((r) => ({ slug: r.model.slug, name: r.model.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      return NextResponse.json({ ok: true, models });
    }

    if (action === "generations" || action === "trims") {
      if (!brandSlug || !modelSlug) {
        return NextResponse.json({ ok: false, error: "brand_and_model_required" }, { status: 400 });
      }
      const entries = await getPackEntries();
      const categoryPath = `arac/${subtype}`;
      const matches = entries.filter(
        (e) =>
          e.verified === true &&
          e.active !== false &&
          e.brandSlug === brandSlug &&
          e.modelSlug === modelSlug &&
          e.categoryPaths.includes(categoryPath)
      );
      const generationsMap = new Map<string, string>();
      const yearsSet = new Set<number>();
      for (const m of matches) {
        const code = (m.generationCode || "").trim();
        const label = (m.generationLabel || "").trim();
        const isFake =
          !code ||
          !label ||
          FAKE_GENERATION_VALUES.has(code.toLowerCase()) ||
          FAKE_GENERATION_VALUES.has(label.toLowerCase());
        if (!isFake) generationsMap.set(code, label);
        for (const y of m.modelYears || []) yearsSet.add(y);
      }
      const generations = [...generationsMap.entries()].map(([code, label]) => ({ code, label }));
      const years = [...yearsSet].sort((a, b) => b - a);

      const versions: CatalogVersion[] = mergeVersionsForCascade(matches, {
        generationCode: generationFilter,
        year: yearFilter,
      });

      if (action === "trims") {
        if (!versionSlug) {
          return NextResponse.json({ ok: false, error: "version_required" }, { status: 400 });
        }
        const trims = filterTrimsForVersion(versions, versionSlug, {
          generationCode: generationFilter,
          year: yearFilter,
        });
        return NextResponse.json({ ok: true, trims });
      }

      return NextResponse.json({ ok: true, generations, versions, years });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (e) {
    console.error("[api/vasita/catalog] failed", e);
    return NextResponse.json({ ok: false, error: "catalog_unavailable" }, { status: 500 });
  }
}
