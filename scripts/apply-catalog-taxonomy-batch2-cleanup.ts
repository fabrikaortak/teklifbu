/**
 * Batch 2: remove old/duplicate shopping categories; keep only full-target-tree.json canon.
 *
 * npx tsx scripts/apply-catalog-taxonomy-batch2-cleanup.ts --dry-run
 * npx tsx scripts/apply-catalog-taxonomy-batch2-cleanup.ts --apply
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { catalogSlugify } from "../src/lib/catalogSlug";
import { invalidateCatalogTreeCache } from "../src/core/services/catalog/catalogTreeCache";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const TREE_FILE = join(ROOT, "docs", "catalog-taxonomy", "full-target-tree.json");
const SCRIPT_OUT = join(ROOT, "scripts", "output");

type TreeNode = {
  name: string;
  path: string;
  parentPath: string | null;
  isLeaf: boolean;
  children?: TreeNode[];
};

type Canon = {
  name: string;
  logicalPath: string;
  pathNames: string[];
  slug: string;
  path: string;
  parentSlug: string | null;
  root: "sifir-urun" | "ikinci-el";
  isLeaf: boolean;
};

function normName(s: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u" };
  return s
    .toLocaleLowerCase("tr")
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .replace(/&/g, " ve ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAIN_SLUG_ALIASES: Record<string, string> = { "spor-ve-outdoor": "spor-outdoor" };

function instanceSlug(root: "sifir-urun" | "ikinci-el", pathNames: string[]): string {
  const segs = pathNames.map((p) => catalogSlugify(p));
  if (segs[0] && MAIN_SLUG_ALIASES[segs[0]]) segs[0] = MAIN_SLUG_ALIASES[segs[0]];
  return [root, ...segs].join("__");
}
function instancePath(root: "sifir-urun" | "ikinci-el", pathNames: string[]): string {
  const segs = pathNames.map((p) => catalogSlugify(p));
  if (segs[0] && MAIN_SLUG_ALIASES[segs[0]]) segs[0] = MAIN_SLUG_ALIASES[segs[0]];
  return [root, ...segs].join("/");
}

function flatten(roots: TreeNode[]): Array<{ name: string; pathNames: string[]; isLeaf: boolean; logicalPath: string }> {
  const out: Array<{ name: string; pathNames: string[]; isLeaf: boolean; logicalPath: string }> = [];
  function walk(n: TreeNode, parents: string[]) {
    const pathNames = [...parents, n.name];
    out.push({
      name: n.name,
      pathNames,
      isLeaf: Boolean(n.isLeaf || !n.children?.length),
      logicalPath: pathNames.join(" › "),
    });
    for (const c of n.children || []) walk(c, pathNames);
  }
  for (const r of roots) walk(r, []);
  return out;
}

/** Old / hybrid name → preferred canonical logical path (without dual-root) */
const SEMANTIC_TARGET: Record<string, string> = {
  buzdolabi: "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "tek kapili buzdolabi": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "tek kapili": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "cift kapili buzdolabi": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "cift kapili": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "no frost": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "gardirop tipi": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "ankastre buzdolabi": "Ev Aletleri › Beyaz Eşya › Soğutma › Buzdolabı",
  "mini buzdolabi": "Ev Aletleri › Beyaz Eşya › Soğutma › Mini Buzdolabı",
  "derin dondurucu": "Ev Aletleri › Beyaz Eşya › Soğutma › Derin Dondurucu",
  "sarap dolabi": "Ev Aletleri › Beyaz Eşya › Soğutma › Şarap Dolabı",
  "akilli telefon": "Elektronik › Telefon ve Aksesuar › Cep Telefonu › Akıllı Telefon",
  "tuslu telefon": "Elektronik › Telefon ve Aksesuar › Cep Telefonu › Tuşlu Telefon",
  "cep telefonu": "Elektronik › Telefon ve Aksesuar › Cep Telefonu",
  "cep telefonu aksesuar": "Elektronik › Telefon ve Aksesuar",
  "cep telefonu & aksesuar": "Elektronik › Telefon ve Aksesuar",
  powerbank: "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Powerbank",
  "sarj powerbank": "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Powerbank",
  "akilli saat": "Elektronik › Telefon ve Aksesuar › Giyilebilir Teknoloji › Akıllı Saat",
  "akilli saat bileklik": "Elektronik › Telefon ve Aksesuar › Giyilebilir Teknoloji › Akıllı Saat",
  airfryer: "Mutfak ve Sofra › Pişirme › Elektrikli Pişirme › Airfryer",
  "hava fritozu": "Mutfak ve Sofra › Pişirme › Elektrikli Pişirme › Airfryer",
  yazici: "Elektronik › Bilgisayar ve Tablet › Bilgisayar Çevre Birimleri › Yazıcı",
  "yazici tarayici": "Elektronik › Bilgisayar ve Tablet › Bilgisayar Çevre Birimleri › Yazıcı",
  tisort: "Moda › Kadın › Üst Giyim › Tişört",
  "tv goruntu ve ses": "Elektronik › Televizyon, Görüntü ve Ses",
  "televizyon goruntu ve ses": "Elektronik › Televizyon, Görüntü ve Ses",
  "fotograf ve kamera": "Elektronik › Televizyon, Görüntü ve Ses › Fotoğraf ve Video",
  "ev dekorasyon mobilya": "Ev ve Yaşam › Mobilya",
  "giyim aksesuar": "Moda",
  "elektrikli ev aletleri": "Ev Aletleri › Küçük Ev Aletleri",
  "ev elektronigi": "Ev Aletleri",
  "ayakkabi canta": "Moda › Ayakkabı",
  "ayakkabi & canta": "Moda › Ayakkabı",
  "anne bebek": "Anne, Bebek ve Çocuk",
  "anne & bebek": "Anne, Bebek ve Çocuk",
  muzik: "Hobi ve Oyun › Müzik Aletleri",
  "antika koleksiyon": "Hobi ve Oyun › Oyun ve Eğlence › Koleksiyon",
  "antika & koleksiyon": "Hobi ve Oyun › Oyun ve Eğlence › Koleksiyon",
  "ofis kirtasiye": "Kitap, Kırtasiye ve Ofis",
  "ofis & kirtasiye": "Kitap, Kırtasiye ve Ofis",
  "hobi oyuncak": "Hobi ve Oyun",
  "hobi & oyuncak": "Hobi ve Oyun",
  "kitap dergi film": "Kitap, Kırtasiye ve Ofis › Kitap",
  "kitap dergi & film": "Kitap, Kırtasiye ve Ofis › Kitap",
  "mutfak gerecleri": "Mutfak ve Sofra",
};

/** Known wrong hybrid slug segments → canonical segment rewrites */
function rewrittenSlugCandidates(slug: string): string[] {
  const out = new Set<string>([slug]);
  const add = (s: string) => out.add(s);
  add(slug.replace(/spor-ve-outdoor/g, "spor-outdoor"));
  add(slug.replace(/__tv-goruntu-ve-ses/g, "__televizyon-goruntu-ve-ses"));
  add(slug.replace(/__fotograf-ve-kamera(\b|$)/g, "__televizyon-goruntu-ve-ses__fotograf-ve-video"));
  add(slug.replace(/__ev-ve-yasam__ev-dekorasyon-mobilya/g, "__ev-ve-yasam__mobilya"));
  add(slug.replace(/__moda__giyim-aksesuar/g, "__moda"));
  // hyphen-style old seed mid → try double-underscore under known anas (best-effort leaf tail)
  const m = slug.match(/^(sifir-urun|ikinci-el)-([a-z0-9-]+)(?:__(.+))?$/);
  if (m) {
    const root = m[1] as "sifir-urun" | "ikinci-el";
    const mid = m[2];
    const rest = m[3] || "";
    const midMap: Record<string, string> = {
      "beyaz-esya": "ev-aletleri__beyaz-esya__sogutma",
      "cep-telefonu": "elektronik__telefon-ve-aksesuar__cep-telefonu",
      "bilgisayar": "elektronik__bilgisayar-ve-tablet",
      "tv-goruntu-ses": "elektronik__televizyon-goruntu-ve-ses",
      "elektrikli-ev-aletleri": "ev-aletleri__kucuk-ev-aletleri",
    };
    if (midMap[mid]) {
      const base = `${root}__${midMap[mid]}`;
      if (!rest) add(base.replace(/__sogutma$/, "")); // beyaz-esya mid alone → beyaz-esya group
      if (mid === "beyaz-esya" && !rest) add(`${root}__ev-aletleri__beyaz-esya`);
      if (rest === "buzdolabi" || rest === "tek-kapili" || rest === "cift-kapili" || rest === "no-frost" || rest === "ankastre-buzdolabi" || rest === "gardirop-tipi") {
        add(`${root}__ev-aletleri__beyaz-esya__sogutma__buzdolabi`);
      } else if (rest === "mini-buzdolabi") {
        add(`${root}__ev-aletleri__beyaz-esya__sogutma__mini-buzdolabi`);
      } else if (rest) {
        add(`${base}__${rest}`);
        add(`${root}__${midMap[mid]}__${rest}`);
      } else {
        add(base);
      }
    }
  }
  return [...out];
}

type PlanItem = {
  action: "SOFT_DELETE" | "MERGE_INTO_CANON" | "KEEP_CANON";
  categoryId: string;
  slug: string;
  name: string;
  reason: string;
  targetSlug?: string;
  targetId?: string;
  listingCount: number;
  productCount: number;
  offerCount: number;
  childCount: number;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  mkdirSync(SCRIPT_OUT, { recursive: true });
  if (!existsSync(TREE_FILE)) throw new Error("missing full-target-tree.json");

  const treeJson = JSON.parse(readFileSync(TREE_FILE, "utf8"));
  const flat = flatten(treeJson.roots as TreeNode[]);

  const canons: Canon[] = [];
  for (const root of ["sifir-urun", "ikinci-el"] as const) {
    for (const n of flat) {
      const slug = instanceSlug(root, n.pathNames);
      const path = instancePath(root, n.pathNames);
      const parentSlug = n.pathNames.length === 1 ? root : instanceSlug(root, n.pathNames.slice(0, -1));
      canons.push({
        name: n.name,
        logicalPath: n.logicalPath,
        pathNames: n.pathNames,
        slug,
        path,
        parentSlug,
        root,
        isLeaf: n.isLeaf,
      });
    }
  }
  const canonBySlug = new Map(canons.map((c) => [c.slug, c]));
  const canonByRootName = new Map<string, Canon[]>();
  for (const c of canons) {
    const k = `${c.root}::${normName(c.name)}`;
    const list = canonByRootName.get(k) || [];
    list.push(c);
    canonByRootName.set(k, list);
  }
  const canonByRootLogical = new Map(canons.map((c) => [`${c.root}::${c.logicalPath}`, c]));

  const roots = await prisma.category.findMany({
    where: { slug: { in: ["sifir-urun", "ikinci-el"] }, deletedAt: null },
  });
  const rootIds = new Set(roots.map((r) => r.id));

  const cats = await prisma.category.findMany({
    where: {
      deletedAt: null,
      OR: [{ slug: { startsWith: "sifir-urun" } }, { slug: { startsWith: "ikinci-el" } }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      path: true,
      parentId: true,
      level: true,
      _count: {
        select: {
          children: { where: { deletedAt: null } },
          listings: true,
          products: { where: { deletedAt: null } },
        },
      },
    },
  });

  const offerRows = await prisma.sellerOffer.findMany({
    where: { deletedAt: null },
    select: { product: { select: { categoryId: true } } },
  });
  const offerByCat = new Map<string, number>();
  for (const o of offerRows) {
    const id = o.product?.categoryId;
    if (!id) continue;
    offerByCat.set(id, (offerByCat.get(id) || 0) + 1);
  }

  function rootOf(slug: string): "sifir-urun" | "ikinci-el" | null {
    if (slug === "sifir-urun" || slug.startsWith("sifir-urun")) return "sifir-urun";
    if (slug === "ikinci-el" || slug.startsWith("ikinci-el")) return "ikinci-el";
    return null;
  }

  function resolveCanon(cat: (typeof cats)[0]): Canon | null {
    if (canonBySlug.has(cat.slug)) return canonBySlug.get(cat.slug)!;
    const root = rootOf(cat.slug);
    if (!root) return null;

    for (const cand of rewrittenSlugCandidates(cat.slug)) {
      if (canonBySlug.has(cand)) return canonBySlug.get(cand)!;
    }

    const nn = normName(cat.name);
    if (SEMANTIC_TARGET[nn]) {
      const hit = canonByRootLogical.get(`${root}::${SEMANTIC_TARGET[nn]}`);
      if (hit) return hit;
    }
    // fuzzy: same normalized name under this root — prefer deeper, prefer Soğutma path for fridges
    const candidates = (canonByRootName.get(`${root}::${nn}`) || []).slice();
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      candidates.sort((a, b) => {
        const score = (c: Canon) => {
          let s = c.pathNames.length * 10;
          if (c.path.includes("/sogutma/")) s += 50;
          if (c.logicalPath.includes("Televizyon")) s += 20;
          return s;
        };
        return score(b) - score(a);
      });
      return candidates[0];
    }

    // last slug segment unique match among canon leaves
    const lastSeg = cat.slug.split("__").pop() || cat.slug.split("-").pop() || "";
    if (lastSeg && lastSeg !== "sifir" && lastSeg !== "urun" && lastSeg !== "ikinci" && lastSeg !== "el") {
      const bySeg = canons.filter((c) => c.root === root && c.slug.endsWith(`__${lastSeg}`));
      if (bySeg.length === 1) return bySeg[0];
      if (bySeg.length > 1) {
        bySeg.sort((a, b) => b.pathNames.length - a.pathNames.length);
        // if fridge-ish, prefer sogutma
        const sog = bySeg.find((c) => c.path.includes("/sogutma/"));
        return sog || bySeg[0];
      }
    }

    // fallback: map to ana (depth 1) if name matches a main
    const ana = canons.find((c) => c.root === root && c.pathNames.length === 1 && normName(c.name) === nn);
    if (ana) return ana;

    return null;
  }

  const plan: PlanItem[] = [];
  const keptCanonIds = new Set<string>();

  for (const cat of cats) {
    if (rootIds.has(cat.id) || cat.slug === "sifir-urun" || cat.slug === "ikinci-el") {
      plan.push({
        action: "KEEP_CANON",
        categoryId: cat.id,
        slug: cat.slug,
        name: cat.name,
        reason: "system_root",
        listingCount: cat._count.listings,
        productCount: cat._count.products,
        offerCount: offerByCat.get(cat.id) || 0,
        childCount: cat._count.children,
      });
      keptCanonIds.add(cat.id);
      continue;
    }

    const isCanonSlug = canonBySlug.has(cat.slug);
    const listingCount = cat._count.listings;
    const productCount = cat._count.products;
    const offerCount = offerByCat.get(cat.id) || 0;
    const childCount = cat._count.children;
    const rel = listingCount + productCount + offerCount;

    if (isCanonSlug) {
      plan.push({
        action: "KEEP_CANON",
        categoryId: cat.id,
        slug: cat.slug,
        name: cat.name,
        reason: "canonical_slug",
        listingCount,
        productCount,
        offerCount,
        childCount,
      });
      keptCanonIds.add(cat.id);
      continue;
    }

    const target = resolveCanon(cat);
    if (target) {
      // Will resolve targetId at apply time
      plan.push({
        action: rel > 0 || childCount > 0 ? "MERGE_INTO_CANON" : "SOFT_DELETE",
        categoryId: cat.id,
        slug: cat.slug,
        name: cat.name,
        reason: rel > 0 ? "duplicate_with_relations" : childCount > 0 ? "duplicate_with_children" : "duplicate_empty",
        targetSlug: target.slug,
        listingCount,
        productCount,
        offerCount,
        childCount,
      });
    } else {
      // Non-canonical, no semantic target — delete if empty; if has relations, try name match later or keep flagged
      if (rel > 0) {
        plan.push({
          action: "MERGE_INTO_CANON",
          categoryId: cat.id,
          slug: cat.slug,
          name: cat.name,
          reason: "non_canon_with_relations_needs_manual_or_name_match",
          listingCount,
          productCount,
          offerCount,
          childCount,
        });
      } else {
        plan.push({
          action: "SOFT_DELETE",
          categoryId: cat.id,
          slug: cat.slug,
          name: cat.name,
          reason: "non_canon_empty",
          listingCount,
          productCount,
          offerCount,
          childCount,
        });
      }
    }
  }

  // Resolve target IDs from DB for MERGE / aliased soft-deletes
  const neededSlugs = [...new Set(plan.map((p) => p.targetSlug).filter(Boolean) as string[])];
  const dbBySlug = new Map(
    (
      await prisma.category.findMany({
        where: { deletedAt: null, slug: { in: neededSlugs } },
        select: { id: true, slug: true },
      })
    ).map((c) => [c.slug, c.id])
  );
  for (const p of plan) {
    if (p.targetSlug && !p.targetId) p.targetId = dbBySlug.get(p.targetSlug);
  }

  // Risk: MERGE without targetId — greenfield: soft-delete empties; relations fall back to dual root
  const mergeNoTarget = plan.filter((p) => p.action === "MERGE_INTO_CANON" && !p.targetId);
  const rootIdBySlug = new Map(roots.map((r) => [r.slug, r.id]));
  for (const p of mergeNoTarget) {
    const root = rootOf(p.slug);
    if (p.listingCount + p.productCount + p.offerCount > 0 && root) {
      p.targetSlug = root;
      p.targetId = rootIdBySlug.get(root);
      p.reason = "fallback_merge_to_root — no specific canon target";
    } else {
      p.action = "SOFT_DELETE";
      p.reason = "non_canon_empty_no_target";
    }
  }

  const summary = {
    keep: plan.filter((p) => p.action === "KEEP_CANON").length,
    softDelete: plan.filter((p) => p.action === "SOFT_DELETE").length,
    merge: plan.filter((p) => p.action === "MERGE_INTO_CANON").length,
    mergeWithoutTarget: mergeNoTarget.length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    summary,
    sampleDeletes: plan.filter((p) => p.action === "SOFT_DELETE").slice(0, 40),
    sampleMerges: plan.filter((p) => p.action === "MERGE_INTO_CANON").slice(0, 40),
    keptWithRelationsNoTarget: plan.filter((p) => p.reason.startsWith("KEEP_UNTIL_MANUAL")),
  };

  if (dryRun) {
    writeFileSync(join(SCRIPT_OUT, "catalog-taxonomy-batch2-dry-run.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, out: "scripts/output/catalog-taxonomy-batch2-dry-run.json" }, null, 2));
    return;
  }

  const deletedIds: string[] = [];
  const mergedIds: string[] = [];
  const aliases: Array<{ oldSlug: string; categoryId: string }> = [];
  const now = new Date();

  // Process deepest (highest level / longest slug) first for children
  const ordered = [...plan].sort((a, b) => b.slug.length - a.slug.length);

  await prisma.$transaction(
    async (tx) => {
      for (const item of ordered) {
        if (item.action === "KEEP_CANON") continue;

        if (item.action === "SOFT_DELETE") {
          // reparent active children to target if any leftover
          const children = await tx.category.findMany({
            where: { parentId: item.categoryId, deletedAt: null },
            select: { id: true },
          });
          if (children.length && item.targetId) {
            for (const ch of children) {
              await tx.category.update({
                where: { id: ch.id },
                data: { parentId: item.targetId },
              });
            }
          } else if (children.length) {
            // skip delete — still has children; will retry conceptually by not deleting
            continue;
          }
          await tx.category.update({
            where: { id: item.categoryId },
            data: { deletedAt: now, isActive: false },
          });
          deletedIds.push(item.categoryId);
          if (item.targetId) {
            aliases.push({ oldSlug: item.slug, categoryId: item.targetId });
          }
          continue;
        }

        if (item.action === "MERGE_INTO_CANON" && item.targetId) {
          const targetId = item.targetId;
          // move listings
          await tx.listing.updateMany({
            where: { categoryId: item.categoryId },
            data: { categoryId: targetId },
          });
          // move products
          await tx.product.updateMany({
            where: { categoryId: item.categoryId, deletedAt: null },
            data: { categoryId: targetId },
          });
          // reparent children
          await tx.category.updateMany({
            where: { parentId: item.categoryId, deletedAt: null },
            data: { parentId: targetId },
          });
          // brands: copy missing
          const brands = await tx.categoryBrand.findMany({ where: { categoryId: item.categoryId } });
          for (const b of brands) {
            await tx.categoryBrand.upsert({
              where: { categoryId_brandId: { categoryId: targetId, brandId: b.brandId } },
              create: { categoryId: targetId, brandId: b.brandId, sortOrder: b.sortOrder, isFeatured: b.isFeatured },
              update: {},
            });
          }
          await tx.categoryBrand.deleteMany({ where: { categoryId: item.categoryId } });
          const attrs = await tx.categoryAttribute.findMany({ where: { categoryId: item.categoryId } });
          for (const a of attrs) {
            await tx.categoryAttribute.upsert({
              where: { categoryId_attributeId: { categoryId: targetId, attributeId: a.attributeId } },
              create: {
                categoryId: targetId,
                attributeId: a.attributeId,
                required: a.required,
                filterable: a.filterable,
                formVisible: a.formVisible,
                detailVisible: a.detailVisible,
                comparisonVisible: a.comparisonVisible,
                searchable: a.searchable,
                isVariant: a.isVariant,
                unit: a.unit,
                sortOrder: a.sortOrder,
              },
              update: {},
            });
          }
          await tx.categoryAttribute.deleteMany({ where: { categoryId: item.categoryId } });
          const models = await tx.categoryModel.findMany({ where: { categoryId: item.categoryId } });
          for (const m of models) {
            await tx.categoryModel.upsert({
              where: { categoryId_modelId: { categoryId: targetId, modelId: m.modelId } },
              create: { categoryId: targetId, modelId: m.modelId, sortOrder: m.sortOrder },
              update: {},
            });
          }
          await tx.categoryModel.deleteMany({ where: { categoryId: item.categoryId } });

          await tx.category.update({
            where: { id: item.categoryId },
            data: { deletedAt: now, isActive: false },
          });
          mergedIds.push(item.categoryId);
          aliases.push({ oldSlug: item.slug, categoryId: targetId });
        }
      }

      // second pass: soft-delete empty leftovers that are not in canonical slug set
      let changed = true;
      let guard = 0;
      while (changed && guard < 30) {
        guard++;
        changed = false;
        const leftovers = await tx.category.findMany({
          where: {
            deletedAt: null,
            OR: [{ slug: { startsWith: "sifir-urun" } }, { slug: { startsWith: "ikinci-el" } }],
            NOT: { slug: { in: ["sifir-urun", "ikinci-el"] } },
          },
          select: {
            id: true,
            slug: true,
            _count: {
              select: {
                children: { where: { deletedAt: null } },
                listings: true,
                products: { where: { deletedAt: null } },
              },
            },
          },
        });
        for (const L of leftovers) {
          if (canonBySlug.has(L.slug)) continue;
          if (L._count.children > 0 || L._count.listings > 0 || L._count.products > 0) continue;
          await tx.category.update({
            where: { id: L.id },
            data: { deletedAt: now, isActive: false },
          });
          deletedIds.push(L.id);
          changed = true;
        }
      }

      // write aliases
      for (const a of aliases) {
        await tx.categoryAlias.upsert({
          where: { oldSlug: a.oldSlug },
          create: {
            oldSlug: a.oldSlug,
            categoryId: a.categoryId,
            redirectType: "INTERNAL_ALIAS",
            active: true,
            notes: "batch2-cleanup",
          },
          update: { categoryId: a.categoryId, active: true, notes: "batch2-cleanup" },
        });
      }
    },
    { timeout: 300_000 }
  );

  invalidateCatalogTreeCache();

  // Post audit: same name under multiple parents (active)
  const active = await prisma.category.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [{ slug: { startsWith: "sifir-urun__" } }, { slug: { startsWith: "ikinci-el__" } }],
    },
    select: { id: true, name: true, slug: true, parentId: true, path: true },
  });
  const byRootName = new Map<string, typeof active>();
  for (const a of active) {
    const root = rootOf(a.slug) || "?";
    const k = `${root}::${normName(a.name)}`;
    const list = byRootName.get(k) || [];
    list.push(a);
    byRootName.set(k, list);
  }
  const dupNames = [...byRootName.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([k, list]) => ({
      key: k,
      paths: list.map((x) => x.path || x.slug),
    }));

  const orphan = await prisma.$queryRaw<Array<{ id: string; slug: string }>>`
    SELECT c.id, c.slug FROM "Category" c
    LEFT JOIN "Category" p ON p.id = c."parentId"
    WHERE c."deletedAt" IS NULL AND c."isActive" = true
      AND (c.slug LIKE 'sifir-urun%' OR c.slug LIKE 'ikinci-el%')
      AND c.slug NOT IN ('sifir-urun','ikinci-el')
      AND c."parentId" IS NOT NULL AND p.id IS NULL
    LIMIT 50
  `;

  const applyReport = {
    ...report,
    applied: true,
    deletedCount: deletedIds.length,
    mergedCount: mergedIds.length,
    aliasCount: aliases.length,
    deletedIds,
    mergedIds,
    aliases: aliases.slice(0, 200),
    remainingSameNameMultiParent: dupNames.slice(0, 50),
    orphans: orphan,
  };
  writeFileSync(join(SCRIPT_OUT, "catalog-taxonomy-batch2-apply.json"), JSON.stringify(applyReport, null, 2));
  console.log(
    JSON.stringify(
      {
        deletedCount: deletedIds.length,
        mergedCount: mergedIds.length,
        aliasCount: aliases.length,
        remainingDupNames: dupNames.length,
        orphans: orphan.length,
        out: "scripts/output/catalog-taxonomy-batch2-apply.json",
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
