import { NextResponse } from "next/server";
import { getCatalogProduct } from "@/core/services/catalog/catalogCommerceService";
import { getCategoryBreadcrumb } from "@/core/services/catalog/categoryTreeService";
import { minorToTl } from "@/lib/catalogCommerce";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/catalog/products/:id */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const product = await getCatalogProduct(id);
  if (!product) return NextResponse.json({ error: "Ürün yok" }, { status: 404 });
  const path = await getCategoryBreadcrumb({ categoryId: product.categoryId });
  return NextResponse.json({
    ok: true,
    product: {
      ...product,
      categoryPath: path,
    },
  });
}
