import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";
import {
  COMMERCIAL_BUSINESS_TYPES_SETTING_KEY,
  activeCommercialBusinessTypes,
  normalizeCommercialBusinessTypes,
} from "@/lib/commercialBusinessTypes";

/** Açık işletme tipleri — kayıt / profil formu */
export async function GET() {
  const raw = await getSetting(COMMERCIAL_BUSINESS_TYPES_SETTING_KEY, null);
  const all = normalizeCommercialBusinessTypes(raw);
  const active = activeCommercialBusinessTypes(raw);
  return NextResponse.json({
    types: active.map((t) => ({ key: t.key, label: t.label, sortOrder: t.sortOrder })),
    all: all.map((t) => ({
      key: t.key,
      label: t.label,
      active: t.active,
      sortOrder: t.sortOrder,
    })),
  });
}
