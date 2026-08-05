/**
 * A–E catalog flow tests after tree v2 seed.
 * npx tsx scripts/test-catalog-flows.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FLOWS = [
  {
    id: "A",
    title: "Elektronik > Telefon ve Aksesuar > Cep Telefonu > Akıllı Telefon",
    slugs: [
      "ikinci-el__elektronik",
      "ikinci-el__elektronik__telefon-ve-aksesuar",
      "ikinci-el-cep-telefonu",
      "ikinci-el-cep-telefonu__akilli-telefon",
    ],
    leaf: "ikinci-el-cep-telefonu__akilli-telefon",
  },
  {
    id: "B",
    title: "Ev Aletleri > Beyaz Eşya > Buzdolabı",
    slugs: [
      "ikinci-el__ev-aletleri",
      "ikinci-el__ev-aletleri__beyaz-esya",
      "ikinci-el-beyaz-esya",
      "ikinci-el-beyaz-esya__buzdolabi",
    ],
    leaf: "ikinci-el-beyaz-esya__buzdolabi",
  },
  {
    id: "C",
    title: "Moda > Erkek > Tişört",
    slugs: ["ikinci-el__moda", "ikinci-el__moda__erkek", "ikinci-el__moda__erkek__tisort"],
    leaf: "ikinci-el__moda__erkek__tisort",
  },
  {
    id: "D",
    title: "Spor ve Outdoor > Bisiklet",
    slugs: [
      "ikinci-el__spor-outdoor",
      "ikinci-el__spor-outdoor__bisiklet",
      "ikinci-el__spor-outdoor__bisiklet__bisiklet",
    ],
    leaf: "ikinci-el__spor-outdoor__bisiklet__bisiklet",
  },
  {
    id: "E",
    title: "Mutfak ve Sofra > Su Arıtma > Filtreli Sürahi",
    slugs: [
      "ikinci-el__mutfak-ve-sofra",
      "ikinci-el__mutfak-ve-sofra__su-aritma",
      "ikinci-el__mutfak-ve-sofra__su-aritma__filtreli-surahi",
    ],
    leaf: "ikinci-el__mutfak-ve-sofra__su-aritma__filtreli-surahi",
  },
];

async function chain(id) {
  const out = [];
  let cur = id;
  const guard = new Set();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const c = await prisma.category.findUnique({
      where: { id: cur },
      select: { id: true, slug: true, name: true, parentId: true, path: true, level: true, modelMode: true },
    });
    if (!c) break;
    out.unshift(c);
    cur = c.parentId;
  }
  return out;
}

async function resolveBrands(categoryId) {
  const links = await prisma.categoryBrand.findMany({
    where: { categoryId, brand: { deletedAt: null, isActive: true } },
    include: { brand: true },
    orderBy: { sortOrder: "asc" },
  });
  return links.map((l) => l.brand.name);
}

async function runFlow(flow) {
  const missing = [];
  for (const s of flow.slugs) {
    const c = await prisma.category.findUnique({ where: { slug: s } });
    if (!c) missing.push(s);
  }
  const leaf = await prisma.category.findUnique({ where: { slug: flow.leaf } });
  if (!leaf) {
    return { id: flow.id, title: flow.title, ok: false, missing, error: "leaf missing" };
  }
  const parents = await chain(leaf.id);
  const brands = await resolveBrands(leaf.id);
  let models = await prisma.categoryModel.findMany({
    where: { categoryId: leaf.id, model: { deletedAt: null } },
    include: { model: { include: { brand: true } } },
    take: 20,
  });
  if (!models.length && leaf.parentId) {
    models = await prisma.categoryModel.findMany({
      where: { categoryId: leaf.parentId, model: { deletedAt: null } },
      include: { model: { include: { brand: true } } },
      take: 20,
    });
  }
  let attrs = await prisma.categoryAttribute.findMany({
    where: { categoryId: leaf.id, attribute: { deletedAt: null } },
    include: { attribute: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!attrs.length && leaf.parentId) {
    attrs = await prisma.categoryAttribute.findMany({
      where: { categoryId: leaf.parentId, attribute: { deletedAt: null } },
      include: { attribute: true },
      orderBy: { sortOrder: "asc" },
    });
  }
  const hasNike = brands.some((b) => /nike|adidas/i.test(b));
  return {
    id: flow.id,
    title: flow.title,
    ok: missing.length === 0,
    missing,
    path: leaf.path,
    modelMode: leaf.modelMode,
    parentChain: parents.map((p) => `${p.name} (${p.slug})`),
    brands: brands.slice(0, 25),
    brandCount: brands.length,
    hasNikeAdidas: hasNike,
    models: models.slice(0, 15).map((m) => `${m.model.brand.name} / ${m.model.name}`),
    attributes: attrs.map((a) => a.attribute.name),
    variants: attrs.filter((a) => a.isVariant).map((a) => a.attribute.name),
  };
}

async function main() {
  const results = [];
  for (const f of FLOWS) results.push(await runFlow(f));
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
