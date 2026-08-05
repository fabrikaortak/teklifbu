import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

function isLeafShop(slug) {
  return (
    (slug.startsWith("ikinci-el-") || slug.startsWith("sifir-urun-")) &&
    !slug.includes("__")
  );
}
function isTypeCat(slug) {
  return (
    (slug.startsWith("ikinci-el-") || slug.startsWith("sifir-urun-")) &&
    slug.includes("__")
  );
}
function isRootShop(slug) {
  return slug === "ikinci-el" || slug === "sifir-urun";
}

async function brandsFor(slug) {
  const cat = await p.category.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!cat) return { cat: null, brands: [] };
  const links = await p.categoryBrand.findMany({
    where: { categoryId: cat.id, brand: { deletedAt: null, isActive: true } },
    include: { brand: true },
    orderBy: { sortOrder: "asc" },
    take: 15,
  });
  return { cat, brands: links.map((l) => l.brand.name) };
}

async function modelsFor(slug, brandName) {
  const cat = await p.category.findUnique({ where: { slug }, select: { id: true } });
  if (!cat) return [];
  const brand = await p.brand.findFirst({
    where: { name: { equals: brandName, mode: "insensitive" }, deletedAt: null },
  });
  if (!brand) return [];
  const links = await p.categoryModel.findMany({
    where: { categoryId: cat.id, model: { brandId: brand.id, deletedAt: null } },
    include: { model: true },
    orderBy: { sortOrder: "asc" },
    take: 12,
  });
  return links.map((l) => l.model.name);
}

async function attrsFor(slug) {
  const cat = await p.category.findUnique({ where: { slug }, select: { id: true } });
  if (!cat) return [];
  const links = await p.categoryAttribute.findMany({
    where: { categoryId: cat.id, attribute: { deletedAt: null } },
    include: { attribute: true },
    orderBy: { sortOrder: "asc" },
  });
  return links.map((l) => ({
    name: l.attribute.name,
    slug: l.attribute.slug,
    isVariant: l.isVariant,
    type: l.attribute.type,
  }));
}

async function main() {
  const cats = await p.category.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, parentId: true, level: true, path: true },
  });

  const shop = cats.filter((c) => c.slug.startsWith("ikinci-el") || c.slug.startsWith("sifir-urun"));
  const roots = shop.filter((c) => isRootShop(c.slug));
  const leaves = shop.filter((c) => isLeafShop(c.slug));
  const types = shop.filter((c) => isTypeCat(c.slug));

  // levels for shopping only
  const byLevel = {};
  for (const c of shop) byLevel[c.level] = (byLevel[c.level] || 0) + 1;

  const brands = await p.brand.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, name: true } });
  const brandSlugDup = Object.entries(
    brands.reduce((a, b) => {
      a[b.slug] = (a[b.slug] || 0) + 1;
      return a;
    }, {})
  ).filter(([, n]) => n > 1);

  const models = await p.productModel.findMany({
    where: { deletedAt: null },
    select: { id: true, brandId: true, slug: true, name: true },
  });
  const orphanModels = models.filter((m) => !brands.some((b) => b.id === m.brandId));
  const modelsWithoutBrandLink = 0;

  const categoryBrands = await p.categoryBrand.count();
  const categoryModels = await p.categoryModel.count();

  // brands with no category
  const linkedBrandIds = new Set(
    (await p.categoryBrand.findMany({ select: { brandId: true } })).map((x) => x.brandId)
  );
  const brandsNoCat = brands.filter((b) => !linkedBrandIds.has(b.id));

  // models with no category
  const linkedModelIds = new Set(
    (await p.categoryModel.findMany({ select: { modelId: true } })).map((x) => x.modelId)
  );
  const modelsNoCat = models.filter((m) => !linkedModelIds.has(m.id));

  // orphan parentId
  const ids = new Set(cats.map((c) => c.id));
  const orphanParents = cats.filter((c) => c.parentId && !ids.has(c.parentId));

  // duplicate category slugs (unique constraint should prevent)
  const slugCounts = {};
  for (const c of cats) slugCounts[c.slug] = (slugCounts[c.slug] || 0) + 1;
  const dupSlugs = Object.entries(slugCounts).filter(([, n]) => n > 1);

  // leaf types without brands / without attrs
  const typeIds = types.map((t) => t.id);
  const typesWithBrand = new Set(
    (
      await p.categoryBrand.findMany({
        where: { categoryId: { in: typeIds } },
        select: { categoryId: true },
      })
    ).map((x) => x.categoryId)
  );
  const typesWithAttr = new Set(
    (
      await p.categoryAttribute.findMany({
        where: { categoryId: { in: typeIds } },
        select: { categoryId: true },
      })
    ).map((x) => x.categoryId)
  );
  const typesNoBrand = types.filter((t) => !typesWithBrand.has(t.id)).length;
  const typesNoAttr = types.filter((t) => !typesWithAttr.has(t.id)).length;

  // phone types with models expectation
  const phoneTypes = types.filter((t) => t.slug.includes("cep-telefonu"));
  const phoneTypesNoModel = [];
  for (const t of phoneTypes) {
    const n = await p.categoryModel.count({ where: { categoryId: t.id } });
    if (!n) phoneTypesNoModel.push(t.slug);
  }

  // Renk attribute uniqueness
  const renk = await p.attribute.findMany({ where: { slug: "renk" } });
  const attrSlugs = await p.attribute.groupBy({ by: ["slug"], _count: true });
  const dupAttrs = attrSlugs.filter((x) => x._count > 1);

  // sample flows — map ChatGPT paths to our slugs
  const samples = {};
  const phoneLeaf = "ikinci-el-cep-telefonu";
  const phoneType = "ikinci-el-cep-telefonu__akilli-telefon";
  const fridge = "ikinci-el-beyaz-esya__buzdolabi";
  const fridgeLeaf = "ikinci-el-beyaz-esya";
  const shirt = "ikinci-el-giyim-aksesuar__tisort";
  const shirtAlt = "ikinci-el-giyim-aksesuar__erkek-giyim";
  const bike = "ikinci-el-spor-outdoor__bisiklet";
  const kettle = null; // filtreli sürahi — likely missing

  for (const [key, slug] of Object.entries({
    phoneLeaf,
    phoneType,
    fridge,
    fridgeLeaf,
    shirt,
    shirtAlt,
    bike,
  })) {
    const b = await brandsFor(slug);
    const a = await attrsFor(slug);
    const m = key.startsWith("phone") ? await modelsFor(slug, "Apple") : [];
    samples[key] = {
      exists: !!b.cat,
      name: b.cat?.name,
      brandsSample: b.brands.slice(0, 8),
      brandCount: b.brands.length,
      appleModels: m,
      attrs: a,
      variants: a.filter((x) => x.isVariant).map((x) => x.name),
    };
  }

  // search filtreli sürahi
  const surahi = await p.category.findMany({
    where: { OR: [{ name: { contains: "Sürahi", mode: "insensitive" } }, { slug: { contains: "surahi" } }] },
    select: { slug: true, name: true },
    take: 10,
  });
  const mutfak = await p.category.findMany({
    where: { OR: [{ name: { contains: "Mutfak", mode: "insensitive" } }, { slug: { contains: "mutfak" } }] },
    select: { slug: true, name: true },
    take: 15,
  });
  const erkekTisort = await p.category.findMany({
    where: {
      AND: [
        { slug: { startsWith: "ikinci-el-giyim" } },
        { OR: [{ name: { contains: "Tişört" } }, { slug: { contains: "tisort" } }, { slug: { contains: "erkek" } }] },
      ],
    },
    select: { slug: true, name: true, parentId: true },
    take: 20,
  });

  // Samsung brand count
  const samsung = await p.brand.findMany({ where: { OR: [{ slug: "samsung" }, { name: { equals: "Samsung", mode: "insensitive" } }], deletedAt: null } });

  // parent-child sample
  const sampleTree = await p.category.findFirst({
    where: { slug: "ikinci-el-cep-telefonu" },
    include: { children: { take: 5, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, level: true, parentId: true } }, parent: { select: { slug: true } } },
  });

  console.log(
    JSON.stringify(
      {
        counts: {
          shopRoots: roots.length,
          shopLeaves: leaves.length,
          shopTypes: types.length,
          byLevel,
          brands: brands.length,
          models: models.length,
          categoryBrands,
          categoryModels,
          typesNoBrand,
          typesNoAttr,
          phoneTypesNoModel: phoneTypesNoModel.slice(0, 20),
          phoneTypesNoModelCount: phoneTypesNoModel.length,
          brandsNoCat: brandsNoCat.length,
          brandsNoCatSample: brandsNoCat.slice(0, 10).map((b) => b.name),
          modelsNoCat: modelsNoCat.length,
          orphanParents: orphanParents.length,
          dupCategorySlugs: dupSlugs,
          dupBrandSlugs: brandSlugDup,
          dupAttrs,
          renkCount: renk.length,
          modelsWithoutBrandLink,
          orphanModels: orphanModels.length,
          samsungCount: samsung.length,
          samsung: samsung.map((s) => s.slug),
        },
        sampleTree: sampleTree
          ? {
              slug: sampleTree.slug,
              parent: sampleTree.parent?.slug,
              level: sampleTree.level,
              children: sampleTree.children,
            }
          : null,
        samples,
        surahi,
        mutfak,
        erkekTisort,
      },
      null,
      2
    )
  );

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
