import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  listProductRequests,
  approveProductRequest,
  rejectProductRequest,
  mergeProductRequest,
  adminCreateProduct,
  adminCreateVariant,
} from "@/core/services/catalog/catalogCommerceService";
import { prisma } from "@/lib/db";
import { minorToTl } from "@/lib/catalogCommerce";

/** GET /api/admin/catalog/product-requests */
export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const status = new URL(req.url).searchParams.get("status") || undefined;
  const rows = await listProductRequests({ status: status || undefined });
  return NextResponse.json({ ok: true, requests: rows });
}
