import { prisma } from "@/lib/db";
import { catalogSlugify, isShoppingCategorySlug } from "@/lib/catalogSlug";

export async function listBrands(opts?: { q?: string; includeDeleted?: boolean }) {
  const q = String(opts?.q || "").trim();
  return prisma.brand.findMany({
    where: {
      ...(opts?.includeDeleted ? {} : { deletedAt: null }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { categoryBrands: true, models: true } },
    },
  });
}

export async function createBrand(input: {
  name: string;
  slug?: string;
  logo?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Marka adı zorunlu");
  const slug = catalogSlugify(input.slug || name);
  if (!slug) throw new Error("Geçerli slug üretilemedi");
  return prisma.brand.create({
    data: {
      name,
      slug,
      logo: input.logo ? String(input.logo) : null,
      sortOrder: Number(input.sortOrder || 0),
      isActive: input.isActive !== false,
    },
  });
}

export async function updateBrand(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    logo: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = String(input.name).trim();
  if (input.slug !== undefined) data.slug = catalogSlugify(input.slug);
  if (input.logo !== undefined) data.logo = input.logo ? String(input.logo) : null;
  if (input.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder) || 0;
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  data.managedBySeed = false;
  data.source = "ADMIN";
  return prisma.brand.update({ where: { id }, data });
}

export async function softDeleteBrand(id: string) {
  return prisma.brand.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export async function listProductModels(opts?: { brandId?: string; q?: string }) {
  const q = String(opts?.q || "").trim();
  return prisma.productModel.findMany({
    where: {
      deletedAt: null,
      ...(opts?.brandId ? { brandId: opts.brandId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      _count: { select: { categoryModels: true } },
    },
  });
}

export async function createProductModel(input: {
  brandId: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Model adı zorunlu");
  if (!input.brandId) throw new Error("Marka seçin");
  const slug = catalogSlugify(input.slug || name);
  return prisma.productModel.create({
    data: {
      brandId: input.brandId,
      name,
      slug,
      sortOrder: Number(input.sortOrder || 0),
      isActive: input.isActive !== false,
    },
  });
}

export async function updateProductModel(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
    brandId: string;
  }>
) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = String(input.name).trim();
  if (input.slug !== undefined) data.slug = catalogSlugify(input.slug);
  if (input.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder) || 0;
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (input.brandId !== undefined) data.brandId = input.brandId;
  data.managedBySeed = false;
  data.source = "ADMIN";
  return prisma.productModel.update({ where: { id }, data });
}

export async function softDeleteProductModel(id: string) {
  return prisma.productModel.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export async function listShoppingCategories() {
  const cats = await prisma.category.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: [{ path: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      parentId: true,
      level: true,
      path: true,
    },
  });
  return cats.filter((c) => isShoppingCategorySlug(c.slug));
}

export async function listCategoryBrands(categoryId: string) {
  return prisma.categoryBrand.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: "asc" }],
    include: { brand: true },
  });
}

export async function setCategoryBrand(input: {
  categoryId: string;
  brandId: string;
  sortOrder?: number;
  isFeatured?: boolean;
}) {
  return prisma.categoryBrand.upsert({
    where: {
      categoryId_brandId: { categoryId: input.categoryId, brandId: input.brandId },
    },
    create: {
      categoryId: input.categoryId,
      brandId: input.brandId,
      sortOrder: Number(input.sortOrder || 0),
      isFeatured: Boolean(input.isFeatured),
    },
    update: {
      sortOrder: Number(input.sortOrder || 0),
      isFeatured: Boolean(input.isFeatured),
    },
  });
}

export async function removeCategoryBrand(categoryId: string, brandId: string) {
  return prisma.categoryBrand.delete({
    where: { categoryId_brandId: { categoryId, brandId } },
  });
}

export async function listCategoryModels(categoryId: string) {
  return prisma.categoryModel.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: "asc" }],
    include: {
      model: { include: { brand: { select: { id: true, name: true, slug: true } } } },
    },
  });
}

export async function setCategoryModel(input: {
  categoryId: string;
  modelId: string;
  sortOrder?: number;
}) {
  return prisma.categoryModel.upsert({
    where: {
      categoryId_modelId: { categoryId: input.categoryId, modelId: input.modelId },
    },
    create: {
      categoryId: input.categoryId,
      modelId: input.modelId,
      sortOrder: Number(input.sortOrder || 0),
    },
    update: { sortOrder: Number(input.sortOrder || 0) },
  });
}

export async function removeCategoryModel(categoryId: string, modelId: string) {
  return prisma.categoryModel.delete({
    where: { categoryId_modelId: { categoryId, modelId } },
  });
}
