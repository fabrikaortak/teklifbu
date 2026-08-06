import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Vasıta attribute templates (Stage1) — DB-backed CategoryAttribute + AttributeOption
 * seeded by scripts/vehicle-stage1-attributes-apply.ts from
 * docs/vertical-taxonomy/vehicle-attribute-templates.csv.
 *
 * GET /api/vasita/attributes?subtype=otomobil
 *   → { ok, fields: [{ key, legacyKey, label, type, required, filterable, unit, sortOrder, options: [{value,label}] }] }
 */
async function resolveCategoryBySubtype(subtype: string) {
  const slug = `arac__${subtype}`;
  return prisma.category.findFirst({
    where: { OR: [{ slug }, { path: `arac/${subtype}` }], deletedAt: null },
    select: { id: true },
  });
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const subtype = String(sp.get("subtype") || "").trim();
  if (!subtype) return NextResponse.json({ ok: false, error: "subtype_required" }, { status: 400 });

  try {
    const category = await resolveCategoryBySubtype(subtype);
    if (!category) return NextResponse.json({ ok: true, fields: [] });

    const rows = await prisma.categoryAttribute.findMany({
      where: { categoryId: category.id, attribute: { isActive: true, deletedAt: null } },
      orderBy: [{ sortOrder: "asc" }],
      include: {
        attribute: {
          select: {
            slug: true,
            name: true,
            type: true,
            options: { orderBy: { sortOrder: "asc" }, select: { value: true, label: true } },
          },
        },
      },
    });

    const fields = rows.map((r) => ({
      key: r.attribute.slug,
      label: r.attribute.name,
      type: r.attribute.type,
      required: r.required,
      filterable: r.filterable,
      formVisible: r.formVisible,
      unit: r.unit || "",
      sortOrder: r.sortOrder,
      options: r.attribute.options,
    }));

    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    console.error("[api/vasita/attributes] failed", e);
    return NextResponse.json({ ok: false, error: "attributes_unavailable" }, { status: 500 });
  }
}
