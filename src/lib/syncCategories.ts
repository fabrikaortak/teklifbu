import type { PrismaClient } from "@prisma/client";
import { SHOP_ROOTS, SHOP_SUBCATEGORIES, childSlug } from "@/data/shopCategories";
import { PREMIUM_CATEGORY_SEEDS, childPremiumSlug } from "@/data/premiumCategories";

/** Emlak kökleri + İkinci El / Sıfır Ürün + Premium dikeyleri senkronize eder. */
export async function syncCategories(client: PrismaClient) {
  const base = [
    { slug: "konut", name: "Emlak", icon: "home", sortOrder: 1 },
    { slug: "arac", name: "Vasıta", icon: "car", sortOrder: 2 },
    { slug: "isyeri", name: "İşyeri", icon: "building", sortOrder: 3 },
    { slug: "arsa", name: "Arsa", icon: "map", sortOrder: 4 },
    { slug: "kiralik", name: "Kiralık", icon: "key", sortOrder: 5 },
  ];

  for (const c of base) {
    await client.category.upsert({
      where: { slug: c.slug },
      create: {
        ...c,
        parentId: null,
        isActive: true,
        isPremium: false,
        premiumVertical: null,
        level: 0,
        path: c.slug,
      },
      update: {
        name: c.name,
        icon: c.icon,
        sortOrder: c.sortOrder,
        parentId: null,
        isActive: true,
        isPremium: false,
        premiumVertical: null,
        level: 0,
        path: c.slug,
      },
    });
  }

  await client.category.upsert({
    where: { slug: "diger" },
    create: {
      slug: "diger",
      name: "Diğer",
      icon: "grid",
      sortOrder: 99,
      isActive: false,
      parentId: null,
      isPremium: false,
    },
    update: { isActive: false, sortOrder: 99, isPremium: false },
  });

  for (const root of SHOP_ROOTS) {
    const parent = await client.category.upsert({
      where: { slug: root.slug },
      create: {
        slug: root.slug,
        name: root.name,
        icon: root.icon,
        sortOrder: root.sortOrder,
        isActive: true,
        parentId: null,
        isPremium: false,
        premiumVertical: null,
        level: 0,
        path: root.slug,
      },
      update: {
        name: root.name,
        icon: root.icon,
        sortOrder: root.sortOrder,
        isActive: true,
        parentId: null,
        isPremium: false,
        premiumVertical: null,
        level: 0,
        path: root.slug,
      },
    });

    for (const sub of SHOP_SUBCATEGORIES) {
      const slug = childSlug(root.slug, sub.slug);
      await client.category.upsert({
        where: { slug },
        create: {
          slug,
          name: sub.name,
          icon: sub.icon,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
          isPremium: false,
          premiumVertical: null,
          level: 1,
          path: `${root.slug}/${sub.slug}`,
        },
        update: {
          name: sub.name,
          icon: sub.icon,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
          isPremium: false,
          premiumVertical: null,
          level: 1,
          path: `${root.slug}/${sub.slug}`,
        },
      });
    }
  }

  for (const root of PREMIUM_CATEGORY_SEEDS) {
    const parent = await client.category.upsert({
      where: { slug: root.slug },
      create: {
        slug: root.slug,
        name: root.name,
        icon: root.icon,
        sortOrder: root.sortOrder,
        isActive: true,
        parentId: null,
        isPremium: true,
        premiumVertical: root.vertical,
        level: 0,
        path: root.slug,
      },
      update: {
        name: root.name,
        icon: root.icon,
        sortOrder: root.sortOrder,
        isActive: true,
        parentId: null,
        isPremium: true,
        premiumVertical: root.vertical,
        level: 0,
        path: root.slug,
      },
    });

    for (const sub of root.children) {
      const slug = childPremiumSlug(root.slug, sub.slug);
      await client.category.upsert({
        where: { slug },
        create: {
          slug,
          name: sub.name,
          icon: sub.icon,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
          isPremium: true,
          premiumVertical: root.vertical,
          level: 1,
          path: `${root.slug}/${sub.slug}`,
        },
        update: {
          name: sub.name,
          icon: sub.icon,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
          isPremium: true,
          premiumVertical: root.vertical,
          level: 1,
          path: `${root.slug}/${sub.slug}`,
        },
      });
    }
  }
}

/** Filtre slug'ı için kategori id listesi (kök ise tüm altlar dahil). */
export async function resolveCategoryFilterIds(client: PrismaClient, slug: string): Promise<string[] | null> {
  const cat = await client.category.findUnique({
    where: { slug },
    select: { id: true, isActive: true, deletedAt: true, path: true },
  });
  if (!cat || !cat.isActive || cat.deletedAt) return null;

  if (cat.path) {
    const rows = await client.category.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [{ id: cat.id }, { path: cat.path }, { path: { startsWith: `${cat.path}/` } }],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  const ids: string[] = [];
  const queue = [cat.id];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    const kids = await client.category.findMany({
      where: { parentId: id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    for (const k of kids) queue.push(k.id);
  }
  return ids;
}
