/**
 * Örnek katalog ürünleri: iPhone, tişört, Brita filtreli sürahi.
 * Admin ürünleri — satıcı oluşturmaz.
 *
 * npx tsx scripts/seed-catalog-sample-products.ts
 */
import { PrismaClient } from "@prisma/client";
import { buildAttributesHash } from "../src/lib/catalogCommerce";
import { catalogSlugify } from "../src/lib/catalogSlug";

const prisma = new PrismaClient();

async function findLeaf(slugIncludes: string) {
  const rows = await prisma.category.findMany({
    where: {
      deletedAt: null,
      slug: { contains: slugIncludes },
      OR: [{ children: { none: {} } }, { level: { gte: 3 } }],
    },
    orderBy: { level: "desc" },
    take: 20,
  });
  return rows.find((r) => r.slug.includes("sifir") || r.slug.includes("ikinci")) || rows[0] || null;
}

async function ensureProduct(opts: {
  categoryId: string;
  brandId?: string | null;
  modelId?: string | null;
  name: string;
  barcode?: string;
  variants: Array<{ title: string; sku: string; values?: Array<{ attributeId: string; optionId?: string; textValue?: string }> }>;
}) {
  const slugBase = catalogSlugify(opts.name) || `urun-${Date.now()}`;
  let product = await prisma.product.findFirst({
    where: { categoryId: opts.categoryId, slug: slugBase, deletedAt: null },
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        categoryId: opts.categoryId,
        brandId: opts.brandId || null,
        modelId: opts.modelId || null,
        name: opts.name,
        slug: slugBase,
        barcode: opts.barcode || null,
        status: "ACTIVE",
        managedByAdmin: true,
      },
    });
  }

  for (const v of opts.variants) {
    const hash = buildAttributesHash(v.values || []);
    const exists = await prisma.productVariant.findFirst({
      where: {
        productId: product.id,
        OR: [{ sku: v.sku }, { attributesHash: hash }],
        deletedAt: null,
      },
    });
    if (exists) continue;
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        title: v.title,
        sku: v.sku,
        attributesHash: hash,
        isActive: true,
      },
    });
    for (const val of v.values || []) {
      await prisma.productVariantValue.create({
        data: {
          variantId: variant.id,
          attributeId: val.attributeId,
          optionId: val.optionId || null,
          textValue: val.textValue || null,
        },
      });
    }
  }

  return product;
}

async function main() {
  const phoneCat =
    (await findLeaf("cep-telefonu")) ||
    (await prisma.category.findFirst({ where: { slug: { contains: "telefon" }, deletedAt: null } }));
  const teeCat =
    (await findLeaf("tisort")) ||
    (await prisma.category.findFirst({ where: { slug: { contains: "tisort" }, deletedAt: null } }));
  const britaCat =
    (await findLeaf("filtreli-surahi")) ||
    (await prisma.category.findFirst({ where: { slug: { contains: "filtreli" }, deletedAt: null } }));

  const apple = await prisma.brand.findFirst({ where: { slug: "apple" } });
  const brita = await prisma.brand.findFirst({ where: { slug: "brita" } });
  const iphoneModel = apple
    ? await prisma.productModel.findFirst({
        where: { brandId: apple.id, OR: [{ name: { contains: "iPhone 14", mode: "insensitive" } }, { slug: { contains: "iphone-14" } }] },
      })
    : null;

  const report: Record<string, string> = {};

  if (phoneCat) {
    const depolama = await prisma.categoryAttribute.findFirst({
      where: { categoryId: phoneCat.id, attribute: { slug: "depolama" } },
      include: { attribute: { include: { options: true } } },
    });
    const renk = await prisma.categoryAttribute.findFirst({
      where: { categoryId: phoneCat.id, attribute: { slug: { in: ["renk", "color"] } } },
      include: { attribute: { include: { options: true } } },
    });
    const opt256 = depolama?.attribute.options.find((o) => /256/i.test(o.label) || /256/i.test(o.value));
    const opt128 = depolama?.attribute.options.find((o) => /128/i.test(o.label) || /128/i.test(o.value));
    const colorOpt = renk?.attribute.options[0];

    const p = await ensureProduct({
      categoryId: phoneCat.id,
      brandId: apple?.id,
      modelId: iphoneModel?.id,
      name: "Apple iPhone 14 Pro 256 GB",
      barcode: "0194253409063",
      variants: [
        {
          title: "256 GB",
          sku: "IPH14PRO-256",
          values: depolama && opt256
            ? [{ attributeId: depolama.attributeId, optionId: opt256.id }]
            : depolama
              ? [{ attributeId: depolama.attributeId, textValue: "256 GB" }]
              : [],
        },
        {
          title: "128 GB",
          sku: "IPH14PRO-128",
          values: depolama && opt128
            ? [{ attributeId: depolama.attributeId, optionId: opt128.id }]
            : depolama
              ? [{ attributeId: depolama.attributeId, textValue: "128 GB" }]
              : colorOpt && renk
                ? [{ attributeId: renk.attributeId, optionId: colorOpt.id }]
                : [],
        },
      ],
    });
    report.iphone = p.id;
  } else {
    report.iphone = "SKIP: kategori yok";
  }

  if (teeCat) {
    const beden = await prisma.categoryAttribute.findFirst({
      where: { categoryId: teeCat.id, attribute: { slug: { in: ["beden", "size"] } } },
      include: { attribute: { include: { options: true } } },
    });
    const opts = beden?.attribute.options || [];
    const p = await ensureProduct({
      categoryId: teeCat.id,
      name: "Basic Pamuklu Erkek Tişört",
      barcode: "TEE-BASIC-001",
      variants: ["S", "M", "L"].map((size) => {
        const opt = opts.find((o) => o.label.toUpperCase() === size || o.value.toUpperCase() === size);
        return {
          title: `Beden ${size}`,
          sku: `TEE-BASIC-${size}`,
          values:
            beden && opt
              ? [{ attributeId: beden.attributeId, optionId: opt.id }]
              : beden
                ? [{ attributeId: beden.attributeId, textValue: size }]
                : [],
        };
      }),
    });
    report.tisort = p.id;
  } else {
    report.tisort = "SKIP: kategori yok";
  }

  if (britaCat) {
    const p = await ensureProduct({
      categoryId: britaCat.id,
      brandId: brita?.id,
      name: "Brita Marella Filtreli Sürahi 2.4 L",
      barcode: "4006387074403",
      variants: [
        { title: "Standart", sku: "BRITA-MARELLA-24", values: [] },
      ],
    });
    report.brita = p.id;
  } else {
    report.brita = "SKIP: kategori yok";
  }

  console.log(JSON.stringify({ ok: true, report }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
