import type { BrowseNode } from "@/data/categoryBrowseTree";
import { PREMIUM_CATEGORY_SEEDS, childPremiumSlug, type PremiumVertical } from "@/data/premiumCategories";

/** Premium sidebar ağacı — admin’de açık dikeylere göre filtrelenir. */
export function buildPremiumBrowseTree(enabled: Record<string, boolean>): BrowseNode[] {
  return PREMIUM_CATEGORY_SEEDS.filter((r) => enabled[r.vertical] !== false).map((root) => ({
    id: `premium/${root.vertical}`,
    name: root.name,
    filter: { category: root.slug },
    children: root.children.map((c) => ({
      id: `premium/${root.vertical}/${c.slug}`,
      name: c.name,
      filter: { category: childPremiumSlug(root.slug, c.slug) },
    })),
  }));
}

export function premiumRootSlugs(enabled?: Record<string, boolean>): string[] {
  return PREMIUM_CATEGORY_SEEDS.filter((r) => !enabled || enabled[r.vertical] !== false).map((r) => r.slug);
}

export type { PremiumVertical };
