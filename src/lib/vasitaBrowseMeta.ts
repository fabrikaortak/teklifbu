/**
 * Shared Vasıta browse metadata helpers.
 * Used by BOTH:
 *  - src/lib/vasitaBrowseFromTarget.ts (JSON target-tree adapter, EMERGENCY FALLBACK ONLY)
 *  - src/lib/vasitaBrowseFromDb.ts (DB Category adapter, runtime source of truth)
 *
 * Keeps subtype/attr-mapping logic identical regardless of source.
 */
import type { BrowseFilter } from "@/data/categoryBrowseTree";

/** Prefix stored in Category.description so browse meta survives without new columns. */
export const VASITA_META_PREFIX = "VASITA_META:";

export const CATALOG_SCOPE_TO_SUBTYPE: Record<string, string> = {
  PASSENGER_CAR: "otomobil",
  SUV_PICKUP: "arazi-suv-pickup",
  MOTORCYCLE: "motosiklet",
  MINIVAN_PANELVAN: "minivan-panelvan",
  LIGHT_COMMERCIAL: "ticari-araclar",
  TRUCK: "ticari-araclar",
  TRACTOR_UNIT: "ticari-araclar",
  BUS_MINIBUS: "ticari-araclar",
  TRAILER: "ticari-araclar",
  CARAVAN: "karavan",
  ATV: "atv",
  UTV: "utv",
  MARINE_VEHICLE: "deniz-araclari",
  AIRCRAFT: "ucak",
};

export type VasitaMeta = {
  browseRole?: string;
  catalogScope?: string | null;
  requiredFilters?: Record<string, unknown>;
  mapsToAttribute?: Record<string, string>;
  legacySubtype?: string;
  browseOnly?: boolean;
  /** vehicle-attribute-templates.csv template_key (PASSENGER_CAR, MOTORCYCLE, …) */
  attributeTemplate?: string | null;
};

export type FilterWithAttrs = BrowseFilter & { _attrs?: Record<string, string> };

export function serializeVasitaMeta(meta: VasitaMeta): string {
  return `${VASITA_META_PREFIX}${JSON.stringify(meta)}`;
}

/** Reads `VASITA_META:{...}` out of Category.description (any prefix text before it is ignored). */
export function parseVasitaMeta(description?: string | null): VasitaMeta | null {
  if (!description) return null;
  const idx = description.indexOf(VASITA_META_PREFIX);
  if (idx === -1) return null;
  const jsonPart = description.slice(idx + VASITA_META_PREFIX.length).trim();
  try {
    return JSON.parse(jsonPart) as VasitaMeta;
  } catch {
    return null;
  }
}

export function subtypeForMeta(
  meta: VasitaMeta | null | undefined,
  slug: string,
  parentMeta?: VasitaMeta | null
): string {
  const fromFilter = meta?.requiredFilters?.catalogScope;
  if (typeof fromFilter === "string" && CATALOG_SCOPE_TO_SUBTYPE[fromFilter]) {
    return CATALOG_SCOPE_TO_SUBTYPE[fromFilter];
  }
  if (meta?.catalogScope && CATALOG_SCOPE_TO_SUBTYPE[meta.catalogScope]) {
    return CATALOG_SCOPE_TO_SUBTYPE[meta.catalogScope];
  }
  if (parentMeta?.catalogScope && CATALOG_SCOPE_TO_SUBTYPE[parentMeta.catalogScope]) {
    return CATALOG_SCOPE_TO_SUBTYPE[parentMeta.catalogScope];
  }
  return slug;
}

/**
 * Listing filter for a browse node.
 * `hasParent` mirrors the JSON adapter's convention: top-level main-nav nodes are
 * built with parent=undefined even though their DB row has parentId=arac, because a
 * segment hub (Kiralık Araçlar, Elektrikli Araçlar, …) itself must resolve subtype=own slug,
 * while its *children* resolve subtype from catalogScope/mapsToAttribute.
 */
export function filterForMeta(
  meta: VasitaMeta | null | undefined,
  slug: string,
  hasParent: boolean,
  parentMeta?: VasitaMeta | null
): FilterWithAttrs {
  const role = meta?.browseRole || parentMeta?.browseRole || "VEHICLE_TYPE";
  const subtype = subtypeForMeta(meta, slug, parentMeta);
  const f: FilterWithAttrs = {
    category: "arac",
    subtype,
    _attrs: { ...(meta?.mapsToAttribute || {}) },
  };

  const rf = meta?.requiredFilters || {};
  if (rf.dealType === "KIRALIK" || rf.dealType === "RENT") {
    f.dealType = "KIRALIK";
  }
  if (rf.fuelType) f._attrs!.fuelType = String(rf.fuelType);
  if (rf.condition) f._attrs!.condition = String(rf.condition);
  if (rf.classicStatus) f._attrs!.classicStatus = "true";
  if (rf.disabledPlateEligible) f._attrs!.disabledPlateEligible = "true";
  if (rf.rentalPeriod) f._attrs!.rentalPeriod = String(rf.rentalPeriod);
  if (rf.withDriver) f._attrs!.withDriver = "true";

  if (
    ["MARKET_SEGMENT", "TRANSACTION_MODE", "CONDITION_SEGMENT", "SPECIAL_SEGMENT"].includes(role) &&
    !meta?.catalogScope &&
    !rf.catalogScope &&
    !hasParent
  ) {
    f.subtype = slug;
  }

  return f;
}

/** `filter._attrs` accessor shared by CategoryLadderPicker regardless of tree source. */
export function readBrowseExtraAttrs(filter: BrowseFilter): Record<string, string> {
  return (filter as FilterWithAttrs)._attrs || {};
}
