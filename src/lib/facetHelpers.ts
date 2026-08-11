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
  /** arac:subtype:brand:model:version */
  versions: Record<string, number>;
  /** arac:subtype:brand:model:version:trim  — legacy: arac:…:model:trim when no version */
  trims: Record<string, number>;
  rentals: Record<string, number>;
  showEmptyBrands: boolean;
  showEmptyModels: boolean;
  showEmptyTrims: boolean;
  /** Alt kategori / dealType / shop dalları — 0 ilanlıları gizle */
  showEmptyCategories: boolean;
  /** Emlak/Vasıta kökünde (18) göster — false ise sadece alt dallarda sayı */
  showRootCounts: boolean;
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

  if (cat.startsWith("ikinci-el-") || cat.startsWith("sifir-urun-") || cat.includes("__")) {
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

  if (filter.trim && filter.version && filter.brand && filter.model && filter.subtype) {
    return (
      facets.trims[
        `arac:${filter.subtype}:${filter.brand}:${filter.model}:${filter.version}:${filter.trim}`
      ] || 0
    );
  }
  if (filter.version && filter.brand && filter.model && filter.subtype) {
    return (
      facets.versions?.[`arac:${filter.subtype}:${filter.brand}:${filter.model}:${filter.version}`] || 0
    );
  }
  if (filter.trim && filter.brand && filter.model && filter.subtype) {
    // Legacy: attributes.trim held engine when version was absent
    return facets.trims[`arac:${filter.subtype}:${filter.brand}:${filter.model}:${filter.trim}`] || 0;
  }
  if (filter.model && filter.brand && filter.subtype) {
    return facets.models[`arac:${filter.subtype}:${filter.brand}:${filter.model}`] || 0;
  }
  if (filter.brand && filter.subtype) {
    return facets.brands[`arac:${filter.subtype}:${filter.brand}`] || 0;
  }
  if (filter.subtype && filter.dealType) {
    return facets.subtypes[`${cat}:${filter.dealType}:${filter.subtype}`] || 0;
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

export type NavCatalogVersion = {
  slug: string;
  name: string;
  trims?: Array<{ slug: string; name: string }>;
};

export type NavCatalogModel = {
  slug: string;
  name: string;
  /** Motor / model kodu — nested paketler versions[].trims */
  versions?: NavCatalogVersion[];
  /** Shallow nav: versions henüz yüklenmedi ama pack’te var */
  hasVersions?: boolean;
  /** Legacy flat engine leaves (no version/trim split) */
  trims?: Array<{ slug: string; name: string }>;
};

export function buildVehicleBrandNodes(
  subtype: string,
  facets: FacetCounts,
  /** Stage1 DB catalog only — never falls back to vehicleCatalog.ts. */
  catalogBrands: Array<{
    slug: string;
    name: string;
    models?: NavCatalogModel[];
  }> = []
) {
  const cfg = facets.browseNavConfig;
  const showEmptyMotors = facets.showEmptyTrims;
  const brands = catalogBrands.map((b) => ({
    slug: b.slug,
    name: b.name,
    models:
      b.models && b.models.length
        ? b.models.map((m) => ({
            slug: m.slug,
            name: m.name,
            versions: m.versions || [],
            hasVersions: Boolean(m.hasVersions),
            trims: m.trims || [],
          }))
        : [],
  }));
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

          const versionsFromPack = (m.versions || []).map((v) => {
            const vCount =
              facets.versions?.[`arac:${subtype}:${b.slug}:${m.slug}:${v.slug}`] || 0;
            const nestedTrims = (v.trims || [])
              .map((t) => ({
                slug: t.slug,
                name: t.name,
                count:
                  facets.trims[
                    `arac:${subtype}:${b.slug}:${m.slug}:${v.slug}:${t.slug}`
                  ] || 0,
              }))
              .filter((t) => showEmptyMotors || t.count > 0);
            return {
              slug: v.slug,
              name: v.name,
              count: vCount,
              trims: nestedTrims,
            };
          }).filter((v) => showEmptyMotors || v.count > 0 || v.trims.length > 0);

          // Legacy flat trims → treat as version-only leaves when pack has no versions
          const legacyTrims =
            versionsFromPack.length === 0 && !m.hasVersions
              ? (m.trims || [])
                  .map((t) => ({
                    slug: t.slug,
                    name: t.name,
                    count: facets.trims[`arac:${subtype}:${b.slug}:${m.slug}:${t.slug}`] || 0,
                    trims: [] as Array<{ slug: string; name: string; count: number }>,
                  }))
                  .filter((t) => showEmptyMotors || t.count > 0)
              : [];

          const versions = versionsFromPack.length ? versionsFromPack : legacyTrims;
          return {
            slug: m.slug,
            name: displayNameFor(cfg, mKey, m.name),
            count: mCount,
            versions,
            hasVersions: Boolean(m.hasVersions) || versions.length > 0,
            _sort: sortOrderFor(cfg, mKey, mi),
          };
        })
        .filter((m): m is NonNullable<typeof m> => m != null)
        .sort((a, b) => a._sort - b._sort || a.name.localeCompare(b.name, "tr"))
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
    // Always list every seeded DB brand (even count=0).
    .sort((a, b) => a.name.localeCompare(b.name, "tr") || a._sort - b._sort)
    .map(({ _sort: _, ...rest }) => rest);
}
