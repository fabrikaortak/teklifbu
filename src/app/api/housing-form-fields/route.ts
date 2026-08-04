import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";
import {
  DEFAULT_HOUSING_FORM_FIELDS_ENABLED,
  normalizeHousingFormFieldsEnabled,
} from "@/data/housingFormFields";

export const runtime = "nodejs";

export async function GET() {
  const raw = await getSetting<Record<string, boolean>>(
    "housing_form_fields_enabled",
    DEFAULT_HOUSING_FORM_FIELDS_ENABLED
  );
  return NextResponse.json({
    ok: true,
    enabled: normalizeHousingFormFieldsEnabled(raw),
  });
}
