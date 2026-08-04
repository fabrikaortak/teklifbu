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
      create: { ...c, parentId: null, isActive: true, isPremium: false, premiumVertical: null },
      update: {
        name: c.name,
        icon: c.icon,
        sortOrder: c.sortOrder,
        parentId: null,
        isActive: true,
        isPremium: false,
        premiumVertical: null,
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
      },
      update: {
        name: root.name,
        icon: root.icon,
        sortOrder: root.sortOrder,
        isActive: true,
        parentId: null,
        isPremium: false,
        premiumVertical: null,
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
        },
        update: {
          name: sub.name,
          icon: sub.icon,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
          isPremium: false,
          premiumVertical: null,
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
      },
      update: {
        name: root.name,
        icon: root.icon,
        sortOrder: root.sortOrder,
        isActive: true,
        parentId: null,
        isPremium: true,
        premiumVertical: root.vertical,
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
        },
        update: {
          name: sub.name,
          icon: sub.icon,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
          isPremium: true,
          premiumVertical: root.vertical,
        },
      });
    }
  }
}

/** Filtre slug'ı için kategori id listesi (kök ise altlar dahil). */
export async function resolveCategoryFilterIds(client: PrismaClient, slug: string): Promise<string[] | null> {
  const cat = await client.category.findUnique({
    where: { slug },
    include: { children: { where: { isActive: true }, select: { id: true } } },
  });
  if (!cat || !cat.isActive) return null;
  if (cat.children.length) {
    return [cat.id, ...cat.children.map((c) => c.id)];
  }
  return [cat.id];
}
