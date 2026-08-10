/**
 * Pre-implementation validation for catalog taxonomy mapping.
 * READ-ONLY — never mutates DB.
 *
 * npx tsx scripts/catalog-taxonomy-full-validation.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { isShoppingCategorySlug } from "../src/lib/catalogSlug";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "docs", "catalog-taxonomy");
const SCRIPT_OUT = join(ROOT, "scripts", "output");
const MD =
  process.env.TAXONOMY_MD ||
  "C:\\Users\\ÇELEBİ\\Downloads\\teklifbu_genis_kategori_agaci.md";
const MAPPING = join(OUT_DIR, "category-mapping-full.csv");

type MapRow = Record<string, string>;

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path: string, headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

function parseCsv(text: string): MapRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: MapRow = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
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

function norm(s: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    i̇: "i",
    ö: "o",
    ş: "s",
    ü: "u",
  };
  return s
    .toLocaleLowerCase("tr")
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .replace(/&/g, " ve ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(ler|lar|leri|lari)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Manual synonym dictionary for Turkish commerce */
const SYNONYMS: Array<[RegExp, string]> = [
  [/tv goruntu( ve)? ses/, "televizyon goruntu ve ses"],
  [/cep telefonu( ve)? aksesuar/, "telefon ve aksesuar"],
  [/dizustu( notebook)?/, "dizustu bilgisayar"],
  [/akilli saat( ve)? bileklik/, "akilli saat"],
  [/sarj( ve)? powerbank/, "powerbank"],
  [/kulaklik( ve)? bluetooth/, "bluetooth kulaklik"],
  [/yazici( ve)? tarayici/, "yazici"],
  [/anne( ve)? bebek/, "anne bebek ve cocuk"],
  [/bahce( ve)? yapi( market)?/, "bahce ve yapi"],
  [/kisisel bakim( ve)? kozmetik/, "kozmetik ve kisisel bakim"],
  [/hobi( ve)? oyuncak/, "hobi ve oyun"],
  [/ofis( ve)? kirtasiye/, "kitap kirtasiye ve ofis"],
  [/kitap dergi( ve)? film/, "kitap kirtasiye ve ofis"],
  [/ev sinemasi/, "ev sinema sistemi"],
  [/is makineleri|tarim makineleri|sanayi makineleri/, "endustriyel ve ticari urunler"],
];

function canonicalize(s: string): string {
  let n = norm(s);
  for (const [re, rep] of SYNONYMS) n = n.replace(re, rep);
  return n.replace(/\s+/g, " ").trim();
}

type TNode = {
  name: string;
  path: string;
  parentPath: string | null;
  isLeaf: boolean;
  depth: number;
  pathNames: string[];
  children: TNode[];
};

function parseMd(text: string): TNode[] {
  const lines = text.split(/\r?\n/);
  let inTree = false;
  const roots: TNode[] = [];
  const stack: TNode[] = [];
  for (const raw of lines) {
    if (raw.trim() === "## Kategori Ağacı") {
      inTree = true;
      continue;
    }
    if (!inTree) continue;
    if (raw.startsWith("## ") && !raw.includes("Kategori")) break;
    const m = raw.match(/^(\s*)- (.+)$/);
    if (!m) continue;
    const depth = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    const name = m[2].trim();
    const node: TNode = {
      name,
      depth,
      pathNames: [],
      path: "",
      parentPath: null,
      children: [],
      isLeaf: true,
    };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length) {
      const parent = stack[stack.length - 1];
      parent.children.push(node);
      parent.isLeaf = false;
      node.pathNames = [...parent.pathNames, name];
      node.parentPath = parent.pathNames.join(" › ");
    } else {
      node.pathNames = [name];
      node.parentPath = null;
    }
    node.path = node.pathNames.join(" › ");
    if (!stack.length) roots.push(node);
    stack.push(node);
  }
  return flatten(roots);
}

function flatten(nodes: TNode[], out: TNode[] = []): TNode[] {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

type DbCat = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  parentId: string | null;
  parentName: string | null;
  childCount: number;
  listingCount: number;
  productCount: number;
  offerCount: number;
  brandCount: number;
  attrCount: number;
  modelCount: number;
  side: string;
};

function bestTargetMatch(
  name: string,
  targets: TNode[]
): { target: TNode | null; confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "NO_MATCH"; score: number } {
  const cn = canonicalize(name);
  const nt = tokens(cn);
  let best: TNode | null = null;
  let bestScore = 0;
  for (const t of targets) {
    const ct = canonicalize(t.name);
    if (ct === cn) return { target: t, confidence: "EXACT", score: 1 };
    const sc = jaccard(nt, tokens(ct));
    // boost if synonymized forms equal
    if (canonicalize(t.name) === cn) return { target: t, confidence: "EXACT", score: 1 };
    if (sc > bestScore) {
      bestScore = sc;
      best = t;
    }
  }
  // containment
  if (best && bestScore < 0.5) {
    for (const t of targets) {
      const ct = canonicalize(t.name);
      if (ct.includes(cn) || cn.includes(ct)) {
        const ratio = Math.min(cn.length, ct.length) / Math.max(cn.length, ct.length);
        if (ratio >= 0.55 && ratio > bestScore) {
          best = t;
          bestScore = ratio;
        }
      }
    }
  }
  if (!best || bestScore < 0.35) return { target: null, confidence: "NO_MATCH", score: bestScore };
  if (bestScore >= 0.85) return { target: best, confidence: "HIGH", score: bestScore };
  if (bestScore >= 0.55) return { target: best, confidence: "MEDIUM", score: bestScore };
  return { target: best, confidence: "LOW", score: bestScore };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(SCRIPT_OUT, { recursive: true });
  if (!existsSync(MAPPING)) throw new Error("Missing mapping CSV — run generate-catalog-taxonomy-plan.ts first");
  if (!existsSync(MD)) throw new Error("Missing taxonomy MD: " + MD);

  const mapping = parseCsv(readFileSync(MAPPING, "utf8"));
  const targets = parseMd(readFileSync(MD, "utf8"));
  const targetByPath = new Map(targets.map((t) => [t.path, t]));
  const targetByCanonName = new Map<string, TNode[]>();
  for (const t of targets) {
    const k = canonicalize(t.name);
    const list = targetByCanonName.get(k) || [];
    list.push(t);
    targetByCanonName.set(k, list);
  }

  const cats = await prisma.category.findMany({
    where: {
      deletedAt: null,
      OR: [
        { slug: { in: ["ikinci-el", "sifir-urun"] } },
        { slug: { startsWith: "ikinci-el" } },
        { slug: { startsWith: "sifir-urun" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      parentId: true,
      parent: { select: { name: true } },
      _count: {
        select: {
          children: { where: { deletedAt: null } },
          listings: true,
          products: { where: { deletedAt: null } },
          categoryBrands: true,
          categoryAttributes: true,
          categoryModels: true,
        },
      },
    },
  });

  const shopping = cats.filter(
    (c) => isShoppingCategorySlug(c.slug) || c.slug === "ikinci-el" || c.slug === "sifir-urun"
  );

  const offers = await prisma.sellerOffer.findMany({
    where: { deletedAt: null },
    select: { product: { select: { categoryId: true } } },
  });
  const offerByCat = new Map<string, number>();
  for (const o of offers) {
    const id = o.product?.categoryId;
    if (!id) continue;
    offerByCat.set(id, (offerByCat.get(id) || 0) + 1);
  }

  const dbById = new Map<string, DbCat>();
  for (const c of shopping) {
    dbById.set(c.id, {
      id: c.id,
      name: c.name,
      slug: c.slug,
      path: c.path,
      parentId: c.parentId,
      parentName: c.parent?.name || null,
      childCount: c._count.children,
      listingCount: c._count.listings,
      productCount: c._count.products,
      offerCount: offerByCat.get(c.id) || 0,
      brandCount: c._count.categoryBrands,
      attrCount: c._count.categoryAttributes,
      modelCount: c._count.categoryModels,
      side: c.slug.startsWith("sifir") ? "sifir" : c.slug.startsWith("ikinci") ? "ikinci" : "root",
    });
  }

  // ---------- 1) ARCHIVE validation ----------
  const archiveRows = mapping.filter((r) => r.action === "ARCHIVE");
  const archiveOut: Record<string, unknown>[] = [];
  let archiveConfirmed = 0;
  let archiveRejected = 0;
  let addToTarget = 0;

  for (const r of archiveRows) {
    const db = dbById.get(r.currentCategoryId);
    if (!db) continue;
    const match = bestTargetMatch(db.name, targets);
    let revised = "ARCHIVE_CONFIRMED";
    let reason = "no semantic target; empty relations; candidate for archive";
    let semantic = "";
    let risk = "LOW";
    let manual = false;
    let confirmed = false;

    const hasRelations =
      db.listingCount > 0 ||
      db.productCount > 0 ||
      db.offerCount > 0 ||
      db.brandCount > 0 ||
      db.attrCount > 0 ||
      db.modelCount > 0;
    const hasChildren = db.childCount > 0;

    // special scope decisions
    const n = canonicalize(db.name);
    if (/yiyecek|icecek|gida/.test(n)) {
      revised = "ADD_TO_TARGET_TREE";
      reason = "Yiyecek/İçecek — kapsam kararı: hedef MD'de yok; ticari olarak eklenebilir veya bilinçli dışarıda";
      risk = "MEDIUM";
      manual = true;
      addToTarget++;
    } else if (/saat taki|saat.*mucevher|taki/.test(n) && !/akilli saat/.test(n)) {
      revised = "ADD_TO_TARGET_TREE";
      reason = "Saat/Takı — Moda veya Elektronik altında eksik olabilir; ADD önerisi";
      semantic = "Moda › Aksesuar (öneri) / ayrı ana";
      risk = "MEDIUM";
      manual = true;
      addToTarget++;
    } else if (/tarim|is makineleri|sanayi/.test(n)) {
      revised = "MOVE";
      reason = "Endüstriyel ve Ticari Ürünler altına map edilmeli";
      semantic = "Endüstriyel ve Ticari Ürünler › …";
      risk = hasRelations ? "HIGH" : "MEDIUM";
      manual = true;
    } else if (/^muzik$/.test(n)) {
      revised = "MOVE";
      reason = "Hobi ve Oyun altına taşınabilir veya ADD";
      semantic = "Hobi ve Oyun";
      risk = "MEDIUM";
      manual = true;
    } else if (/ev elektronigi|teknik elektronik/.test(n)) {
      revised = "MERGE";
      reason = "Elektronik altına fold — children MANUAL_REVIEW";
      semantic = "Elektronik";
      risk = "HIGH";
      manual = true;
    } else if (/diger her sey|diger alisveris/.test(n)) {
      revised = "MANUAL_REVIEW";
      reason = "Diğer Her Şey — catch-all; ARCHIVE veya POLICY_ONLY";
      risk = hasRelations ? "HIGH" : "MEDIUM";
      manual = true;
    } else if (match.confidence === "EXACT" || match.confidence === "HIGH") {
      revised = match.confidence === "EXACT" ? "RENAME" : "MOVE";
      semantic = match.target?.path || "";
      reason = `semantic match ${match.confidence} score=${match.score.toFixed(2)} → ${semantic}`;
      risk = hasRelations ? "HIGH" : "MEDIUM";
      manual = match.confidence !== "EXACT";
      archiveRejected++;
    } else if (match.confidence === "MEDIUM") {
      revised = "MANUAL_REVIEW";
      semantic = match.target?.path || "";
      reason = `possible alias/move MEDIUM → ${semantic}`;
      risk = "MEDIUM";
      manual = true;
      archiveRejected++;
    } else if (hasChildren) {
      revised = "KEEP";
      reason = "has active children — cannot ARCHIVE";
      risk = "HIGH";
      manual = true;
      archiveRejected++;
    } else if (db.listingCount > 0 || db.productCount > 0 || db.offerCount > 0) {
      revised = "MANUAL_REVIEW";
      reason = "has Listing/Product/SellerOffer — never auto-archive";
      risk = db.productCount || db.listingCount ? "CRITICAL" : "HIGH";
      manual = true;
      archiveRejected++;
    } else if (/&.+| ve /.test(db.name) && /aksesuar|powerbank|bileklik|tarayici|bluetooth|goruntu/.test(n)) {
      revised = "SPLIT";
      reason = "compound node — split candidate";
      risk = "HIGH";
      manual = true;
      archiveRejected++;
    } else if (db.brandCount > 0 || db.attrCount > 0 || db.modelCount > 0) {
      // Seed/link-only orphan: archive OK if links can be dropped in txn; still needs approval gate
      confirmed = true;
      revised = "ARCHIVE_CONFIRMED";
      reason =
        "no semantic target; no commercial rows; only CategoryBrand/Attribute/Model links (seed) — archive with link cleanup in transaction";
      risk = "MEDIUM";
      manual = true;
      archiveConfirmed++;
    } else {
      confirmed = true;
      revised = "ARCHIVE_CONFIRMED";
      reason = "no target match; no children; no commercial or link relations";
      risk = "LOW";
      manual = false;
      archiveConfirmed++;
    }

    archiveOut.push({
      categoryId: db.id,
      currentName: db.name,
      currentPath: db.path || db.slug,
      currentParent: db.parentName || "",
      childCount: db.childCount,
      listingCount: db.listingCount,
      productCount: db.productCount,
      sellerOfferCount: db.offerCount,
      brandLinkCount: db.brandCount,
      attributeLinkCount: db.attrCount,
      modelLinkCount: db.modelCount,
      originalAction: "ARCHIVE",
      revisedAction: revised,
      semanticTargetPath: semantic,
      archiveConfirmed: confirmed,
      reason,
      riskLevel: risk,
      manualApprovalRequired: manual || !confirmed,
    });
  }

  writeCsv(
    join(OUT_DIR, "archive-validation-full.csv"),
    [
      "categoryId",
      "currentName",
      "currentPath",
      "currentParent",
      "childCount",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "brandLinkCount",
      "attributeLinkCount",
      "modelLinkCount",
      "originalAction",
      "revisedAction",
      "semanticTargetPath",
      "archiveConfirmed",
      "reason",
      "riskLevel",
      "manualApprovalRequired",
    ],
    archiveOut
  );

  // ---------- 2) CREATE_NEW validation ----------
  const createRows = mapping.filter((r) => r.action === "CREATE_NEW");
  const createOut: Record<string, unknown>[] = [];
  let createConfirmed = 0;
  let createPossibleDup = 0;

  // index DB sifir by canon name
  const dbSifir = [...dbById.values()].filter((c) => c.side === "sifir");
  for (const r of createRows) {
    const name = r.targetName;
    const path = r.targetPath;
    let confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "NO_MATCH" = "NO_MATCH";
    let matchedId = "";
    let matchedPath = "";
    let score = 0;

    // exact canon against DB names
    const cn = canonicalize(name);
    for (const d of dbSifir) {
      const dn = canonicalize(d.name);
      if (dn === cn) {
        confidence = "EXACT";
        matchedId = d.id;
        matchedPath = d.path || d.slug;
        score = 1;
        break;
      }
    }
    if (confidence === "NO_MATCH") {
      const nt = tokens(cn);
      for (const d of dbSifir) {
        const sc = jaccard(nt, tokens(canonicalize(d.name)));
        if (sc > score) {
          score = sc;
          matchedId = d.id;
          matchedPath = d.path || d.slug;
        }
      }
      if (score >= 0.85) confidence = "HIGH";
      else if (score >= 0.55) confidence = "MEDIUM";
      else if (score >= 0.35) confidence = "LOW";
      else {
        confidence = "NO_MATCH";
        matchedId = "";
        matchedPath = "";
      }
    }

    // compound containment: target leaf inside DB compound name
    if (confidence === "NO_MATCH" || confidence === "LOW") {
      for (const d of dbSifir) {
        if (canonicalize(d.name).includes(cn) && cn.length >= 4) {
          confidence = "MEDIUM";
          matchedId = d.id;
          matchedPath = d.path || d.slug;
          score = Math.max(score, 0.6);
          break;
        }
      }
    }

    const revisedAction =
      confidence === "NO_MATCH"
        ? "CREATE_NEW_CONFIRMED"
        : confidence === "LOW"
          ? "CREATE_NEW_CONFIRMED"
          : "MANUAL_REVIEW";
    if (revisedAction === "CREATE_NEW_CONFIRMED") createConfirmed++;
    else createPossibleDup++;

    createOut.push({
      targetName: name,
      targetPath: path,
      targetParentPath: r.targetParentPath,
      confidence,
      matchScore: score.toFixed(3),
      matchedCategoryId: matchedId,
      matchedDbPath: matchedPath,
      revisedAction,
      riskLevel: confidence === "EXACT" || confidence === "HIGH" ? "HIGH" : confidence === "MEDIUM" ? "MEDIUM" : "LOW",
      notes:
        confidence === "NO_MATCH"
          ? "no DB counterpart — safe create candidate"
          : `possible existing node (${confidence}) — do not auto-create`,
    });
  }

  writeCsv(
    join(OUT_DIR, "create-new-validation-full.csv"),
    [
      "targetName",
      "targetPath",
      "targetParentPath",
      "confidence",
      "matchScore",
      "matchedCategoryId",
      "matchedDbPath",
      "revisedAction",
      "riskLevel",
      "notes",
    ],
    createOut
  );

  // ---------- 3) MOVE validation ----------
  const moveRows = mapping.filter((r) => r.action === "MOVE");
  const moveOut: Record<string, unknown>[] = [];
  let moveSafe = 0;
  let moveRisky = 0;
  for (const r of moveRows) {
    const db = dbById.get(r.currentCategoryId);
    const preserveId = r.preserveId === "true";
    const risky =
      Number(r.productCount) > 0 ||
      Number(r.listingCount) > 0 ||
      Number(r.sellerOfferCount) > 0 ||
      Number(r.categoryModelCount) > 0;
    if (risky) moveRisky++;
    else moveSafe++;
    moveOut.push({
      categoryId: r.currentCategoryId,
      currentName: r.currentName,
      currentPath: r.currentPath,
      currentParent: db?.parentName || "",
      targetPath: r.targetPath,
      targetParentPath: r.targetParentPath,
      preserveId,
      pathChange: `${r.currentPath} → ${r.targetPath}`,
      childPathRebuildRequired: (db?.childCount || 0) > 0,
      listingFilterImpact: Number(r.listingCount) > 0,
      productFilterImpact: Number(r.productCount) > 0,
      breadcrumbImpact: true,
      aliasRequired: true,
      relationsKeptViaSameId: preserveId,
      listingCount: r.listingCount,
      productCount: r.productCount,
      sellerOfferCount: r.sellerOfferCount,
      brandLinkCount: r.categoryBrandCount,
      attributeLinkCount: r.categoryAttributeCount,
      modelLinkCount: r.categoryModelCount,
      bucket: risky ? "SAFE_WITH_TRANSACTION" : "SAFE_AUTOMATIC",
      riskLevel: r.riskLevel || (risky ? "HIGH" : "LOW"),
      notes: r.notes,
    });
  }
  writeCsv(
    join(OUT_DIR, "move-validation-full.csv"),
    [
      "categoryId",
      "currentName",
      "currentPath",
      "currentParent",
      "targetPath",
      "targetParentPath",
      "preserveId",
      "pathChange",
      "childPathRebuildRequired",
      "listingFilterImpact",
      "productFilterImpact",
      "breadcrumbImpact",
      "aliasRequired",
      "relationsKeptViaSameId",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "brandLinkCount",
      "attributeLinkCount",
      "modelLinkCount",
      "bucket",
      "riskLevel",
      "notes",
    ],
    moveOut
  );

  // ---------- 4) SPLIT/MERGE detail ----------
  const splitMerge = mapping.filter((r) => ["SPLIT", "MERGE", "MANUAL_REVIEW"].includes(r.action));
  writeCsv(
    join(OUT_DIR, "split-merge-manual-validation.csv"),
    [
      "categoryId",
      "currentName",
      "currentPath",
      "action",
      "splitGroup",
      "mergeGroup",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "brandLinkCount",
      "attributeLinkCount",
      "modelLinkCount",
      "autoAssignable",
      "assignmentPlan",
      "riskLevel",
      "notes",
    ],
    splitMerge.map((r) => ({
      categoryId: r.currentCategoryId,
      currentName: r.currentName,
      currentPath: r.currentPath,
      action: r.action,
      splitGroup: r.splitGroup,
      mergeGroup: r.mergeGroup,
      listingCount: r.listingCount,
      productCount: r.productCount,
      sellerOfferCount: r.sellerOfferCount,
      brandLinkCount: r.categoryBrandCount,
      attributeLinkCount: r.categoryAttributeCount,
      modelLinkCount: r.categoryModelCount,
      autoAssignable: false,
      assignmentPlan: (() => {
        const n = canonicalize(r.currentName);
        if (/cep telefonu/.test(n) && /aksesuar/.test(n))
          return "SPLIT MANUAL: children → Cep Telefonu leaves vs Telefon Aksesuarları; Products/Listings by title+attrs; Brands stay on phone leaf; no auto move";
        if (/sarj|powerbank/.test(n))
          return "SPLIT MANUAL: Şarj Cihazı vs Powerbank leaves; offers by keyword (powerbank|şarj|adaptör); else MANUAL_REVIEW queue";
        if (/akilli saat|bileklik/.test(n))
          return "SPLIT/RENAME: prefer map to Akıllı Saat; Bileklik/band → ayrı aksesuar leaf if stock exists; Models stay with watch";
        if (/yazici|tarayici/.test(n))
          return "SPLIT MANUAL: Yazıcı vs Tarayıcı; title keywords; multifunction → Yazıcı/Tarayıcı/Çok Fonksiyonlu if exists else MANUAL";
        if (/kulaklik|bluetooth/.test(n))
          return "MOVE/RENAME to Bluetooth Kulaklık; wired → Kablolu Kulaklık if distinguishable";
        if (/bisiklet/.test(n))
          return "MERGE nest: Bisiklet→Bisiklet wrapper — reparent children to outer; keep outer id; soft-delete inner";
        if (r.action === "MERGE")
          return "Reparent children to canonical target; preserve target id; alias source; move Category* links; Products keep categoryId if target preserved";
        return "Human decide KEEP/MOVE/SPLIT/ADD_TO_TARGET_TREE — no automatic record move";
      })(),
      riskLevel: r.riskLevel,
      notes: r.notes,
    }))
  );

  // ---------- 5) DB extras taxonomy gaps ----------
  const matchedIds = new Set(
    mapping.filter((r) => r.currentCategoryId && r.action !== "ARCHIVE").map((r) => r.currentCategoryId)
  );
  // also ids that archive validation reclassified away from archive
  for (const a of archiveOut) {
    if (String(a.revisedAction) !== "ARCHIVE_CONFIRMED") matchedIds.add(String(a.categoryId));
  }

  const gapOut: Record<string, unknown>[] = [];
  for (const db of dbSifir) {
    const inMappingAsNonArchive = mapping.some(
      (r) => r.currentCategoryId === db.id && r.action !== "ARCHIVE"
    );
    if (inMappingAsNonArchive) continue;
    const arch = archiveOut.find((a) => a.categoryId === db.id);
    const bucket =
      arch?.revisedAction === "ADD_TO_TARGET_TREE"
        ? "C_ADD_TO_TARGET"
        : arch?.revisedAction === "MOVE" || arch?.revisedAction === "MERGE"
          ? "D_REPARENT"
          : arch?.revisedAction === "ARCHIVE_CONFIRMED"
            ? "A_OBSOLETE"
            : arch?.revisedAction === "RENAME" || arch?.revisedAction === "MANUAL_REVIEW"
              ? "B_ALIAS_OR_REVIEW"
              : /diger/.test(canonicalize(db.name))
                ? "E_OTHER"
                : /yiyecek|gida|icecek/.test(canonicalize(db.name))
                  ? "F_SCOPE"
                  : "B_ALIAS_OR_REVIEW";
    gapOut.push({
      categoryId: db.id,
      name: db.name,
      path: db.path || db.slug,
      classification: bucket,
      revisedAction: arch?.revisedAction || "MANUAL_REVIEW",
      reason: arch?.reason || "unmapped sifir node",
      listingCount: db.listingCount,
      productCount: db.productCount,
    });
  }
  writeCsv(
    join(OUT_DIR, "target-tree-gap-review.csv"),
    ["categoryId", "name", "path", "classification", "revisedAction", "reason", "listingCount", "productCount"],
    gapOut
  );

  // ---------- 6) leaf quality + micro leaf review ----------
  const leaves = targets.filter((t) => t.isLeaf);
  const byParent = new Map<string, TNode[]>();
  for (const l of leaves) {
    const p = l.parentPath || "";
    const list = byParent.get(p) || [];
    list.push(l);
    byParent.set(p, list);
  }
  const leafCanon = new Map<string, TNode[]>();
  for (const l of leaves) {
    const k = canonicalize(l.name);
    const list = leafCanon.get(k) || [];
    list.push(l);
    leafCanon.set(k, list);
  }
  const leafQuality: Record<string, unknown>[] = [];
  const microOut: Record<string, unknown>[] = [];
  for (const l of leaves) {
    const sibs = (byParent.get(l.parentPath || "") || []).filter((x) => x.name !== l.name);
    const sameName = (leafCanon.get(canonicalize(l.name)) || []).filter((x) => x.path !== l.path);
    const issues: string[] = [];
    if (sameName.length) issues.push("same_sense_duplicate_leaf");
    if (/aksesuar|yedek parca|parca/i.test(l.name) && /urun|cihaz|telefon|tablet/i.test(l.parentPath || ""))
      issues.push("accessory_group_as_leaf");
    if (/^(apple|samsung|xiaomi|nike|adidas|sony|lg|bosch|arcelik)$/i.test(l.name))
      issues.push("brand_as_leaf");
    if (sibs.length >= 8 && l.depth >= 3) issues.push("micro_dense_sibling");
    if (l.name.length <= 3) issues.push("very_short_name");
    if (/diger|cesitli|genel/i.test(l.name)) issues.push("catch_all_leaf");
    if (l.depth <= 1) issues.push("too_shallow_for_leaf");
    // wrong main guesses (heuristic)
    if (/elektronik/i.test(l.path) && /kiyafet|elbise|ayakkabi/i.test(l.name)) issues.push("wrong_main_category");
    leafQuality.push({
      categoryPath: l.path,
      name: l.name,
      depth: l.depth,
      siblingCount: sibs.length + 1,
      duplicatePaths: sameName.map((x) => x.path).join(" | "),
      issues: issues.join("|") || "ok",
      recommendAction: issues.includes("same_sense_duplicate_leaf")
        ? "MANUAL_REVIEW_DEDUP"
        : issues.includes("micro_dense_sibling")
          ? "MICRO_REVIEW"
          : "KEEP",
    });
    if (sibs.length >= 8 && l.depth >= 3) {
      microOut.push({
        categoryPath: l.path,
        parentPath: l.parentPath || "",
        siblingCount: sibs.length + 1,
        issues: issues.join("|") || "dense_sibling_group",
        recommendMerge: false,
        notes: "report only — no merge without approval",
      });
    }
  }
  writeCsv(
    join(OUT_DIR, "leaf-quality-review.csv"),
    ["categoryPath", "name", "depth", "siblingCount", "duplicatePaths", "issues", "recommendAction"],
    leafQuality
  );
  writeCsv(
    join(OUT_DIR, "micro-leaf-review.csv"),
    ["categoryPath", "parentPath", "siblingCount", "issues", "recommendMerge", "notes"],
    microOut
  );

  // ---------- 7) dual-root decision ----------
  const dualMd = `# Dual-root architecture decision

Generated: ${new Date().toISOString()}
Status: DECISION REPORT ONLY — no schema change

## Options

### A) Current: mirrored Category trees (ZERO + SECOND_HAND)

- Commercial nodes ≈ **1375 × 2 = 2750** Category rows (plus 2 system roots)
- CategoryBrand / CategoryAttribute / CategoryModel typically duplicated per side if linked per category instance
- Estimated link multiplication if naively copied:
  - Brands links: ~2×
  - Attribute links: ~2×
  - Model links: ~2×
- Pros: matches existing \`sifir-urun\` / \`ikinci-el\` filters, Listing categoryId semantics, form ladder
- Cons: admin edits twice; drift risk; seed size doubles

### B) Shared commercial Category + condition/policy

- Single ~1375 commercial nodes (+ policies)
- Condition NEW/USED on Listing/Offer or policy table
- commerceMode per root policy overlay
- Pros: half the taxonomy maintenance; Brand/Attr/Model linked once
- Cons: **breaking** for current Listing.categoryId + browse filters; large migration; Product.categoryId ambiguity for used vs new

## Compatibility with current Product / Listing

- Product.categoryId today points at shopping categories (often sifir side)
- Listing.categoryId used for classic listings including ikinci-el
- SellerOffer does not own category; inherits via Product

## Recommendation (this phase)

- **Keep A (dual Category instances)** for rollout to avoid breaking Listing/Product filters
- Treat MD tree as SHARED_TEMPLATE generator that upserts both roots
- Do **not** duplicate Brand / Product / Attribute entities
- Attach CategoryBrand/Attribute/Model primarily on ZERO leaf; SECOND_HAND inherits via resolve services or explicit lighter links
- Revisit B only after commerceMode + alias layer is stable

## Cost snapshot (template size)

| Metric | Shared template | Dual instances (A) |
|--------|-----------------|--------------------|
| Ana | 14 | 28 |
| Ara | 250 | 500 |
| Leaf | 1111 | 2222 |
| Total commercial nodes | 1375 | 2750 |

## Migration risk

- A: medium (parent moves + creates) — compatible
- B: high/critical — defer
`;
  writeFileSync(join(OUT_DIR, "dual-root-architecture-decision.md"), dualMd, "utf8");

  // ---------- 8) attribute quality ----------
  const attrCsvPath = join(OUT_DIR, "category-attributes-full.csv");
  const attrRows = existsSync(attrCsvPath) ? parseCsv(readFileSync(attrCsvPath, "utf8")) : [];
  const attrByPath = new Map<string, MapRow[]>();
  for (const a of attrRows) {
    const list = attrByPath.get(a.categoryPath) || [];
    list.push(a);
    attrByPath.set(a.categoryPath, list);
  }
  let genericOnly = 0;
  let leavesWithSpecific = 0;
  for (const [, list] of attrByPath) {
    const slugs = new Set(list.map((x) => x.attributeSlug));
    const onlyGeneric =
      [...slugs].every((s) => ["renk", "garanti", "urun-durumu", "durum"].includes(s)) ||
      (slugs.size <= 2 && (slugs.has("renk") || slugs.has("garanti")));
    if (onlyGeneric) genericOnly++;
    else leavesWithSpecific++;
  }
  // DB evidence: washer fridge attrs + bike empty
  const washerDb = [...dbById.values()].filter((c) => /camasir makinesi/.test(canonicalize(c.name)));
  const washerAttrSlugs: string[] = [];
  for (const w of washerDb) {
    const rows = await prisma.categoryAttribute.findMany({
      where: { categoryId: w.id },
      select: { attribute: { select: { slug: true, name: true } } },
    });
    for (const r of rows) washerAttrSlugs.push(r.attribute.slug);
  }
  const fridgeAttrsOnWasher = washerAttrSlugs.filter((s) =>
    ["hacim", "kapi-tipi", "no-frost", "enerji-sinifi"].includes(s)
  );
  const bikeDb = [...dbById.values()].filter((c) => canonicalize(c.name) === "bisiklet");
  const bikeAttrCounts = await Promise.all(
    bikeDb.map(async (b) => ({
      id: b.id,
      path: b.path,
      attrs: await prisma.categoryAttribute.count({ where: { categoryId: b.id } }),
    }))
  );

  const attrIssues = [
    {
      issue: "washer_has_fridge_attrs",
      detail: `DB evidence slugs on washer: ${[...new Set(washerAttrSlugs)].join(",") || "none"}; fridge-like: ${[...new Set(fridgeAttrsOnWasher)].join(",") || "none"}`,
      severity: fridgeAttrsOnWasher.length ? "CRITICAL" : "LOW",
    },
    {
      issue: "generic_attr_template_overuse",
      detail: `${genericOnly}/${attrByPath.size} planned leaves only generic (renk/garanti/durum); ${leavesWithSpecific} have category-specific attrs`,
      severity: genericOnly > attrByPath.size * 0.7 ? "HIGH" : "MEDIUM",
    },
    {
      issue: "bike_leaf_empty_in_db",
      detail: bikeAttrCounts.map((b) => `${b.path || b.id}:${b.attrs}`).join(" | ") || "no bike category",
      severity: bikeAttrCounts.some((b) => b.attrs <= 1) ? "HIGH" : "LOW",
    },
    {
      issue: "fashion_size_vs_shoe_size",
      detail: "Ensure beden vs numara option sets are not shared blindly across Moda leaves",
      severity: "MEDIUM",
    },
    {
      issue: "electronics_modelMode_mismatch",
      detail: "Phone/laptop leaves need modelMode=BRAND_MODEL; accessories often ATTRIBUTE_ONLY — verify model-mode CSV",
      severity: "MEDIUM",
    },
    {
      issue: "pet_wrong_brand_attrs",
      detail: "Pet leaves may inherit electronics brands/attrs — manual check before seed",
      severity: "MEDIUM",
    },
    {
      issue: "industrial_insufficient_technical",
      detail: "Endüstriyel leaf plans often lack voltage/power/capacity — expand before apply",
      severity: "HIGH",
    },
  ];
  writeCsv(join(OUT_DIR, "attribute-quality-issues.csv"), ["issue", "detail", "severity"], attrIssues);

  // ---------- 9) brand quality ----------
  const brandCsvPath = join(OUT_DIR, "category-brands-full.csv");
  const brandRows = existsSync(brandCsvPath) ? parseCsv(readFileSync(brandCsvPath, "utf8")) : [];
  const brandsByPath = new Map<string, MapRow[]>();
  for (const b of brandRows) {
    const list = brandsByPath.get(b.categoryPath) || [];
    list.push(b);
    brandsByPath.set(b.categoryPath, list);
  }
  let onlyDiger = 0;
  let tooMany = 0;
  let noBrandPlan = 0;
  for (const leaf of leaves) {
    const list = brandsByPath.get(leaf.path) || [];
    if (!list.length) noBrandPlan++;
    if (list.length === 1 && /diger|markasiz/i.test(list[0].brandName)) onlyDiger++;
    if (list.length > 40) tooMany++;
  }
  // DB: categories with >40 brands (likely blind inherit)
  const overBrandedDb = [...dbById.values()].filter((c) => c.side === "sifir" && c.brandCount > 40);
  const brandIssues = [
    { issue: "only_diger_placeholder", detail: `${onlyDiger} planned leaves with only Diğer/Markasız`, severity: "MEDIUM" },
    { issue: "missing_brand_plan", detail: `${noBrandPlan} leaves have no row in brands CSV`, severity: noBrandPlan > 100 ? "HIGH" : "MEDIUM" },
    { issue: "over_populated_plan", detail: `${tooMany} planned leaves with >40 brands`, severity: "LOW" },
    {
      issue: "db_over_populated_inherit",
      detail: `${overBrandedDb.length} DB sifir categories with >40 CategoryBrand (sample: ${overBrandedDb
        .slice(0, 5)
        .map((c) => `${c.name}:${c.brandCount}`)
        .join("; ")})`,
      severity: overBrandedDb.length ? "HIGH" : "LOW",
    },
    { issue: "no_blind_parent_inheritance", detail: "Plan forbids parent brand copy — verify on apply", severity: "INFO" },
    {
      issue: "irrelevant_brand_risk",
      detail: "Cross-vertical brands (e.g. apparel on bike/pet) — validate per leaf before seed",
      severity: "MEDIUM",
    },
    {
      issue: "brand_required_vs_optional",
      detail: "Phone/laptop/TV should require brand; grocery/pet food often allow unbranded — enforce via allowUnbranded",
      severity: "MEDIUM",
    },
  ];
  writeCsv(join(OUT_DIR, "brand-quality-issues.csv"), ["issue", "detail", "severity"], brandIssues);

  // ---------- 10) application buckets ----------
  const buckets: Record<string, unknown>[] = [];
  let safeAuto = 0;
  let safeTx = 0;
  let manual = 0;

  function pushBucket(row: Record<string, unknown>, bucket: string) {
    buckets.push({ ...row, applicationBucket: bucket });
    if (bucket === "SAFE_AUTOMATIC") safeAuto++;
    else if (bucket === "SAFE_WITH_TRANSACTION") safeTx++;
    else manual++;
  }

  for (const r of mapping) {
    const risk = r.riskLevel || "LOW";
    const rel =
      Number(r.listingCount) + Number(r.productCount) + Number(r.sellerOfferCount) + Number(r.categoryModelCount);
    if (r.action === "KEEP" && risk === "LOW") {
      pushBucket({ ...r, bucketReason: "exact keep" }, "SAFE_AUTOMATIC");
    } else if (r.action === "CREATE_NEW") {
      const v = createOut.find((c) => c.targetPath === r.targetPath);
      if (v && v.revisedAction === "CREATE_NEW_CONFIRMED" && v.confidence === "NO_MATCH") {
        pushBucket({ ...r, bucketReason: "validated no-match create" }, "SAFE_AUTOMATIC");
      } else if (v && String(v.confidence).match(/EXACT|HIGH|MEDIUM/)) {
        pushBucket({ ...r, bucketReason: `create blocked — ${v.confidence} db match` }, "MANUAL_APPROVAL");
      } else {
        pushBucket({ ...r, bucketReason: "create needs batch review" }, "SAFE_WITH_TRANSACTION");
      }
    } else if (r.action === "MOVE" && rel === 0) {
      pushBucket({ ...r, bucketReason: "empty move preserve id" }, "SAFE_AUTOMATIC");
    } else if (r.action === "MOVE") {
      pushBucket({ ...r, bucketReason: "related move — txn + alias" }, "SAFE_WITH_TRANSACTION");
    } else if (["SPLIT", "MERGE", "MANUAL_REVIEW", "ARCHIVE"].includes(r.action)) {
      pushBucket({ ...r, bucketReason: r.action }, "MANUAL_APPROVAL");
    } else {
      pushBucket({ ...r, bucketReason: "default manual" }, "MANUAL_APPROVAL");
    }
  }

  // refine ARCHIVE using archiveOut
  for (const b of buckets) {
    if (b.action !== "ARCHIVE") continue;
    const a = archiveOut.find((x) => x.categoryId === b.currentCategoryId);
    if (!a) continue;
    if (a.revisedAction === "ARCHIVE_CONFIRMED") {
      b.applicationBucket = "SAFE_WITH_TRANSACTION";
      b.bucketReason = "archive confirmed empty";
    } else {
      b.applicationBucket = "MANUAL_APPROVAL";
      b.bucketReason = String(a.revisedAction);
    }
  }
  // recount
  safeAuto = buckets.filter((b) => b.applicationBucket === "SAFE_AUTOMATIC").length;
  safeTx = buckets.filter((b) => b.applicationBucket === "SAFE_WITH_TRANSACTION").length;
  manual = buckets.filter((b) => b.applicationBucket === "MANUAL_APPROVAL").length;

  writeCsv(
    join(OUT_DIR, "application-buckets-full.csv"),
    [
      "currentCategoryId",
      "currentName",
      "targetPath",
      "action",
      "riskLevel",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "applicationBucket",
      "bucketReason",
      "notes",
    ],
    buckets.map((b) => ({
      currentCategoryId: b.currentCategoryId,
      currentName: b.currentName,
      targetPath: b.targetPath,
      action: b.action,
      riskLevel: b.riskLevel,
      listingCount: b.listingCount,
      productCount: b.productCount,
      sellerOfferCount: b.sellerOfferCount,
      applicationBucket: b.applicationBucket,
      bucketReason: b.bucketReason,
      notes: b.notes,
    }))
  );

  const revisedArchiveDist = archiveOut.reduce((acc, a) => {
    const k = String(a.revisedAction);
    acc[k] = Number(acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const createConfDist = createOut.reduce((acc, a) => {
    const k = String(a.confidence);
    acc[k] = Number(acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const criticalHigh = buckets.filter((b) => b.riskLevel === "CRITICAL" || b.riskLevel === "HIGH");

  const firstBatch = {
    description: "Elektronik SAFE_AUTOMATIC KEEP + empty MOVE + CREATE_NEW NO_MATCH only; exclude phone CRITICAL",
    counts: {
      keep: buckets.filter(
        (b) =>
          b.applicationBucket === "SAFE_AUTOMATIC" &&
          b.action === "KEEP" &&
          String(b.targetPath || b.currentName).startsWith("Elektronik")
      ).length,
    },
  };

  const validation = {
    generatedAt: new Date().toISOString(),
    dbMutations: false,
    readyToWriteDb: false,
    archive: {
      reviewed: archiveOut.length,
      distribution: revisedArchiveDist,
      archiveConfirmed,
      archiveRejected,
      addToTargetTree: addToTarget,
    },
    createNew: {
      reviewed: createOut.length,
      confidence: createConfDist,
      createNewConfirmed: createConfirmed,
      createNewPossibleDuplicate: createPossibleDup,
    },
    move: { total: moveOut.length, moveSafe, moveRisky },
    splitManual: splitMerge.filter((r) => r.action === "SPLIT").length,
    mergeManual: splitMerge.filter((r) => r.action === "MERGE").length,
    manualReviewRows: splitMerge.filter((r) => r.action === "MANUAL_REVIEW").length,
    gaps: {
      rows: gapOut.length,
      addToTarget: gapOut.filter((g) => g.classification === "C_ADD_TO_TARGET").length,
      scopeFood: gapOut.filter((g) => g.classification === "F_SCOPE").length,
      other: gapOut.filter((g) => g.classification === "E_OTHER").length,
      obsolete: gapOut.filter((g) => g.classification === "A_OBSOLETE").length,
      aliasOrReview: gapOut.filter((g) => g.classification === "B_ALIAS_OR_REVIEW").length,
      reparent: gapOut.filter((g) => g.classification === "D_REPARENT").length,
    },
    leafQuality: {
      totalLeaves: leaves.length,
      withIssues: leafQuality.filter((l) => l.issues !== "ok").length,
      duplicateSense: leafQuality.filter((l) => String(l.issues).includes("same_sense_duplicate_leaf")).length,
      brandAsLeaf: leafQuality.filter((l) => String(l.issues).includes("brand_as_leaf")).length,
    },
    microLeaves: microOut.length,
    attributeIssues: attrIssues,
    brandIssues,
    buckets: { safeAutomatic: safeAuto, safeWithTransaction: safeTx, manualApproval: manual },
    criticalHighCount: criticalHigh.length,
    dualRoot: {
      sharedTemplateNodes: 1375,
      dualInstancesNodes: 2750,
      recommendation: "Keep dual Category instances; do not duplicate Brand/Product/Attribute",
    },
    firstBatch,
    migrationNeeded: ["CategoryCommerceMode (later)", "CategoryAlias (later)", "path rebuild job (later)"],
    rollbackPlan: [
      "Do not hard-delete categories",
      "Alias old slug → new",
      "Transaction per ana category",
      "Checkpoint parentId/path JSON before batch",
      "Restore from checkpoint + soft-deleted rows",
    ],
    files: {
      archive: "docs/catalog-taxonomy/archive-validation-full.csv",
      createNew: "docs/catalog-taxonomy/create-new-validation-full.csv",
      move: "docs/catalog-taxonomy/move-validation-full.csv",
      splitMerge: "docs/catalog-taxonomy/split-merge-manual-validation.csv",
      gaps: "docs/catalog-taxonomy/target-tree-gap-review.csv",
      leafQuality: "docs/catalog-taxonomy/leaf-quality-review.csv",
      micro: "docs/catalog-taxonomy/micro-leaf-review.csv",
      dualRoot: "docs/catalog-taxonomy/dual-root-architecture-decision.md",
      attrIssues: "docs/catalog-taxonomy/attribute-quality-issues.csv",
      brandIssues: "docs/catalog-taxonomy/brand-quality-issues.csv",
      buckets: "docs/catalog-taxonomy/application-buckets-full.csv",
      validationJson: "scripts/output/catalog-taxonomy-full-validation.json",
    },
  };

  writeFileSync(join(SCRIPT_OUT, "catalog-taxonomy-full-validation.json"), JSON.stringify(validation, null, 2), "utf8");
  console.log(JSON.stringify(validation, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
