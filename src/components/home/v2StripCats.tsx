"use client";

import type { ReactNode } from "react";
import {
  LayoutGrid,
  Car,
  Home,
  Smartphone,
  Sofa,
  Shirt,
  Bike,
  Package,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getCatIcon } from "@/components/CategoryIcons";
import { CLASSIC_BROWSE_TREE, classicRootCategory } from "@/data/classicBrowseTree";

export type V2NavCat = {
  slug: string;
  name: string;
  Icon?: LucideIcon;
  /** API / filtre eşlemesi */
  mapTo?: string;
};

/** Ana sayfa şerit / menü kökleri: yalnızca Emlak + Vasıta */
export const V2_NAV_CATS: V2NavCat[] = CLASSIC_BROWSE_TREE.map((n) => ({
  slug: n.id,
  name: n.name,
  mapTo: n.filter.category || n.id,
  Icon: n.id === "arac" ? Car : Home,
}));

/**
 * Şerit: Emlak + Vasıta (+ Alışveriş / Premium — dikey açıksa gösterilir)
 */
export const V2_CLASSIC_STRIP: V2NavCat[] = [
  { slug: "emlak", name: "Emlak", Icon: Home, mapTo: classicRootCategory("emlak") },
  { slug: "araclar", name: "Vasıta", Icon: Car, mapTo: classicRootCategory("arac") },
  { slug: "alisveris", name: "Alışveriş", Icon: ShoppingBag, mapTo: "alisveris" },
  { slug: "premium", name: "Premium", Icon: Sparkles, mapTo: "premium" },
];
/** /alisveris şerit kökleri */
export const V2_ALISVERIS_STRIP: V2NavCat[] = [
  { slug: "elektronik", name: "Elektronik", Icon: Smartphone, mapTo: classicRootCategory("elektronik") },
  { slug: "ev-yasam", name: "Ev & Yaşam", Icon: Sofa, mapTo: classicRootCategory("ev-yasam") },
  { slug: "moda", name: "Moda & Aksesuar", Icon: Shirt, mapTo: classicRootCategory("moda") },
  { slug: "hobi", name: "Hobi & Spor", Icon: Bike, mapTo: classicRootCategory("hobi") },
  { slug: "diger", name: "Diğer", Icon: Package, mapTo: classicRootCategory("diger") },
];

export const V2_CLASSIC_SIDE: V2NavCat[] = V2_CLASSIC_STRIP;

export function V2StripIcon({
  Icon,
  active,
  size = 18,
}: {
  Icon: LucideIcon;
  active?: boolean;
  size?: number;
}) {
  return <Icon size={size} strokeWidth={active ? 2.25 : 1.75} />;
}

export function classicCatIcon(cat: V2NavCat, active = false, size = 18): ReactNode {
  if (cat.Icon) return <V2StripIcon Icon={cat.Icon} active={active} size={size} />;
  return getCatIcon(cat.mapTo?.split(",")[0] || cat.slug || "all", size);
}

export function v2CatIcon(slug: string, size = 18) {
  return getCatIcon(slug || "all", size);
}

export function resolveCatSlug(cat: V2NavCat) {
  return cat.mapTo || cat.slug;
}

export function navCatCount(
  cat: V2NavCat,
  data: {
    stats?: { activeListings?: number };
    categories?: Array<{
      slug: string;
      _count?: { listings: number };
      children?: Array<{ slug: string; _count?: { listings: number } }>;
    }>;
  } | null
): number {
  if (!cat.slug) return data?.stats?.activeListings ?? 0;
  const keys = resolveCatSlug(cat).split(",").map((s) => s.trim()).filter(Boolean);
  const cats = data?.categories || [];
  let total = 0;
  for (const key of keys) {
    for (const c of cats) {
      if (c.slug === key || c.slug === cat.slug) total += c._count?.listings ?? 0;
      for (const ch of c.children || []) {
        if (ch.slug === key || ch.slug === cat.slug) total += ch._count?.listings ?? 0;
      }
    }
  }
  return total;
}

export { LayoutGrid };
