/** Electric overlay ↔ canonical Vasıta subtype helpers (Stage1). */

export const ELECTRIC_SUBTYPE_TO_CANONICAL: Record<
  string,
  { canonicalSubtype: string; fuelType: "ELECTRIC"; electricVehicleType: string }
> = {
  "elektrikli-otomobil": {
    canonicalSubtype: "otomobil",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-otomobil",
  },
  "elektrikli-suv-pickup": {
    canonicalSubtype: "arazi-suv-pickup",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-suv-pickup",
  },
  "elektrikli-suv-ve-pickup": {
    canonicalSubtype: "arazi-suv-pickup",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-suv-pickup",
  },
  "elektrikli-minivan-panelvan": {
    canonicalSubtype: "minivan-panelvan",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-minivan-panelvan",
  },
  "elektrikli-ticari": {
    canonicalSubtype: "ticari-araclar",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-ticari",
  },
  "elektrikli-motosiklet": {
    canonicalSubtype: "motosiklet",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-motosiklet",
  },
  "elektrikli-atv": {
    canonicalSubtype: "atv",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-atv",
  },
  "elektrikli-utv": {
    canonicalSubtype: "utv",
    fuelType: "ELECTRIC",
    electricVehicleType: "elektrikli-utv",
  },
};

export function isElectricOverlaySubtype(subtype?: string | null): boolean {
  if (!subtype) return false;
  if (subtype === "elektrikli-araclar") return true;
  return Boolean(ELECTRIC_SUBTYPE_TO_CANONICAL[subtype]);
}

export function resolveElectricListingAttrs(subtype: string): {
  subtype: string;
  fuel: string;
  electricVehicleType?: string;
} | null {
  const hit = ELECTRIC_SUBTYPE_TO_CANONICAL[subtype];
  if (!hit) return null;
  return {
    subtype: hit.canonicalSubtype,
    fuel: hit.fuelType,
    electricVehicleType: hit.electricVehicleType,
  };
}

/** Form/attribute template should use canonical vehicle type, not overlay slug. */
export function canonicalSubtypeForForms(subtype: string): string {
  return ELECTRIC_SUBTYPE_TO_CANONICAL[subtype]?.canonicalSubtype || subtype;
}
