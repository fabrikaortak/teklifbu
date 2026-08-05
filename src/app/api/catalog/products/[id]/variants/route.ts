import { NextResponse } from "next/server";
import { listProductVariants } from "@/core/services/catalog/catalogCommerceService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/catalog/products/:id/variants */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const variants = await listProductVariants(id);
  return NextResponse.json({ ok: true, variants });
}
