import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import type { FacetCounts } from "@/lib/facetHelpers";
import { normalizeBrowseNavConfig, type BrowseNavConfig } from "@/lib/browseNavConfig";
import { publicListingStatusWhere } from "@/core/services/listingExpiryService";

export type { FacetCounts } from "@/lib/facetHelpers";
export { countForBrowseFilter, buildVehicleBrandNodes } from "@/lib/facetHelpers";

type Cache = { at: number; data: FacetCounts };
let cache: Cache | null = null;
const TTL_MS = 120_000;

function attr(row: { attributes: unknown }, key: string): string {
  const a = row.attributes;
  if (!a || typeof a !== "object" || Array.isArray(a)) return "";
  const v = (a as Record<string, unknown>)[key];
  return v == null ? "" : String(v).trim();
}

/** İlan sayılarını toplayıp cache’ler — menü; arşivlenene kadar vitrinle aynı status seti. */
export async function getFacetCounts(force = false): Promise<FacetCounts> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const [
    showEmptyBrands,
    showEmptyModels,
    showEmptyTrims,
    showEmptyCategories,
    showRootCounts,
    browseNavRaw,
    activeCats,
    publicWhere,
  ] = await Promise.all([
    getSetting<boolean>("vehicle_nav_show_empty_brands", false),
    getSetting<boolean>("vehicle_nav_show_empty_models", false),
    getSetting<boolean>("vehicle_nav_show_empty_trims", false),
    getSetting<boolean>("category_nav_show_empty", false),
    getSetting<boolean>("browse_nav_show_root_counts", false),
    getSetting<unknown>("browse_nav_config", null),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true },
    }),
    publicListingStatusWhere(),
  ]);

  const browseNavConfig: BrowseNavConfig = normalizeBrowseNavConfig(browseNavRaw);

  // Master switch: hideEmptyUntilListing ⇒ boş dalları gösterme
  const hideEmpty = browseNavConfig.hideEmptyUntilListing;
  const effectiveShowEmptyBrands = hideEmpty ? false : showEmptyBrands;
  const effectiveShowEmptyModels = hideEmpty ? false : showEmptyModels;
  const effectiveShowEmptyCategories = hideEmpty ? false : showEmptyCategories;

  const rows = await prisma.listing.findMany({
    where: publicWhere,
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
  const versions: Record<string, number> = {};
  const trims: Record<string, number> = {};
  const rentals: Record<string, number> = {};

  for (const row of rows) {
    const slug = row.category.slug;
    const parentSlug = row.category.parent?.slug;
    const root = parentSlug || slug;

    if (slug.includes("__")) {
      // Dual-root path: her ata segmentine +1 (Ev Aletleri / Beyaz Eşya menü sayıları)
      const parts = slug.split("__");
      for (let i = 1; i <= parts.length; i++) {
        const prefix = parts.slice(0, i).join("__");
        categories[prefix] = (categories[prefix] || 0) + 1;
      }
    } else {
      categories[root] = (categories[root] || 0) + 1;
      if (parentSlug) categories[slug] = (categories[slug] || 0) + 1;
    }

    const dealType = String(row.dealType || "").trim();
    if (dealType) {
      const dtKey = `${root}:${dealType}`;
      dealTypes[dtKey] = (dealTypes[dtKey] || 0) + 1;
      if (slug !== root) {
        dealTypes[`${slug}:${dealType}`] = (dealTypes[`${slug}:${dealType}`] || 0) + 1;
      }
    }

    const subtype = attr(row, "subtype");
    if (subtype) {
      const sk = `${root}:${subtype}`;
      subtypes[sk] = (subtypes[sk] || 0) + 1;
      if (slug !== root) {
        subtypes[`${slug}:${subtype}`] = (subtypes[`${slug}:${subtype}`] || 0) + 1;
      }
      // Menü yaprağı hem dealType hem subtype ister — ayrı ayrı saymak Satılık altında
      // yanlış (1) gösterir, tıklanınca 0 ilan çıkar.
      if (dealType) {
        const combined = `${root}:${dealType}:${subtype}`;
        subtypes[combined] = (subtypes[combined] || 0) + 1;
        if (slug !== root) {
          subtypes[`${slug}:${dealType}:${subtype}`] =
            (subtypes[`${slug}:${dealType}:${subtype}`] || 0) + 1;
        }
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
      const version = attr(row, "version");
      const trim = attr(row, "trim");
      if (subtype && brand) {
        const bk = `arac:${subtype}:${brand}`;
        brands[bk] = (brands[bk] || 0) + 1;
      }
      if (subtype && brand && model) {
        const mk = `arac:${subtype}:${brand}:${model}`;
        models[mk] = (models[mk] || 0) + 1;
      }
      if (subtype && brand && model && version) {
        const vk = `arac:${subtype}:${brand}:${model}:${version}`;
        versions[vk] = (versions[vk] || 0) + 1;
        if (trim) {
          const tk = `arac:${subtype}:${brand}:${model}:${version}:${trim}`;
          trims[tk] = (trims[tk] || 0) + 1;
        }
      } else if (subtype && brand && model && trim) {
        // Legacy: engine stored in attributes.trim
        const vk = `arac:${subtype}:${brand}:${model}:${trim}`;
        versions[vk] = (versions[vk] || 0) + 1;
        trims[`arac:${subtype}:${brand}:${model}:${trim}`] =
          (trims[`arac:${subtype}:${brand}:${model}:${trim}`] || 0) + 1;
      }
    }
  }

  const data: FacetCounts = {
    categories,
    dealTypes,
    subtypes,
    brands,
    models,
    versions,
    trims,
    rentals,
    showEmptyBrands: effectiveShowEmptyBrands,
    showEmptyModels: effectiveShowEmptyModels,
    showEmptyTrims,
    showEmptyCategories: effectiveShowEmptyCategories,
    showRootCounts: Boolean(showRootCounts),
    activeCategorySlugs: activeCats.map((c) => c.slug),
    browseNavConfig,
  };
  cache = { at: Date.now(), data };
  return data;
}

export function invalidateFacetCache() {
  cache = null;
}
