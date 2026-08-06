/**
 * Dry-run: vehicle-stage1-target-tree.json vs current TS ARAC_TYPES.
 * No DB writes. Run: npx tsx scripts/vehicle-property-stage1-dry-run.ts
 */
import fs from "fs";
import path from "path";

type AnyNode = {
  name: string;
  slug: string;
  path: string;
  browseRole?: string;
  catalogScope?: string | null;
  persistsAsCategory?: boolean;
  browseOnly?: boolean;
  isLeaf?: boolean;
  children?: AnyNode[];
  legacySubtypeSlugs?: string[];
  requiredFilters?: Record<string, unknown>;
  attributeTemplate?: string | null;
};

const ROOT = process.cwd();
const TREE_PATH = path.join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-target-tree.json");
const OUT_PATH = path.join(ROOT, "scripts/output/vehicle-property-stage1-dry-run.json");

const LEGACY_TS_SUBTYPES = [
  "otomobil",
  "arazi-suv-pickup",
  "motosiklet",
  "minivan-panelvan",
  "ticari-araclar",
  "kiralik-araclar",
  "deniz-araclari",
  "hasarli-araclar",
  "karavan",
  "klasik-araclar",
  "elektrikli-araclar",
  "atv",
  "ucak",
  "engelli-plakali",
];

function walk(nodes: AnyNode[], acc: AnyNode[] = []): AnyNode[] {
  for (const n of nodes) {
    acc.push(n);
    if (n.children?.length) walk(n.children, acc);
  }
  return acc;
}

function main() {
  const tree = JSON.parse(fs.readFileSync(TREE_PATH, "utf8"));
  const mainNav: AnyNode[] = tree.mainNav || [];
  const all = walk(mainNav);

  const byRole: Record<string, number> = {};
  for (const n of all) {
    const r = n.browseRole || "VEHICLE_TYPE";
    byRole[r] = (byRole[r] || 0) + 1;
  }

  const persistTrue = all.filter((n) => n.persistsAsCategory === true);
  const browseOnly = all.filter((n) => n.browseOnly === true || n.persistsAsCategory === false);
  const leaves = all.filter((n) => n.isLeaf !== false && (!n.children || n.children.length === 0));
  const mainCount = mainNav.length;

  const childCounts = mainNav.map((m) => ({
    slug: m.slug,
    name: m.name,
    browseRole: m.browseRole,
    childCount: m.children?.length || 0,
    persistsAsCategory: m.persistsAsCategory !== false,
  }));

  const legacyMapped = new Set<string>();
  const aliasNeeded: Array<{ legacy: string; targetPaths: string[] }> = [];
  for (const m of mainNav) {
    for (const leg of m.legacySubtypeSlugs || []) {
      legacyMapped.add(leg);
      aliasNeeded.push({ legacy: leg, targetPaths: [m.path] });
    }
  }
  // ucak → hava-araclari
  if (!legacyMapped.has("ucak")) {
    aliasNeeded.push({ legacy: "ucak", targetPaths: ["arac/hava-araclari"] });
  } else {
    // already via hava-araclari legacySubtypeSlugs
  }

  const missingLegacy = LEGACY_TS_SUBTYPES.filter((s) => !legacyMapped.has(s) && s !== "ucak");
  const newVsLegacy = mainNav.map((m) => m.slug).filter((s) => !LEGACY_TS_SUBTYPES.includes(s));

  const paths = all.map((n) => n.path);
  const pathDupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  const slugsAtSameParent = new Map<string, string[]>();
  for (const n of all) {
    const parent = n.path.split("/").slice(0, -1).join("/") || "root";
    const key = `${parent}::${n.slug}`;
    const arr = slugsAtSameParent.get(key) || [];
    arr.push(n.path);
    slugsAtSameParent.set(key, arr);
  }
  const slugDupes = [...slugsAtSameParent.entries()].filter(([, v]) => v.length > 1);

  const filterPolicyMains = mainNav.filter((m) =>
    ["MARKET_SEGMENT", "TRANSACTION_MODE", "CONDITION_SEGMENT", "SPECIAL_SEGMENT"].includes(
      String(m.browseRole)
    )
  );
  const realTypeMains = mainNav.filter((m) => m.browseRole === "VEHICLE_TYPE" || !m.browseRole);

  const report = {
    generatedAt: new Date().toISOString(),
    status: "DRY_RUN_ONLY",
    dbWrites: false,
    seedRan: false,
    migrationRan: false,
    uiChanged: false,
    A_mainCategories: mainCount,
    B_childCountsPerMain: childCounts,
    B_totalNodes: all.length,
    B_totalLeavesApprox: leaves.length,
    C_persistAsCategoryCount: persistTrue.length,
    C_persistAsCategoryPaths: persistTrue.map((n) => n.path),
    D_filterPolicyMains: filterPolicyMains.map((m) => ({
      slug: m.slug,
      browseRole: m.browseRole,
      requiredFilters: m.requiredFilters,
    })),
    D_browseOnlyChildCount: browseOnly.length,
    E_dedupeRules: tree.dedupeRules,
    E_howPreventCatalogDup:
      "Brand/Model attach only to catalogScope VEHICLE_TYPE categories; segment hubs use requiredFilters; one Listing resolves into multiple browse views.",
    F_selectionChains: tree.selectionChains,
    G_attributeTemplatesPlanned: tree.attributeTemplatesPlanned,
    H_risks: [
      "Listing.categoryId today is flat 'arac' + attributes.subtype — need mapping layer before seed.",
      "Facet keys arac:{subtype}:… must keep subtype compatibility or alias facet rewrite.",
      "Elektrikli/Hasarlı/Kiralık/Klasik/Engelli as Category rows that are hubs — admin must not attach brands to them.",
      "dealType=KIRALIK for kiralik hub vs legacy subtype-only kiralik-araclar listings.",
      "UTV is new (not in current TS) — greenfield OK.",
      "Brand.slug global unique — BMW Motorrad vs BMW car collision needs domain/prefix (report before migration).",
    ],
    I_migrationNeeded: {
      categoryTree: "SEED only (Category rows) — no Prisma schema change required for tree",
      attributeReuse: "SEED Attribute/CategoryAttribute — schema exists",
      brandDomain: "OPTIONAL migration if domain/vertical column added — ASK APPROVAL first",
      vehicleStarTables: "FORBIDDEN in stage 1",
      listingFk: "FORBIDDEN in stage 1",
    },
    J_seedReady: false,
    J_seedReadyReason:
      "Plan JSON approved; attribute CSV + verified brand packs + CategoryAlias map still needed before seed.",
    legacy: {
      tsSubtypeCount: LEGACY_TS_SUBTYPES.length,
      tsSubtypes: LEGACY_TS_SUBTYPES,
      mappedLegacy: [...legacyMapped],
      aliasNeeded,
      missingLegacyCoverage: missingLegacy,
      newMainVsLegacy: newVsLegacy,
      ucakMapsTo: "arac/hava-araclari",
    },
    quality: {
      pathDuplicates: [...new Set(pathDupes)],
      slugParentDuplicates: slugDupes.map(([k, v]) => ({ key: k, paths: v })),
      byBrowseRole: byRole,
    },
    comparisonSummary: {
      currentTsMains: 14,
      targetMains: 15,
      note: "TS has ucak; target splits Hava Araçları + UTV. ATV kept; UTV added. Same Sahibinden-like segments retained as browseRoles.",
    },
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, out: OUT_PATH, A: report.A_mainCategories, B_total: report.B_totalNodes, C: report.C_persistAsCategoryCount, D_policyMains: report.D_filterPolicyMains.length, J: report.J_seedReady }, null, 2));
}

main();
