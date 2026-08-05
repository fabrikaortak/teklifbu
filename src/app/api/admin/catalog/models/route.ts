import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  createProductModel,
  listProductModels,
  softDeleteProductModel,
  updateProductModel,
} from "@/core/services/catalog/brandCatalogService";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const rows = await listProductModels({
    brandId: sp.get("brandId") || undefined,
    q: sp.get("q") || undefined,
  });
  return NextResponse.json({ ok: true, models: rows });
}

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const model = await createProductModel(body);
    return NextResponse.json({ ok: true, model });
  } catch (e) {
    return catalogError(e);
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return catalogError(new Error("id gerekli"));
    const model = await updateProductModel(id, body);
    return NextResponse.json({ ok: true, model });
  } catch (e) {
    return catalogError(e);
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return catalogError(new Error("id gerekli"));
    await softDeleteProductModel(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return catalogError(e);
  }
}
