/**
 * Apply catalog taxonomy BATCH 1 (SAFE STRUCTURE) only.
 *
 * npx tsx scripts/apply-catalog-taxonomy-batch1.ts --dry-run
 * npx tsx scripts/apply-catalog-taxonomy-batch1.ts --apply
 *
 * Rules:
 * - KEEP / CREATE_NEW / empty MOVE only
 * - no split/merge/archive/risky move
 * - preserve Category.id on MOVE
 * - dual roots sifir-urun + ikinci-el
 * - do not duplicate Brand/Product/Attribute entities
 * - abort --apply if any op would touch Listing/Product/SellerOffer
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { catalogSlugify } from "../src/lib/catalogSlug";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "docs", "catalog-taxonomy");
const SCRIPT_OUT = join(ROOT, "scripts", "output");
const TREE_FILE = join(OUT_DIR, "full-target-tree.json");
const BATCH_FILE = join(OUT_DIR, "application-batches-final.csv");
const MAPPING_FILE = join(OUT_DIR, "category-mapping-full.csv");

type TreeNode = {
  name: string;
  slug: string;
  path: string;
  parentPath: string | null;
  isLeaf: boolean;
  children?: TreeNode[];
};

type FlatNode = {
  name: string;
  path: string;
  parentPath: string | null;
  isLeaf: boolean;
  depth: number;
  pathNames: string[];
  sortOrder: number;
};

type CsvRow = Record<string, string>;
type PlannedOp =
  | {
      kind: "CREATE";
      root: "sifir-urun" | "ikinci-el";
      name: string;
      logicalPath: string;
      slug: string;
      path: string;
      parentSlug: string | null;
      level: number;
      sortOrder: number;
      isLeaf: boolean;
    }
  | {
      kind: "KEEP";
      categoryId: string;
      slug: string;
      name: string;
      logicalPath: string;
    }
  | {
      kind: "MOVE";
      categoryId: string;
      name: string;
      fromParentId: string | null;
      toParentSlug: string;
      toPath: string;
      toSlug: string;
      root: "sifir-urun" | "ikinci-el";
      listingCount: number;
      productCount: number;
      offerCount: number;
    };

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || !args.includes("--apply");
  const apply = args.includes("--apply");
  if (apply && args.includes("--dry-run")) {
    throw new Error("Use either --dry-run or --apply, not both");
  }
  return { dryRun: !apply, apply };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

function flattenTree(roots: TreeNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  let order = 0;
  function walk(n: TreeNode, pathNames: string[]) {
    const names = [...pathNames, n.name];
    const node: FlatNode = {
      name: n.name,
      path: names.join(" › "),
      parentPath: pathNames.length ? pathNames.join(" › ") : null,
      isLeaf: Boolean(n.isLeaf || !n.children?.length),
      depth: names.length,
      pathNames: names,
      sortOrder: order++,
    };
    out.push(node);
    for (const c of n.children || []) walk(c, names);
  }
  for (const r of roots) walk(r, []);
  return out;
}

function instanceSlug(root: "sifir-urun" | "ikinci-el", pathNames: string[]): string {
  // Prefer existing short ana slugs already in DB (avoid Spor ve Outdoor → spor-ve-outdoor dup)
  const MAIN_SLUG_ALIASES: Record<string, string> = {
    "spor-ve-outdoor": "spor-outdoor",
  };
  const segs = pathNames.map((p) => catalogSlugify(p));
  if (segs.length >= 1 && MAIN_SLUG_ALIASES[segs[0]]) segs[0] = MAIN_SLUG_ALIASES[segs[0]];
  return [root, ...segs].join("__");
}

function instancePath(root: "sifir-urun" | "ikinci-el", pathNames: string[]): string {
  const MAIN_SLUG_ALIASES: Record<string, string> = {
    "spor-ve-outdoor": "spor-outdoor",
  };
  const segs = pathNames.map((p) => catalogSlugify(p));
  if (segs.length >= 1 && MAIN_SLUG_ALIASES[segs[0]]) segs[0] = MAIN_SLUG_ALIASES[segs[0]];
  return [root, ...segs].join("/");
}

function normalizeLogicalPath(p: string): string {
  return p
    .replace(/\s*[›>]\s*/g, " › ")
    .replace(/\s+/g, " ")
    .trim();
}

async function relationCounts(categoryId: string) {
  const [listingCount, productCount, offerCount] = await Promise.all([
    prisma.listing.count({ where: { categoryId } }),
    prisma.product.count({ where: { categoryId, deletedAt: null } }),
    prisma.sellerOffer.count({
      where: { deletedAt: null, product: { categoryId, deletedAt: null } },
    }),
  ]);
  return { listingCount, productCount, offerCount };
}

async function main() {
  const { dryRun, apply } = parseArgs();
  mkdirSync(SCRIPT_OUT, { recursive: true });
  if (!existsSync(TREE_FILE)) throw new Error("Missing " + TREE_FILE);
  if (!existsSync(BATCH_FILE)) throw new Error("Missing " + BATCH_FILE);

  const treeJson = JSON.parse(readFileSync(TREE_FILE, "utf8"));
  const flat = flattenTree(treeJson.roots as TreeNode[]);
  const byLogical = new Map(flat.map((n) => [normalizeLogicalPath(n.path), n]));

  const batchRows = parseCsv(readFileSync(BATCH_FILE, "utf8")).filter(
    (r) => r.batch === "BATCH_1_SAFE_STRUCTURE"
  );
  const mapping = existsSync(MAPPING_FILE) ? parseCsv(readFileSync(MAPPING_FILE, "utf8")) : [];
  const mappingById = new Map(mapping.filter((m) => m.currentCategoryId).map((m) => [m.currentCategoryId, m]));

  const roots = await prisma.category.findMany({
    where: { slug: { in: ["sifir-urun", "ikinci-el"] }, deletedAt: null },
  });
  const rootBySlug = new Map(roots.map((r) => [r.slug, r]));
  if (!rootBySlug.get("sifir-urun") || !rootBySlug.get("ikinci-el")) {
    throw new Error("Missing sifir-urun / ikinci-el roots");
  }

  const existing = await prisma.category.findMany({
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
      sortOrder: true,
    },
  });
  const bySlug = new Map(existing.map((c) => [c.slug, c]));

  const planned: PlannedOp[] = [];
  const skipped: Array<{ reason: string; detail: string }> = [];
  const risks: Array<{ reason: string; detail: string }> = [];

  // --- CREATE / KEEP from full target tree (dual root) ---
  // Prefer full tree upsert for Batch1 structure; restricted to BATCH_1 CREATE_NEW paths + ancestors of those + all nodes if CREATE covers most of tree.
  // Upsert entire target tree under both roots (idempotent by instance slug).
  // Batch1 CSV CREATE_NEW drives intent; full tree ensures parents/leaves like Soğutma→Buzdolabı exist even when mapping marked MOVE.
  const ensurePaths = new Set<string>(flat.map((n) => n.path));
  const ensureList = flat.slice().sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder);

  for (const node of ensureList) {
    for (const root of ["sifir-urun", "ikinci-el"] as const) {
      const slug = instanceSlug(root, node.pathNames);
      const path = instancePath(root, node.pathNames);
      const parentSlug =
        node.pathNames.length === 1 ? root : instanceSlug(root, node.pathNames.slice(0, -1));
      const hit = bySlug.get(slug);
      if (hit) {
        planned.push({
          kind: "KEEP",
          categoryId: hit.id,
          slug,
          name: hit.name,
          logicalPath: node.path,
        });
      } else {
        planned.push({
          kind: "CREATE",
          root,
          name: node.name,
          logicalPath: node.path,
          slug,
          path,
          parentSlug,
          level: node.depth,
          sortOrder: node.sortOrder,
          isLeaf: node.isLeaf,
        });
      }
    }
  }

  // --- empty MOVE from batch1 ---
  for (const row of batchRows.filter((r) => r.action === "MOVE")) {
    const id = row.currentCategoryId;
    if (!id) continue;
    const cat = existing.find((c) => c.id === id);
    if (!cat) {
      skipped.push({ reason: "move_missing_category", detail: id });
      continue;
    }
    const rel = {
      listingCount: Number(row.listingCount || 0),
      productCount: Number(row.productCount || 0),
      offerCount: Number(row.sellerOfferCount || 0),
    };
    // live re-check
    const live = await relationCounts(id);
    const listingCount = Math.max(rel.listingCount, live.listingCount);
    const productCount = Math.max(rel.productCount, live.productCount);
    const offerCount = Math.max(rel.offerCount, live.offerCount);
    if (listingCount + productCount + offerCount > 0) {
      risks.push({
        reason: "move_has_relations",
        detail: `${cat.slug} L${listingCount}/P${productCount}/O${offerCount}`,
      });
      continue;
    }
    const logical = normalizeLogicalPath(row.targetPath);
    const targetNode = byLogical.get(logical);
    if (!targetNode) {
      skipped.push({ reason: "move_target_not_in_tree", detail: row.targetPath });
      continue;
    }
    const root: "sifir-urun" | "ikinci-el" = cat.slug.startsWith("sifir")
      ? "sifir-urun"
      : cat.slug.startsWith("ikinci")
        ? "ikinci-el"
        : "sifir-urun";
    const toSlug = instanceSlug(root, targetNode.pathNames);
    const toPath = instancePath(root, targetNode.pathNames);
    const toParentSlug =
      targetNode.pathNames.length === 1 ? root : instanceSlug(root, targetNode.pathNames.slice(0, -1));

    // If target slug already exists as a different id, skip move (create already covers structure)
    const existingTarget = bySlug.get(toSlug);
    if (existingTarget && existingTarget.id !== cat.id) {
      skipped.push({
        reason: "move_target_slug_exists",
        detail: `${cat.slug} → ${toSlug} (kept id ${existingTarget.id})`,
      });
      continue;
    }

    planned.push({
      kind: "MOVE",
      categoryId: cat.id,
      name: cat.name,
      fromParentId: cat.parentId,
      toParentSlug,
      toPath,
      toSlug,
      root,
      listingCount,
      productCount,
      offerCount,
    });
  }

  // KEEP rows from batch (explicit) — informational
  for (const row of batchRows.filter((r) => r.action === "KEEP")) {
    if (!row.currentCategoryId) continue;
    const cat = existing.find((c) => c.id === row.currentCategoryId);
    if (!cat) continue;
    planned.push({
      kind: "KEEP",
      categoryId: cat.id,
      slug: cat.slug,
      name: cat.name,
      logicalPath: row.targetPath || row.currentName,
    });
  }

  const summary = {
    creates: planned.filter((p) => p.kind === "CREATE").length,
    keeps: planned.filter((p) => p.kind === "KEEP").length,
    moves: planned.filter((p) => p.kind === "MOVE").length,
    skipped: skipped.length,
    risks: risks.length,
  };

  const mainsPlanned = flat.filter((n) => n.depth === 1).map((n) => n.name);
  const reportBase = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    batch: "BATCH_1_SAFE_STRUCTURE",
    summary,
    risks,
    skipped: skipped.slice(0, 200),
    mainsExpected: mainsPlanned,
    sampleCreates: planned.filter((p) => p.kind === "CREATE").slice(0, 30),
    sampleMoves: planned.filter((p) => p.kind === "MOVE").slice(0, 30),
    abortApplyIfRisks: risks.length > 0,
  };

  if (dryRun || !apply) {
    const out = join(SCRIPT_OUT, "catalog-taxonomy-batch1-dry-run.json");
    writeFileSync(out, JSON.stringify(reportBase, null, 2), "utf8");
    console.log(JSON.stringify({ ...reportBase, outFile: out }, null, 2));
    if (risks.length) {
      console.error("DRY-RUN has relation risks — do not --apply until resolved");
      process.exitCode = 2;
    }
    return;
  }

  if (risks.length) {
    console.error("ABORT apply: relation risks present");
    writeFileSync(
      join(SCRIPT_OUT, "catalog-taxonomy-batch1-apply.json"),
      JSON.stringify({ ...reportBase, applied: false, abort: true }, null, 2),
      "utf8"
    );
    process.exit(2);
  }

  // Apply in transaction chunks by depth
  const createdIds: string[] = [];
  const movedIds: string[] = [];
  const keptIds: string[] = [];
  const slugToId = new Map<string, string>([...bySlug.entries()].map(([s, c]) => [s, c.id]));
  for (const r of roots) slugToId.set(r.slug, r.id);

  const creates = planned.filter((p) => p.kind === "CREATE") as Extract<PlannedOp, { kind: "CREATE" }>[];
  creates.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);

  // Create parents first in one transaction per 100
  const CHUNK = 80;
  for (let i = 0; i < creates.length; i += CHUNK) {
    const chunk = creates.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const op of chunk) {
        if (slugToId.has(op.slug)) continue;
        const parentId = op.parentSlug ? slugToId.get(op.parentSlug) : undefined;
        if (!parentId) {
          throw new Error(`Missing parent for ${op.slug} (parent ${op.parentSlug})`);
        }
        // re-check unique
        const exists = await tx.category.findFirst({
          where: { slug: op.slug },
          select: { id: true },
        });
        if (exists) {
          slugToId.set(op.slug, exists.id);
          keptIds.push(exists.id);
          continue;
        }
        const row = await tx.category.create({
          data: {
            name: op.name,
            slug: op.slug,
            path: op.path,
            parentId,
            level: op.level,
            sortOrder: op.sortOrder,
            isActive: true,
            managedBySeed: true,
            source: "SYSTEM_SEED",
            modelMode: "OPTIONAL",
            brandInheritanceMode: "NONE",
          },
          select: { id: true },
        });
        slugToId.set(op.slug, row.id);
        createdIds.push(row.id);
      }
    });
  }

  // Moves
  const moves = planned.filter((p) => p.kind === "MOVE") as Extract<PlannedOp, { kind: "MOVE" }>[];
  for (const op of moves) {
    const live = await relationCounts(op.categoryId);
    if (live.listingCount + live.productCount + live.offerCount > 0) {
      risks.push({
        reason: "move_blocked_live_relations",
        detail: op.categoryId,
      });
      continue;
    }
    const parentId = slugToId.get(op.toParentSlug);
    if (!parentId) {
      skipped.push({ reason: "move_parent_missing_after_create", detail: op.toParentSlug });
      continue;
    }
    // slug collision
    const clash = await prisma.category.findFirst({
      where: { slug: op.toSlug, NOT: { id: op.categoryId } },
      select: { id: true },
    });
    if (clash) {
      skipped.push({ reason: "move_slug_clash", detail: op.toSlug });
      continue;
    }
    const level = op.toPath.split("/").length - 1;
    await prisma.category.update({
      where: { id: op.categoryId },
      data: {
        parentId,
        path: op.toPath,
        slug: op.toSlug,
        level,
        name: op.name,
      },
    });
    slugToId.set(op.toSlug, op.categoryId);
    movedIds.push(op.categoryId);
  }

  for (const op of planned.filter((p) => p.kind === "KEEP")) {
    if (op.kind === "KEEP") keptIds.push(op.categoryId);
  }

  // Post checks
  const sifir = rootBySlug.get("sifir-urun")!;
  const ana = await prisma.category.findMany({
    where: {
      parentId: sifir.id,
      deletedAt: null,
      isActive: true,
      slug: { startsWith: "sifir-urun__" },
    },
    select: { name: true, slug: true },
    orderBy: { sortOrder: "asc" },
  });

  const dupSlugs = await prisma.$queryRaw<Array<{ slug: string; c: bigint }>>`
    SELECT slug, COUNT(*)::bigint AS c FROM "Category" WHERE "deletedAt" IS NULL GROUP BY slug HAVING COUNT(*) > 1
  `;

  // invalidate caches best-effort
  try {
    const { invalidateCatalogTreeCache } = await import(
      "../src/core/services/catalog/catalogTreeCache"
    );
    invalidateCatalogTreeCache();
  } catch (e) {
    console.warn("cache invalidate failed", e);
  }

  const applyReport = {
    ...reportBase,
    applied: true,
    createdIds,
    movedIds,
    keptIdsCount: keptIds.length,
    createdCount: createdIds.length,
    movedCount: movedIds.length,
    anaAfter: ana.map((a) => a.name),
    anaCount: ana.length,
    duplicateSlugs: dupSlugs,
    risksAfter: risks,
    skippedAfter: skipped.slice(0, 100),
  };
  const out = join(SCRIPT_OUT, "catalog-taxonomy-batch1-apply.json");
  writeFileSync(out, JSON.stringify(applyReport, null, 2), "utf8");
  // compact created id list for rollback
  writeFileSync(
    join(SCRIPT_OUT, "catalog-taxonomy-batch1-created-ids.json"),
    JSON.stringify({ createdIds, movedIds }, null, 2),
    "utf8"
  );
  console.log(JSON.stringify({ outFile: out, created: createdIds.length, moved: movedIds.length, ana: ana.map((a) => a.name) }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
