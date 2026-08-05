import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  createBrand,
  listBrands,
  softDeleteBrand,
  updateBrand,
} from "@/core/services/catalog/brandCatalogService";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const q = new URL(req.url).searchParams.get("q") || "";
  const rows = await listBrands({ q });
  return NextResponse.json({ ok: true, brands: rows });
}

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const brand = await createBrand(body);
    return NextResponse.json({ ok: true, brand });
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
    const brand = await updateBrand(id, body);
    return NextResponse.json({ ok: true, brand });
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
    await softDeleteBrand(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return catalogError(e);
  }
}
