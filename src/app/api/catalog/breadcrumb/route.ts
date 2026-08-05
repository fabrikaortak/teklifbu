import { NextResponse } from "next/server";
import { getCategoryBreadcrumb } from "@/core/services/catalog/categoryTreeService";

/** GET /api/catalog/breadcrumb?categorySlug= | categoryId= */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const categoryId = String(sp.get("categoryId") || "").trim();
  const categorySlug = String(sp.get("categorySlug") || "").trim();
  if (!categoryId && !categorySlug) {
    return NextResponse.json({ ok: true, crumbs: [] });
  }
  try {
    const crumbs = await getCategoryBreadcrumb({ categoryId, categorySlug });
    return NextResponse.json({ ok: true, crumbs });
  } catch (e) {
    console.error("[api/catalog/breadcrumb]", e);
    return NextResponse.json({ ok: false, crumbs: [], error: "breadcrumb_failed" }, { status: 500 });
  }
}
