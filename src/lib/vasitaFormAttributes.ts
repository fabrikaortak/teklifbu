"use client";

import { useEffect, useState } from "react";
import { canonicalSubtypeForForms } from "@/lib/vasitaElectric";

/**
 * Adapter between the DB-backed Vasıta attribute templates
 * (Attribute + AttributeOption + CategoryAttribute, seeded by
 * scripts/vehicle-stage1-attributes-apply.ts from
 * docs/vertical-taxonomy/vehicle-attribute-templates.csv) and the legacy
 * flat `attrs` shape used by src/app/ilan-ver/page.tsx.
 *
 * Stage1 does NOT change the ilan-ver form layout — this only supplies
 * option lists (e.g. for the "Yakıt" select) sourced from the DB when
 * available, falling back to the existing hardcoded lists otherwise.
 */

export type VasitaFormAttributeOption = { value: string; label: string };

export type VasitaFormAttributeField = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SINGLE_SELECT" | "MULTI_SELECT" | "BOOLEAN" | "COLOR" | "DATE" | "RANGE";
  required: boolean;
  filterable: boolean;
  formVisible: boolean;
  unit: string;
  sortOrder: number;
  options: VasitaFormAttributeOption[];
};

/** template field_key → legacy attrs.* key (docs/vertical-taxonomy/vehicle-attribute-templates.csv `legacy_attributes_key`). */
export const FIELD_KEY_TO_LEGACY_ATTR: Record<string, string> = {
  modelYear: "year",
  mileage: "km",
  fuelType: "fuel",
  transmission: "gear",
  bodyType: "bodyType",
  engineDisplacement: "engineSize",
  enginePower: "enginePower",
  driveType: "drive",
  color: "color",
  plateStatus: "plateStatus",
  registrationDate: "registrationDate",
  condition: "vehicleStatus",
  exchange: "swap",
  warranty: "warranty",
  bodySubtype: "bodySubtype",
  motorcycleClass: "motorcycleClass",
  cylinderCount: "cylinders",
  coolingType: "cooling",
  usageClass: "usageClass",
  axleCount: "axles",
  loadCapacity: "loadCapacity",
  grossWeight: "grossWeight",
  cabinType: "cabinType",
  operatingHours: "operatingHours",
  batteryCapacityKwh: "batteryCapacity",
  electricRangeKm: "electricRange",
  chargingType: "chargingType",
  fastCharging: "fastCharging",
  damageAmount: "damageAmount",
  paintedParts: "paintedParts",
  replacedParts: "replacedParts",
  accidentHistory: "accidentHistory",
  inspectionAvailable: "inspectionAvailable",
  inspectionDate: "inspectionDate",
  disabledPlateEligible: "disabledPlateEligible",
  specialEquipment: "specialEquipment",
  wheelchairAccess: "wheelchairAccess",
  classicStatus: "classicStatus",
  seatCount: "seats",
  floorType: "floorType",
};

/** subtype (browse filter) → attribute template key */
export const SUBTYPE_TO_ATTRIBUTE_TEMPLATE: Record<string, string> = {
  otomobil: "PASSENGER_CAR",
  "arazi-suv-pickup": "SUV_PICKUP",
  motosiklet: "MOTORCYCLE",
  "minivan-panelvan": "MINIVAN_PANELVAN",
  "ticari-araclar": "TRUCK",
  "kamyonet-van": "LIGHT_COMMERCIAL",
  "kamyon-kamyonet": "TRUCK",
  "cekici": "TRACTOR_UNIT",
  "dorse": "TRAILER",
  "otobus-minibus": "BUS_MINIBUS",
  karavan: "CARAVAN",
  atv: "ATV_UTV",
  utv: "ATV_UTV",
  "deniz-araclari": "MARINE_VEHICLE",
  "hava-araclari": "AIRCRAFT",
};

export function attributeTemplateForSubtype(subtype: string): string {
  const canonical = canonicalSubtypeForForms(subtype);
  return SUBTYPE_TO_ATTRIBUTE_TEMPLATE[canonical] || SUBTYPE_TO_ATTRIBUTE_TEMPLATE[subtype] || "PASSENGER_CAR";
}

export function legacyAttrKeyFor(fieldKey: string): string {
  return FIELD_KEY_TO_LEGACY_ATTR[fieldKey] || fieldKey;
}

export function visibleVasitaFormFields(fields: VasitaFormAttributeField[]): VasitaFormAttributeField[] {
  return fields
    .filter((f) => f.formVisible !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

const cache = new Map<string, VasitaFormAttributeField[]>();

async function fetchFields(subtype: string): Promise<VasitaFormAttributeField[]> {
  if (cache.has(subtype)) return cache.get(subtype)!;
  try {
    const res = await fetch(`/api/vasita/attributes?subtype=${encodeURIComponent(subtype)}`, { cache: "no-store" });
    const data = await res.json();
    const fields: VasitaFormAttributeField[] = Array.isArray(data?.fields) ? data.fields : [];
    cache.set(subtype, fields);
    return fields;
  } catch {
    return [];
  }
}

/** Find a field by legacy attrs.* key (e.g. "fuel" → fieldKey "fuelType"). */
export function findFieldByLegacyKey(
  fields: VasitaFormAttributeField[],
  legacyKey: string
): VasitaFormAttributeField | undefined {
  return fields.find((f) => legacyAttrKeyFor(f.key) === legacyKey);
}

/**
 * Client hook: DB-backed attribute fields for a Vasıta subtype (e.g. "otomobil").
 * Returns `[]` while loading or when unavailable — callers should fall back to
 * their existing hardcoded option lists in that case (no layout change).
 */
export function useVasitaFormAttributes(subtype: string | undefined | null) {
  const [fields, setFields] = useState<VasitaFormAttributeField[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = canonicalSubtypeForForms((subtype || "").trim());
    if (!s) {
      setFields([]);
      setLoaded(false);
      return;
    }
    let alive = true;
    setLoaded(false);
    fetchFields(s).then((f) => {
      if (!alive) return;
      setFields(f);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [subtype]);

  return { fields, loaded };
}
