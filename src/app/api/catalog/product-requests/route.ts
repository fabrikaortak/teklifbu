import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createProductRequest, findSimilarProducts } from "@/core/services/catalog/catalogCommerceService";
import { prisma } from "@/lib/db";

/** POST /api/catalog/product-requests — satıcı yeni ürün talebi */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const shop = await prisma.shop.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });

  try {
    const similar = await findSimilarProducts({
      proposedName: String(body.proposedName || ""),
      categoryId: body.categoryId,
      brandId: body.brandId || undefined,
      modelId: body.modelId || undefined,
      barcode: body.barcode || undefined,
    });
    const high = similar.filter((s) => s.score >= 40);
    if (high.length && !body.force) {
      return NextResponse.json({
        ok: false,
        code: "SIMILAR_PRODUCTS",
        message: "Bu ürün katalogda olabilir",
        similar: high.slice(0, 5),
      }, { status: 409 });
    }

    const request = await createProductRequest({
      requesterUserId: user.id,
      shopId: shop?.id || body.shopId || null,
      categoryId: String(body.categoryId || ""),
      brandId: body.brandId || null,
      modelId: body.modelId || null,
      proposedName: String(body.proposedName || ""),
      barcode: body.barcode || null,
      description: body.description || null,
      attributesJson: body.attributesJson ?? null,
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : [],
    });
    return NextResponse.json({ ok: true, request });
  } catch (e) {
    const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
    if (e instanceof VerticalAccessError) {
      return NextResponse.json(e.toJSON(), { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Talep oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
