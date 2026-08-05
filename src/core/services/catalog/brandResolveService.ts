import type { BrandInheritanceMode } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ResolvedBrand = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isFeatured: boolean;
};

type CatNode = {
  id: string;
  parentId: string | null;
  brandInheritanceMode: BrandInheritanceMode;
};

async function loadDirectBrands(categoryId: string): Promise<ResolvedBrand[]> {
  const links = await prisma.categoryBrand.findMany({
    where: {
      categoryId,
      brand: { deletedAt: null, isActive: true },
    },
    include: { brand: true },
    orderBy: [{ sortOrder: "asc" }],
  });
  return links.map((l) => ({
    id: l.brand.id,
    name: l.brand.name,
    slug: l.brand.slug,
    logo: l.brand.logo,
    isFeatured: l.isFeatured,
  }));
}

function mergeBrands(base: ResolvedBrand[], extra: ResolvedBrand[]): ResolvedBrand[] {
  const seen = new Set(base.map((b) => b.id));
  const out = [...base];
  for (const b of extra) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

/**
 * Resolve brands for a category using brandInheritanceMode:
 * - NONE: only CategoryBrand on this node
 * - MERGE: this node + walk parents (NONE stops parent climb for that ancestor's own list only; we still merge each ancestor's direct brands when mode is MERGE)
 * - OVERRIDE: only this node's brands (same as NONE for resolution; seed uses OVERRIDE when replacing inherited sets)
 */
export async function resolveBrandsForCategory(categoryId: string): Promise<ResolvedBrand[]> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, parentId: true, brandInheritanceMode: true },
  });
  if (!cat) return [];

  const mode = cat.brandInheritanceMode;
  const own = await loadDirectBrands(cat.id);

  if (mode === "NONE" || mode === "OVERRIDE") {
    return own;
  }

  // MERGE: own + ancestors' direct brands
  let brands = own;
  let parentId = cat.parentId;
  const guard = new Set<string>([cat.id]);
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId);
    const parent: CatNode | null = await prisma.category.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true, parentId: true, brandInheritanceMode: true },
    });
    if (!parent) break;
    const parentBrands = await loadDirectBrands(parent.id);
    brands = mergeBrands(brands, parentBrands);
    parentId = parent.parentId;
  }
  return brands;
}

export async function resolveCategoryId(opts: {
  categoryId?: string | null;
  categorySlug?: string | null;
}): Promise<{ id: string; slug: string; modelMode: string } | null> {
  const id = String(opts.categoryId || "").trim();
  const slug = String(opts.categorySlug || "").trim();
  if (id) {
    return prisma.category.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true, slug: true, modelMode: true },
    });
  }
  if (!slug) return null;
  return prisma.category.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    select: { id: true, slug: true, modelMode: true },
  });
}
