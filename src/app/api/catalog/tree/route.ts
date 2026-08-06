import { NextResponse } from "next/server";
import { getCatalogTreeCached } from "@/core/services/catalog/catalogTreeCache";
import { resolveAlisverisBrowseTree } from "@/lib/alisverisBrowseFromDb";
import { prisma } from "@/lib/db";
import { resolveVasitaBrowseTree } from "@/lib/vasitaBrowseFromDb";

/**
 * Public DB category tree for alışveriş + vasıta.
 * GET /api/catalog/tree?root=sifir-urun|ikinci-el|all
 * GET /api/catalog/tree?format=browse  → UI BrowseNode (kökler gizli, ana kategoriler)
 * GET /api/catalog/tree?format=vasita-browse → Vasıta (arac) BrowseNode[] — DB source of truth
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const root = String(sp.get("root") || "all").trim();
  const format = String(sp.get("format") || "").trim();
  const allowed = root === "sifir-urun" || root === "ikinci-el" || root === "all" ? root : "all";

  if (format === "vasita-browse") {
    try {
      const rows = await prisma.category.findMany({
        where: { deletedAt: null, OR: [{ path: "arac" }, { path: { startsWith: "arac/" } }] },
        select: {
          id: true,
          slug: true,
          name: true,
          path: true,
          parentId: true,
          sortOrder: true,
          description: true,
          isActive: true,
        },
      });
      const { root: node, meta } = resolveVasitaBrowseTree(rows);
      if (meta.source === "fallback-json") {
        console.warn("[api/catalog/tree] vasita-browse fallback:", meta.warning);
      }
      return NextResponse.json(
        { ok: true, browseTree: node.children || [], meta, root: node },
        { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
      );
    } catch (e) {
      console.error("[api/catalog/tree] vasita-browse failed", e);
      const { root: node, meta } = resolveVasitaBrowseTree(null);
      return NextResponse.json({ ok: true, browseTree: node.children || [], meta, root: node, degraded: true });
    }
  }

  try {
    const tree = await getCatalogTreeCached(allowed);
    if (format === "browse") {
      const { tree: browseTree, meta } = resolveAlisverisBrowseTree(tree);
      if (meta.source === "fallback-ts") {
        console.warn("[api/catalog/tree] browse fallback:", meta.warning);
      }
      return NextResponse.json(
        { ok: true, browseTree, meta, tree },
        {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    }
    return NextResponse.json(
      { ok: true, tree },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (e) {
    console.error("[api/catalog/tree] failed", e);
    if (format === "browse") {
      const { tree: browseTree, meta } = resolveAlisverisBrowseTree(null);
      return NextResponse.json({ ok: true, browseTree, meta, tree: [], degraded: true });
    }
    return NextResponse.json({ ok: false, error: "tree_unavailable", tree: [] }, { status: 500 });
  }
}
