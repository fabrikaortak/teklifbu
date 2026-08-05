import { prisma } from "@/lib/db";
import { isShoppingCategorySlug } from "@/lib/catalogSlug";

export type CatalogTreeNode = {
  id: string;
  slug: string;
  name: string;
  level: number;
  path: string | null;
  sortOrder: number;
  icon: string | null;
  image: string | null;
  modelMode: string;
  brandInheritanceMode: string;
  children: CatalogTreeNode[];
};

export async function getCatalogTree(rootSlug: "ikinci-el" | "sifir-urun" | "all" = "all") {
  const roots =
    rootSlug === "all"
      ? await prisma.category.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            slug: { in: ["ikinci-el", "sifir-urun"] },
          },
          orderBy: [{ sortOrder: "asc" }],
        })
      : await prisma.category.findMany({
          where: { deletedAt: null, isActive: true, slug: rootSlug },
        });

  if (!roots.length) return [];

  const all = await prisma.category.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { slug: { startsWith: "ikinci-el" } },
        { slug: { startsWith: "sifir-urun" } },
        { path: { startsWith: "ikinci-el/" } },
        { path: { startsWith: "sifir-urun/" } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      level: true,
      path: true,
      parentId: true,
      sortOrder: true,
      icon: true,
      image: true,
      modelMode: true,
      brandInheritanceMode: true,
    },
  });

  const byParent = new Map<string | null, typeof all>();
  for (const c of all) {
    if (!isShoppingCategorySlug(c.slug)) continue;
    const key = c.parentId;
    const list = byParent.get(key) || [];
    list.push(c);
    byParent.set(key, list);
  }

  function build(parentId: string | null): CatalogTreeNode[] {
    const kids = [...(byParent.get(parentId) || [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr")
    );
    return kids.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      level: c.level,
      path: c.path,
      sortOrder: c.sortOrder,
      icon: c.icon,
      image: c.image,
      modelMode: c.modelMode,
      brandInheritanceMode: c.brandInheritanceMode,
      children: build(c.id),
    }));
  }

  return roots
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      level: r.level,
      path: r.path,
      sortOrder: r.sortOrder,
      icon: r.icon,
      image: r.image,
      modelMode: r.modelMode,
      brandInheritanceMode: r.brandInheritanceMode,
      children: build(r.id),
    }));
}

const HIDDEN_ROOT_SLUGS = new Set(["ikinci-el", "sifir-urun"]);

export async function getCategoryChain(categoryId: string) {
  const chain: Array<{
    id: string;
    slug: string;
    name: string;
    level: number;
    path: string | null;
    icon: string | null;
    image: string | null;
  }> = [];
  let id: string | null = categoryId;
  const guard = new Set<string>();
  while (id && !guard.has(id)) {
    guard.add(id);
    const cat = await prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        level: true,
        path: true,
        parentId: true,
        icon: true,
        image: true,
      },
    });
    if (!cat) break;
    chain.unshift(cat);
    id = cat.parentId;
  }
  return chain;
}

/** Breadcrumb için: sistem köklerini gizle */
export async function getCategoryBreadcrumb(opts: { categoryId?: string; categorySlug?: string }) {
  let id = opts.categoryId || "";
  if (!id && opts.categorySlug) {
    const cat = await prisma.category.findFirst({
      where: { slug: opts.categorySlug, deletedAt: null },
      select: { id: true },
    });
    id = cat?.id || "";
  }
  if (!id) return [];
  const chain = await getCategoryChain(id);
  return chain
    .filter((c) => !HIDDEN_ROOT_SLUGS.has(c.slug))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      path: c.path,
      icon: c.icon,
      image: c.image,
      href: `/alisveris?category=${encodeURIComponent(c.slug)}`,
    }));
}
