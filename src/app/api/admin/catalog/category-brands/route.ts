import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  listCategoryBrands,
  listShoppingCategories,
  removeCategoryBrand,
  setCategoryBrand,
} from "@/core/services/catalog/brandCatalogService";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const categoryId = sp.get("categoryId") || "";
  const categories = await listShoppingCategories();
  if (!categoryId) {
    return NextResponse.json({ ok: true, categories, links: [] });
  }
  const links = await listCategoryBrands(categoryId);
  return NextResponse.json({ ok: true, categories, links });
}

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const action = String(body.action || "upsert");
    if (action === "remove") {
      await removeCategoryBrand(String(body.categoryId), String(body.brandId));
      return NextResponse.json({ ok: true });
    }
    const link = await setCategoryBrand(body);
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    return catalogError(e);
  }
}
