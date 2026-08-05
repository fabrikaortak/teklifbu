import type { AttributeType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { catalogSlugify } from "@/lib/catalogSlug";

const ATTR_TYPES = new Set<string>([
  "TEXT",
  "NUMBER",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
  "COLOR",
  "DATE",
  "RANGE",
]);

export function parseAttributeType(raw: unknown): AttributeType {
  const t = String(raw || "").toUpperCase();
  if (!ATTR_TYPES.has(t)) throw new Error("Geçersiz özellik tipi");
  return t as AttributeType;
}

export async function listAttributes(opts?: { q?: string }) {
  const q = String(opts?.q || "").trim();
  return prisma.attribute.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    include: {
      options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
      _count: { select: { categoryAttributes: true } },
    },
  });
}

export async function createAttribute(input: {
  name: string;
  slug?: string;
  type: unknown;
  isActive?: boolean;
}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Özellik adı zorunlu");
  const type = parseAttributeType(input.type);
  const slug = catalogSlugify(input.slug || name);
  return prisma.attribute.create({
    data: {
      name,
      slug,
      type,
      isActive: input.isActive !== false,
    },
  });
}

export async function updateAttribute(
  id: string,
  input: Partial<{ name: string; slug: string; type: unknown; isActive: boolean }>
) {
  const data: Prisma.AttributeUpdateInput = {};
  if (input.name !== undefined) data.name = String(input.name).trim();
  if (input.slug !== undefined) data.slug = catalogSlugify(input.slug);
  if (input.type !== undefined) data.type = parseAttributeType(input.type);
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  data.managedBySeed = false;
  data.source = "ADMIN";
  return prisma.attribute.update({ where: { id }, data });
}

export async function softDeleteAttribute(id: string) {
  return prisma.attribute.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export async function addAttributeOption(input: {
  attributeId: string;
  label: string;
  value?: string;
  colorCode?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const label = String(input.label || "").trim();
  if (!label) throw new Error("Seçenek etiketi zorunlu");
  const value = catalogSlugify(input.value || label) || label;
  return prisma.attributeOption.create({
    data: {
      attributeId: input.attributeId,
      label,
      value,
      colorCode: input.colorCode ? String(input.colorCode) : null,
      sortOrder: Number(input.sortOrder || 0),
      isActive: input.isActive !== false,
    },
  });
}

export async function updateAttributeOption(
  id: string,
  input: Partial<{
    label: string;
    value: string;
    colorCode: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const data: Prisma.AttributeOptionUpdateInput = {};
  if (input.label !== undefined) data.label = String(input.label).trim();
  if (input.value !== undefined) data.value = catalogSlugify(input.value) || String(input.value);
  if (input.colorCode !== undefined) data.colorCode = input.colorCode ? String(input.colorCode) : null;
  if (input.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder) || 0;
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  return prisma.attributeOption.update({ where: { id }, data });
}

export async function deleteAttributeOption(id: string) {
  return prisma.attributeOption.delete({ where: { id } });
}

export async function listCategoryAttributes(categoryId: string) {
  return prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: "asc" }],
    include: {
      attribute: {
        include: { options: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function setCategoryAttribute(input: {
  categoryId: string;
  attributeId: string;
  required?: boolean;
  filterable?: boolean;
  formVisible?: boolean;
  detailVisible?: boolean;
  comparisonVisible?: boolean;
  searchable?: boolean;
  isVariant?: boolean;
  unit?: string | null;
  sortOrder?: number;
}) {
  return prisma.categoryAttribute.upsert({
    where: {
      categoryId_attributeId: {
        categoryId: input.categoryId,
        attributeId: input.attributeId,
      },
    },
    create: {
      categoryId: input.categoryId,
      attributeId: input.attributeId,
      required: Boolean(input.required),
      filterable: Boolean(input.filterable),
      formVisible: input.formVisible !== false,
      detailVisible: input.detailVisible !== false,
      comparisonVisible: Boolean(input.comparisonVisible),
      searchable: Boolean(input.searchable),
      isVariant: Boolean(input.isVariant),
      unit: input.unit ? String(input.unit) : null,
      sortOrder: Number(input.sortOrder || 0),
    },
    update: {
      required: Boolean(input.required),
      filterable: Boolean(input.filterable),
      formVisible: input.formVisible !== false,
      detailVisible: input.detailVisible !== false,
      comparisonVisible: Boolean(input.comparisonVisible),
      searchable: Boolean(input.searchable),
      isVariant: Boolean(input.isVariant),
      unit: input.unit ? String(input.unit) : null,
      sortOrder: Number(input.sortOrder || 0),
    },
  });
}

export async function removeCategoryAttribute(categoryId: string, attributeId: string) {
  return prisma.categoryAttribute.delete({
    where: { categoryId_attributeId: { categoryId, attributeId } },
  });
}
