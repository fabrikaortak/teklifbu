import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  adminCreateVariant,
  pauseOffersForVariant,
} from "@/core/services/catalog/catalogCommerceService";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const variant = await adminCreateVariant(body);
    return NextResponse.json({ ok: true, variant });
  } catch (e) {
    return catalogError(e);
  }
}

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ ok: true, variants: [] });
  const variants = await prisma.productVariant.findMany({
    where: { productId, deletedAt: null },
    include: { values: { include: { attribute: true, option: true } } },
    orderBy: { title: "asc" },
  });
  return NextResponse.json({ ok: true, variants });
}

export async function PATCH(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) throw new Error("id gerekli");
    const variant = await prisma.productVariant.update({
      where: { id },
      data: {
        ...(body.title != null ? { title: String(body.title) } : {}),
        ...(body.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
      },
    });
    if (body.isActive === false) {
      await pauseOffersForVariant(id);
    }
    return NextResponse.json({ ok: true, variant });
  } catch (e) {
    return catalogError(e);
  }
}
