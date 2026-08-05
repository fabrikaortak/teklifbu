/**
 * Catalog tree v2 seed:
 * - 4-layer parents under ikinci-el + sifir-urun
 * - Reparent existing leaves (no delete)
 * - Mutfak ve Sofra + Filtreli Sürahi attrs + Brita
 * - Bike brands OVERRIDE
 * - modelMode flags
 * - Transaction per root / group
 * - JSON report
 *
 * npx tsx scripts/seed-catalog-tree-v2.ts
 */
import { PrismaClient, type CatalogModelMode, type AttributeType } from "@prisma/client";
import fs from "fs";
import path from "path";
import { catalogSlugify } from "../src/lib/catalogSlug";

const prisma = new PrismaClient();

type Report = {
  createdCategories: number;
  updatedCategories: number;
  movedCategories: number;
  createdBrands: number;
  categoryBrandLinks: number;
  createdModels: number;
  missingParents: string[];
  duplicateSlugs: string[];
  brandlessLeaves: string[];
  attributelessLeaves: string[];
  requiredWithoutModels: string[];
  transactionErrors: string[];
  skippedManagedBySeed: number;
};

const report: Report = {
  createdCategories: 0,
  updatedCategories: 0,
  movedCategories: 0,
  createdBrands: 0,
  categoryBrandLinks: 0,
  createdModels: 0,
  missingParents: [],
  duplicateSlugs: [],
  brandlessLeaves: [],
  attributelessLeaves: [],
  requiredWithoutModels: [],
  transactionErrors: [],
  skippedManagedBySeed: 0,
};

const ROOTS = ["ikinci-el", "sifir-urun"] as const;

/** Ana → Alt → mevcut leaf shop slug (reparent) */
type LeafAttach = {
  leafSub: string;
  modelMode?: CatalogModelMode;
  brandInheritanceMode?: "NONE" | "MERGE" | "OVERRIDE";
};

type AltNode = {
  slug: string;
  name: string;
  leaves?: LeafAttach[];
  /** son tipler (yeni, leaf altında değil — ara düğüm children) */
  types?: Array<{ slug: string; name: string; modelMode?: CatalogModelMode }>;
};

type AnaNode = {
  slug: string;
  name: string;
  alts: AltNode[];
};

const MEGA: AnaNode[] = [
  {
    slug: "elektronik",
    name: "Elektronik",
    alts: [
      {
        slug: "telefon-ve-aksesuar",
        name: "Telefon ve Aksesuar",
        leaves: [{ leafSub: "cep-telefonu", modelMode: "REQUIRED", brandInheritanceMode: "NONE" }],
      },
      {
        slug: "bilgisayar-ve-tablet",
        name: "Bilgisayar ve Tablet",
        leaves: [
          { leafSub: "bilgisayar", modelMode: "OPTIONAL" },
          { leafSub: "tablet", modelMode: "OPTIONAL" },
        ],
      },
      {
        slug: "tv-goruntu-ve-ses",
        name: "TV, Görüntü ve Ses",
        leaves: [{ leafSub: "tv-goruntu-ses", modelMode: "REQUIRED" }],
      },
      {
        slug: "fotograf-ve-kamera",
        name: "Fotoğraf ve Kamera",
        leaves: [{ leafSub: "fotograf-kamera", modelMode: "OPTIONAL" }],
      },
      {
        slug: "oyun-ve-konsol",
        name: "Oyun ve Konsol",
        leaves: [{ leafSub: "oyun-konsol", modelMode: "OPTIONAL" }],
      },
    ],
  },
  {
    slug: "ev-aletleri",
    name: "Ev Aletleri",
    alts: [
      {
        slug: "beyaz-esya",
        name: "Beyaz Eşya",
        leaves: [{ leafSub: "beyaz-esya", modelMode: "OPTIONAL", brandInheritanceMode: "NONE" }],
      },
      {
        slug: "kucuk-ev-aletleri",
        name: "Küçük Ev Aletleri",
        leaves: [{ leafSub: "elektrikli-ev-aletleri", modelMode: "OPTIONAL" }],
      },
    ],
  },
  {
    slug: "ev-ve-yasam",
    name: "Ev ve Yaşam",
    alts: [
      {
        slug: "ev-dekorasyon-mobilya",
        name: "Ev Dekorasyon & Mobilya",
        leaves: [{ leafSub: "ev-dekorasyon", modelMode: "DISABLED" }],
      },
    ],
  },
  {
    slug: "moda",
    name: "Moda",
    alts: [
      {
        slug: "erkek",
        name: "Erkek",
        types: [{ slug: "tisort", name: "Tişört", modelMode: "DISABLED" }],
      },
      {
        slug: "kadin",
        name: "Kadın",
        types: [{ slug: "tisort", name: "Tişört", modelMode: "DISABLED" }],
      },
      {
        slug: "giyim-aksesuar",
        name: "Giyim & Aksesuar",
        leaves: [{ leafSub: "giyim-aksesuar", modelMode: "DISABLED" }],
      },
    ],
  },
  {
    slug: "spor-outdoor",
    name: "Spor ve Outdoor",
    alts: [
      {
        slug: "bisiklet",
        name: "Bisiklet",
        types: [{ slug: "bisiklet", name: "Bisiklet", modelMode: "OPTIONAL" }],
      },
      {
        slug: "spor-urunleri",
        name: "Spor Ürünleri",
        leaves: [{ leafSub: "spor-outdoor", modelMode: "OPTIONAL", brandInheritanceMode: "NONE" }],
      },
    ],
  },
  {
    slug: "mutfak-ve-sofra",
    name: "Mutfak ve Sofra",
    alts: [
      { slug: "pisirme", name: "Pişirme" },
      { slug: "sofra-ve-servis", name: "Sofra ve Servis" },
      { slug: "saklama-ve-duzenleme", name: "Saklama ve Düzenleme" },
      { slug: "mutfak-gerecleri", name: "Mutfak Gereçleri" },
      { slug: "termos-ve-matara", name: "Termos ve Matara" },
      {
        slug: "su-aritma",
        name: "Su Arıtma",
        types: [
          { slug: "filtreli-surahi", name: "Filtreli Sürahi", modelMode: "OPTIONAL" },
          { slug: "su-aritma-cihazi", name: "Su Arıtma Cihazı", modelMode: "OPTIONAL" },
          { slug: "musluk-filtresi", name: "Musluk Filtresi", modelMode: "OPTIONAL" },
          { slug: "yedek-filtre", name: "Yedek Filtre", modelMode: "OPTIONAL" },
          { slug: "su-sebili", name: "Su Sebili", modelMode: "OPTIONAL" },
        ],
      },
    ],
  },
];

const BIKE_BRANDS: Array<[string, string]> = [
  ["bianchi", "Bianchi"],
  ["salcano", "Salcano"],
  ["kron", "Kron"],
  ["carraro", "Carraro"],
  ["corelli", "Corelli"],
  ["bisan", "Bisan"],
  ["phantom", "Phantom"],
  ["scott", "Scott"],
  ["trek", "Trek"],
  ["giant", "Giant"],
  ["cannondale", "Cannondale"],
  ["specialized", "Specialized"],
  ["merida", "Merida"],
  ["decathlon", "Decathlon"],
];

const MUTFAK_BRANDS: Array<[string, string]> = [
  ["karaca", "Karaca"],
  ["korkmaz", "Korkmaz"],
  ["schafer", "Schafer"],
  ["jumbo", "Jumbo"],
  ["emsan", "Emsan"],
  ["fissler", "Fissler"],
  ["wmf", "WMF"],
  ["tefal", "Tefal"],
  ["brita", "Brita"],
  ["pasabahce", "Paşabahçe"],
];

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function upsertCategory(
  tx: Tx,
  data: {
    slug: string;
    name: string;
    parentId: string | null;
    level: number;
    path: string;
    sortOrder?: number;
    modelMode?: CatalogModelMode;
    brandInheritanceMode?: "NONE" | "MERGE" | "OVERRIDE";
  }
) {
  const existing = await tx.category.findUnique({ where: { slug: data.slug } });
  if (existing && !existing.managedBySeed) {
    report.skippedManagedBySeed++;
    return existing;
  }
  if (existing) {
    const moved = existing.parentId !== data.parentId;
    const updated = await tx.category.update({
      where: { slug: data.slug },
      data: {
        name: data.name,
        parentId: data.parentId,
        level: data.level,
        path: data.path,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        isActive: true,
        deletedAt: null,
        ...(data.modelMode ? { modelMode: data.modelMode } : {}),
        ...(data.brandInheritanceMode ? { brandInheritanceMode: data.brandInheritanceMode } : {}),
        managedBySeed: true,
        source: "SYSTEM_SEED",
      },
    });
    report.updatedCategories++;
    if (moved) report.movedCategories++;
    return updated;
  }
  const created = await tx.category.create({
    data: {
      slug: data.slug,
      name: data.name,
      parentId: data.parentId,
      level: data.level,
      path: data.path,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
      modelMode: data.modelMode || "OPTIONAL",
      brandInheritanceMode: data.brandInheritanceMode || "NONE",
      managedBySeed: true,
      source: "SYSTEM_SEED",
    },
  });
  report.createdCategories++;
  return created;
}

async function ensureBrand(tx: Tx, slug: string, name: string) {
  const existing = await tx.brand.findUnique({ where: { slug } });
  if (existing) {
    if (!existing.managedBySeed) {
      report.skippedManagedBySeed++;
      return existing;
    }
    return existing;
  }
  const created = await tx.brand.create({
    data: {
      slug,
      name,
      isActive: true,
      managedBySeed: true,
      source: "SYSTEM_SEED",
    },
  });
  report.createdBrands++;
  return created;
}

async function linkBrand(tx: Tx, categoryId: string, brandId: string, sortOrder = 0) {
  await tx.categoryBrand.upsert({
    where: { categoryId_brandId: { categoryId, brandId } },
    create: { categoryId, brandId, sortOrder },
    update: { sortOrder },
  });
  report.categoryBrandLinks++;
}

async function ensureAttr(
  tx: Tx,
  slug: string,
  name: string,
  type: AttributeType,
  options?: Array<[string, string]>
) {
  let attr = await tx.attribute.findUnique({ where: { slug } });
  if (!attr) {
    attr = await tx.attribute.create({
      data: {
        slug,
        name,
        type,
        isActive: true,
        managedBySeed: true,
        source: "SYSTEM_SEED",
      },
    });
  } else if (attr.managedBySeed) {
    attr = await tx.attribute.update({
      where: { id: attr.id },
      data: { name, type, isActive: true, deletedAt: null },
    });
  }
  if (options?.length && attr.managedBySeed) {
    let i = 0;
    for (const [value, label] of options) {
      await tx.attributeOption.upsert({
        where: { attributeId_value: { attributeId: attr.id, value } },
        create: { attributeId: attr.id, value, label, sortOrder: i++ },
        update: { label, sortOrder: i - 1, isActive: true },
      });
    }
  }
  return attr;
}

async function linkAttr(
  tx: Tx,
  categoryId: string,
  attributeId: string,
  flags: { required?: boolean; filterable?: boolean; isVariant?: boolean; sortOrder?: number }
) {
  await tx.categoryAttribute.upsert({
    where: { categoryId_attributeId: { categoryId, attributeId } },
    create: {
      categoryId,
      attributeId,
      required: Boolean(flags.required),
      filterable: flags.filterable !== false,
      formVisible: true,
      detailVisible: true,
      isVariant: Boolean(flags.isVariant),
      sortOrder: flags.sortOrder ?? 0,
    },
    update: {
      required: Boolean(flags.required),
      filterable: flags.filterable !== false,
      isVariant: Boolean(flags.isVariant),
      sortOrder: flags.sortOrder ?? 0,
      formVisible: true,
    },
  });
}

function megaSlug(root: string, ...parts: string[]) {
  return [root, ...parts].join("__");
}

function leafSlug(root: string, sub: string) {
  return `${root}-${sub}`;
}

async function seedRootTree(root: (typeof ROOTS)[number]) {
  await prisma.$transaction(
    async (tx) => {
      const rootCat = await tx.category.findUnique({ where: { slug: root } });
      if (!rootCat) {
        report.missingParents.push(root);
        return;
      }
      await tx.category.update({
        where: { id: rootCat.id },
        data: { level: 0, path: root },
      });

      let anaOrder = 0;
      for (const ana of MEGA) {
        anaOrder++;
        const anaSlug = megaSlug(root, ana.slug);
        const anaCat = await upsertCategory(tx, {
          slug: anaSlug,
          name: ana.name,
          parentId: rootCat.id,
          level: 1,
          path: `${root}/${ana.slug}`,
          sortOrder: anaOrder,
        });

        let altOrder = 0;
        for (const alt of ana.alts) {
          altOrder++;
          const altSlug = megaSlug(root, ana.slug, alt.slug);
          const altCat = await upsertCategory(tx, {
            slug: altSlug,
            name: alt.name,
            parentId: anaCat.id,
            level: 2,
            path: `${root}/${ana.slug}/${alt.slug}`,
            sortOrder: altOrder,
          });

          if (alt.leaves) {
            let leafOrder = 0;
            for (const leaf of alt.leaves) {
              leafOrder++;
              const ls = leafSlug(root, leaf.leafSub);
              const existing = await tx.category.findUnique({ where: { slug: ls } });
              if (!existing) {
                report.missingParents.push(`missing leaf ${ls}`);
                continue;
              }
              await upsertCategory(tx, {
                slug: ls,
                name: existing.name,
                parentId: altCat.id,
                level: 3,
                path: `${root}/${ana.slug}/${alt.slug}/${leaf.leafSub}`,
                sortOrder: leafOrder,
                modelMode: leaf.modelMode,
                brandInheritanceMode: leaf.brandInheritanceMode || "NONE",
              });

              // Refresh children type paths/levels under leaf
              const kids = await tx.category.findMany({
                where: { parentId: existing.id, deletedAt: null },
              });
              for (const kid of kids) {
                if (!kid.managedBySeed) {
                  report.skippedManagedBySeed++;
                  continue;
                }
                const typePart = kid.slug.includes("__")
                  ? kid.slug.split("__").pop()!
                  : catalogSlugify(kid.name);
                await tx.category.update({
                  where: { id: kid.id },
                  data: {
                    level: 4,
                    path: `${root}/${ana.slug}/${alt.slug}/${leaf.leafSub}/${typePart}`,
                    brandInheritanceMode: "NONE",
                  },
                });
                report.updatedCategories++;
              }
            }
          }

          if (alt.types) {
            let tOrder = 0;
            for (const t of alt.types) {
              tOrder++;
              const tSlug = megaSlug(root, ana.slug, alt.slug, t.slug);
              await upsertCategory(tx, {
                slug: tSlug,
                name: t.name,
                parentId: altCat.id,
                level: 3,
                path: `${root}/${ana.slug}/${alt.slug}/${t.slug}`,
                sortOrder: tOrder,
                modelMode: t.modelMode || "OPTIONAL",
                brandInheritanceMode: "NONE",
              });
            }
          }
        }
      }

      // Phone types: set modelMode REQUIRED on akilli-telefon
      for (const typeSlug of [
        `${root}-cep-telefonu__akilli-telefon`,
        `${root}-cep-telefonu__cep-telefonu`,
      ]) {
        const t = await tx.category.findUnique({ where: { slug: typeSlug } });
        if (t?.managedBySeed) {
          await tx.category.update({
            where: { id: t.id },
            data: { modelMode: "REQUIRED", brandInheritanceMode: "NONE" },
          });
        }
      }

      // Buzdolabı optional
      const buz = await tx.category.findUnique({
        where: { slug: `${root}-beyaz-esya__buzdolabi` },
      });
      if (buz?.managedBySeed) {
        await tx.category.update({
          where: { id: buz.id },
          data: { modelMode: "OPTIONAL", brandInheritanceMode: "NONE" },
        });
      }

      // Existing tişört type under giyim — DISABLED
      const tisortOld = await tx.category.findUnique({
        where: { slug: `${root}-giyim-aksesuar__tisort` },
      });
      if (tisortOld?.managedBySeed) {
        await tx.category.update({
          where: { id: tisortOld.id },
          data: { modelMode: "DISABLED", brandInheritanceMode: "NONE" },
        });
      }

      // TV required
      const tv = await tx.category.findFirst({
        where: {
          OR: [
            { slug: `${root}-tv-goruntu-ses__televizyon` },
            { slug: { contains: `${root}-tv-goruntu-ses__tv` } },
          ],
        },
      });
      if (tv?.managedBySeed) {
        await tx.category.update({
          where: { id: tv.id },
          data: { modelMode: "REQUIRED" },
        });
      }
    },
    { timeout: 120_000 }
  );
}

async function seedBikeBrands(root: (typeof ROOTS)[number]) {
  await prisma.$transaction(async (tx) => {
    const bikeCat = await tx.category.findUnique({
      where: { slug: megaSlug(root, "spor-outdoor", "bisiklet", "bisiklet") },
    });
    if (!bikeCat) {
      report.missingParents.push(`bike ${root}`);
      return;
    }
    await tx.category.update({
      where: { id: bikeCat.id },
      data: { brandInheritanceMode: "NONE", modelMode: "OPTIONAL" },
    });
    // Remove clothing brands if any were linked
    const bad = await tx.brand.findMany({
      where: { slug: { in: ["nike", "adidas", "puma", "under-armour", "reebok"] } },
      select: { id: true },
    });
    if (bad.length) {
      await tx.categoryBrand.deleteMany({
        where: { categoryId: bikeCat.id, brandId: { in: bad.map((b) => b.id) } },
      });
    }
    // Also clean parent spor leaf bike types
    const sporLeaf = await tx.category.findUnique({ where: { slug: leafSlug(root, "spor-outdoor") } });
    if (sporLeaf) {
      const bikeTypes = await tx.category.findMany({
        where: {
          parentId: sporLeaf.id,
          OR: [{ slug: { contains: "bisiklet" } }, { name: { contains: "Bisiklet" } }],
        },
      });
      for (const bt of bikeTypes) {
        await tx.category.update({
          where: { id: bt.id },
          data: { brandInheritanceMode: "NONE", modelMode: "OPTIONAL" },
        });
        if (bad.length) {
          await tx.categoryBrand.deleteMany({
            where: { categoryId: bt.id, brandId: { in: bad.map((b) => b.id) } },
          });
        }
        let i = 0;
        for (const [slug, name] of BIKE_BRANDS) {
          const b = await ensureBrand(tx, slug, name);
          await linkBrand(tx, bt.id, b.id, i++);
        }
      }
    }
    let i = 0;
    for (const [slug, name] of BIKE_BRANDS) {
      const b = await ensureBrand(tx, slug, name);
      await linkBrand(tx, bikeCat.id, b.id, i++);
    }
  });
}

async function seedMutfak(root: (typeof ROOTS)[number]) {
  await prisma.$transaction(async (tx) => {
    const suArıtma = await tx.category.findUnique({
      where: { slug: megaSlug(root, "mutfak-ve-sofra", "su-aritma") },
    });
    if (!suArıtma) {
      report.missingParents.push(`su-aritma ${root}`);
      return;
    }

    const filtreli = await tx.category.findUnique({
      where: { slug: megaSlug(root, "mutfak-ve-sofra", "su-aritma", "filtreli-surahi") },
    });
    if (!filtreli) {
      report.missingParents.push(`filtreli-surahi ${root}`);
      return;
    }

    let i = 0;
    for (const [slug, name] of MUTFAK_BRANDS) {
      const b = await ensureBrand(tx, slug, name);
      await linkBrand(tx, suArıtma.id, b.id, i);
      await linkBrand(tx, filtreli.id, b.id, i);
      i++;
    }

    // Su arıtma children all get Brita at least
    const kids = await tx.category.findMany({ where: { parentId: suArıtma.id } });
    const brita = await ensureBrand(tx, "brita", "Brita");
    for (const k of kids) {
      await linkBrand(tx, k.id, brita.id, 0);
      await tx.category.update({
        where: { id: k.id },
        data: { brandInheritanceMode: "NONE", modelMode: k.modelMode },
      });
    }

    const kapasite = await ensureAttr(tx, "kapasite", "Kapasite", "SINGLE_SELECT", [
      ["1-5-l", "1.5 L"],
      ["2-l", "2 L"],
      ["2-5-l", "2.5 L"],
      ["3-l", "3 L"],
    ]);
    const filtreTipi = await ensureAttr(tx, "filtre-tipi", "Filtre Tipi", "SINGLE_SELECT", [
      ["standart", "Standart"],
      ["maxtra", "MAXTRA+"],
      ["aktif-karbon", "Aktif Karbon"],
    ]);
    const filtreAdedi = await ensureAttr(tx, "filtre-adedi", "Filtre Adedi", "SINGLE_SELECT", [
      ["1", "1"],
      ["2", "2"],
      ["3", "3"],
      ["4", "4"],
      ["6", "6"],
    ]);
    const malzeme = await ensureAttr(tx, "malzeme", "Malzeme", "SINGLE_SELECT", [
      ["plastik", "Plastik"],
      ["cam", "Cam"],
      ["tritan", "Tritan"],
    ]);
    const bulaşık = await ensureAttr(
      tx,
      "bulasik-makinesinde-yikanabilir",
      "Bulaşık Makinesinde Yıkanabilir",
      "BOOLEAN"
    );
    const filtreGosterge = await ensureAttr(
      tx,
      "filtre-degisim-gostergesi",
      "Filtre Değişim Göstergesi",
      "BOOLEAN"
    );
    const olculer = await ensureAttr(tx, "urun-olculeri", "Ürün Ölçüleri", "TEXT");
    const renk = await ensureAttr(tx, "renk", "Renk", "COLOR");
    const garanti = await ensureAttr(tx, "garanti", "Garanti", "SINGLE_SELECT", [
      ["yok", "Yok"],
      ["6-ay", "6 Ay"],
      ["1-yil", "1 Yıl"],
      ["2-yil", "2 Yıl"],
    ]);

    // Marka/Model are form fields, not CategoryAttribute usually — still skip creating fake attrs

    const attrs: Array<{
      attr: Awaited<ReturnType<typeof ensureAttr>>;
      flags: { required?: boolean; filterable?: boolean; isVariant?: boolean; sortOrder: number };
    }> = [
      { attr: kapasite, flags: { required: true, isVariant: true, sortOrder: 1 } },
      { attr: filtreTipi, flags: { filterable: true, sortOrder: 2 } },
      { attr: filtreAdedi, flags: { isVariant: true, sortOrder: 3 } },
      { attr: renk, flags: { isVariant: true, sortOrder: 4 } },
      { attr: malzeme, flags: { sortOrder: 5 } },
      { attr: bulaşık, flags: { sortOrder: 6 } },
      { attr: filtreGosterge, flags: { sortOrder: 7 } },
      { attr: olculer, flags: { sortOrder: 8 } },
      { attr: garanti, flags: { sortOrder: 9 } },
    ];

    for (const { attr, flags } of attrs) {
      await linkAttr(tx, filtreli.id, attr.id, flags);
    }
  });
}

async function setTisortLinks(root: (typeof ROOTS)[number]) {
  await prisma.$transaction(async (tx) => {
    // Copy fashion brands + attrs from old tişört if exists to new moda paths
    const old = await tx.category.findUnique({
      where: { slug: `${root}-giyim-aksesuar__tisort` },
    });
    const targets = [
      megaSlug(root, "moda", "erkek", "tisort"),
      megaSlug(root, "moda", "kadin", "tisort"),
    ];
    for (const slug of targets) {
      const t = await tx.category.findUnique({ where: { slug } });
      if (!t) continue;
      await tx.category.update({
        where: { id: t.id },
        data: { modelMode: "DISABLED", brandInheritanceMode: "NONE" },
      });
      if (old) {
        const brands = await tx.categoryBrand.findMany({ where: { categoryId: old.id } });
        for (const b of brands) {
          await linkBrand(tx, t.id, b.brandId, b.sortOrder);
        }
        // Prefer giyim leaf brands if type empty
        if (!brands.length) {
          const leaf = await tx.category.findUnique({
            where: { slug: leafSlug(root, "giyim-aksesuar") },
          });
          if (leaf) {
            const lb = await tx.categoryBrand.findMany({ where: { categoryId: leaf.id } });
            for (const b of lb) await linkBrand(tx, t.id, b.brandId, b.sortOrder);
          }
        }
        const attrs = await tx.categoryAttribute.findMany({ where: { categoryId: old.id } });
        for (const a of attrs) {
          await linkAttr(tx, t.id, a.attributeId, {
            required: a.required,
            filterable: a.filterable,
            isVariant: a.isVariant,
            sortOrder: a.sortOrder,
          });
        }
        if (!attrs.length) {
          const leaf = await tx.category.findUnique({
            where: { slug: leafSlug(root, "giyim-aksesuar") },
          });
          if (leaf) {
            const la = await tx.categoryAttribute.findMany({ where: { categoryId: leaf.id } });
            for (const a of la) {
              await linkAttr(tx, t.id, a.attributeId, {
                required: a.required,
                filterable: a.filterable,
                isVariant: a.isVariant,
                sortOrder: a.sortOrder,
              });
            }
          }
        }
      }
    }
  });
}

async function finalizeReport() {
  const leaves = await prisma.category.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { slug: { startsWith: "ikinci-el-" } },
        { slug: { startsWith: "sifir-urun-" } },
        { slug: { contains: "__" } },
      ],
    },
    select: {
      id: true,
      slug: true,
      modelMode: true,
      _count: { select: { categoryBrands: true, categoryAttributes: true, categoryModels: true } },
    },
  });

  for (const l of leaves) {
    if (l._count.categoryBrands === 0 && !l.slug.includes("__elektronik") && l.level !== undefined) {
      // only check deep leaves roughly
    }
    if (l._count.categoryBrands === 0 && (l.slug.includes("__") || /-cep-telefonu$|-beyaz-esya$/.test(l.slug))) {
      report.brandlessLeaves.push(l.slug);
    }
    if (l._count.categoryAttributes === 0 && l.slug.includes("__")) {
      report.attributelessLeaves.push(l.slug);
    }
    if (l.modelMode === "REQUIRED" && l._count.categoryModels === 0) {
      // check parent models
      const cat = await prisma.category.findUnique({
        where: { id: l.id },
        select: { parentId: true },
      });
      let has = false;
      if (cat?.parentId) {
        const pc = await prisma.categoryModel.count({ where: { categoryId: cat.parentId } });
        has = pc > 0;
      }
      if (!has) report.requiredWithoutModels.push(l.slug);
    }
  }

  // Cap lists
  report.brandlessLeaves = report.brandlessLeaves.slice(0, 50);
  report.attributelessLeaves = report.attributelessLeaves.slice(0, 50);
}

async function main() {
  console.log("catalog-tree-v2 seed start");
  for (const root of ROOTS) {
    try {
      await seedRootTree(root);
      console.log("tree ok", root);
    } catch (e) {
      report.transactionErrors.push(`tree ${root}: ${String(e)}`);
      console.error(e);
    }
  }
  for (const root of ROOTS) {
    try {
      await seedBikeBrands(root);
      console.log("bike ok", root);
    } catch (e) {
      report.transactionErrors.push(`bike ${root}: ${String(e)}`);
      console.error(e);
    }
  }
  for (const root of ROOTS) {
    try {
      await seedMutfak(root);
      console.log("mutfak ok", root);
    } catch (e) {
      report.transactionErrors.push(`mutfak ${root}: ${String(e)}`);
      console.error(e);
    }
  }
  for (const root of ROOTS) {
    try {
      await setTisortLinks(root);
      console.log("tisort ok", root);
    } catch (e) {
      report.transactionErrors.push(`tisort ${root}: ${String(e)}`);
      console.error(e);
    }
  }

  await finalizeReport();

  const outDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `seed-report-tree-v2-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log("report", outFile);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
