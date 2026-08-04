import { brandsForSubtype } from "@/data/vehicleCatalog";
import type { BrowseFilter } from "@/data/categoryBrowseTree";
import {
  aracBrandKey,
  aracModelKey,
  isNodeActive,
  sortOrderFor,
  displayNameFor,
  type BrowseNavConfig,
} from "@/lib/browseNavConfig";

export type FacetCounts = {
  categories: Record<string, number>;
  dealTypes: Record<string, number>;
  subtypes: Record<string, number>;
  brands: Record<string, number>;
  models: Record<string, number>;
  trims: Record<string, number>;
  rentals: Record<string, number>;
  showEmptyBrands: boolean;
  showEmptyModels: boolean;
  showEmptyTrims: boolean;
  /** Alt kategori / dealType / shop dalları — 0 ilanlıları gizle */
  showEmptyCategories: boolean;
  /** Admin'de pasif (isActive=false) olmayan kategori slug'ları */
  activeCategorySlugs: string[];
  /** Admin kategori ağacı: düğüm aktiflik / sıra */
  browseNavConfig: BrowseNavConfig;
};

export function countForBrowseFilter(
  facets: FacetCounts,
  filter: BrowseFilter
): number {
  const cat = filter.category || "";
  if (!cat) return 0;

  if (cat.includes(",")) {
    return cat
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .reduce((sum, slug) => sum + countForBrowseFilter(facets, { ...filter, category: slug }), 0);
  }

  if (cat.startsWith("ikinci-el-") || cat.startsWith("sifir-urun-")) {
    if (filter.brand && filter.subtype) {
      return (
        facets.brands[`shop:${cat}:${filter.subtype}:${filter.brand}`] ||
        facets.brands[`shop:${cat}:${filter.brand}`] ||
        0
      );
    }
    if (filter.brand) {
      return facets.brands[`shop:${cat}:${filter.brand}`] || 0;
    }
    if (filter.subtype) {
      return facets.subtypes[`${cat}:${filter.subtype}`] || 0;
    }
    return facets.categories[cat] || 0;
  }

  if (filter.trim && filter.brand && filter.model && filter.subtype) {
    return facets.trims[`arac:${filter.subtype}:${filter.brand}:${filter.model}:${filter.trim}`] || 0;
  }
  if (filter.model && filter.brand && filter.subtype) {
    return facets.models[`arac:${filter.subtype}:${filter.brand}:${filter.model}`] || 0;
  }
  if (filter.brand && filter.subtype) {
    return facets.brands[`arac:${filter.subtype}:${filter.brand}`] || 0;
  }
  if (filter.subtype) {
    return facets.subtypes[`${cat}:${filter.subtype}`] || 0;
  }
  if (filter.dealType) {
    return facets.dealTypes[`${cat}:${filter.dealType}`] || 0;
  }
  if (filter.rental === "gunluk") {
    return facets.rentals[`${cat}:gunluk`] || 0;
  }
  return facets.categories[cat] || 0;
}

export function buildVehicleBrandNodes(subtype: string, facets: FacetCounts) {
  const cfg = facets.browseNavConfig;
  const brands = brandsForSubtype(subtype);
  return brands
    .map((b, bi) => {
      const bKey = aracBrandKey(subtype, b.slug);
      if (!isNodeActive(cfg, bKey)) return null;
      const bCount = facets.brands[`arac:${subtype}:${b.slug}`] || 0;
      const models = b.models
        .map((m, mi) => {
          const mKey = aracModelKey(subtype, b.slug, m.slug);
          if (!isNodeActive(cfg, mKey)) return null;
          const mCount = facets.models[`arac:${subtype}:${b.slug}:${m.slug}`] || 0;
          const trimList = (m.trims || [])
            .map((t) => ({
              slug: t.slug,
              name: t.name,
              count: facets.trims[`arac:${subtype}:${b.slug}:${m.slug}:${t.slug}`] || 0,
            }))
            .filter((t) => facets.showEmptyTrims || t.count > 0);
          return {
            slug: m.slug,
            name: displayNameFor(cfg, mKey, m.name),
            count: mCount,
            trims: trimList,
            _sort: sortOrderFor(cfg, mKey, mi),
          };
        })
        .filter((m): m is NonNullable<typeof m> => m != null)
        .filter((m) => facets.showEmptyModels || m.count > 0)
        .sort((a, b) => a._sort - b._sort)
        .map(({ _sort: _, ...rest }) => rest);
      return {
        slug: b.slug,
        name: displayNameFor(cfg, bKey, b.name),
        count: bCount,
        models,
        _sort: sortOrderFor(cfg, bKey, bi),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b != null)
    .filter((b) => facets.showEmptyBrands || b.count > 0)
    .sort((a, b) => a._sort - b._sort)
    .map(({ _sort: _, ...rest }) => rest);
}
