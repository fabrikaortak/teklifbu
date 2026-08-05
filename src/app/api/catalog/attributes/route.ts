import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCategoryId } from "@/core/services/catalog/brandResolveService";

/** GET /api/catalog/attributes?categoryId= | categorySlug= */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const categoryId = String(sp.get("categoryId") || "").trim();
  const categorySlug = String(sp.get("categorySlug") || "").trim();

  const cat = await resolveCategoryId({ categoryId, categorySlug });
  if (!cat) return NextResponse.json({ ok: true, attributes: [], modelMode: "OPTIONAL" });

  let links = await prisma.categoryAttribute.findMany({
    where: {
      categoryId: cat.id,
      attribute: { deletedAt: null, isActive: true },
    },
    include: {
      attribute: {
        include: {
          options: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  // If leaf type has no attrs, fall back to parent once (e.g. akilli-telefon → cep-telefonu)
  if (!links.length) {
    const node = await prisma.category.findFirst({
      where: { id: cat.id },
      select: { parentId: true },
    });
    if (node?.parentId) {
      links = await prisma.categoryAttribute.findMany({
        where: {
          categoryId: node.parentId,
          attribute: { deletedAt: null, isActive: true },
        },
        include: {
          attribute: {
            include: {
              options: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    modelMode: cat.modelMode,
    categoryId: cat.id,
    categorySlug: cat.slug,
    attributes: links.map((l) => ({
      id: l.attribute.id,
      name: l.attribute.name,
      slug: l.attribute.slug,
      type: l.attribute.type,
      required: l.required,
      filterable: l.filterable,
      formVisible: l.formVisible,
      detailVisible: l.detailVisible,
      comparisonVisible: l.comparisonVisible,
      searchable: l.searchable,
      isVariant: l.isVariant,
      unit: l.unit,
      options: l.attribute.options.map((o) => ({
        id: o.id,
        label: o.label,
        value: o.value,
        colorCode: o.colorCode,
      })),
    })),
  });
}
