/**
 * Tam katalog seed: alt kategori (ürün tipi) + model + özellik/varyant.
 * Mevcut Listing / ikinci-el-* leaf'leri bozmaz; altına children ekler.
 *
 * npx tsx scripts/seed-catalog-full.ts
 */
import { PrismaClient, AttributeType } from "@prisma/client";
import { SHOP_BROWSE_CHILDREN, SHOP_PHONE_MODELS, type ShopChildDef } from "../src/data/shopBrowseChildren";
import { SHOP_SUBCATEGORIES } from "../src/data/shopCategories";
import { catalogSlugify } from "../src/lib/catalogSlug";

const prisma = new PrismaClient();

/** ChatGPT listelerinden ek yapraklar (mevcut tip yoksa eklenir) */
const EXTRA_TYPES: Record<string, Array<[string, string]>> = {
  "cep-telefonu": [
    ["yenilenmis-telefon", "Yenilenmiş Telefon"],
    ["akilli-bileklik", "Akıllı Bileklik"],
    ["telefon-kilifi", "Telefon Kılıfı"],
    ["ekran-koruyucu", "Ekran Koruyucu"],
    ["sarj-cihazi", "Şarj Cihazı"],
    ["sarj-kablosu", "Şarj Kablosu"],
    ["arac-telefon-aksesuari", "Araç Telefon Aksesuarı"],
    ["telefon-yedek-parca", "Telefon Yedek Parçası"],
  ],
  bilgisayar: [
    ["all-in-one", "All-in-One Bilgisayar"],
    ["grafik-tablet", "Grafik Tablet"],
    ["webcam", "Webcam"],
    ["tarayici", "Tarayıcı"],
  ],
  "beyaz-esya": [
    ["tek-kapili", "Tek Kapılı Buzdolabı"],
    ["cift-kapili", "Çift Kapılı Buzdolabı"],
    ["no-frost", "No Frost"],
    ["gardırop-tipi", "Gardırop Tipi"],
    ["mini-buzdolabi", "Mini Buzdolabı"],
    ["ankastre-buzdolabi", "Ankastre Buzdolabı"],
    ["camasir-kurutma", "Çamaşır ve Kurutma Makinesi"],
    ["derin-dondurucu", "Derin Dondurucu"],
    ["aspirator", "Aspiratör"],
    ["ankastre-set", "Ankastre Set"],
  ],
  "elektrikli-ev-aletleri": [
    ["airfryer", "Airfryer"],
    ["robot-supurge", "Robot Süpürge"],
    ["turk-kahvesi", "Türk Kahvesi Makinesi"],
    ["espresso", "Espresso Makinesi"],
  ],
  "giyim-aksesuar": [
    ["tisort", "Tişört"],
    ["gomlek", "Gömlek"],
    ["jean", "Jean"],
    ["kazak", "Kazak"],
  ],
};

type AttrSeed = {
  slug: string;
  name: string;
  type: AttributeType;
  options?: Array<[string, string, string?]>; // value, label, color?
  /** hangi shop sub slug'lara bağlanır */
  subs: string[];
  required?: boolean;
  filterable?: boolean;
  formVisible?: boolean;
  detailVisible?: boolean;
  comparisonVisible?: boolean;
  searchable?: boolean;
  isVariant?: boolean;
  unit?: string;
};

const ATTRIBUTES: AttrSeed[] = [
  {
    slug: "depolama",
    name: "Depolama",
    type: "SINGLE_SELECT",
    options: [
      ["64-gb", "64 GB"],
      ["128-gb", "128 GB"],
      ["256-gb", "256 GB"],
      ["512-gb", "512 GB"],
      ["1-tb", "1 TB"],
    ],
    subs: ["cep-telefonu", "tablet", "bilgisayar"],
    required: true,
    filterable: true,
    isVariant: true,
    searchable: true,
    comparisonVisible: true,
  },
  {
    slug: "ram",
    name: "RAM",
    type: "SINGLE_SELECT",
    options: [
      ["4-gb", "4 GB"],
      ["6-gb", "6 GB"],
      ["8-gb", "8 GB"],
      ["12-gb", "12 GB"],
      ["16-gb", "16 GB"],
      ["32-gb", "32 GB"],
    ],
    subs: ["cep-telefonu", "bilgisayar", "tablet"],
    filterable: true,
    comparisonVisible: true,
  },
  {
    slug: "renk",
    name: "Renk",
    type: "COLOR",
    options: [
      ["siyah", "Siyah", "#111111"],
      ["beyaz", "Beyaz", "#f5f5f5"],
      ["gri", "Gri", "#9ca3af"],
      ["mavi", "Mavi", "#2563eb"],
      ["kirmizi", "Kırmızı", "#dc2626"],
      ["yesil", "Yeşil", "#16a34a"],
      ["altin", "Altın", "#d4af37"],
      ["mor", "Mor", "#7c3aed"],
      ["pembe", "Pembe", "#ec4899"],
      ["diger", "Diğer"],
    ],
    subs: [
      "cep-telefonu",
      "tablet",
      "giyim-aksesuar",
      "ayakkabi-canta",
      "beyaz-esya",
      "elektrikli-ev-aletleri",
      "tv-goruntu-ses",
    ],
    filterable: true,
    isVariant: true,
    formVisible: true,
  },
  {
    slug: "garanti",
    name: "Garanti",
    type: "SINGLE_SELECT",
    options: [
      ["yok", "Garantisiz"],
      ["1-ay", "1 Ay"],
      ["3-ay", "3 Ay"],
      ["6-ay", "6 Ay"],
      ["12-ay", "12 Ay"],
      ["24-ay", "24 Ay"],
    ],
    subs: [
      "cep-telefonu",
      "bilgisayar",
      "tablet",
      "beyaz-esya",
      "elektrikli-ev-aletleri",
      "tv-goruntu-ses",
      "oyun-konsol",
      "fotograf-kamera",
    ],
    filterable: true,
  },
  {
    slug: "isletim-sistemi",
    name: "İşletim Sistemi",
    type: "SINGLE_SELECT",
    options: [
      ["ios", "iOS"],
      ["android", "Android"],
      ["harmonyos", "HarmonyOS"],
      ["windows", "Windows"],
      ["macos", "macOS"],
      ["diger", "Diğer"],
    ],
    subs: ["cep-telefonu", "tablet", "bilgisayar"],
    filterable: true,
    comparisonVisible: true,
  },
  {
    slug: "sim",
    name: "SIM Özelliği",
    type: "SINGLE_SELECT",
    options: [
      ["tek-sim", "Tek SIM"],
      ["cift-sim", "Çift SIM"],
      ["esim", "eSIM"],
      ["cift-sim-esim", "Çift SIM + eSIM"],
    ],
    subs: ["cep-telefonu"],
    filterable: true,
  },
  {
    slug: "cinsiyet",
    name: "Cinsiyet",
    type: "SINGLE_SELECT",
    options: [
      ["kadin", "Kadın"],
      ["erkek", "Erkek"],
      ["unisex", "Unisex"],
      ["cocuk", "Çocuk"],
    ],
    subs: ["giyim-aksesuar", "ayakkabi-canta", "saat-taki"],
    required: true,
    filterable: true,
  },
  {
    slug: "beden",
    name: "Beden",
    type: "SINGLE_SELECT",
    options: [
      ["xxs", "XXS"],
      ["xs", "XS"],
      ["s", "S"],
      ["m", "M"],
      ["l", "L"],
      ["xl", "XL"],
      ["xxl", "XXL"],
      ["3xl", "3XL"],
    ],
    subs: ["giyim-aksesuar"],
    required: true,
    filterable: true,
    isVariant: true,
  },
  {
    slug: "ayakkabi-numara",
    name: "Numara",
    type: "SINGLE_SELECT",
    options: Array.from({ length: 15 }, (_, i) => {
      const n = 35 + i;
      return [`${n}`, String(n)] as [string, string];
    }),
    subs: ["ayakkabi-canta"],
    filterable: true,
    isVariant: true,
  },
  {
    slug: "kalip",
    name: "Kalıp",
    type: "SINGLE_SELECT",
    options: [
      ["regular", "Regular"],
      ["slim", "Slim"],
      ["oversized", "Oversized"],
      ["relaxed", "Relaxed"],
    ],
    subs: ["giyim-aksesuar"],
    filterable: true,
  },
  {
    slug: "kumas",
    name: "Kumaş",
    type: "SINGLE_SELECT",
    options: [
      ["pamuk", "Pamuk"],
      ["polyester", "Polyester"],
      ["keten", "Keten"],
      ["denim", "Denim"],
      ["yün", "Yün"],
      ["deri", "Deri"],
      ["diger", "Diğer"],
    ],
    subs: ["giyim-aksesuar"],
    filterable: true,
  },
  {
    slug: "yaka-tipi",
    name: "Yaka Tipi",
    type: "SINGLE_SELECT",
    options: [
      ["bisiklet", "Bisiklet Yaka"],
      ["v-yaka", "V Yaka"],
      ["gomlek-yaka", "Gömlek Yaka"],
      ["hakim", "Hakim Yaka"],
    ],
    subs: ["giyim-aksesuar"],
    filterable: true,
  },
  {
    slug: "kol-tipi",
    name: "Kol Tipi",
    type: "SINGLE_SELECT",
    options: [
      ["kisa", "Kısa Kol"],
      ["uzun", "Uzun Kol"],
      ["kolsuz", "Kolsuz"],
    ],
    subs: ["giyim-aksesuar"],
    filterable: true,
  },
  {
    slug: "hacim",
    name: "Hacim",
    type: "SINGLE_SELECT",
    options: [
      ["100-lt", "100 L altı"],
      ["100-200", "100–200 L"],
      ["200-300", "200–300 L"],
      ["300-400", "300–400 L"],
      ["400-500", "400–500 L"],
      ["500-plus", "500 L üstü"],
    ],
    subs: ["beyaz-esya"],
    filterable: true,
    comparisonVisible: true,
    unit: "L",
  },
  {
    slug: "enerji-sinifi",
    name: "Enerji Sınıfı",
    type: "SINGLE_SELECT",
    options: [
      ["a", "A"],
      ["b", "B"],
      ["c", "C"],
      ["d", "D"],
      ["e", "E"],
      ["f", "F"],
      ["g", "G"],
    ],
    subs: ["beyaz-esya", "elektrikli-ev-aletleri"],
    filterable: true,
    comparisonVisible: true,
  },
  {
    slug: "kapi-tipi",
    name: "Kapı Tipi",
    type: "SINGLE_SELECT",
    options: [
      ["tek", "Tek Kapı"],
      ["cift", "Çift Kapı"],
      ["french", "French Door"],
      ["side-by-side", "Side by Side"],
    ],
    subs: ["beyaz-esya"],
    filterable: true,
  },
  {
    slug: "no-frost",
    name: "No Frost",
    type: "BOOLEAN",
    subs: ["beyaz-esya"],
    filterable: true,
    comparisonVisible: true,
  },
  {
    slug: "olculer",
    name: "Ölçüler",
    type: "TEXT",
    subs: ["beyaz-esya", "ev-dekorasyon"],
    formVisible: true,
    detailVisible: true,
    unit: "cm",
  },
  {
    slug: "urun-durumu",
    name: "Ürün Durumu",
    type: "SINGLE_SELECT",
    options: [
      ["sifir", "Sıfır"],
      ["ikinci-el", "İkinci El"],
      ["yenilenmis", "Yenilenmiş"],
    ],
    subs: SHOP_SUBCATEGORIES.map((s) => s.slug),
    required: true,
    filterable: true,
    formVisible: true,
  },
];

function collectTypes(defs: ShopChildDef[]): Array<{ slug: string; name: string }> {
  const out: Array<{ slug: string; name: string }> = [];
  for (const d of defs) {
    if (d.subtype) out.push({ slug: d.slug, name: d.name });
  }
  return out;
}

async function upsertCategoryChild(parent: {
  id: string;
  slug: string;
  path: string | null;
  level: number;
  icon: string | null;
}, childSlug: string, childName: string, sortOrder: number) {
  const slug = `${parent.slug}__${childSlug}`;
  const path = `${parent.path || parent.slug}/${childSlug}`;
  return prisma.category.upsert({
    where: { slug },
    create: {
      slug,
      name: childName,
      icon: parent.icon,
      sortOrder,
      isActive: true,
      parentId: parent.id,
      level: parent.level + 1,
      path,
      isPremium: false,
    },
    update: {
      name: childName,
      parentId: parent.id,
      level: parent.level + 1,
      path,
      isActive: true,
      deletedAt: null,
      sortOrder,
    },
  });
}

async function main() {
  console.log("=== 1) Alt kategoriler (ürün tipleri) ===");
  let typeCount = 0;
  const typeCatsByKey = new Map<string, string>(); // `${root}|${sub}|${type}` -> categoryId

  for (const sub of SHOP_SUBCATEGORIES) {
    const fromTree = collectTypes(SHOP_BROWSE_CHILDREN[sub.slug] || []);
    const extras = (EXTRA_TYPES[sub.slug] || []).map(([slug, name]) => ({ slug, name }));
    const merged = new Map<string, string>();
    for (const t of [...fromTree, ...extras]) merged.set(catalogSlugify(t.slug) || t.slug, t.name);

    for (const root of ["ikinci-el", "sifir-urun"] as const) {
      const parentSlug = `${root}-${sub.slug}`;
      const parent = await prisma.category.findUnique({ where: { slug: parentSlug } });
      if (!parent) {
        console.warn("missing parent", parentSlug);
        continue;
      }
      // ensure parent path/level
      if (parent.level === 0 && parent.parentId) {
        await prisma.category.update({
          where: { id: parent.id },
          data: { level: 1, path: `${root}/${sub.slug}` },
        });
        parent.level = 1;
        parent.path = `${root}/${sub.slug}`;
      } else if (!parent.path) {
        await prisma.category.update({
          where: { id: parent.id },
          data: { path: `${root}/${sub.slug}`, level: parent.parentId ? 1 : 0 },
        });
        parent.path = `${root}/${sub.slug}`;
        parent.level = parent.parentId ? 1 : 0;
      }

      let i = 0;
      for (const [typeSlug, typeName] of merged) {
        const child = await upsertCategoryChild(parent, typeSlug, typeName, i++);
        typeCatsByKey.set(`${root}|${sub.slug}|${typeSlug}`, child.id);
        typeCount++;
      }
    }
  }
  console.log("type_categories_upserted", typeCount);

  console.log("=== 2) Markaları alt tiplere de bağla (parent markalarından) ===");
  let brandChildLinks = 0;
  for (const sub of SHOP_SUBCATEGORIES) {
    for (const root of ["ikinci-el", "sifir-urun"] as const) {
      const parentSlug = `${root}-${sub.slug}`;
      const parent = await prisma.category.findUnique({ where: { slug: parentSlug }, select: { id: true } });
      if (!parent) continue;
      const parentBrands = await prisma.categoryBrand.findMany({ where: { categoryId: parent.id } });
      const children = await prisma.category.findMany({
        where: { parentId: parent.id, deletedAt: null },
        select: { id: true },
      });
      for (const child of children) {
        for (const pb of parentBrands) {
          await prisma.categoryBrand.upsert({
            where: { categoryId_brandId: { categoryId: child.id, brandId: pb.brandId } },
            create: {
              categoryId: child.id,
              brandId: pb.brandId,
              sortOrder: pb.sortOrder,
              isFeatured: pb.isFeatured,
            },
            update: { sortOrder: pb.sortOrder, isFeatured: pb.isFeatured },
          });
          brandChildLinks++;
        }
      }
    }
  }
  console.log("brand_links_on_types", brandChildLinks);

  console.log("=== 3) Telefon modelleri ===");
  let modelCount = 0;
  let modelLinks = 0;
  for (const [brandName, models] of Object.entries(SHOP_PHONE_MODELS)) {
    if (brandName === "Diğer" || brandName === "Other") continue;
    const brandSlug = catalogSlugify(brandName);
    let brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
    if (!brand) {
      brand = await prisma.brand.findFirst({
        where: { name: { equals: brandName, mode: "insensitive" }, deletedAt: null },
      });
    }
    if (!brand) {
      brand = await prisma.brand.create({
        data: { name: brandName, slug: brandSlug || `brand-${Date.now()}`, isActive: true },
      });
    }

    let mi = 0;
    for (const modelName of models) {
      if (modelName === "Diğer") continue;
      const modelSlug = catalogSlugify(modelName);
      const model = await prisma.productModel.upsert({
        where: { brandId_slug: { brandId: brand.id, slug: modelSlug } },
        create: {
          brandId: brand.id,
          name: modelName,
          slug: modelSlug,
          sortOrder: mi++,
          isActive: true,
        },
        update: { name: modelName, isActive: true, deletedAt: null, sortOrder: mi - 1 },
      });
      modelCount++;

      // bağla: cep telefonu leaf + akıllı telefon tipi
      for (const root of ["ikinci-el", "sifir-urun"] as const) {
        const targets = [
          `${root}-cep-telefonu`,
          `${root}-cep-telefonu__akilli-telefon`,
        ];
        for (const slug of targets) {
          const cat = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
          if (!cat) continue;
          await prisma.categoryModel.upsert({
            where: { categoryId_modelId: { categoryId: cat.id, modelId: model.id } },
            create: { categoryId: cat.id, modelId: model.id, sortOrder: model.sortOrder },
            update: { sortOrder: model.sortOrder },
          });
          modelLinks++;
        }
      }
    }
  }
  console.log("models", modelCount, "model_links", modelLinks);

  console.log("=== 4) Özellik + seçenek + kategori bağları (varyant bayrakları) ===");
  let attrCount = 0;
  let optCount = 0;
  let catAttrCount = 0;

  for (const a of ATTRIBUTES) {
    const attr = await prisma.attribute.upsert({
      where: { slug: a.slug },
      create: {
        slug: a.slug,
        name: a.name,
        type: a.type,
        isActive: true,
      },
      update: {
        name: a.name,
        type: a.type,
        isActive: true,
        deletedAt: null,
      },
    });
    attrCount++;

    if (a.options?.length) {
      let oi = 0;
      for (const [value, label, colorCode] of a.options) {
        await prisma.attributeOption.upsert({
          where: { attributeId_value: { attributeId: attr.id, value } },
          create: {
            attributeId: attr.id,
            value,
            label,
            colorCode: colorCode || null,
            sortOrder: oi++,
            isActive: true,
          },
          update: {
            label,
            colorCode: colorCode || null,
            sortOrder: oi - 1,
            isActive: true,
          },
        });
        optCount++;
      }
    }

    for (const sub of a.subs) {
      for (const root of ["ikinci-el", "sifir-urun"] as const) {
        const parentSlug = `${root}-${sub}`;
        const cats = await prisma.category.findMany({
          where: {
            deletedAt: null,
            OR: [{ slug: parentSlug }, { slug: { startsWith: `${parentSlug}__` } }],
          },
          select: { id: true },
        });
        for (const cat of cats) {
          await prisma.categoryAttribute.upsert({
            where: {
              categoryId_attributeId: { categoryId: cat.id, attributeId: attr.id },
            },
            create: {
              categoryId: cat.id,
              attributeId: attr.id,
              required: Boolean(a.required),
              filterable: a.filterable !== false,
              formVisible: a.formVisible !== false,
              detailVisible: a.detailVisible !== false,
              comparisonVisible: Boolean(a.comparisonVisible),
              searchable: Boolean(a.searchable),
              isVariant: Boolean(a.isVariant),
              unit: a.unit || null,
              sortOrder: 0,
            },
            update: {
              required: Boolean(a.required),
              filterable: a.filterable !== false,
              formVisible: a.formVisible !== false,
              detailVisible: a.detailVisible !== false,
              comparisonVisible: Boolean(a.comparisonVisible),
              searchable: Boolean(a.searchable),
              isVariant: Boolean(a.isVariant),
              unit: a.unit || null,
            },
          });
          catAttrCount++;
        }
      }
    }
  }
  console.log({ attrCount, optCount, catAttrCount });

  const summary = {
    categories: await prisma.category.count({ where: { deletedAt: null } }),
    brands: await prisma.brand.count({ where: { deletedAt: null } }),
    models: await prisma.productModel.count({ where: { deletedAt: null } }),
    attributes: await prisma.attribute.count({ where: { deletedAt: null } }),
    options: await prisma.attributeOption.count(),
    categoryBrands: await prisma.categoryBrand.count(),
    categoryModels: await prisma.categoryModel.count(),
    categoryAttributes: await prisma.categoryAttribute.count(),
  };
  console.log("=== SUMMARY ===", summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
