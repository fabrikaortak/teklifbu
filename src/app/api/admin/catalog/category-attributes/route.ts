import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  listCategoryAttributes,
  removeCategoryAttribute,
  setCategoryAttribute,
} from "@/core/services/catalog/attributeCatalogService";
import { listShoppingCategories } from "@/core/services/catalog/brandCatalogService";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const categoryId = new URL(req.url).searchParams.get("categoryId") || "";
  const categories = await listShoppingCategories();
  if (!categoryId) return NextResponse.json({ ok: true, categories, links: [] });
  const links = await listCategoryAttributes(categoryId);
  return NextResponse.json({ ok: true, categories, links });
}

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    if (String(body.action || "") === "remove") {
      await removeCategoryAttribute(String(body.categoryId), String(body.attributeId));
      return NextResponse.json({ ok: true });
    }
    const link = await setCategoryAttribute(body);
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    return catalogError(e);
  }
}
