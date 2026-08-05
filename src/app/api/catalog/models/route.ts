import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCategoryId } from "@/core/services/catalog/brandResolveService";

/** GET /api/catalog/models?categoryId=&brandId= */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const categoryId = String(sp.get("categoryId") || "").trim();
  const categorySlug = String(sp.get("categorySlug") || "").trim();
  const brandIdParam = String(sp.get("brandId") || "").trim();
  const brandSlug = String(sp.get("brandSlug") || "").trim();
  const brandName = String(sp.get("brand") || "").trim();

  const cat = await resolveCategoryId({ categoryId, categorySlug });
  if (!cat) return NextResponse.json({ ok: true, models: [], modelMode: "OPTIONAL" });

  let brandId = brandIdParam || undefined;
  if (!brandId && (brandSlug || brandName)) {
    const brand = await prisma.brand.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          ...(brandSlug ? [{ slug: brandSlug }] : []),
          ...(brandName ? [{ name: { equals: brandName, mode: "insensitive" as const } }] : []),
        ],
      },
      select: { id: true },
    });
    brandId = brand?.id;
  }

  const links = await prisma.categoryModel.findMany({
    where: {
      categoryId: cat.id,
      model: {
        deletedAt: null,
        isActive: true,
        ...(brandId ? { brandId } : {}),
      },
    },
    include: {
      model: { include: { brand: { select: { id: true, name: true, slug: true } } } },
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  // Also include models linked on ancestors with MERGE-like fallback for phone leaf→type
  // Prefer exact category; if empty and brand set, try parent once
  let models = links.map((l) => ({
    id: l.model.id,
    name: l.model.name,
    slug: l.model.slug,
    brand: l.model.brand,
  }));

  if (!models.length && brandId) {
    const node = await prisma.category.findFirst({
      where: { id: cat.id },
      select: { parentId: true },
    });
    if (node?.parentId) {
      const parentLinks = await prisma.categoryModel.findMany({
        where: {
          categoryId: node.parentId,
          model: { deletedAt: null, isActive: true, brandId },
        },
        include: {
          model: { include: { brand: { select: { id: true, name: true, slug: true } } } },
        },
        orderBy: [{ sortOrder: "asc" }],
      });
      models = parentLinks.map((l) => ({
        id: l.model.id,
        name: l.model.name,
        slug: l.model.slug,
        brand: l.model.brand,
      }));
    }
  }

  return NextResponse.json({
    ok: true,
    models,
    modelMode: cat.modelMode,
    categoryId: cat.id,
    categorySlug: cat.slug,
  });
}
