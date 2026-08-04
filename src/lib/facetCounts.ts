import { prisma } from "@/lib/db";
import { ListingStatus } from "@prisma/client";
import { getSetting } from "@/core/settings";
import type { FacetCounts } from "@/lib/facetHelpers";
import { normalizeBrowseNavConfig, type BrowseNavConfig } from "@/lib/browseNavConfig";

export type { FacetCounts } from "@/lib/facetHelpers";
export { countForBrowseFilter, buildVehicleBrandNodes } from "@/lib/facetHelpers";

type Cache = { at: number; data: FacetCounts };
let cache: Cache | null = null;
const TTL_MS = 45_000;

const ACTIVE: ListingStatus[] = [ListingStatus.ACTIVE, ListingStatus.SELECTION, ListingStatus.APPROVED];

function attr(row: { attributes: unknown }, key: string): string {
  const a = row.attributes;
  if (!a || typeof a !== "object" || Array.isArray(a)) return "";
  const v = (a as Record<string, unknown>)[key];
  return v == null ? "" : String(v).trim();
}

/** İlan sayılarını toplayıp cache’ler — menü/filtre için (45 sn cache, max 5k ilan). */
export async function getFacetCounts(force = false): Promise<FacetCounts> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const [
    showEmptyBrands,
    showEmptyModels,
    showEmptyTrims,
    showEmptyCategories,
    browseNavRaw,
    activeCats,
  ] = await Promise.all([
    getSetting<boolean>("vehicle_nav_show_empty_brands", false),
    getSetting<boolean>("vehicle_nav_show_empty_models", false),
    getSetting<boolean>("vehicle_nav_show_empty_trims", false),
    getSetting<boolean>("category_nav_show_empty", false),
    getSetting<unknown>("browse_nav_config", null),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true },
    }),
  ]);

  const browseNavConfig: BrowseNavConfig = normalizeBrowseNavConfig(browseNavRaw);

  // Master switch: hideEmptyUntilListing ⇒ boş dalları gösterme
  const hideEmpty = browseNavConfig.hideEmptyUntilListing;
  const effectiveShowEmptyBrands = hideEmpty ? false : showEmptyBrands;
  const effectiveShowEmptyModels = hideEmpty ? false : showEmptyModels;
  const effectiveShowEmptyCategories = hideEmpty ? false : showEmptyCategories;

  const rows = await prisma.listing.findMany({
    where: { status: { in: ACTIVE } },
    select: {
      category: { select: { slug: true, parentId: true, parent: { select: { slug: true } } } },
      dealType: true,
      attributes: true,
    },
    take: 5000,
  });

  const categories: Record<string, number> = {};
  const dealTypes: Record<string, number> = {};
  const subtypes: Record<string, number> = {};
  const brands: Record<string, number> = {};
  const models: Record<string, number> = {};
  const trims: Record<string, number> = {};
  const rentals: Record<string, number> = {};

  for (const row of rows) {
    const slug = row.category.slug;
    const parentSlug = row.category.parent?.slug;
    const root = parentSlug || slug;
    categories[root] = (categories[root] || 0) + 1;
    if (parentSlug) categories[slug] = (categories[slug] || 0) + 1;

    const dtKey = `${root}:${row.dealType}`;
    dealTypes[dtKey] = (dealTypes[dtKey] || 0) + 1;

    const subtype = attr(row, "subtype");
    if (subtype) {
      const sk = `${root}:${subtype}`;
      subtypes[sk] = (subtypes[sk] || 0) + 1;
      if (slug !== root) {
        subtypes[`${slug}:${subtype}`] = (subtypes[`${slug}:${subtype}`] || 0) + 1;
      }
    }
    const rental = attr(row, "rentalPeriod");
    if (rental) {
      const rk = `${root}:${rental}`;
      rentals[rk] = (rentals[rk] || 0) + 1;
    }

    const brand = attr(row, "brand");
    if (brand && (slug.startsWith("ikinci-el-") || slug.startsWith("sifir-urun-"))) {
      brands[`shop:${slug}:${brand}`] = (brands[`shop:${slug}:${brand}`] || 0) + 1;
      if (subtype) {
        const bk = `shop:${slug}:${subtype}:${brand}`;
        brands[bk] = (brands[bk] || 0) + 1;
      }
    }

    if (root === "arac" || slug === "arac") {
      const model = attr(row, "model");
      const trim = attr(row, "trim");
      if (subtype && brand) {
        const bk = `arac:${subtype}:${brand}`;
        brands[bk] = (brands[bk] || 0) + 1;
      }
      if (subtype && brand && model) {
        const mk = `arac:${subtype}:${brand}:${model}`;
        models[mk] = (models[mk] || 0) + 1;
      }
      if (subtype && brand && model && trim) {
        const tk = `arac:${subtype}:${brand}:${model}:${trim}`;
        trims[tk] = (trims[tk] || 0) + 1;
      }
    }
  }

  const data: FacetCounts = {
    categories,
    dealTypes,
    subtypes,
    brands,
    models,
    trims,
    rentals,
    showEmptyBrands: effectiveShowEmptyBrands,
    showEmptyModels: effectiveShowEmptyModels,
    showEmptyTrims,
    showEmptyCategories: effectiveShowEmptyCategories,
    activeCategorySlugs: activeCats.map((c) => c.slug),
    browseNavConfig,
  };
  cache = { at: Date.now(), data };
  return data;
}

export function invalidateFacetCache() {
  cache = null;
}
