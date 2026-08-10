/**
 * Generate full catalog taxonomy conversion plan artifacts (READ-ONLY vs DB).
 * Does NOT mutate DB.
 *
 * Source: teklifbu_genis_kategori_agaci.md
 * Outputs: docs/catalog-taxonomy/* + scripts/output/catalog-taxonomy-full-dry-run.json
 *
 * npx tsx scripts/generate-catalog-taxonomy-plan.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { isShoppingCategorySlug } from "../src/lib/catalogSlug";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const MD =
  process.env.TAXONOMY_MD ||
  "C:\\Users\\ÇELEBİ\\Downloads\\teklifbu_genis_kategori_agaci.md";
const OUT_DIR = join(ROOT, "docs", "catalog-taxonomy");
const SCRIPT_OUT = join(ROOT, "scripts", "output");

type TNode = {
  name: string;
  depth: number;
  pathNames: string[];
  path: string;
  parentPath: string | null;
  children: TNode[];
  isLeaf: boolean;
};

function slugify(s: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  return s
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .toLowerCase()
    .replace(/&/g, "ve")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function norm(s: string) {
  return s
    .toLocaleLowerCase("tr")
    .replace(/&/g, "ve")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path: string, headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

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
  return roots;
}

function flatten(nodes: TNode[], out: TNode[] = []): TNode[] {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

function nodeType(n: TNode): "ROOT" | "GROUP" | "PRODUCT_GROUP" | "PRODUCT_TYPE" {
  if (n.depth === 0) return "ROOT";
  if (n.isLeaf) return "PRODUCT_TYPE";
  if (n.depth === 1) return "GROUP";
  return "PRODUCT_GROUP";
}

function suggestCommerce(
  path: string[],
  name: string,
  root: "ZERO" | "SECOND_HAND"
): "LISTING_ONLY" | "CATALOG_ONLY" | "BOTH" {
  const blob = norm([...path, name].join(" "));
  if (root === "SECOND_HAND") {
    if (/antika|koleksiyon|el yapimi|vintage|sanat/.test(blob)) return "LISTING_ONLY";
    if (/akilli telefon|dizustu|laptop|televizyon|oled|qled|camasir|buzdolabi|konsol|filtreli surahi/.test(norm(name)))
      return "LISTING_ONLY"; // used unique units often
    if (/tisort|ayakkabi|bisiklet|mobilya|aksesuar|kilif/.test(norm(name))) return "BOTH";
    return "LISTING_ONLY";
  }
  // ZERO
  if (/antika|koleksiyon|el yapimi|vintage/.test(blob)) return "LISTING_ONLY";
  if (
    /akilli telefon|tuslu telefon|katlanabilir|dizustu|laptop|tablet|televizyon|oled|qled|mini led|camasir|buzdolabi|bulasik|kurutma|klima|oyun konsolu|playstation|xbox|nintendo|filtreli surahi|airfryer|robot supurge|yazici|akilli saat/.test(
      norm(name)
    )
  )
    return "CATALOG_ONLY";
  if (/tisort|gomlek|elbise|ayakkabi|canta|bisiklet|masa|sandalye|koltuk|kilif|kablo|aksesuar/.test(norm(name)))
    return "BOTH";
  if (/yedek parca|parca/.test(norm(name))) return "BOTH";
  return "BOTH";
}

function suggestModelMode(name: string, commerce: string): "REQUIRED" | "OPTIONAL" | "DISABLED" {
  const n = norm(name);
  if (
    /akilli telefon|katlanabilir telefon|tablet|dizustu|laptop|televizyon|oled|qled|mini led|oyun konsolu|playstation|xbox|nintendo|dijital fotograf|yazici|klima|akilli saat|kulaklik|islemci|ekran karti|drone/.test(
      n
    )
  )
    return "REQUIRED";
  if (/tisort|gomlek|corap|kilif|kablo|mouse pad|saklama|kutu|askı|askı aparatı|hdmi/.test(n)) return "DISABLED";
  if (commerce === "LISTING_ONLY" && /ikinci|antika/.test(n)) return "DISABLED";
  if (/camasir|buzdolabi|bulasik|kahve|supurge|bisiklet|filtreli|tencere/.test(n)) return "OPTIONAL";
  return "OPTIONAL";
}

function attrPlanForLeaf(path: string, name: string): Array<Record<string, unknown>> {
  const n = norm(name);
  const pth = norm(path);
  const base: Array<Record<string, unknown>> = [];
  const push = (o: Record<string, unknown>) => base.push({ categoryPath: path, sortOrder: base.length + 1, source: "plan", ...o });

  // shared common
  if (/telefon|tablet|laptop|dizustu|televizyon|konsol|saat|kulaklik|kamera|yazici|klima|camasir|buzdolabi|supurge|kahve|surahi|bisiklet|tisort|ayakkabi|gomlek/.test(n + " " + pth)) {
    // brand/model are Brand/ProductModel entities — still list as form fields conceptually via notes
  }

  if (/akilli telefon|katlanabilir|tuslu telefon|outdoor telefon/.test(n)) {
    [
      ["Depolama", "depolama", "SINGLE_SELECT", true, true, "64 GB;128 GB;256 GB;512 GB;1 TB"],
      ["RAM", "ram", "SINGLE_SELECT", false, true, "4 GB;6 GB;8 GB;12 GB;16 GB"],
      ["Renk", "renk", "COLOR", false, true, "Siyah;Beyaz;Gri;Mavi;Altın;Mor;Diğer"],
      ["Ekran Boyutu", "ekran-boyutu", "SINGLE_SELECT", false, true, ""],
      ["İşletim Sistemi", "isletim-sistemi", "SINGLE_SELECT", false, true, "iOS;Android;HarmonyOS;Diğer"],
      ["SIM Tipi", "sim-tipi", "SINGLE_SELECT", false, true, "Tek SIM;Çift SIM;eSIM;Çift SIM + eSIM"],
      ["5G", "5g", "BOOLEAN", false, true, ""],
      ["Garanti", "garanti", "SINGLE_SELECT", false, false, "Yok;6 Ay;12 Ay;24 Ay"],
    ].forEach(([attributeName, attributeSlug, type, required, isVariant, optionValues], i) =>
      push({
        attributeName,
        attributeSlug,
        type,
        required,
        filterable: true,
        searchable: true,
        formVisible: true,
        detailVisible: true,
        comparisonVisible: true,
        isVariant,
        unit: "",
        optionValues,
        notes: i === 0 ? "variant key with renk" : "",
      })
    );
    return base;
  }

  if (/camasir makinesi/.test(n)) {
    [
      ["Kapasite", "yikama-kapasitesi", "SINGLE_SELECT", true, false, "5 kg;6 kg;7 kg;8 kg;9 kg;10 kg;12 kg"],
      ["Devir", "devir", "SINGLE_SELECT", false, true, "1000;1200;1400;1600"],
      ["Enerji Sınıfı", "enerji-sinifi", "SINGLE_SELECT", false, true, "A;B;C;D;E;F;G"],
      ["Kurutmalı", "kurutmali", "BOOLEAN", false, true, ""],
      ["Renk", "renk", "COLOR", false, true, "Beyaz;Gri;Siyah;Diğer"],
      ["Ses Seviyesi", "ses-seviyesi", "NUMBER", false, false, ""],
      ["Ölçüler", "olculer", "TEXT", false, false, ""],
      ["Garanti", "garanti", "SINGLE_SELECT", false, false, "12 Ay;24 Ay;36 Ay"],
    ].forEach(([attributeName, attributeSlug, type, required, filterable, optionValues]) =>
      push({
        attributeName,
        attributeSlug,
        type,
        required,
        filterable,
        searchable: true,
        formVisible: true,
        detailVisible: true,
        comparisonVisible: true,
        isVariant: false,
        unit: attributeSlug === "ses-seviyesi" ? "dB" : attributeSlug === "yikama-kapasitesi" ? "kg" : "",
        optionValues,
        notes: "REPLACE wrong fridge attrs if present on leaf",
      })
    );
    return base;
  }

  if (/tisort/.test(n)) {
    [
      ["Cinsiyet", "cinsiyet", "SINGLE_SELECT", true, false, "Kadın;Erkek;Unisex;Çocuk"],
      ["Beden", "beden", "SINGLE_SELECT", true, true, "XXS;XS;S;M;L;XL;XXL;3XL"],
      ["Renk", "renk", "COLOR", true, true, "Siyah;Beyaz;Gri;Mavi;Kırmızı;Yeşil;Diğer"],
      ["Kumaş", "kumas", "SINGLE_SELECT", false, true, "Pamuk;Polyester;Keten;Diğer"],
      ["Kalıp", "kalip", "SINGLE_SELECT", false, true, "Regular;Slim;Oversized;Relaxed"],
      ["Yaka", "yaka-tipi", "SINGLE_SELECT", false, true, "Bisiklet Yaka;V Yaka;Gömlek Yaka"],
      ["Kol Tipi", "kol-tipi", "SINGLE_SELECT", false, true, "Kısa Kol;Uzun Kol;Kolsuz"],
    ].forEach(([attributeName, attributeSlug, type, required, filterable, optionValues]) =>
      push({
        attributeName,
        attributeSlug,
        type,
        required,
        filterable,
        searchable: true,
        formVisible: true,
        detailVisible: true,
        comparisonVisible: attributeSlug === "beden" || attributeSlug === "renk",
        isVariant: attributeSlug === "beden" || attributeSlug === "renk",
        unit: "",
        optionValues,
        notes: "",
      })
    );
    return base;
  }

  if (/filtreli surahi/.test(n)) {
    [
      ["Kapasite", "kapasite", "SINGLE_SELECT", true, true, "1.5 L;2 L;2.5 L;3 L"],
      ["Filtre Tipi", "filtre-tipi", "SINGLE_SELECT", false, true, "Standart;MAXTRA+;Aktif Karbon"],
      ["Filtre Adedi", "filtre-adedi", "SINGLE_SELECT", false, true, "1;2;3;4;6"],
      ["Renk", "renk", "COLOR", false, true, "Siyah;Beyaz;Gri;Mavi;Diğer"],
      ["Malzeme", "malzeme", "SINGLE_SELECT", false, true, "Plastik;Cam;Tritan"],
      ["Filtre Değişim Göstergesi", "filtre-degisim-gostergesi", "BOOLEAN", false, true, ""],
      ["Garanti", "garanti", "SINGLE_SELECT", false, false, "Yok;12 Ay;24 Ay"],
    ].forEach(([attributeName, attributeSlug, type, required, filterable, optionValues]) =>
      push({
        attributeName,
        attributeSlug,
        type,
        required,
        filterable,
        searchable: true,
        formVisible: true,
        detailVisible: true,
        comparisonVisible: true,
        isVariant: ["kapasite", "renk", "filtre-adedi"].includes(String(attributeSlug)),
        unit: "",
        optionValues,
        notes: "",
      })
    );
    return base;
  }

  if (/bisiklet/.test(n) && !/aksesuar|kask|pompa/.test(n)) {
    [
      ["Bisiklet Tipi", "bisiklet-tipi", "SINGLE_SELECT", true, true, "Dağ;Şehir;Yol;Katlanır;Çocuk;Elektrikli"],
      ["Kadro Boyu", "kadro-boyu", "SINGLE_SELECT", false, true, ""],
      ["Jant Çapı", "jant-capi", "SINGLE_SELECT", false, true, "20;24;26;27.5;28;29"],
      ["Kadro Malzemesi", "kadro-malzemesi", "SINGLE_SELECT", false, true, "Alüminyum;Çelik;Karbon;Diğer"],
      ["Vites Sayısı", "vites-sayisi", "SINGLE_SELECT", false, true, "Tek;3;7;18;21;24;27"],
      ["Fren Tipi", "fren-tipi", "SINGLE_SELECT", false, true, "V-Brake;Disk;Hidrolik Disk"],
      ["Renk", "renk", "COLOR", false, true, "Siyah;Beyaz;Kırmızı;Mavi;Diğer"],
      ["Elektrikli", "elektrikli", "BOOLEAN", false, true, ""],
      ["Garanti", "garanti", "SINGLE_SELECT", false, false, "12 Ay;24 Ay"],
    ].forEach(([attributeName, attributeSlug, type, required, filterable, optionValues]) =>
      push({
        attributeName,
        attributeSlug,
        type,
        required,
        filterable,
        searchable: true,
        formVisible: true,
        detailVisible: true,
        comparisonVisible: true,
        isVariant: attributeSlug === "renk",
        unit: attributeSlug === "jant-capi" ? "inç" : "",
        optionValues,
        notes: "DB leaf currently missing attrs",
      })
    );
    return base;
  }

  // generic template for other leaves
  push({
    attributeName: "Renk",
    attributeSlug: "renk",
    type: "COLOR",
    required: false,
    filterable: true,
    searchable: true,
    formVisible: true,
    detailVisible: true,
    comparisonVisible: false,
    isVariant: true,
    unit: "",
    optionValues: "Siyah;Beyaz;Gri;Mavi;Kırmızı;Diğer",
    notes: "generic plan — refine per leaf in FAZ A",
  });
  push({
    attributeName: "Garanti",
    attributeSlug: "garanti",
    type: "SINGLE_SELECT",
    required: false,
    filterable: false,
    searchable: false,
    formVisible: true,
    detailVisible: true,
    comparisonVisible: false,
    isVariant: false,
    unit: "",
    optionValues: "Yok;6 Ay;12 Ay;24 Ay",
    notes: "generic",
  });
  return base;
}

function brandGroupFor(path: string, name: string): Array<Record<string, unknown>> {
  const n = norm(name);
  const pth = norm(path);
  const rows: Array<Record<string, unknown>> = [];
  const add = (brandName: string, featured: boolean) =>
    rows.push({
      categoryPath: path,
      brandName,
      brandSlug: slugify(brandName),
      featured,
      allowUnbranded: /tisort|moda|aksesuar|el yapimi|mobilya/.test(pth + " " + n),
      source: "plan",
      notes: "seed later — plan only",
    });

  if (/telefon|tablet|akilli saat/.test(n + pth)) {
    ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Google", "OnePlus"].forEach((b, i) => add(b, i < 5));
  } else if (/camasir|buzdolabi|bulasik|kurutma/.test(n)) {
    ["Arçelik", "Beko", "Bosch", "Siemens", "Profilo", "Vestel", "Samsung", "LG"].forEach((b, i) => add(b, i < 6));
  } else if (/tisort|moda/.test(n + pth)) {
    ["Nike", "Adidas", "Mavi", "Koton", "LC Waikiki", "Defacto", "Zara"].forEach((b, i) => add(b, i < 3));
  } else if (/filtreli surahi|mutfak/.test(n + pth)) {
    ["Brita", "Karaca", "Tefal", "Emsan", "Korkmaz"].forEach((b, i) => add(b, i < 2));
  } else if (/bisiklet/.test(n)) {
    ["Bianchi", "Salcano", "Kron", "Carraro", "Decathlon", "Trek", "Giant"].forEach((b, i) => add(b, i < 4));
  } else {
    add("Diğer", false);
  }
  return rows;
}

type DbCat = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  parentId: string | null;
  parentName: string | null;
  level: number;
  modelMode: string;
  side: "sifir" | "ikinci" | "root";
  childCount: number;
  listingCount: number;
  productCount: number;
  offerCount: number;
  brandCount: number;
  attrCount: number;
  modelCount: number;
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(SCRIPT_OUT, { recursive: true });

  if (!existsSync(MD)) throw new Error("Taxonomy MD not found: " + MD);
  const targetRoots = parseMd(readFileSync(MD, "utf8"));
  const targetAll = flatten(targetRoots);
  const targetLeaves = targetAll.filter((n) => n.isLeaf);
  const targetMid = targetAll.filter((n) => !n.isLeaf && n.depth > 0);

  // --- full-target-tree.json ---
  function mapTree(n: TNode, rootType: "SHARED_TEMPLATE"): Record<string, unknown> {
    const commerceZ = suggestCommerce(n.pathNames, n.name, "ZERO");
    const commerceS = suggestCommerce(n.pathNames, n.name, "SECOND_HAND");
    return {
      name: n.name,
      slug: slugify(n.pathNames.join("-")),
      path: n.path,
      parentPath: n.parentPath,
      nodeType: nodeType(n),
      isLeaf: n.isLeaf,
      rootType,
      commerceModeRecommendation: { zero: commerceZ, secondHand: commerceS },
      modelModeRecommendation: suggestModelMode(n.name, commerceZ),
      priority: n.depth === 0 ? 1 : n.isLeaf ? 3 : 2,
      rolloutPhase: targetRoots.findIndex((r) => r.name === n.pathNames[0]) + 1 || 99,
      source: "teklifbu_genis_kategori_agaci.md",
      notes: "",
      children: n.children.map((c) => mapTree(c, rootType)),
    };
  }

  const fullTree = {
    meta: {
      source: MD,
      generatedAt: new Date().toISOString(),
      ana: targetRoots.length,
      mid: targetMid.length,
      leaves: targetLeaves.length,
      total: targetAll.length,
      dualRoot:
        "SHARED_TEMPLATE commercial tree; instantiate under sifir-urun and ikinci-el Category roots without duplicating Brand/Product/Attribute",
    },
    roots: targetRoots.map((r) => mapTree(r, "SHARED_TEMPLATE")),
  };
  writeFileSync(join(OUT_DIR, "full-target-tree.json"), JSON.stringify(fullTree, null, 2), "utf8");

  // --- load DB ---
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
      level: true,
      modelMode: true,
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

  // offer counts via products in category — single query
  const offers = await prisma.sellerOffer.findMany({
    where: { deletedAt: null },
    select: { product: { select: { categoryId: true } } },
  });
  const offerByCat = new Map<string, number>();
  for (const o of offers) {
    const cid = o.product?.categoryId;
    if (!cid) continue;
    offerByCat.set(cid, (offerByCat.get(cid) || 0) + 1);
  }

  const dbRows: DbCat[] = shopping.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    path: c.path,
    parentId: c.parentId,
    parentName: c.parent?.name || null,
    level: c.level,
    modelMode: c.modelMode,
    side: c.slug.startsWith("sifir") ? "sifir" : c.slug.startsWith("ikinci") ? "ikinci" : "root",
    childCount: c._count.children,
    listingCount: c._count.listings,
    productCount: c._count.products,
    offerCount: offerByCat.get(c.id) || 0,
    brandCount: c._count.categoryBrands,
    attrCount: c._count.categoryAttributes,
    modelCount: c._count.categoryModels,
  }));

  const dbSifir = dbRows.filter((c) => c.side === "sifir");
  const byNormName = new Map<string, DbCat[]>();
  for (const c of dbSifir) {
    const k = norm(c.name);
    const list = byNormName.get(k) || [];
    list.push(c);
    byNormName.set(k, list);
  }

  function findDb(t: TNode): DbCat | undefined {
    const cands = byNormName.get(norm(t.name)) || [];
    if (!cands.length) return undefined;
    if (cands.length === 1) return cands[0];
    if (t.parentPath) {
      const pn = norm(t.pathNames[t.pathNames.length - 2] || "");
      const hit = cands.find((c) => c.parentName && norm(c.parentName) === pn);
      if (hit) return hit;
    }
    return cands[0];
  }

  // known split sources
  const SPLIT_SOURCES: Array<{
    re: RegExp;
    targets: string[];
    rule: string;
  }> = [
    {
      re: /cep telefonu.*aksesuar/i,
      targets: ["Elektronik › Telefon ve Aksesuar › Cep Telefonu", "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları"],
      rule: "split group: phones vs accessories by title/attrs",
    },
    {
      re: /sarj.*powerbank/i,
      targets: [
        "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Şarj Adaptörü",
        "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Powerbank",
      ],
      rule: "title keyword: powerbank|şarj|adaptör",
    },
    {
      re: /akilli saat.*bileklik/i,
      targets: [
        "Elektronik › Telefon ve Aksesuar › Giyilebilir Teknoloji › Akıllı Saat",
        "Elektronik › Telefon ve Aksesuar › Giyilebilir Teknoloji › Akıllı Bileklik",
      ],
      rule: "title keyword: saat|bileklik",
    },
    {
      re: /yazici.*tarayici/i,
      targets: [
        "Elektronik › Bilgisayar ve Tablet › Bilgisayar Çevre Birimleri › Yazıcı",
        "Elektronik › Bilgisayar ve Tablet › Bilgisayar Çevre Birimleri › Tarayıcı",
      ],
      rule: "title keyword: yazıcı|tarayıcı|scanner",
    },
    {
      re: /kulaklik.*bluetooth/i,
      targets: [
        "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Bluetooth Kulaklık",
        "Elektronik › Televizyon, Görüntü ve Ses › Kulaklık",
      ],
      rule: "manual — bluetooth vs general headphone taxonomy",
    },
  ];

  const mappingRows: Record<string, unknown>[] = [];
  const splitRows: Record<string, unknown>[] = [];
  const mergeRows: Record<string, unknown>[] = [];
  const aliasRows: Record<string, unknown>[] = [];
  const commerceRows: Record<string, unknown>[] = [];
  const modelRows: Record<string, unknown>[] = [];
  const attrRows: Record<string, unknown>[] = [];
  const variantRows: Record<string, unknown>[] = [];
  const brandRows: Record<string, unknown>[] = [];

  const actionCounts: Record<string, number> = {};
  const riskCounts: Record<string, number> = {};
  let preserveId = 0;
  let createNew = 0;

  const matchedDbIds = new Set<string>();

  for (const t of targetAll) {
    const db = findDb(t);
    const zMode = suggestCommerce(t.pathNames, t.name, "ZERO");
    const sMode = suggestCommerce(t.pathNames, t.name, "SECOND_HAND");
    const mMode = suggestModelMode(t.name, zMode);

    let action = "CREATE_NEW";
    let risk = "LOW";
    let notes = "";
    let preserve = false;
    let redirect = false;
    let alias = false;
    let splitGroup = "";
    let mergeGroup = "";

    if (db) {
      matchedDbIds.add(db.id);
      preserve = true;
      preserveId++;
      const parentOk =
        !t.parentPath ||
        !db.parentName ||
        norm(db.parentName) === norm(t.pathNames[t.pathNames.length - 2] || "");
      if (norm(db.name) !== norm(t.name)) {
        action = "RENAME";
        notes = `rename '${db.name}' → '${t.name}'`;
      } else if (!parentOk) {
        action = "MOVE";
        notes = `move from parent '${db.parentName}' → '${t.pathNames[t.pathNames.length - 2] || ""}'`;
      } else {
        action = "KEEP";
      }
      if (db.productCount || db.offerCount || db.modelCount) risk = "HIGH";
      if ((db.productCount || db.offerCount) && (action === "MOVE" || action === "RENAME")) risk = "CRITICAL";
      if (db.listingCount && db.productCount) risk = "CRITICAL";
      redirect = action === "RENAME" || action === "MOVE";
      alias = redirect;
    } else {
      createNew++;
      action = "CREATE_NEW";
      // check if this target is part of a known split of an existing compound node
      for (const sp of SPLIT_SOURCES) {
        // if any db compound matches and this target is one of split targets
        if (sp.targets.some((x) => norm(x) === norm(t.path) || t.path.startsWith(x))) {
          notes = "may receive records from split: " + sp.rule;
          risk = "MEDIUM";
        }
      }
    }

    actionCounts[action] = (actionCounts[action] || 0) + 1;
    riskCounts[risk] = (riskCounts[risk] || 0) + 1;

    mappingRows.push({
      currentCategoryId: db?.id || "",
      currentName: db?.name || "",
      currentSlug: db?.slug || "",
      currentPath: db?.path || "",
      currentParentId: db?.parentId || "",
      currentRoot: db?.side || "",
      targetName: t.name,
      targetSlug: slugify(t.pathNames.join("-")),
      targetPath: t.path,
      targetParentPath: t.parentPath || "",
      action,
      canonicalTargetCategoryId: db?.id || "",
      preserveId: preserve,
      redirectRequired: redirect,
      aliasRequired: alias,
      splitGroup,
      mergeGroup,
      listingCount: db?.listingCount || 0,
      productCount: db?.productCount || 0,
      sellerOfferCount: db?.offerCount || 0,
      categoryBrandCount: db?.brandCount || 0,
      categoryAttributeCount: db?.attrCount || 0,
      categoryModelCount: db?.modelCount || 0,
      riskLevel: risk,
      notes,
    });

    if (t.isLeaf) {
      commerceRows.push({
        categoryPath: t.path,
        zeroRootMode: zMode,
        secondHandRootMode: sMode,
        classicListingAllowed: zMode !== "CATALOG_ONLY" || sMode !== "CATALOG_ONLY",
        catalogOfferAllowed: zMode !== "LISTING_ONLY",
        reason: `heuristic leaf policy; zero=${zMode} secondHand=${sMode}`,
        notes: "",
      });
      modelRows.push({
        categoryPath: t.path,
        modelMode: mMode,
        reason: mMode === "REQUIRED" ? "identifiable commercial model" : mMode === "DISABLED" ? "apparel/accessory style" : "optional model",
        requiresSeedModels: mMode === "REQUIRED",
        priority: mMode === "REQUIRED" ? 1 : mMode === "OPTIONAL" ? 2 : 3,
        notes: "",
      });

      const attrs = attrPlanForLeaf(t.path, t.name);
      for (const a of attrs) attrRows.push(a);
      const variants = attrs.filter((a) => a.isVariant);
      for (const v of variants) {
        variantRows.push({
          categoryPath: t.path,
          variantAttributeSlug: v.attributeSlug,
          requiredForVariant: Boolean(v.required),
          sortOrder: v.sortOrder,
          duplicateKeyRule: "attributesHash sorted option ids",
          notes: String(v.notes || ""),
        });
      }
      for (const b of brandGroupFor(t.path, t.name)) brandRows.push(b);
    }
  }

  // DB extras → ARCHIVE / MANUAL_REVIEW / SPLIT
  for (const db of dbSifir) {
    if (matchedDbIds.has(db.id)) continue;
    let action = "ARCHIVE";
    let risk = "LOW";
    let notes = "in DB (sifir) but not in target MD by name match";
    let splitGroup = "";

    const compounds: Array<{ re: RegExp; targets: string[]; rule: string }> = [
      ...SPLIT_SOURCES,
      {
        re: /tv.*goruntu.*ses/i,
        targets: ["Elektronik › Televizyon, Görüntü ve Ses"],
        rule: "legacy TV wrapper — alias to Televizyon, Görüntü ve Ses group",
      },
      {
        re: /beyaz esya/i,
        targets: ["Ev Aletleri › Beyaz Eşya"],
        rule: "beyaz eşya group alignment",
      },
      {
        re: /ev elektronigi|teknik elektronik/i,
        targets: ["Elektronik"],
        rule: "fold legacy electronics ana into Elektronik — MANUAL_REVIEW children",
      },
      {
        re: /ayakkabi.*canta/i,
        targets: ["Moda"],
        rule: "Ayakkabı & Çanta ana → Moda subtree — MANUAL_REVIEW",
      },
      {
        re: /^muzik$/i,
        targets: ["Hobi ve Oyun"],
        rule: "Müzik ana → Hobi/Oyun or separate review",
      },
      {
        re: /diger her sey|diger-alisveris/i,
        targets: [],
        rule: "Diğer Her Şey — ARCHIVE or MANUAL_REVIEW",
      },
    ];

    for (const sp of compounds) {
      if (sp.re.test(db.name) || sp.re.test(db.slug)) {
        if (sp.targets.length >= 2) {
          action = "SPLIT";
          splitGroup = sp.targets.join(" | ");
          risk = db.productCount || db.listingCount ? "CRITICAL" : "HIGH";
          notes = sp.rule;
          for (const targetPath of sp.targets) {
            splitRows.push({
              sourceCategoryId: db.id,
              sourceName: db.name,
              sourcePath: db.path || db.slug,
              targetCategoryPath: targetPath,
              assignmentRule: sp.rule,
              autoAssignable: false,
              manualReviewRequired: true,
              affectedListingCount: db.listingCount,
              affectedProductCount: db.productCount,
              affectedSellerOfferCount: db.offerCount,
              affectedBrandLinks: db.brandCount,
              affectedAttributeLinks: db.attrCount,
              affectedModelLinks: db.modelCount,
              riskLevel: risk,
              notes,
            });
          }
        } else if (sp.targets.length === 1) {
          action = "MANUAL_REVIEW";
          notes = sp.rule + " → " + sp.targets[0];
          risk = db.productCount || db.listingCount ? "HIGH" : "MEDIUM";
        } else {
          action = "ARCHIVE";
          notes = sp.rule;
          risk = db.listingCount || db.productCount ? "HIGH" : "LOW";
        }
        break;
      }
    }

    if (action === "ARCHIVE") {
      for (const sp of SPLIT_SOURCES) {
        if (sp.re.test(db.name) || sp.re.test(db.slug)) {
          action = "SPLIT";
          splitGroup = sp.targets.join(" | ");
          risk = db.productCount || db.listingCount ? "CRITICAL" : "HIGH";
          notes = sp.rule;
          for (const targetPath of sp.targets) {
            splitRows.push({
              sourceCategoryId: db.id,
              sourceName: db.name,
              sourcePath: db.path || db.slug,
              targetCategoryPath: targetPath,
              assignmentRule: sp.rule,
              autoAssignable: !/manual/i.test(sp.rule),
              manualReviewRequired: true,
              affectedListingCount: db.listingCount,
              affectedProductCount: db.productCount,
              affectedSellerOfferCount: db.offerCount,
              affectedBrandLinks: db.brandCount,
              affectedAttributeLinks: db.attrCount,
              affectedModelLinks: db.modelCount,
              riskLevel: risk,
              notes,
            });
          }
          break;
        }
      }
    }

    if (norm(db.name) === "bisiklet" && db.parentName && norm(db.parentName) === "bisiklet") {
      action = "MERGE";
      risk = "MEDIUM";
      notes = "Bisiklet→Bisiklet nest: merge leaf into parent or rename parent";
      mergeRows.push({
        sourceCategoryId: db.id,
        sourcePath: db.path || db.slug,
        targetCategoryPath: "Spor ve Outdoor › Bisiklet",
        preserveTargetId: true,
        moveChildren: true,
        moveRelations: true,
        aliasOldPath: db.path || db.slug,
        affectedListingCount: db.listingCount,
        affectedProductCount: db.productCount,
        affectedSellerOfferCount: db.offerCount,
        riskLevel: risk,
        notes,
      });
    }

    if (db.productCount || db.offerCount || db.modelCount) risk = risk === "LOW" ? "HIGH" : risk;
    if (db.listingCount && db.productCount) risk = "CRITICAL";

    actionCounts[action] = (actionCounts[action] || 0) + 1;
    riskCounts[risk] = (riskCounts[risk] || 0) + 1;

    mappingRows.push({
      currentCategoryId: db.id,
      currentName: db.name,
      currentSlug: db.slug,
      currentPath: db.path || "",
      currentParentId: db.parentId || "",
      currentRoot: db.side,
      targetName: "",
      targetSlug: "",
      targetPath: "",
      targetParentPath: "",
      action,
      canonicalTargetCategoryId: "",
      preserveId: action === "SPLIT" || action === "MERGE",
      redirectRequired: true,
      aliasRequired: true,
      splitGroup,
      mergeGroup: action === "MERGE" ? "bisiklet-nest" : "",
      listingCount: db.listingCount,
      productCount: db.productCount,
      sellerOfferCount: db.offerCount,
      categoryBrandCount: db.brandCount,
      categoryAttributeCount: db.attrCount,
      categoryModelCount: db.modelCount,
      riskLevel: risk,
      notes,
    });

    if (action === "ARCHIVE" || action === "SPLIT" || action === "MERGE" || action === "RENAME" || action === "MOVE") {
      aliasRows.push({
        oldSlug: db.slug,
        oldPath: db.path || "",
        oldCategoryId: db.id,
        targetCategoryId: "",
        targetPath: splitGroup || "",
        redirectType: action === "SPLIT" ? "MANUAL_REVIEW" : "INTERNAL_ALIAS",
        reason: notes,
        preserveSeo: true,
        active: true,
        notes: action,
      });
    }
  }

  // soft-deleted wrappers aliases
  const soft = await prisma.category.findMany({
    where: {
      deletedAt: { not: null },
      OR: [{ slug: { startsWith: "sifir-urun" } }, { slug: { startsWith: "ikinci-el" } }],
    },
    select: { id: true, slug: true, path: true, name: true, parent: { select: { id: true, path: true, slug: true } } },
    take: 50,
  });
  for (const s of soft) {
    aliasRows.push({
      oldSlug: s.slug,
      oldPath: s.path || "",
      oldCategoryId: s.id,
      targetCategoryId: s.parent?.id || "",
      targetPath: s.parent?.path || s.parent?.slug || "",
      redirectType: "301",
      reason: "soft-deleted near-duplicate wrapper",
      preserveSeo: true,
      active: true,
      notes: s.name,
    });
  }

  // wrong attr report snippet for washer
  const washer = dbSifir.find((c) => /camasir/.test(c.slug) && c.childCount === 0);
  let wrongAttrNotes = "";
  if (washer) {
    const links = await prisma.categoryAttribute.findMany({
      where: { categoryId: washer.id },
      include: { attribute: { select: { slug: true, name: true } } },
    });
    const bad = links.filter((l) => /hacim|kapi-tipi|no-frost/.test(l.attribute.slug));
    if (bad.length) {
      wrongAttrNotes = `Çamaşır Makinesi has fridge attrs: ${bad.map((b) => b.attribute.slug).join(",")}`;
    }
  }

  writeCsv(
    join(OUT_DIR, "category-mapping-full.csv"),
    [
      "currentCategoryId",
      "currentName",
      "currentSlug",
      "currentPath",
      "currentParentId",
      "currentRoot",
      "targetName",
      "targetSlug",
      "targetPath",
      "targetParentPath",
      "action",
      "canonicalTargetCategoryId",
      "preserveId",
      "redirectRequired",
      "aliasRequired",
      "splitGroup",
      "mergeGroup",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "categoryBrandCount",
      "categoryAttributeCount",
      "categoryModelCount",
      "riskLevel",
      "notes",
    ],
    mappingRows
  );

  writeCsv(
    join(OUT_DIR, "category-splits-full.csv"),
    [
      "sourceCategoryId",
      "sourceName",
      "sourcePath",
      "targetCategoryPath",
      "assignmentRule",
      "autoAssignable",
      "manualReviewRequired",
      "affectedListingCount",
      "affectedProductCount",
      "affectedSellerOfferCount",
      "affectedBrandLinks",
      "affectedAttributeLinks",
      "affectedModelLinks",
      "riskLevel",
      "notes",
    ],
    splitRows
  );

  writeCsv(
    join(OUT_DIR, "category-merges-full.csv"),
    [
      "sourceCategoryId",
      "sourcePath",
      "targetCategoryPath",
      "preserveTargetId",
      "moveChildren",
      "moveRelations",
      "aliasOldPath",
      "affectedListingCount",
      "affectedProductCount",
      "affectedSellerOfferCount",
      "riskLevel",
      "notes",
    ],
    mergeRows
  );

  writeCsv(
    join(OUT_DIR, "category-aliases-full.csv"),
    [
      "oldSlug",
      "oldPath",
      "oldCategoryId",
      "targetCategoryId",
      "targetPath",
      "redirectType",
      "reason",
      "preserveSeo",
      "active",
      "notes",
    ],
    aliasRows
  );

  writeCsv(
    join(OUT_DIR, "category-commerce-mode-full.csv"),
    ["categoryPath", "zeroRootMode", "secondHandRootMode", "classicListingAllowed", "catalogOfferAllowed", "reason", "notes"],
    commerceRows
  );

  writeCsv(
    join(OUT_DIR, "category-model-mode-full.csv"),
    ["categoryPath", "modelMode", "reason", "requiresSeedModels", "priority", "notes"],
    modelRows
  );

  writeCsv(
    join(OUT_DIR, "category-attributes-full.csv"),
    [
      "categoryPath",
      "attributeName",
      "attributeSlug",
      "type",
      "required",
      "filterable",
      "searchable",
      "formVisible",
      "detailVisible",
      "comparisonVisible",
      "isVariant",
      "unit",
      "sortOrder",
      "optionValues",
      "source",
      "notes",
    ],
    attrRows
  );

  writeCsv(
    join(OUT_DIR, "category-variants-full.csv"),
    ["categoryPath", "variantAttributeSlug", "requiredForVariant", "sortOrder", "duplicateKeyRule", "notes"],
    variantRows
  );

  writeCsv(
    join(OUT_DIR, "category-brands-full.csv"),
    ["categoryPath", "brandName", "brandSlug", "featured", "allowUnbranded", "source", "notes"],
    brandRows
  );

  // Phone risk report
  const phoneDb = dbSifir.filter(
    (c) => /telefon|cep-telefonu|akilli-saat|bileklik|kilif|sarj|kulaklik/.test(c.slug + c.name)
  );
  const phoneMd = [
    `# Telefon migration risk report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Status: PLAN ONLY — no DB writes`,
    ``,
    `## Current DB phone-related nodes (Sıfır)`,
    `| name | slug | listings | products | offers | brands | attrs | models |`,
    `|---|---|---:|---:|---:|---:|---:|---:|`,
    ...phoneDb.map(
      (c) =>
        `| ${c.name} | \`${c.slug}\` | ${c.listingCount} | ${c.productCount} | ${c.offerCount} | ${c.brandCount} | ${c.attrCount} | ${c.modelCount} |`
    ),
    ``,
    `## Target phone tree (from MD)`,
    `- Elektronik › Telefon ve Aksesuar › Cep Telefonu › (Akıllı/Tuşlu/Katlanabilir/Outdoor)`,
    `- … › Telefon Aksesuarları › …`,
    `- … › Giyilebilir Teknoloji › …`,
    `- … › İletişim Cihazları › …`,
    ``,
    `## Preserve IDs`,
    `- Prefer KEEP/MOVE for \`sifir-urun-cep-telefonu__akilli-telefon\` and \`…__tuslu-telefon\``,
    `- Split \`Cep Telefonu & Aksesuar\` / compound accessory leaves — MANUAL_REVIEW`,
    ``,
    `## Auto vs manual`,
    `- Auto: alias for soft-deleted wrappers`,
    `- Manual: Product/Listing reassignment on SPLIT`,
    ``,
    `## Rollback`,
    `- Checkpoint category parentId/path before batch`,
    `- Keep old slug as CategoryAlias`,
    `- Do not hard-delete categories with relations`,
    ``,
    wrongAttrNotes ? `## Related attr debt\n${wrongAttrNotes}\n` : "",
  ].join("\n");
  writeFileSync(join(OUT_DIR, "phone-migration-risk-report.md"), phoneMd, "utf8");

  // Critical areas brief
  const areas = [
    { key: "Beyaz Eşya", re: /beyaz-esya|camasir|buzdolabi|bulasik|kurutma/ },
    { key: "Moda", re: /moda|tisort|giyim|ayakkabi/ },
    { key: "Bisiklet", re: /bisiklet/ },
    { key: "Endüstriyel", re: /is-makinesi|tarim|sanayi|endustriyel/ },
    { key: "Otomotiv", re: /otomotiv|arac/ },
    { key: "Kozmetik", re: /kozmetik|bakim|kisisel-bakim/ },
    { key: "Pet Shop", re: /pet/ },
  ];
  const critMd = [
    `# Critical area risk summaries`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    ...areas.map((a) => {
      const nodes = dbSifir.filter((c) => a.re.test(c.slug + " " + c.name));
      const sums = nodes.reduce(
        (acc, c) => {
          acc.l += c.listingCount;
          acc.p += c.productCount;
          acc.o += c.offerCount;
          acc.b += c.brandCount;
          acc.a += c.attrCount;
          acc.m += c.modelCount;
          return acc;
        },
        { l: 0, p: 0, o: 0, b: 0, a: 0, m: 0 }
      );
      return [
        `## ${a.key}`,
        `- DB nodes: ${nodes.length}`,
        `- Listings: ${sums.l} · Products: ${sums.p} · Offers: ${sums.o}`,
        `- Brand links: ${sums.b} · Attr links: ${sums.a} · Model links: ${sums.m}`,
        `- Risks: split/merge of compound nodes; brand relevance; attr schema quality`,
        ``,
      ].join("\n");
    }),
    wrongAttrNotes ? `## Known wrong attributes\n${wrongAttrNotes}\n` : "",
  ].join("\n");
  writeFileSync(join(OUT_DIR, "critical-areas-risk-summary.md"), critMd, "utf8");

  // Micro-split candidates in target (report only)
  const micro: string[] = [];
  for (const leaf of targetLeaves) {
    const siblings = targetAll.filter(
      (n) => n.parentPath === leaf.parentPath && n.isLeaf && n.name !== leaf.name
    );
    if (siblings.length >= 8 && leaf.depth >= 3) {
      micro.push(leaf.path);
    }
  }

  const dryRun = {
    generatedAt: new Date().toISOString(),
    sourceMd: MD,
    dbMutations: false,
    totals: {
      targetAna: targetRoots.length,
      targetMid: targetMid.length,
      targetLeaves: targetLeaves.length,
      targetTotal: targetAll.length,
      dbShoppingActive: dbRows.length,
      dbSifir: dbSifir.length,
      dbIkinci: dbRows.filter((c) => c.side === "ikinci").length,
    },
    actions: actionCounts,
    risks: riskCounts,
    preserveId,
    createNew,
    redirectAliasRows: aliasRows.length,
    splitRows: splitRows.length,
    mergeRows: mergeRows.length,
    affected: {
      listings: mappingRows.reduce((s, r) => s + Number(r.listingCount || 0), 0),
      products: mappingRows.reduce((s, r) => s + Number(r.productCount || 0), 0),
      sellerOffers: mappingRows.reduce((s, r) => s + Number(r.sellerOfferCount || 0), 0),
      categoryBrands: mappingRows.reduce((s, r) => s + Number(r.categoryBrandCount || 0), 0),
      categoryAttributes: mappingRows.reduce((s, r) => s + Number(r.categoryAttributeCount || 0), 0),
      categoryModels: mappingRows.reduce((s, r) => s + Number(r.categoryModelCount || 0), 0),
    },
    autoApplicable: ["KEEP", "ALIAS_ONLY", "INTERNAL_ALIAS for soft-deleted wrappers"],
    manualApprovalRequired: ["SPLIT", "MERGE", "MOVE with Product/Listing", "CREATE_NEW bulk"],
    microSeparationCandidatesSample: micro.slice(0, 40),
    microSeparationCandidatesCount: micro.length,
    wrongAttrNotes,
    files: {
      mapping: "docs/catalog-taxonomy/category-mapping-full.csv",
      tree: "docs/catalog-taxonomy/full-target-tree.json",
      splits: "docs/catalog-taxonomy/category-splits-full.csv",
      merges: "docs/catalog-taxonomy/category-merges-full.csv",
      aliases: "docs/catalog-taxonomy/category-aliases-full.csv",
      commerce: "docs/catalog-taxonomy/category-commerce-mode-full.csv",
      model: "docs/catalog-taxonomy/category-model-mode-full.csv",
      attributes: "docs/catalog-taxonomy/category-attributes-full.csv",
      variants: "docs/catalog-taxonomy/category-variants-full.csv",
      brands: "docs/catalog-taxonomy/category-brands-full.csv",
      phone: "docs/catalog-taxonomy/phone-migration-risk-report.md",
      critical: "docs/catalog-taxonomy/critical-areas-risk-summary.md",
    },
    rollout: targetRoots.map((r, i) => ({
      order: i + 1,
      ana: r.name,
      nodes: flatten([r]).length,
      leaves: flatten([r]).filter((n) => n.isLeaf).length,
    })),
  };

  writeFileSync(join(SCRIPT_OUT, "catalog-taxonomy-full-dry-run.json"), JSON.stringify(dryRun, null, 2), "utf8");
  writeFileSync(join(OUT_DIR, "README.md"), `# Catalog taxonomy conversion plan\n\nGenerated ${dryRun.generatedAt}\n\nRead-only plan artifacts. Do not apply without approval.\n\nSee dry-run: \`scripts/output/catalog-taxonomy-full-dry-run.json\`\n`, "utf8");

  console.log(JSON.stringify({ ok: true, dryRunSummary: dryRun.totals, actions: actionCounts, risks: riskCounts, outDir: OUT_DIR }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
