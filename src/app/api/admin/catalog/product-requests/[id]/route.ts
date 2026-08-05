import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  approveProductRequest,
  rejectProductRequest,
  mergeProductRequest,
} from "@/core/services/catalog/catalogCommerceService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/catalog/product-requests/:id/approve */
export async function POST(req: Request, ctx: Ctx) {
  const { admin, error } = await requireCatalogAdmin();
  if (error || !admin) return error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "approve");
  try {
    if (action === "reject") {
      const row = await rejectProductRequest(id, admin.id, String(body.reason || ""));
      return NextResponse.json({ ok: true, request: row });
    }
    if (action === "merge") {
      const row = await mergeProductRequest(id, admin.id, String(body.productId || ""));
      return NextResponse.json({ ok: true, request: row });
    }
    const product = await approveProductRequest(id, admin.id, {
      name: body.name,
      description: body.description,
      barcode: body.barcode,
      mainImage: body.mainImage,
      variants: body.variants,
    });
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return catalogError(e);
  }
}
