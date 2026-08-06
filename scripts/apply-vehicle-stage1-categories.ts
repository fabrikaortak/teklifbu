/**
 * Seed Vasıta Category tree from vehicle-stage1-target-tree.json.
 * Seeds ALL nodes (persistsAsCategory AND browseOnly) so the DB is a complete
 * runtime source of truth for browse (src/lib/vasitaBrowseFromDb.ts).
 * browseRole/catalogScope/requiredFilters/mapsToAttribute/legacySubtype are
 * encoded into Category.description as `VASITA_META:{...json...}`.
 * No Vehicle* tables. Idempotent.
 *
 * npx tsx scripts/apply-vehicle-stage1-categories.ts
 * DRY_RUN=1 npx tsx scripts/apply-vehicle-stage1-categories.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { serializeVasitaMeta, type VasitaMeta } from "@/lib/vasitaBrowseMeta";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

type TargetNode = {
  name: string;
  slug: string;
  path: string;
  parentPath?: string;
  persistsAsCategory?: boolean;
  browseOnly?: boolean;
  browseRole?: string;
  catalogScope?: string | null;
  requiredFilters?: Record<string, unknown>;
  mapsToAttribute?: Record<string, string>;
  attributeTemplate?: string | null;
  children?: TargetNode[];
  sortOrder?: number;
  legacySubtypeSlugs?: string[];
};

type FlatNode = TargetNode & { parentPath: string | null; browseOnly: boolean };

function flatten(
  nodes: TargetNode[],
  parentPath: string | null,
  parentMeta: Pick<TargetNode, "browseRole" | "catalogScope" | "attributeTemplate"> | null,
  acc: FlatNode[] = []
) {
  for (const n of nodes) {
    const browseOnly = n.persistsAsCategory === false || Boolean(n.browseOnly);
    acc.push({
      ...n,
      parentPath,
      browseOnly,
      // Segment-hub children often omit browseRole/catalogScope/attributeTemplate — inherit for meta only.
      browseRole: n.browseRole || parentMeta?.browseRole,
      catalogScope: n.catalogScope !== undefined ? n.catalogScope : null,
      attributeTemplate: n.attributeTemplate ?? parentMeta?.attributeTemplate ?? null,
    } as FlatNode);
    if (n.children?.length) {
      flatten(
        n.children,
        n.path,
        {
          browseRole: n.browseRole || parentMeta?.browseRole,
          catalogScope: n.catalogScope,
          attributeTemplate: n.attributeTemplate ?? parentMeta?.attributeTemplate,
        },
        acc
      );
    }
  }
  return acc;
}

function dbSlugFromPath(path: string): string {
  // arac → arac; arac/otomobil → arac__otomobil
  if (!path.includes("/")) return path;
  return path.replace(/\//g, "__");
}

function metaFor(row: { legacySubtypeSlugs?: string[] } & Omit<FlatNode, "parentPath">): VasitaMeta {
  const meta: VasitaMeta = {
    browseRole: row.browseRole,
    catalogScope: row.catalogScope ?? null,
    requiredFilters: row.requiredFilters || {},
    mapsToAttribute: row.mapsToAttribute || {},
    browseOnly: row.browseOnly,
    attributeTemplate: row.attributeTemplate ?? null,
  };
  if (row.legacySubtypeSlugs?.length) meta.legacySubtype = row.legacySubtypeSlugs[0];
  return meta;
}

async function main() {
  const tree = JSON.parse(
    readFileSync(join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-target-tree.json"), "utf8")
  );
  const root = tree.root as TargetNode;
  const mains = tree.mainNav as TargetNode[];

  const nodes = flatten(mains, "arac", { browseRole: root.browseRole, catalogScope: root.catalogScope });
  const plan = [
    {
      name: root.name || "Vasıta",
      slug: "arac",
      path: "arac",
      parentPath: null as string | null,
      sortOrder: 2,
      legacySubtypeSlugs: [] as string[],
      browseOnly: false,
      browseRole: root.browseRole,
      catalogScope: root.catalogScope ?? null,
      requiredFilters: root.requiredFilters,
      mapsToAttribute: undefined as Record<string, string> | undefined,
      attributeTemplate: root.attributeTemplate ?? null,
    },
    ...nodes.map((n, i) => ({
      name: n.name,
      slug: dbSlugFromPath(n.path),
      path: n.path,
      parentPath: n.parentPath,
      sortOrder: n.sortOrder ?? i + 10,
      legacySubtypeSlugs: n.legacySubtypeSlugs || [],
      browseOnly: n.browseOnly,
      browseRole: n.browseRole,
      catalogScope: n.catalogScope ?? null,
      requiredFilters: n.requiredFilters,
      mapsToAttribute: n.mapsToAttribute,
      attributeTemplate: n.attributeTemplate ?? null,
    })),
  ];

  const report: {
    dryRun: boolean;
    created: string[];
    updated: string[];
    aliases: string[];
    skipped: string[];
    errors: string[];
    browseOnlyCount: number;
    persistedCount: number;
  } = {
    dryRun: DRY,
    created: [],
    updated: [],
    aliases: [],
    skipped: [],
    errors: [],
    browseOnlyCount: plan.filter((p) => p.browseOnly).length,
    persistedCount: plan.filter((p) => !p.browseOnly).length,
  };

  const idByPath = new Map<string, string>();

  for (const row of plan) {
    try {
      const description = serializeVasitaMeta(metaFor(row));

      if (DRY) {
        const existing = await prisma.category.findUnique({ where: { slug: row.slug } });
        if (existing) {
          report.updated.push(row.slug);
          idByPath.set(row.path, existing.id);
        } else {
          report.created.push(row.slug);
          idByPath.set(row.path, `dry-${row.slug}`);
        }
        continue;
      }

      const parentId =
        row.parentPath && idByPath.has(row.parentPath)
          ? idByPath.get(row.parentPath)!
          : row.parentPath
            ? (
                await prisma.category.findFirst({
                  where: { OR: [{ path: row.parentPath }, { slug: dbSlugFromPath(row.parentPath) }] },
                })
              )?.id || null
            : null;

      const level = row.path === "arac" ? 0 : row.path.split("/").length - 1;

      const existing = await prisma.category.findUnique({ where: { slug: row.slug } });
      if (existing) {
        if (existing.managedBySeed === false) {
          report.skipped.push(`${row.slug} (managedBySeed=false, admin-edited)`);
          idByPath.set(row.path, existing.id);
          continue;
        }
        const updated = await prisma.category.update({
          where: { slug: row.slug },
          data: {
            name: row.name,
            path: row.path,
            parentId: row.path === "arac" ? null : parentId,
            level,
            sortOrder: row.sortOrder,
            isActive: true,
            managedBySeed: true,
            description,
          },
        });
        idByPath.set(row.path, updated.id);
        report.updated.push(row.slug);
      } else {
        const created = await prisma.category.create({
          data: {
            slug: row.slug,
            name: row.name,
            path: row.path,
            parentId: row.path === "arac" ? null : parentId,
            level,
            sortOrder: row.sortOrder,
            isActive: true,
            icon: row.path === "arac" ? "car" : null,
            managedBySeed: true,
            description,
          },
        });
        idByPath.set(row.path, created.id);
        report.created.push(row.slug);
      }

      // CategoryAlias for legacy flat subtype → new path slug (informational for browse)
      for (const leg of row.legacySubtypeSlugs || []) {
        if (leg === row.slug || leg === "arac") continue;
        const aliasSlug = `legacy-subtype-${leg}`;
        const catId = idByPath.get(row.path);
        if (!catId) continue;
        const existsAlias = await prisma.categoryAlias.findUnique({ where: { oldSlug: aliasSlug } });
        if (!existsAlias) {
          await prisma.categoryAlias.create({
            data: {
              oldSlug: aliasSlug,
              categoryId: catId,
              redirectType: "INTERNAL_ALIAS",
              active: true,
              notes: `Stage1: legacy attributes.subtype=${leg} → ${row.path}`,
            },
          });
          report.aliases.push(aliasSlug);
        }
      }
    } catch (e) {
      report.errors.push(`${row.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Alias ucak → hava-araclari
  if (!DRY) {
    const hava = idByPath.get("arac/hava-araclari");
    if (hava) {
      const aliasSlug = "legacy-subtype-ucak";
      const existsAlias = await prisma.categoryAlias.findUnique({ where: { oldSlug: aliasSlug } });
      if (!existsAlias) {
        await prisma.categoryAlias.create({
          data: {
            oldSlug: aliasSlug,
            categoryId: hava,
            redirectType: "INTERNAL_ALIAS",
            active: true,
            notes: "Stage1: ucak → hava-araclari",
          },
        });
        report.aliases.push(aliasSlug);
      }
    }
  }

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  const out = join(process.cwd(), "scripts/output/vehicle-stage1-category-seed-report.json");
  writeFileSync(out, JSON.stringify({ ...report, planned: plan.length, at: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ ok: report.errors.length === 0, out, ...report, planned: plan.length }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
