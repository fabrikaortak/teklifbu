import { NextResponse } from "next/server";
import { searchCatalogProducts, findSimilarProducts } from "@/core/services/catalog/catalogCommerceService";

/** GET /api/catalog/products/search?q=&categoryId=&brandId=&modelId=&barcode=&limit= */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const similar = sp.get("similar") === "1";
    if (similar) {
      const rows = await findSimilarProducts({
        proposedName: String(sp.get("q") || sp.get("name") || ""),
        categoryId: sp.get("categoryId") || undefined,
        brandId: sp.get("brandId") || undefined,
        modelId: sp.get("modelId") || undefined,
        barcode: sp.get("barcode") || undefined,
        limit: Number(sp.get("limit") || 10),
      });
      return NextResponse.json({ ok: true, similar: rows });
    }
    const products = await searchCatalogProducts({
      q: sp.get("q") || undefined,
      categoryId: sp.get("categoryId") || undefined,
      brandId: sp.get("brandId") || undefined,
      modelId: sp.get("modelId") || undefined,
      barcode: sp.get("barcode") || undefined,
      limit: Number(sp.get("limit") || 20),
    });
    return NextResponse.json({ ok: true, products });
  } catch (e) {
    console.error("[catalog/products/search]", e);
    return NextResponse.json({ ok: false, products: [], error: "search_failed" }, { status: 500 });
  }
}
