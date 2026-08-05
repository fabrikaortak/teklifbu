import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveBrandsForCategory, resolveCategoryId } from "@/core/services/catalog/brandResolveService";

/**
 * Public: aktif markalar (kategoriye göre veya tümü).
 * GET /api/catalog/brands?categoryId=
 * GET /api/catalog/brands?categorySlug=ikinci-el-cep-telefonu
 * GET /api/catalog/brands?subSlug=cep-telefonu
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const categoryId = String(sp.get("categoryId") || "").trim();
  const categorySlug = String(sp.get("categorySlug") || "").trim();
  const subSlug = String(sp.get("subSlug") || "").trim();

  if (categoryId || categorySlug) {
    const cat = await resolveCategoryId({ categoryId, categorySlug });
    if (!cat) return NextResponse.json({ ok: true, brands: [], modelMode: "OPTIONAL" });
    const brands = await resolveBrandsForCategory(cat.id);
    return NextResponse.json({
      ok: true,
      brands,
      modelMode: cat.modelMode,
      categoryId: cat.id,
      categorySlug: cat.slug,
    });
  }

  if (subSlug) {
    const cats = await prisma.category.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [{ slug: `ikinci-el-${subSlug}` }, { slug: `sifir-urun-${subSlug}` }],
      },
      select: { id: true, modelMode: true },
    });
    const seen = new Set<string>();
    const brands = [];
    for (const c of cats) {
      const list = await resolveBrandsForCategory(c.id);
      for (const b of list) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        brands.push(b);
      }
    }
    return NextResponse.json({
      ok: true,
      brands,
      modelMode: cats[0]?.modelMode || "OPTIONAL",
    });
  }

  const all = await prisma.brand.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, logo: true },
  });
  return NextResponse.json({
    ok: true,
    brands: all.map((b) => ({ ...b, isFeatured: false })),
  });
}
