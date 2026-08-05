import { prisma } from "@/lib/db";
import type { CatalogTreeNode } from "@/core/services/catalog/categoryTreeService";
import { getCatalogTree } from "@/core/services/catalog/categoryTreeService";

const CACHE_TTL_MS = 30_000;
const TAG = "catalog-tree";

type CacheEntry = {
  at: number;
  tree: CatalogTreeNode[];
};

let memory: CacheEntry | null = null;

export function catalogTreeCacheTag() {
  return TAG;
}

export function invalidateCatalogTreeCache() {
  memory = null;
  try {
    // Next.js cache tag (best-effort; ignore if unavailable in scripts)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { revalidateTag } = require("next/cache") as { revalidateTag: (t: string) => void };
    revalidateTag(TAG);
  } catch {
    /* non-Next runtime */
  }
  if (typeof console !== "undefined") {
    console.info("[catalog-tree] cache invalidated");
  }
}

export async function getCatalogTreeCached(
  rootSlug: "ikinci-el" | "sifir-urun" | "all" = "all"
): Promise<CatalogTreeNode[]> {
  const now = Date.now();
  if (rootSlug === "all" && memory && now - memory.at < CACHE_TTL_MS) {
    return memory.tree;
  }
  const tree = await getCatalogTree(rootSlug);
  if (rootSlug === "all") {
    memory = { at: now, tree };
  }
  return tree;
}

/** Warm / force refresh */
export async function refreshCatalogTreeCache() {
  invalidateCatalogTreeCache();
  return getCatalogTreeCached("all");
}

export async function getCategoryBySlugCached(slug: string) {
  return prisma.category.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      path: true,
      level: true,
      parentId: true,
      icon: true,
      image: true,
      modelMode: true,
    },
  });
}
