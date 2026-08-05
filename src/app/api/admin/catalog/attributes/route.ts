import { NextResponse } from "next/server";
import { catalogError, requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import {
  addAttributeOption,
  createAttribute,
  deleteAttributeOption,
  listAttributes,
  softDeleteAttribute,
  updateAttribute,
  updateAttributeOption,
} from "@/core/services/catalog/attributeCatalogService";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const q = new URL(req.url).searchParams.get("q") || "";
  const rows = await listAttributes({ q });
  return NextResponse.json({ ok: true, attributes: rows });
}

export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const action = String(body.action || "create");
    if (action === "option-create") {
      const option = await addAttributeOption(body);
      return NextResponse.json({ ok: true, option });
    }
    if (action === "option-update") {
      const option = await updateAttributeOption(String(body.id), body);
      return NextResponse.json({ ok: true, option });
    }
    if (action === "option-delete") {
      await deleteAttributeOption(String(body.id));
      return NextResponse.json({ ok: true });
    }
    const attribute = await createAttribute(body);
    return NextResponse.json({ ok: true, attribute });
  } catch (e) {
    return catalogError(e);
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return catalogError(new Error("id gerekli"));
    const attribute = await updateAttribute(id, body);
    return NextResponse.json({ ok: true, attribute });
  } catch (e) {
    return catalogError(e);
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return catalogError(new Error("id gerekli"));
    await softDeleteAttribute(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return catalogError(e);
  }
}
