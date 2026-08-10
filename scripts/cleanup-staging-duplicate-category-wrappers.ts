/**
 * Staging: find + optionally collapse near-duplicate category wrappers.
 * Pattern: Parent "TV, Görüntü ve Ses" → only-child "TV, Görüntü & Ses" → real leaves.
 *
 * DRY_RUN default. APPLY=1 to reparent children to grandparent and delete wrapper.
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npx tsx scripts/cleanup-staging-duplicate-category-wrappers.ts
 * ... APPLY=1
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import { writeAuditLog } from "../src/core/services/tenantService";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "1";
const OUT = join(process.cwd(), "scripts/output/cleanup-duplicate-category-wrappers.json");

function normName(s: string) {
  return s
    .toLocaleLowerCase("tr")
    .replace(/&/g, "ve")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nearSame(a: string, b: string) {
  // Strict: only "TV, Görüntü ve Ses" vs "TV, Görüntü & Ses" style duplicates.
  // Do NOT treat "Ev Aletleri" ≈ "Küçük Ev Aletleri".
  return normName(a) === normName(b);
}

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("DB", fp.maskedUrl, "APPLY=", APPLY);

  const cats = await prisma.category.findMany({
    where: {
      deletedAt: null,
      OR: [
        { slug: { startsWith: "sifir-urun" } },
        { slug: { startsWith: "ikinci-el" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      level: true,
      path: true,
      _count: {
        select: {
          children: { where: { deletedAt: null } },
          products: { where: { deletedAt: null } },
          listings: true,
          categoryBrands: true,
          categoryAttributes: true,
          categoryModels: true,
        },
      },
    },
  });

  const byParent = new Map<string, typeof cats>();
  const byId = new Map(cats.map((c) => [c.id, c]));
  for (const c of cats) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) || [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  type Hit = {
    wrapperId: string;
    wrapperName: string;
    wrapperSlug: string;
    parentId: string;
    parentName: string;
    parentSlug: string;
    childCount: number;
    products: number;
    listings: number;
    brands: number;
    attrs: number;
    childIds: string[];
  };

  const hits: Hit[] = [];

  for (const [parentId, kids] of byParent) {
    const parent = byId.get(parentId);
    if (!parent) continue;
    for (const wrap of kids) {
      if (!nearSame(parent.name, wrap.name)) continue;
      // wrapper should have children (otherwise pointless) OR be only child with same name
      const wrapKids = byParent.get(wrap.id) || [];
      if (!wrapKids.length && wrap._count.children === 0) continue;
      // Prefer: parent has this near-same child as the redundant layer
      hits.push({
        wrapperId: wrap.id,
        wrapperName: wrap.name,
        wrapperSlug: wrap.slug,
        parentId: parent.id,
        parentName: parent.name,
        parentSlug: parent.slug,
        childCount: wrapKids.length || wrap._count.children,
        products: wrap._count.products,
        listings: wrap._count.listings,
        brands: wrap._count.categoryBrands,
        attrs: wrap._count.categoryAttributes,
        childIds: wrapKids.map((k) => k.id),
      });
    }
  }

  // Also: parent has EXACTLY one child and that child is near-same name (classic TV case)
  const singleChildWrappers = hits.filter((h) => {
    const siblings = byParent.get(h.parentId) || [];
    return siblings.length === 1 || nearSame(h.parentName, h.wrapperName);
  });

  console.log("NEAR_SAME_WRAPPERS", hits.length);
  console.log(
    "SAMPLE",
    hits.slice(0, 15).map((h) => ({
      parent: h.parentName,
      wrap: h.wrapperName,
      kids: h.childCount,
      products: h.products,
      listings: h.listings,
    }))
  );

  const blocked = hits.filter((h) => h.products > 0);
  const withListingsOnly = hits.filter((h) => h.products === 0 && h.listings > 0);
  const safe = hits.filter((h) => h.products === 0 && h.listings === 0);
  // listings-only wrappers: reassign listings to parent, then treat as safe
  const actionable = [...safe, ...withListingsOnly];

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });

  if (!APPLY) {
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          mode: "DRY_RUN",
          db: fp.maskedUrl,
          total: hits.length,
          safe: safe.length,
          withListingsOnly: withListingsOnly.length,
          blockedProducts: blocked.length,
          hits,
          blockedSample: blocked.slice(0, 20),
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(
      "DRY_RUN. safe=",
      safe.length,
      "listingsOnly=",
      withListingsOnly.length,
      "blockedProducts=",
      blocked.length,
      "Report:",
      OUT
    );
    return;
  }

  let reparented = 0;
  let deleted = 0;
  let listingsMoved = 0;
  const applied: string[] = [];

  for (const h of actionable) {
    const wrapKids = await prisma.category.findMany({
      where: { parentId: h.wrapperId, deletedAt: null },
      select: { id: true, slug: true, path: true, level: true },
    });

    await prisma.$transaction(async (tx) => {
      if (h.listings > 0) {
        const moved = await tx.listing.updateMany({
          where: { categoryId: h.wrapperId },
          data: { categoryId: h.parentId },
        });
        listingsMoved += moved.count;
      }

      for (const kid of wrapKids) {
        await tx.category.update({
          where: { id: kid.id },
          data: {
            parentId: h.parentId,
            level: Math.max(0, (byId.get(h.parentId)?.level ?? 0) + 1),
          },
        });
        reparented += 1;
      }

      const parentBrandIds = new Set(
        (
          await tx.categoryBrand.findMany({
            where: { categoryId: h.parentId },
            select: { brandId: true },
          })
        ).map((x) => x.brandId)
      );
      const wrapBrands = await tx.categoryBrand.findMany({ where: { categoryId: h.wrapperId } });
      for (const wb of wrapBrands) {
        if (!parentBrandIds.has(wb.brandId)) {
          await tx.categoryBrand.create({
            data: {
              categoryId: h.parentId,
              brandId: wb.brandId,
              sortOrder: wb.sortOrder,
              isFeatured: wb.isFeatured,
            },
          });
        }
      }
      await tx.categoryBrand.deleteMany({ where: { categoryId: h.wrapperId } });

      const parentAttrIds = new Set(
        (
          await tx.categoryAttribute.findMany({
            where: { categoryId: h.parentId },
            select: { attributeId: true },
          })
        ).map((x) => x.attributeId)
      );
      const wrapAttrs = await tx.categoryAttribute.findMany({ where: { categoryId: h.wrapperId } });
      for (const wa of wrapAttrs) {
        if (!parentAttrIds.has(wa.attributeId)) {
          await tx.categoryAttribute.create({
            data: {
              categoryId: h.parentId,
              attributeId: wa.attributeId,
              required: wa.required,
              filterable: wa.filterable,
              formVisible: wa.formVisible,
              detailVisible: wa.detailVisible,
              comparisonVisible: wa.comparisonVisible,
              searchable: wa.searchable,
              isVariant: wa.isVariant,
              unit: wa.unit,
              sortOrder: wa.sortOrder,
            },
          });
        }
      }
      await tx.categoryAttribute.deleteMany({ where: { categoryId: h.wrapperId } });
      await tx.categoryModel.deleteMany({ where: { categoryId: h.wrapperId } });

      await tx.category.update({
        where: { id: h.wrapperId },
        data: { deletedAt: new Date(), isActive: false, managedBySeed: false },
      });
      deleted += 1;
      applied.push(h.wrapperSlug);
    });
  }

  await writeAuditLog({
    action: "staging.cleanup.duplicate_category_wrappers",
    entity: "Category",
    meta: {
      stagingOnly: true,
      reparented,
      softDeletedWrappers: deleted,
      listingsMoved,
      appliedSample: applied.slice(0, 40),
      blockedProducts: blocked.length,
    },
  });

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        mode: "APPLY",
        db: fp.maskedUrl,
        reparented,
        softDeletedWrappers: deleted,
        listingsMoved,
        applied,
        blockedProducts: blocked,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(
    "DONE reparented=",
    reparented,
    "softDeleted=",
    deleted,
    "listingsMoved=",
    listingsMoved,
    "blockedProducts=",
    blocked.length
  );
  console.log("Report:", OUT);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
