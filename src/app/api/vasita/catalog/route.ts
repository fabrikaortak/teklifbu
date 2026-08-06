import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Vasıta catalog cascade (Marka → Model → Nesil/Versiyon → Model yılı).
 * Brand/Model come from CategoryBrand/CategoryModel (DB — Stage1 catalog apply).
 * Generation/version/modelYear come from the SystemSetting `vasita_stage1_catalog` pack
 * (see scripts/vehicle-stage1-catalog-apply.ts) since there are no Vehicle* tables in Stage1.
 *
 * GET /api/vasita/catalog?action=brands&subtype=otomobil
 * GET /api/vasita/catalog?action=models&subtype=otomobil&brand=bmw
 * GET /api/vasita/catalog?action=generations&subtype=otomobil&brand=bmw&model=3-serisi
 */

type CatalogPackEntry = {
  categoryPaths: string[];
  brandSlug: string;
  modelSlug: string;
  generationCode: string;
  generationLabel: string;
  versions: Array<{ slug: string; name: string }>;
  modelYears: number[];
  verified: boolean;
};

/** Legacy fake generation values (v1 catalog) — always treated as "no generation", never displayed. */
const FAKE_GENERATION_VALUES = new Set(["default", "standart", "standard", "genel"]);

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

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const action = String(sp.get("action") || "brands").trim();
  const subtype = String(sp.get("subtype") || "").trim();
  const brandSlug = String(sp.get("brand") || "").trim();
  const modelSlug = String(sp.get("model") || "").trim();

  if (!subtype) {
    return NextResponse.json({ ok: false, error: "subtype_required" }, { status: 400 });
  }

  try {
    if (action === "brands") {
      const category = await resolveCategoryBySubtype(subtype);
      if (!category) return NextResponse.json({ ok: true, brands: [] });
      const rows = await prisma.categoryBrand.findMany({
        where: { categoryId: category.id, brand: { isActive: true, deletedAt: null } },
        orderBy: [{ sortOrder: "asc" }],
        include: { brand: { select: { slug: true, name: true } } },
      });
      const brands = rows
        .map((r) => ({ slug: r.brand.slug, name: r.brand.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      return NextResponse.json({ ok: true, brands });
    }

    if (action === "models") {
      if (!brandSlug) return NextResponse.json({ ok: false, error: "brand_required" }, { status: 400 });
      const category = await resolveCategoryBySubtype(subtype);
      const brand = await prisma.brand.findUnique({ where: { slug: brandSlug }, select: { id: true } });
      if (!category || !brand) return NextResponse.json({ ok: true, models: [] });
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

    if (action === "generations") {
      if (!brandSlug || !modelSlug) {
        return NextResponse.json({ ok: false, error: "brand_and_model_required" }, { status: 400 });
      }
      const entries = await getPackEntries();
      const categoryPath = `arac/${subtype}`;
      const matches = entries.filter(
        (e) =>
          e.verified === true &&
          e.brandSlug === brandSlug &&
          e.modelSlug === modelSlug &&
          e.categoryPaths.includes(categoryPath)
      );
      // "default"/"standart"/"genel" (legacy fake generations) are treated as NO generation.
      const generationsMap = new Map<string, string>();
      const versions: Array<{ slug: string; name: string }> = [];
      const yearsSet = new Set<number>();
      for (const m of matches) {
        const code = (m.generationCode || "").trim();
        const label = (m.generationLabel || "").trim();
        const isFake = !code || !label || FAKE_GENERATION_VALUES.has(code.toLowerCase()) || FAKE_GENERATION_VALUES.has(label.toLowerCase());
        if (!isFake) generationsMap.set(code, label);
        for (const v of m.versions || []) {
          if (!versions.find((x) => x.slug === v.slug)) versions.push(v);
        }
        for (const y of m.modelYears || []) yearsSet.add(y);
      }
      // No auto-injected "default"/"Standart" — real generations only, or none at all.
      const generations = [...generationsMap.entries()].map(([code, label]) => ({ code, label }));
      const years = [...yearsSet].sort((a, b) => b - a);
      return NextResponse.json({ ok: true, generations, versions, years });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (e) {
    console.error("[api/vasita/catalog] failed", e);
    return NextResponse.json({ ok: false, error: "catalog_unavailable" }, { status: 500 });
  }
}
