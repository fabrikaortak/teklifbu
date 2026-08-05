import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  adminCreateProduct,
  searchCatalogProducts,
  pauseOffersForProduct,
} from "@/core/services/catalog/catalogCommerceService";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const products = await searchCatalogProducts({
    q: sp.get("q") || undefined,
    categoryId: sp.get("categoryId") || undefined,
    brandId: sp.get("brandId") || undefined,
    limit: Number(sp.get("limit") || 50),
  });
  return NextResponse.json({ ok: true, products });
}

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const product = await adminCreateProduct(body);
    return NextResponse.json({ ok: true, product });
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
    if (!id) throw new Error("id gerekli");
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: String(body.name).trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
        ...(body.mainImage !== undefined ? { mainImage: body.mainImage } : {}),
        ...(body.status ? { status: body.status } : {}),
        managedByAdmin: true,
      },
    });
    if (body.status === "ARCHIVED" || body.status === "DRAFT") {
      await pauseOffersForProduct(id);
    }
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return catalogError(e);
  }
}
