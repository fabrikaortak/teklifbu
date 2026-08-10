import { NextResponse } from "next/server";
import {
  getBrowseTreeMemory,
  getCatalogTreeCached,
  setBrowseTreeMemory,
} from "@/core/services/catalog/catalogTreeCache";
import { resolveAlisverisBrowseTree, slimBrowseNodes } from "@/lib/alisverisBrowseFromDb";
import { prisma } from "@/lib/db";
import { resolveVasitaBrowseTree } from "@/lib/vasitaBrowseFromDb";

/**
 * Public DB category tree for alışveriş + vasıta.
 * GET /api/catalog/tree?root=sifir-urun|ikinci-el|all
 * GET /api/catalog/tree?format=browse  → UI BrowseNode (sığ menü; marka ağacı yok)
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
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    } catch (e) {
      console.error("[api/catalog/tree] vasita-browse failed", e);
      const { root: node, meta } = resolveVasitaBrowseTree(null);
      return NextResponse.json({ ok: true, browseTree: node.children || [], meta, root: node, degraded: true });
    }
  }

  try {
    if (format === "browse") {
      const hit = getBrowseTreeMemory();
      if (hit) {
        return NextResponse.json(
          { ok: true, browseTree: hit.browseTree, meta: hit.meta },
          { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
        );
      }
      const tree = await getCatalogTreeCached(allowed);
      const { tree: fullBrowse, meta } = resolveAlisverisBrowseTree(tree);
      // Ana → koşul → ürün tipi (marka ağacı yok) — sol menü için yeterli
      const browseTree = slimBrowseNodes(fullBrowse, 2);
      if (meta.source === "fallback-ts") {
        console.warn("[api/catalog/tree] browse fallback:", meta.warning);
      } else {
        setBrowseTreeMemory({ browseTree, meta });
      }
      return NextResponse.json(
        { ok: true, browseTree, meta },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    const tree = await getCatalogTreeCached(allowed);
    return NextResponse.json(
      { ok: true, tree },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (e) {
    console.error("[api/catalog/tree] failed", e);
    if (format === "browse") {
      const { tree: browseTree, meta } = resolveAlisverisBrowseTree(null);
      return NextResponse.json({ ok: true, browseTree, meta, degraded: true });
    }
    return NextResponse.json({ ok: false, error: "tree_unavailable", tree: [] }, { status: 500 });
  }
}
