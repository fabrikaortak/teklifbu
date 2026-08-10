/**
 * Shrink MANUAL_APPROVAL: finalize duplicate/create, archive reclass, split rules,
 * attribute templates, brand quality, and batch plans.
 * READ-ONLY — never mutates DB.
 *
 * npx tsx scripts/catalog-taxonomy-manual-decisions.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "catalog-taxonomy");
const SCRIPT_OUT = join(ROOT, "scripts", "output");
const MD =
  process.env.TAXONOMY_MD ||
  "C:\\Users\\ÇELEBİ\\Downloads\\teklifbu_genis_kategori_agaci.md";

type Row = Record<string, string>;

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
function parseCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Row = {};
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
function mainSeg(path: string): string {
  return (path || "").split(/\s*[›>]\s*/)[0]?.trim() || "";
}
function leafName(path: string): string {
  const parts = (path || "").split(/\s*[›>]\s*/);
  return parts[parts.length - 1]?.trim() || path;
}
function parentOf(path: string): string {
  const parts = (path || "").split(/\s*[›>]\s*/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";
}

type TNode = { name: string; path: string; parentPath: string | null; isLeaf: boolean; depth: number; pathNames: string[]; children: TNode[] };
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
    const node: TNode = { name, depth, pathNames: [], path: "", parentPath: null, children: [], isLeaf: true };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length) {
      const parent = stack[stack.length - 1];
      parent.children.push(node);
      parent.isLeaf = false;
      node.pathNames = [...parent.pathNames, name];
      node.parentPath = parent.pathNames.join(" › ");
    } else {
      node.pathNames = [name];
    }
    node.path = node.pathNames.join(" › ");
    if (!stack.length) roots.push(node);
    stack.push(node);
  }
  const out: TNode[] = [];
  const walk = (ns: TNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(roots);
  return out;
}

type AttrDef = {
  attributeName: string;
  attributeSlug: string;
  type: string;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  comparisonVisible: boolean;
  isVariant: boolean;
  optionValues: string;
  unit: string;
  sortOrder: number;
};

function A(
  name: string,
  slug: string,
  type: string,
  opts: Partial<AttrDef> & { sortOrder: number }
): AttrDef {
  return {
    attributeName: name,
    attributeSlug: slug,
    type,
    required: opts.required ?? false,
    filterable: opts.filterable ?? true,
    searchable: opts.searchable ?? true,
    comparisonVisible: opts.comparisonVisible ?? true,
    isVariant: opts.isVariant ?? false,
    optionValues: opts.optionValues ?? "",
    unit: opts.unit ?? "",
    sortOrder: opts.sortOrder,
  };
}

const TEMPLATES: Record<string, AttrDef[]> = {
  PHONE: [
    A("Depolama", "depolama", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "64 GB;128 GB;256 GB;512 GB;1 TB", sortOrder: 1 }),
    A("RAM", "ram", "SINGLE_SELECT", { isVariant: true, optionValues: "4 GB;6 GB;8 GB;12 GB;16 GB", sortOrder: 2 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Siyah;Beyaz;Gri;Mavi;Altın;Mor;Diğer", sortOrder: 3 }),
    A("Ekran Boyutu", "ekran-boyutu", "SINGLE_SELECT", { optionValues: "5.5;6.1;6.5;6.7;6.8;7.0", unit: "inç", sortOrder: 4 }),
    A("İşletim Sistemi", "isletim-sistemi", "SINGLE_SELECT", { optionValues: "iOS;Android;HarmonyOS;Diğer", sortOrder: 5 }),
    A("SIM Tipi", "sim-tipi", "SINGLE_SELECT", { optionValues: "Tek SIM;Çift SIM;eSIM;Çift SIM + eSIM", sortOrder: 6 }),
    A("5G", "5g", "BOOLEAN", { sortOrder: 7 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "Yok;6 Ay;12 Ay;24 Ay", sortOrder: 8 }),
  ],
  COMPUTER: [
    A("İşlemci", "islemci", "SINGLE_SELECT", { required: true, optionValues: "Intel i3;Intel i5;Intel i7;Intel i9;AMD Ryzen 5;AMD Ryzen 7;Apple M;Diğer", sortOrder: 1 }),
    A("RAM", "ram", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "8 GB;16 GB;32 GB;64 GB", sortOrder: 2 }),
    A("Depolama", "depolama", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "256 GB;512 GB;1 TB;2 TB", sortOrder: 3 }),
    A("Ekran Boyutu", "ekran-boyutu", "SINGLE_SELECT", { optionValues: "13;14;15.6;16;17", unit: "inç", sortOrder: 4 }),
    A("İşletim Sistemi", "isletim-sistemi", "SINGLE_SELECT", { optionValues: "Windows;macOS;ChromeOS;Linux;FreeDOS", sortOrder: 5 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Siyah;Gri;Gümüş;Beyaz;Diğer", sortOrder: 6 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "12 Ay;24 Ay;36 Ay", sortOrder: 7 }),
  ],
  TV: [
    A("Ekran Boyutu", "ekran-boyutu", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "32;40;43;50;55;65;75;85", unit: "inç", sortOrder: 1 }),
    A("Çözünürlük", "cozunurluk", "SINGLE_SELECT", { required: true, optionValues: "HD;Full HD;4K;8K", sortOrder: 2 }),
    A("Panel Tipi", "panel-tipi", "SINGLE_SELECT", { optionValues: "LED;QLED;OLED;Mini-LED;Diğer", sortOrder: 3 }),
    A("Smart TV", "smart-tv", "BOOLEAN", { sortOrder: 4 }),
    A("HDR", "hdr", "SINGLE_SELECT", { optionValues: "Yok;HDR10;HDR10+;Dolby Vision", sortOrder: 5 }),
    A("Yenileme Hızı", "yenileme-hizi", "SINGLE_SELECT", { optionValues: "60 Hz;120 Hz;144 Hz", sortOrder: 6 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "12 Ay;24 Ay;36 Ay", sortOrder: 7 }),
  ],
  WHITE_GOODS: [
    A("Enerji Sınıfı", "enerji-sinifi", "SINGLE_SELECT", { required: true, optionValues: "A;B;C;D;E;F;G", sortOrder: 1 }),
    A("Renk", "renk", "COLOR", { optionValues: "Beyaz;Gri;Siyah;Inox;Diğer", sortOrder: 2 }),
    A("Ölçüler", "olculer", "TEXT", { filterable: false, searchable: false, comparisonVisible: false, sortOrder: 3 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "12 Ay;24 Ay;36 Ay", sortOrder: 4 }),
  ],
  SMALL_APPLIANCE: [
    A("Güç", "guc", "NUMBER", { unit: "W", sortOrder: 1 }),
    A("Kapasite", "kapasite", "TEXT", { sortOrder: 2 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Siyah;Beyaz;Gri;Kırmızı;Diğer", sortOrder: 3 }),
    A("Malzeme", "malzeme", "SINGLE_SELECT", { optionValues: "Plastik;Paslanmaz Çelik;Cam;Diğer", sortOrder: 4 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "Yok;12 Ay;24 Ay", sortOrder: 5 }),
  ],
  APPAREL: [
    A("Cinsiyet", "cinsiyet", "SINGLE_SELECT", { required: true, optionValues: "Kadın;Erkek;Unisex;Çocuk", sortOrder: 1 }),
    A("Beden", "beden", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "XXS;XS;S;M;L;XL;XXL;3XL", sortOrder: 2 }),
    A("Renk", "renk", "COLOR", { required: true, isVariant: true, optionValues: "Siyah;Beyaz;Gri;Mavi;Kırmızı;Yeşil;Diğer", sortOrder: 3 }),
    A("Kumaş", "kumas", "SINGLE_SELECT", { optionValues: "Pamuk;Polyester;Keten;Yün;Diğer", sortOrder: 4 }),
    A("Kalıp", "kalip", "SINGLE_SELECT", { optionValues: "Regular;Slim;Oversized;Relaxed", sortOrder: 5 }),
  ],
  FOOTWEAR: [
    A("Cinsiyet", "cinsiyet", "SINGLE_SELECT", { required: true, optionValues: "Kadın;Erkek;Unisex;Çocuk", sortOrder: 1 }),
    A("Numara", "numara", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "35;36;37;38;39;40;41;42;43;44;45;46", sortOrder: 2 }),
    A("Renk", "renk", "COLOR", { required: true, isVariant: true, optionValues: "Siyah;Beyaz;Kahverengi;Gri;Diğer", sortOrder: 3 }),
    A("Malzeme", "malzeme", "SINGLE_SELECT", { optionValues: "Deri;Süet;Tekstil;Sentetik;Diğer", sortOrder: 4 }),
    A("Taban Tipi", "taban-tipi", "SINGLE_SELECT", { optionValues: "Düz;Spor;Topuklu;Diğer", sortOrder: 5 }),
  ],
  FURNITURE: [
    A("Malzeme", "malzeme", "SINGLE_SELECT", { required: true, optionValues: "Ahşap;MDF;Metal;Cam;Kumaş;Diğer", sortOrder: 1 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Beyaz;Meşe;Ceviz;Siyah;Gri;Diğer", sortOrder: 2 }),
    A("Ölçüler", "olculer", "TEXT", { filterable: false, sortOrder: 3 }),
    A("Montaj Gerekli", "montaj-gerekli", "BOOLEAN", { sortOrder: 4 }),
  ],
  KITCHENWARE: [
    A("Malzeme", "malzeme", "SINGLE_SELECT", { required: true, optionValues: "Çelik;Cam;Seramik;Plastik;Silikon;Diğer", sortOrder: 1 }),
    A("Kapasite", "kapasite", "TEXT", { sortOrder: 2 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Siyah;Beyaz;Gri;Kırmızı;Diğer", sortOrder: 3 }),
    A("Bulaşık Makinesinde Yıkanabilir", "bm-yikanabilir", "BOOLEAN", { sortOrder: 4 }),
  ],
  SPORTS_EQUIPMENT: [
    A("Spor Dalı", "spor-dali", "SINGLE_SELECT", { optionValues: "Fitness;Futbol;Basketbol;Koşu;Outdoor;Diğer", sortOrder: 1 }),
    A("Beden/Boyut", "beden-boyut", "TEXT", { isVariant: true, sortOrder: 2 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Siyah;Beyaz;Kırmızı;Mavi;Diğer", sortOrder: 3 }),
    A("Malzeme", "malzeme", "SINGLE_SELECT", { optionValues: "Metal;Plastik;Kumaş;Karbon;Diğer", sortOrder: 4 }),
  ],
  PET_PRODUCT: [
    A("Hayvan Türü", "hayvan-turu", "SINGLE_SELECT", { required: true, optionValues: "Köpek;Kedi;Kuş;Balık;Kemirgen;Diğer", sortOrder: 1 }),
    A("Yaş Grubu", "yas-grubu", "SINGLE_SELECT", { optionValues: "Yavru;Yetişkin;Yaşlı;Tüm Yaşlar", sortOrder: 2 }),
    A("Ağırlık/Boyut", "agirlik-boyut", "TEXT", { sortOrder: 3 }),
    A("İçerik/Malzeme", "icerik-malzeme", "TEXT", { filterable: false, sortOrder: 4 }),
  ],
  AUTOMOTIVE_PART: [
    A("Uyumlu Marka", "uyumlu-marka", "TEXT", { required: true, searchable: true, sortOrder: 1 }),
    A("Uyumlu Model", "uyumlu-model", "TEXT", { searchable: true, sortOrder: 2 }),
    A("Parça Tipi", "parca-tipi", "SINGLE_SELECT", { optionValues: "Filtre;Balata;Ampul;Aksesuar;Diğer", sortOrder: 3 }),
    A("OEM No", "oem-no", "TEXT", { filterable: false, sortOrder: 4 }),
  ],
  INDUSTRIAL_MACHINE: [
    A("Güç", "guc", "NUMBER", { required: true, unit: "kW", sortOrder: 1 }),
    A("Voltaj", "voltaj", "SINGLE_SELECT", { required: true, optionValues: "220V;380V;Diğer", sortOrder: 2 }),
    A("Kapasite", "kapasite", "TEXT", { sortOrder: 3 }),
    A("Çalışma Ağırlığı", "calisma-agirligi", "NUMBER", { unit: "kg", filterable: false, sortOrder: 4 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "12 Ay;24 Ay;36 Ay", sortOrder: 5 }),
  ],
  COSMETICS: [
    A("Cilt Tipi", "cilt-tipi", "SINGLE_SELECT", { optionValues: "Kuru;Yağlı;Karma;Hassas;Tüm Ciltler", sortOrder: 1 }),
    A("Hacim", "hacim", "SINGLE_SELECT", { isVariant: true, optionValues: "30 ml;50 ml;100 ml;200 ml;250 ml;500 ml", sortOrder: 2 }),
    A("İçerik Notu", "icerik-notu", "TEXT", { filterable: false, searchable: true, comparisonVisible: false, sortOrder: 3 }),
    A("Son Kullanma", "skt", "TEXT", { filterable: false, searchable: false, comparisonVisible: false, sortOrder: 4 }),
  ],
  BOOK_STATIONERY: [
    A("Dil", "dil", "SINGLE_SELECT", { optionValues: "Türkçe;İngilizce;Diğer", sortOrder: 1 }),
    A("Sayfa/Adet", "sayfa-adet", "TEXT", { sortOrder: 2 }),
    A("Boyut", "boyut", "SINGLE_SELECT", { optionValues: "A4;A5;A6;Diğer", sortOrder: 3 }),
    A("Kapak Tipi", "kapak-tipi", "SINGLE_SELECT", { optionValues: "Karton;Ciltli;Spiral;Diğer", sortOrder: 4 }),
  ],
  BABY_PRODUCT: [
    A("Yaş Aralığı", "yas-araligi", "SINGLE_SELECT", { required: true, optionValues: "0-6 ay;6-12 ay;1-2 yaş;2-4 yaş;4+ yaş", sortOrder: 1 }),
    A("Cinsiyet", "cinsiyet", "SINGLE_SELECT", { optionValues: "Kız;Erkek;Unisex", sortOrder: 2 }),
    A("Malzeme", "malzeme", "SINGLE_SELECT", { optionValues: "Pamuk;Plastik;Ahşap;Diğer", sortOrder: 3 }),
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Pembe;Mavi;Beyaz;Sarı;Diğer", sortOrder: 4 }),
  ],
  GENERIC: [
    A("Renk", "renk", "COLOR", { isVariant: true, optionValues: "Siyah;Beyaz;Gri;Mavi;Kırmızı;Diğer", sortOrder: 1 }),
    A("Garanti", "garanti", "SINGLE_SELECT", { filterable: false, searchable: false, comparisonVisible: false, optionValues: "Yok;6 Ay;12 Ay;24 Ay", sortOrder: 2 }),
  ],
};

function assignTemplate(path: string, name: string): string {
  const n = norm(name);
  const p = norm(path);
  if (/akilli telefon|tuslu telefon|katlanabilir|outdoor telefon/.test(n) && !/aksesuar|kilif|sarj|kulaklik/.test(n))
    return "PHONE";
  if (/dizustu|laptop|masaustu|all.in.one|mini pc|notebook/.test(n) && !/canta|kilif|aksesuar/.test(n)) return "COMPUTER";
  if (/televizyon|^tv$|smart tv|qled|oled/.test(n)) return "TV";
  if (/camasir|buzdolabi|bulasik|kurutma|deri|derin dondurucu|ankastre ocak|ankastre firin|^ocak$|^firin$|klima|kombi|davlunbaz/.test(n))
    return "WHITE_GOODS";
  if (
    /kahve|blender|mikser|toaster|airfryer|robot supurge|supurge|surahi|kettle|tost|utu|dikis|hava temiz|nem alma|ustubot|fritoz/.test(
      n
    )
  )
    return "SMALL_APPLIANCE";
  if (/tisort|gomlek|pantolon|elbise|etek|mont|kaban|sweat|hoodie|yelek|sort|tayt|kazak|hirka|pijama|ic giyim|mayo/.test(n))
    return "APPAREL";
  if (/ayakkabi|bot|cizme|sandalet|terlik|topuklu|sneaker|spor ayakkabi/.test(n)) return "FOOTWEAR";
  if (/koltuk|masa|sandalye|yatak|dolap|raf|kanepe|Sehpa|gardirop|mobilya|bazas|komodin/.test(n)) return "FURNITURE";
  if (/tencere|tava|tabak|bardak|casafon|catal|kasik|bicak|cay seti|yemek takimi/.test(n)) return "KITCHENWARE";
  if (/bisiklet|halter|mat|top|raket|kamp|cadir|fitness|dumbbell|yoga|kayak|paten|scooter/.test(n)) return "SPORTS_EQUIPMENT";
  if (/mama|kedi|kopek|akvaryum|kus|kum|tasima|tasma|pet/.test(n)) return "PET_PRODUCT";
  if (/balata|filtre|ampul|silecek|aku|yag|jant|lastik|egzoz/.test(n) || (/otomotiv|yedek parca|aksesuar/.test(p) && /oto/.test(p)))
    return "AUTOMOTIVE_PART";
  if (/jenerator|kompresor|forklift| forez|matkap tezgah|cnc|kaynak|pres|pompa sanayi/.test(n) || /endustriyel|is makinesi|tarim makinesi|sanayi/.test(p))
    return "INDUSTRIAL_MACHINE";
  if (/krem|parfum|sampuan|makyaj|ruj|fondoten|serum|losyon|deodorant|dis macunu/.test(n) || /kozmetik|kisisel bakim/.test(p))
    return "COSMETICS";
  if (/kitap|defter|kalem|silgi|klasor|zımba|dosya|cizgi|roman|dergi/.test(n) || /kitap|kirtasiye|ofis/.test(p))
    return "BOOK_STATIONERY";
  if (/bebek|emzik|mama sandalyesi|araba koltugu|puset|biberon|bebek arabasi|islak mendil/.test(n) || /anne|bebek|cocuk/.test(p))
    return "BABY_PRODUCT";
  // path-based fallbacks before GENERIC
  if (/moda/.test(p) && /giyim|ust|alt|dis/.test(p)) return "APPAREL";
  if (/moda/.test(p) && /ayakkabi/.test(p)) return "FOOTWEAR";
  if (/ev ve yasam|mobilya/.test(p)) return "FURNITURE";
  if (/mutfak ve sofra/.test(p)) return "KITCHENWARE";
  if (/spor ve outdoor|spor /.test(p)) return "SPORTS_EQUIPMENT";
  if (/evcil hayvan/.test(p)) return "PET_PRODUCT";
  if (/otomotiv/.test(p)) return "AUTOMOTIVE_PART";
  if (/endustriyel/.test(p)) return "INDUSTRIAL_MACHINE";
  if (/kozmetik/.test(p)) return "COSMETICS";
  if (/kitap|kirtasiye/.test(p)) return "BOOK_STATIONERY";
  if (/anne|bebek/.test(p)) return "BABY_PRODUCT";
  if (/ev aletleri|kucuk ev/.test(p)) return "SMALL_APPLIANCE";
  if (/elektronik/.test(p) && /telefon aksesuar|sarj|kilif|kablo/.test(p + " " + n)) return "SMALL_APPLIANCE";
  if (/elektronik/.test(p)) return "SMALL_APPLIANCE";
  if (/bahce ve yapi/.test(p)) return "INDUSTRIAL_MACHINE";
  if (/hobi ve oyun/.test(p)) return "SPORTS_EQUIPMENT";
  return "GENERIC";
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(SCRIPT_OUT, { recursive: true });

  const createVal = parseCsv(readFileSync(join(OUT, "create-new-validation-full.csv"), "utf8"));
  const archiveVal = parseCsv(readFileSync(join(OUT, "archive-validation-full.csv"), "utf8"));
  const moveVal = parseCsv(readFileSync(join(OUT, "move-validation-full.csv"), "utf8"));
  const buckets = parseCsv(readFileSync(join(OUT, "application-buckets-full.csv"), "utf8"));
  const mapping = parseCsv(readFileSync(join(OUT, "category-mapping-full.csv"), "utf8"));
  const brandPlan = existsSync(join(OUT, "category-brands-full.csv"))
    ? parseCsv(readFileSync(join(OUT, "category-brands-full.csv"), "utf8"))
    : [];
  const targets = parseMd(readFileSync(MD, "utf8"));
  const leaves = targets.filter((t) => t.isLeaf);

  const cats = await prisma.category.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      parentId: true,
      parent: { select: { id: true, name: true, path: true } },
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
  const byId = new Map(cats.map((c) => [c.id, c]));
  const offers = await prisma.sellerOffer.groupBy({
    by: ["productId"],
    where: { deletedAt: null },
    _count: true,
  });
  // map productId -> count then to category
  const products = await prisma.product.findMany({
    where: { deletedAt: null, id: { in: offers.map((o) => o.productId) } },
    select: { id: true, categoryId: true },
  });
  const offerByCat = new Map<string, number>();
  const offerByProduct = new Map(offers.map((o) => [o.productId, o._count]));
  for (const p of products) {
    if (!p.categoryId) continue;
    offerByCat.set(p.categoryId, (offerByCat.get(p.categoryId) || 0) + (offerByProduct.get(p.id) || 0));
  }

  function relCounts(id: string) {
    const c = byId.get(id);
    if (!c) return { listing: 0, product: 0, offer: 0, brand: 0, attr: 0, model: 0, child: 0 };
    return {
      listing: c._count.listings,
      product: c._count.products,
      offer: offerByCat.get(id) || 0,
      brand: c._count.categoryBrands,
      attr: c._count.categoryAttributes,
      model: c._count.categoryModels,
      child: c._count.children,
    };
  }
  function relStr(id: string) {
    const r = relCounts(id);
    return `L:${r.listing}|P:${r.product}|O:${r.offer}|B:${r.brand}|A:${r.attr}|M:${r.model}|C:${r.child}`;
  }

  // ========== 1) CREATE_NEW possible duplicates ==========
  const dups = createVal.filter((r) => ["EXACT", "HIGH", "MEDIUM"].includes(r.confidence));
  const createDecisions: Record<string, unknown>[] = [];
  const createDist: Record<string, number> = {};

  for (const r of dups) {
    const candId = r.matchedCategoryId;
    const cand = byId.get(candId);
    const targetPath = r.targetPath;
    const targetLeaf = leafName(targetPath);
    const targetMain = mainSeg(targetPath);
    const targetParent = parentOf(targetPath);
    const candName = cand?.name || "";
    const candPath = cand?.path || r.matchedDbPath || "";
    const candNorm = norm(candName);
    const tgtNorm = norm(targetLeaf);
    const score = Number(r.matchScore || 0);
    const rel = cand ? relCounts(cand.id) : null;

    let finalDecision = "CREATE_NEW_CONFIRMED";
    let preserveId = false;
    let semanticMatch = false;
    let reason = "";
    let reviewerRequired = true;

    const compoundParts = candName
      .split(/\s*[&/]\s*|\s+ve\s+/i)
      .map((p) => norm(p))
      .filter((p) => p.length > 2);
    const isCompoundNode = compoundParts.length >= 2 && /&|\sve\s|,/.test(candName);
    const WEAK_PARTS = new Set([
      "aksesuar",
      "aksesuarlari",
      "urun",
      "urunler",
      "sistem",
      "sistemi",
      "set",
      "diger",
      "cesit",
      "grup",
      "market",
    ]);
    const targetIsCompoundPart =
      isCompoundNode &&
      compoundParts.some((p) => {
        if (WEAK_PARTS.has(p)) return false;
        if (p === tgtNorm) return true;
        // avoid Bank⊂Powerbank / Termos⊂Termosifon false positives
        if (p.length >= 5 && tgtNorm.length >= 5) {
          const ratio = Math.min(p.length, tgtNorm.length) / Math.max(p.length, tgtNorm.length);
          if (ratio >= 0.8 && (tgtNorm.includes(p) || p.includes(tgtNorm))) return true;
        }
        return false;
      });

    // Cross-tree false positives
    const candMain = norm(candPath).includes("elektronik")
      ? "elektronik"
      : norm(candPath).includes("ev-alet") || norm(candPath).includes("ev alet")
        ? "ev"
        : norm(candPath).includes("moda") || norm(candPath).includes("ayakkabi")
          ? "moda"
          : norm(candPath).includes("spor")
            ? "spor"
            : norm(candPath).includes("muzik") || norm(candPath).includes("hobi")
              ? "hobi"
              : norm(candPath).includes("mutfak")
                ? "mutfak"
                : "other";
    const tgtMain = norm(targetMain);
    const crossTree =
      (tgtMain &&
        candMain !== "other" &&
        !tgtMain.includes(candMain) &&
        !candMain.includes(tgtMain.slice(0, 4)) &&
        !(tgtMain.includes("ev") && candMain === "ev") &&
        !(tgtMain.includes("mutfak") && (candMain === "ev" || candMain === "mutfak"))) ||
      (/kitap|kirtasiye|ofis/.test(norm(targetPath)) && /elektronik|yazici tarayici/.test(norm(candPath))) ||
      (/televizyon|goruntu|ses/.test(norm(targetPath)) && /muzik|sifir-urun-muzik|telefon.*kulaklik/.test(norm(candPath))) ||
      (/akilli ev|solar/.test(norm(targetPath)) && /sarj powerbank|cep telefonu/.test(norm(candPath))) ||
      (/ev ve yasam|mobilya|bank/.test(norm(targetPath)) && /powerbank|sarj|telefon/.test(norm(candPath))) ||
      (/bilgisayar/.test(norm(targetPath)) && /telefon|kulaklik.*bluetooth/.test(norm(candPath)) && /kulaklik/.test(tgtNorm));

    // Prefer CREATE when cross-tree even if compound-ish
    if (crossTree && !(r.confidence === "EXACT" && candNorm === tgtNorm)) {
      finalDecision = "CREATE_NEW_CONFIRMED";
      semanticMatch = false;
      reason = "name similarity across different taxonomy branches — create under target parent";
      reviewerRequired = false;
    } else if (targetIsCompoundPart) {
      finalDecision = "SPLIT_EXISTING";
      preserveId = false;
      semanticMatch = true;
      reason = `target '${targetLeaf}' is a part of compound DB node '${candName}' — split; do not create orphan duplicate without split plan`;
      reviewerRequired = true;
    } else if (r.confidence === "EXACT" || score >= 0.99) {
      if (
        /yazici/.test(tgtNorm) &&
        /yazici tarayici/.test(candNorm) &&
        /ofis|kirtasiye|kitap/.test(norm(targetPath))
      ) {
        finalDecision = "CREATE_NEW_CONFIRMED";
        semanticMatch = false;
        reason = "Ofis Yazıcı ≠ Elektronik Yazıcı&Tarayıcı — separate leaf under office tree";
        reviewerRequired = false;
      } else if (crossTree && candNorm !== tgtNorm) {
        finalDecision = "CREATE_NEW_CONFIRMED";
        semanticMatch = false;
        reason = "EXACT name string collision across different trees — create under correct parent";
        reviewerRequired = false;
      } else if (cand && (rel!.child > 0 || /sifir-urun-[a-z]/.test(cand.slug) || !cand.parentId)) {
        finalDecision = "RENAME_EXISTING";
        preserveId = true;
        semanticMatch = true;
        reason = `exact/near main or group node — rename/reuse id ${cand.id} → '${targetPath}'`;
        reviewerRequired = rel!.listing + rel!.product > 0;
      } else if (cand && candNorm === tgtNorm) {
        finalDecision = "USE_EXISTING_ID";
        preserveId = true;
        semanticMatch = true;
        reason = "same product-type leaf — reuse Category.id";
        reviewerRequired = rel!.listing + rel!.product + rel!.offer > 0;
        const candParentName = cand.parent?.name || "";
        if (targetParent && candParentName && norm(candParentName) !== norm(leafName(targetParent))) {
          finalDecision = "MOVE_EXISTING";
          reason = `reuse id; reparent toward '${targetParent}' (was under '${candParentName}')`;
        }
      } else {
        finalDecision = "RENAME_EXISTING";
        preserveId = true;
        semanticMatch = true;
        reason = "EXACT synonym/alias — map target to existing id";
        reviewerRequired = false;
      }
    } else if (r.confidence === "HIGH") {
      if (crossTree) {
        finalDecision = "CREATE_NEW_CONFIRMED";
        semanticMatch = false;
        reason = "HIGH score but different taxonomy branch — confirmed create";
        reviewerRequired = false;
      } else {
        finalDecision = "MOVE_EXISTING";
        preserveId = true;
        semanticMatch = true;
        reason = "HIGH semantic — reuse id and align path/parent";
        reviewerRequired = !!(rel && rel.listing + rel.product > 0);
      }
    } else {
      // MEDIUM — prefer create unless clearly same empty node
      if (crossTree) {
        finalDecision = "CREATE_NEW_CONFIRMED";
        semanticMatch = false;
        reason = "MEDIUM similarity across unrelated parents — create under target path";
        reviewerRequired = false;
      } else if (candNorm === tgtNorm) {
        finalDecision = "USE_EXISTING_ID";
        preserveId = true;
        semanticMatch = true;
        reason = "MEDIUM but identical normalized name same family — reuse";
        reviewerRequired = !!(rel && rel.listing + rel.product > 0);
      } else if (rel && rel.listing + rel.product + rel.offer > 0) {
        finalDecision = "MANUAL_BUSINESS_DECISION";
        semanticMatch = true;
        reason = "MEDIUM match with commercial data — business chooses reuse vs create";
        reviewerRequired = true;
      } else if (score >= 0.7 && /beyaz|ev alet|elektronik|moda|spor/.test(norm(candPath) + norm(targetPath))) {
        finalDecision = "USE_EXISTING_ID";
        preserveId = true;
        semanticMatch = true;
        reason = "MEDIUM empty same-family node — prefer reuse over create";
        reviewerRequired = true;
      } else {
        finalDecision = "CREATE_NEW_CONFIRMED";
        semanticMatch = false;
        reason = "MEDIUM weak/ambiguous — safer to CREATE_NEW under target parent than force merge";
        reviewerRequired = false;
      }
    }

    // Hard overrides for known EXACT compound cases
    if (/powerbank/.test(tgtNorm) && /sarj/.test(candNorm) && isCompoundNode) {
      finalDecision = "SPLIT_EXISTING";
      preserveId = false;
      semanticMatch = true;
      reason = "Powerbank leaf vs Şarj & Powerbank compound — split";
      reviewerRequired = true;
    }
    if (/bluetooth kulaklik/.test(tgtNorm) && /kulaklik/.test(candNorm) && isCompoundNode) {
      finalDecision = "RENAME_EXISTING";
      preserveId = true;
      semanticMatch = true;
      reason = "Kulaklık & Bluetooth → Bluetooth Kulaklık rename + path move";
      reviewerRequired = false;
    }
    if (/^yazici$/.test(tgtNorm) && /yazici tarayici/.test(candNorm) && /bilgisayar/.test(norm(targetPath))) {
      finalDecision = "SPLIT_EXISTING";
      preserveId = false;
      semanticMatch = true;
      reason = "Elektronik Yazıcı leaf from Yazıcı & Tarayıcı split";
      reviewerRequired = true;
    }
    if (/ev sinema/.test(tgtNorm) && /ev sinema/.test(candNorm)) {
      finalDecision = "RENAME_EXISTING";
      preserveId = true;
      semanticMatch = true;
      reason = "Ev Sineması → Ev Sinema Sistemi";
      reviewerRequired = false;
    }
    if (
      targetPath.split(/[›>]/).length <= 1 &&
      r.confidence === "EXACT" &&
      cand &&
      (rel!.child > 0 || /sifir-urun-[a-z]/.test(cand.slug))
    ) {
      finalDecision = "RENAME_EXISTING";
      preserveId = true;
      semanticMatch = true;
      reason = "ana kategori rename — preserve id";
      reviewerRequired = false;
    }
    if (
      /televizyon.*goruntu.*ses/.test(norm(targetPath)) &&
      targetPath.split(/[›>]/).length <= 2 &&
      /tv.*goruntu/.test(norm(candPath))
    ) {
      finalDecision = "RENAME_EXISTING";
      preserveId = true;
      semanticMatch = true;
      reason = "TV group rename to Televizyon, Görüntü ve Ses";
      reviewerRequired = !!(rel && rel.listing > 0);
    }

    createDist[finalDecision] = (createDist[finalDecision] || 0) + 1;
    createDecisions.push({
      targetPath,
      candidateCategoryId: candId,
      candidatePath: candPath,
      similarityScore: score.toFixed(3),
      semanticMatch,
      relationCounts: candId ? relStr(candId) : "",
      finalDecision,
      preserveId,
      reason,
      reviewerRequired,
      confidence: r.confidence,
    });
  }

  writeCsv(
    join(OUT, "manual-create-new-decisions.csv"),
    [
      "targetPath",
      "candidateCategoryId",
      "candidatePath",
      "similarityScore",
      "semanticMatch",
      "relationCounts",
      "finalDecision",
      "preserveId",
      "reason",
      "reviewerRequired",
      "confidence",
    ],
    createDecisions
  );

  // ========== 2) ARCHIVE reclass 45 ==========
  const reclass = archiveVal.filter((r) => r.revisedAction !== "ARCHIVE_CONFIRMED");
  const archiveDec: Record<string, unknown>[] = [];
  const archiveDist: Record<string, number> = {};

  const SCOPE: Record<
    string,
    {
      decision: string;
      targetPath: string;
      commerceMode: string;
      modelMode: string;
      attributes: string;
      reason: string;
    }
  > = {
    "yiyecek icecek": {
      decision: "ADD_TO_TARGET_TREE",
      targetPath: "Market ve Gıda › Yiyecek ve İçecek",
      commerceMode: "NEW_PREFERRED",
      modelMode: "ATTRIBUTE_ONLY",
      attributes: "ürün tipi;ağırlık;son kullanma;marka(opsiyonel)",
      reason: "Kapsam: Market ve Gıda ana kategorisi olarak hedef MD'ye eklenmeli (şimdi eksik)",
    },
    gida: {
      decision: "ADD_TO_TARGET_TREE",
      targetPath: "Market ve Gıda › Yiyecek › Gıda",
      commerceMode: "NEW_ONLY",
      modelMode: "ATTRIBUTE_ONLY",
      attributes: "ağırlık;içerik;skt;saklama",
      reason: "Yiyecek altında Gıda leaf/group — ADD",
    },
    icecek: {
      decision: "ADD_TO_TARGET_TREE",
      targetPath: "Market ve Gıda › İçecek",
      commerceMode: "NEW_ONLY",
      modelMode: "ATTRIBUTE_ONLY",
      attributes: "hacim;tip(su/gazlı/sıcak);skt",
      reason: "İçecek ayrı group — ADD",
    },
    "saat taki mucevher": {
      decision: "ADD_TO_TARGET_TREE",
      targetPath: "Moda › Saat ve Takı",
      commerceMode: "BOTH",
      modelMode: "BRAND_MODEL",
      attributes: "cinsiyet;malzeme;renk;saat tipi",
      reason: "Moda altında Saat ve Takı ara kategori — ADD (akıllı saat Elektronik'te kalır)",
    },
    "taki seti": {
      decision: "ADD_TO_TARGET_TREE",
      targetPath: "Moda › Saat ve Takı › Takı › Takı Seti",
      commerceMode: "BOTH",
      modelMode: "ATTRIBUTE_ONLY",
      attributes: "malzeme;renk;set içeriği",
      reason: "Takı leaf — ADD under Moda",
    },
    "el aleti takim": {
      decision: "MOVE_EXISTING",
      targetPath: "Bahçe ve Yapı › El Aletleri › El Aleti ve Takım",
      commerceMode: "BOTH",
      modelMode: "BRAND_MODEL",
      attributes: "güç;voltaj;set adedi;kullanım alanı",
      reason: "El aleti Moda değil — Bahçe ve Yapı; ADD veya MOVE existing",
    },
  };

  for (const r of reclass) {
    const n = norm(r.currentName);
    let decision = r.revisedAction;
    let targetPath = r.semanticTargetPath || "";
    let commerceMode = "";
    let modelMode = "";
    let attributesNeeded = "";
    let reason = r.reason;
    let reviewerRequired = r.manualApprovalRequired === "true";
    let preserveId = true;

    // precise scope names
    if (/^yiyecek.*icecek$|^yiyecek icecek$/.test(n) || n === "yiyecek icecek") {
      const s = SCOPE["yiyecek icecek"];
      decision = s.decision;
      targetPath = s.targetPath;
      commerceMode = s.commerceMode;
      modelMode = s.modelMode;
      attributesNeeded = s.attributes;
      reason = s.reason;
      reviewerRequired = true;
      preserveId = true;
    } else if (n === "gida") {
      const s = SCOPE.gida;
      decision = s.decision;
      targetPath = s.targetPath;
      commerceMode = s.commerceMode;
      modelMode = s.modelMode;
      attributesNeeded = s.attributes;
      reason = s.reason;
      reviewerRequired = true;
    } else if (n === "icecek") {
      const s = SCOPE.icecek;
      decision = s.decision;
      targetPath = s.targetPath;
      commerceMode = s.commerceMode;
      modelMode = s.modelMode;
      attributesNeeded = s.attributes;
      reason = s.reason;
      reviewerRequired = true;
    } else if (/saat.*taki|taki.*mucevher/.test(n)) {
      const s = SCOPE["saat taki mucevher"];
      decision = s.decision;
      targetPath = s.targetPath;
      commerceMode = s.commerceMode;
      modelMode = s.modelMode;
      attributesNeeded = s.attributes;
      reason = s.reason;
      reviewerRequired = true;
    } else if (/taki seti/.test(n)) {
      const s = SCOPE["taki seti"];
      decision = s.decision;
      targetPath = s.targetPath;
      commerceMode = s.commerceMode;
      modelMode = s.modelMode;
      attributesNeeded = s.attributes;
      reason = s.reason;
      reviewerRequired = true;
    } else if (/el aleti/.test(n)) {
      const s = SCOPE["el aleti takim"];
      decision = s.decision;
      targetPath = s.targetPath;
      commerceMode = s.commerceMode;
      modelMode = s.modelMode;
      attributesNeeded = s.attributes;
      reason = s.reason;
      reviewerRequired = false;
    } else if (decision === "RENAME") {
      reason = `Rename preserveId → ${targetPath || "target"}`;
      reviewerRequired = Number(r.listingCount) + Number(r.productCount) > 0;
      preserveId = true;
    } else if (decision === "MOVE") {
      reason = `Move preserveId → ${targetPath}`;
      reviewerRequired = Number(r.listingCount) + Number(r.productCount) > 0;
      preserveId = true;
    } else if (decision === "KEEP") {
      if (n === "sifir" || /sifir-urun$/.test(r.currentPath)) {
        reason = "System root Sıfır — KEEP forever";
        reviewerRequired = false;
      } else {
        reason = "Active children / structural group still needed — KEEP until children remapped";
        reviewerRequired = true;
      }
    } else if (decision === "MERGE") {
      reason = `Merge into ${targetPath || "Elektronik"} — reparent children first`;
      reviewerRequired = true;
      preserveId = false;
    } else if (decision === "SPLIT") {
      reason = "Compound — see split rules; no auto archive";
      reviewerRequired = true;
      preserveId = false;
    } else if (decision === "MANUAL_REVIEW") {
      if (/diger her sey/.test(n)) {
        decision = "KEEP";
        reason = "Catch-all policy bucket — KEEP as POLICY_ONLY until listings drained";
        commerceMode = "BOTH";
        modelMode = "ATTRIBUTE_ONLY";
        reviewerRequired = true;
      } else if (/fotoğraf makinesi|fotograf makinesi/.test(n)) {
        decision = "RENAME";
        targetPath = "Elektronik › Televizyon, Görüntü ve Ses › Fotoğraf ve Video › Dijital Fotoğraf Makinesi";
        reason = "Alias/rename to digital camera leaf";
        preserveId = true;
        reviewerRequired = false;
      } else if (/nem alma|hava temizleyici/.test(n)) {
        decision = "SPLIT";
        targetPath =
          "Ev Aletleri › Küçük Ev Aletleri › Hava Kalitesi › Nem Alma Cihazı | Ev Aletleri › Küçük Ev Aletleri › Hava Kalitesi › Hava Temizleyici";
        reason = "Compound hava — split";
        reviewerRequired = true;
      } else if (/dikis.*utu|utu.*dikis/.test(n)) {
        decision = "SPLIT";
        targetPath = "Ev Aletleri › Küçük Ev Aletleri › Ütü ve Dikiş › Ütü | … › Dikiş Makinesi";
        reason = "Compound ütü/dikiş";
        reviewerRequired = true;
      } else if (/perde.*stor/.test(n)) {
        decision = "RENAME";
        targetPath = "Ev ve Yaşam › Ev Tekstili › Salon Tekstili › Stor Perde";
        reason = "Prefer Stor Perde; perde variants may need sibling creates";
        preserveId = true;
        reviewerRequired = false;
      } else if (/elektrikli ev aletleri/.test(n)) {
        decision = "MERGE";
        targetPath = "Ev Aletleri";
        reason = "Legacy wrapper → Ev Aletleri";
        reviewerRequired = true;
      } else if (/sarj cihazi/.test(n)) {
        decision = "RENAME";
        targetPath = "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Şarj Adaptörü";
        reason = "Şarj Cihazı → Şarj Adaptörü (Powerbank ayrı)";
        preserveId = true;
        reviewerRequired = false;
      }
    }

    archiveDist[decision] = (archiveDist[decision] || 0) + 1;
    archiveDec.push({
      categoryId: r.categoryId,
      currentName: r.currentName,
      currentPath: r.currentPath,
      originalRevisedAction: r.revisedAction,
      finalDecision: decision,
      targetPath,
      preserveId,
      commerceMode,
      modelMode,
      attributesNeeded,
      listingCount: r.listingCount,
      productCount: r.productCount,
      sellerOfferCount: r.sellerOfferCount,
      childCount: r.childCount,
      reason,
      reviewerRequired,
      riskLevel: r.riskLevel,
    });
  }

  writeCsv(
    join(OUT, "manual-archive-reclass-decisions.csv"),
    [
      "categoryId",
      "currentName",
      "currentPath",
      "originalRevisedAction",
      "finalDecision",
      "targetPath",
      "preserveId",
      "commerceMode",
      "modelMode",
      "attributesNeeded",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "childCount",
      "reason",
      "reviewerRequired",
      "riskLevel",
    ],
    archiveDec
  );

  // ========== 3) Risky MOVE plans ==========
  const riskyNames = ["Akıllı Telefon", "Tuşlu Telefon", "Buzdolabı"];
  const riskyPlans: Record<string, unknown>[] = [];
  for (const name of riskyNames) {
    const m = moveVal.find((x) => x.currentName === name);
    if (!m) continue;
    const c = byId.get(m.categoryId);
    const rel = relCounts(m.categoryId);
    const newParentPath = m.targetParentPath;
    riskyPlans.push({
      categoryId: m.categoryId,
      currentName: name,
      preserveCategoryId: m.categoryId,
      currentPath: m.currentPath,
      newPathLogical: m.targetPath,
      newParentLogical: newParentPath,
      newParentId: "RESOLVE_AT_APPLY: create/find parent by targetParentPath under sifir-urun",
      listingImpact: `${rel.listing} listings keep categoryId; breadcrumb/path filter updates after path rebuild`,
      productImpact: `${rel.product} products keep categoryId; catalog browse path changes`,
      sellerOfferImpact: `${rel.offer} offers inherit via product — no offer.categoryId change`,
      brandAttrModel: `CategoryBrand=${rel.brand}, Attr=${rel.attr}, Model=${rel.model} stay on same categoryId`,
      aliasRequired: true,
      aliasPlan: `CategoryAlias: oldSlug=${c?.slug} → categoryId=${m.categoryId}; 301 redirect /kategori/${c?.slug}`,
      rollbackSqlPlan: [
        `-- BEGIN; checkpoint first`,
        `UPDATE "Category" SET "parentId"='${c?.parentId}', path='${c?.path}' WHERE id='${m.categoryId}';`,
        `DELETE FROM "CategoryAlias" WHERE "oldSlug"='${c?.slug}';`,
        `-- COMMIT;`,
      ].join(" "),
      testScenarios: [
        `GET product by id still categoryId=${m.categoryId}`,
        `Listing filter by new path returns same ${rel.listing} rows`,
        `Old slug alias resolves`,
        `Admin category tree shows under new parent`,
        `SellerOffer count unchanged (${rel.offer})`,
      ].join(" | "),
      autoApply: false,
      bucket: "MANUAL_APPROVAL",
      riskLevel: m.riskLevel,
    });
  }
  writeCsv(
    join(OUT, "manual-risky-move-plans.csv"),
    [
      "categoryId",
      "currentName",
      "preserveCategoryId",
      "currentPath",
      "newPathLogical",
      "newParentLogical",
      "newParentId",
      "listingImpact",
      "productImpact",
      "sellerOfferImpact",
      "brandAttrModel",
      "aliasRequired",
      "aliasPlan",
      "rollbackSqlPlan",
      "testScenarios",
      "autoApply",
      "bucket",
      "riskLevel",
    ],
    riskyPlans
  );

  // ========== 4) SPLIT rules ==========
  const splitRules: Record<string, unknown>[] = [];
  const splits = [
    {
      id: "cmsg3xg1y0013uzdcn3no2nil",
      name: "Şarj & Powerbank",
      targets: [
        "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Şarj Adaptörü",
        "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları › Powerbank",
      ],
      keywords: {
        powerbank: "Powerbank",
        "taşınabilir şarj|power bank|powerbank": "Powerbank",
        "şarj aleti|adaptör|adapter|wall charger|şarj cihazı|kablolu şarj": "Şarj Adaptörü",
        "kablosuz şarj|wireless charger": "Kablosuz Şarj Cihazı",
      },
    },
    {
      id: "cmsg3xgfp002puzdcg7jmoiov",
      name: "Yazıcı & Tarayıcı",
      targets: [
        "Elektronik › Bilgisayar ve Tablet › Bilgisayar Çevre Birimleri › Yazıcı",
        "Elektronik › Bilgisayar ve Tablet › Bilgisayar Çevre Birimleri › Tarayıcı",
      ],
      keywords: {
        "tarayıcı|scanner|scan": "Tarayıcı",
        "yazıcı|printer|lazer|inkjet|mürekkep": "Yazıcı",
        "çok fonksiyonlu|mfp|all.in.one|yazıcı tarayıcı": "MANUAL_ONLY",
      },
    },
    {
      id: "cms93j5l8001xuz3gsasrgk49",
      name: "Cep Telefonu & Aksesuar",
      targets: [
        "Elektronik › Telefon ve Aksesuar › Cep Telefonu",
        "Elektronik › Telefon ve Aksesuar › Telefon Aksesuarları",
      ],
      keywords: {
        "iphone|galaxy|xiaomi|redmi|akıllı telefon|cep telefonu|tuslu": "Cep Telefonu children",
        "kılıf|case|ekran koruyucu|şarj|powerbank|kulaklık|stand": "Telefon Aksesuarları children",
      },
    },
  ];

  for (const s of splits) {
    const rel = relCounts(s.id);
    const methods = [
      "title keyword (primary)",
      "ProductModel name contains brand+model → phone leaf",
      "attribute: depolama/ram/sim → phone; kapasite mAh → powerbank",
      "brand: phone OEMs on phone leaves; accessory brands on accessory",
      "existing product type / category child already typed",
      "else manual review queue",
    ].join(" | ");

    let defaultConfidence = "REVIEW";
    if (rel.listing + rel.product + rel.offer === 0) defaultConfidence = "SAFE_AUTO"; // structure-only split of empty
    if (rel.listing + rel.product > 0) defaultConfidence = "MANUAL_ONLY";

    splitRules.push({
      categoryId: s.id,
      currentName: s.name,
      relationCounts: relStr(s.id),
      targetPaths: s.targets.join(" || "),
      keywordRules: JSON.stringify(s.keywords),
      assignmentMethods: methods,
      listingAuto: rel.listing === 0 ? "N/A" : "MANUAL_ONLY — never auto if ambiguous",
      productAuto: rel.product === 0 ? "N/A" : "MANUAL_ONLY unless unique keyword+model",
      offerAuto: "via product — same rule",
      brandAttrModelPlan: "Copy links to both targets only if relevant; phone models stay on phone leaves; no blind duplicate",
      confidenceDefault: defaultConfidence,
      ambiguousPolicy: "leave on source category until human maps — DO NOT auto-move",
      autoApply: false,
    });
  }
  writeCsv(
    join(OUT, "manual-split-distribution-rules.csv"),
    [
      "categoryId",
      "currentName",
      "relationCounts",
      "targetPaths",
      "keywordRules",
      "assignmentMethods",
      "listingAuto",
      "productAuto",
      "offerAuto",
      "brandAttrModelPlan",
      "confidenceDefault",
      "ambiguousPolicy",
      "autoApply",
    ],
    splitRules
  );

  // ========== 5) Critical category attributes ==========
  const criticalDefs: Array<{ category: string; template: string; extra: AttrDef[] }> = [
    {
      category: "Çamaşır Makinesi",
      template: "WHITE_GOODS",
      extra: [
        A("Yıkama Kapasitesi", "yikama-kapasitesi", "SINGLE_SELECT", { required: true, optionValues: "5 kg;6 kg;7 kg;8 kg;9 kg;10 kg;12 kg", unit: "kg", sortOrder: 10 }),
        A("Devir", "devir", "SINGLE_SELECT", { optionValues: "1000;1200;1400;1600", sortOrder: 11 }),
        A("Kurutmalı", "kurutmali", "BOOLEAN", { sortOrder: 12 }),
        A("Ses Seviyesi", "ses-seviyesi", "NUMBER", { unit: "dB", filterable: false, sortOrder: 13 }),
      ],
    },
    {
      category: "Buzdolabı",
      template: "WHITE_GOODS",
      extra: [
        A("Hacim", "hacim", "SINGLE_SELECT", { required: true, optionValues: "200 L;250 L;300 L;350 L;400 L;500 L+", unit: "L", sortOrder: 10 }),
        A("Kapı Tipi", "kapi-tipi", "SINGLE_SELECT", { required: true, optionValues: "Tek Kapı;Çift Kapı;French Door;Side by Side", sortOrder: 11 }),
        A("No-Frost", "no-frost", "BOOLEAN", { sortOrder: 12 }),
        A("Derin Dondurucu", "derin-dondurucu", "BOOLEAN", { sortOrder: 13 }),
      ],
    },
    {
      category: "Bulaşık Makinesi",
      template: "WHITE_GOODS",
      extra: [
        A("Kapasite", "kapasite-kisilik", "SINGLE_SELECT", { required: true, optionValues: "8;10;12;13;14;16", unit: "kişilik", sortOrder: 10 }),
        A("Ankastre", "ankastre", "BOOLEAN", { sortOrder: 11 }),
        A("Ses Seviyesi", "ses-seviyesi", "NUMBER", { unit: "dB", filterable: false, sortOrder: 12 }),
      ],
    },
    {
      category: "Kurutma Makinesi",
      template: "WHITE_GOODS",
      extra: [
        A("Kapasite", "kurutma-kapasitesi", "SINGLE_SELECT", { required: true, optionValues: "7 kg;8 kg;9 kg;10 kg", unit: "kg", sortOrder: 10 }),
        A("Kurutma Tipi", "kurutma-tipi", "SINGLE_SELECT", { optionValues: "Egzoz;Yoğuşmalı;Isı Pompalı", sortOrder: 11 }),
      ],
    },
    {
      category: "Bisiklet",
      template: "SPORTS_EQUIPMENT",
      extra: [
        A("Bisiklet Tipi", "bisiklet-tipi", "SINGLE_SELECT", { required: true, optionValues: "Dağ;Şehir;Yol;Katlanır;Çocuk;Elektrikli", sortOrder: 10 }),
        A("Jant Çapı", "jant-capi", "SINGLE_SELECT", { optionValues: "20;24;26;27.5;28;29", unit: "inç", sortOrder: 11 }),
        A("Vites Sayısı", "vites-sayisi", "SINGLE_SELECT", { optionValues: "Tek;3;7;18;21;24;27", sortOrder: 12 }),
        A("Fren Tipi", "fren-tipi", "SINGLE_SELECT", { optionValues: "V-Brake;Disk;Hidrolik Disk", sortOrder: 13 }),
        A("Kadro Malzemesi", "kadro-malzemesi", "SINGLE_SELECT", { optionValues: "Alüminyum;Çelik;Karbon;Diğer", sortOrder: 14 }),
        A("Elektrikli", "elektrikli", "BOOLEAN", { sortOrder: 15 }),
      ],
    },
    {
      category: "Akıllı Telefon",
      template: "PHONE",
      extra: [],
    },
    {
      category: "Laptop",
      template: "COMPUTER",
      extra: [
        A("Ekran Kartı", "ekran-karti", "SINGLE_SELECT", { optionValues: "Paylaşımlı;GTX;RTX;Radeon;Diğer", sortOrder: 10 }),
      ],
    },
    {
      category: "Televizyon",
      template: "TV",
      extra: [],
    },
    {
      category: "Tişört",
      template: "APPAREL",
      extra: [
        A("Yaka", "yaka-tipi", "SINGLE_SELECT", { optionValues: "Bisiklet Yaka;V Yaka;Gömlek Yaka", sortOrder: 10 }),
        A("Kol Tipi", "kol-tipi", "SINGLE_SELECT", { optionValues: "Kısa Kol;Uzun Kol;Kolsuz", sortOrder: 11 }),
      ],
    },
    {
      category: "Ayakkabı",
      template: "FOOTWEAR",
      extra: [],
    },
    {
      category: "Filtreli Sürahi",
      template: "SMALL_APPLIANCE",
      extra: [
        A("Kapasite", "kapasite", "SINGLE_SELECT", { required: true, isVariant: true, optionValues: "1.5 L;2 L;2.5 L;3 L", sortOrder: 10 }),
        A("Filtre Tipi", "filtre-tipi", "SINGLE_SELECT", { optionValues: "Standart;MAXTRA+;Aktif Karbon", sortOrder: 11 }),
        A("Filtre Adedi", "filtre-adedi", "SINGLE_SELECT", { isVariant: true, optionValues: "1;2;3;4;6", sortOrder: 12 }),
        A("Filtre Değişim Göstergesi", "filtre-degisim-gostergesi", "BOOLEAN", { sortOrder: 13 }),
      ],
    },
    {
      category: "Robot Süpürge",
      template: "SMALL_APPLIANCE",
      extra: [
        A("Emme Gücü", "emme-gucu", "NUMBER", { unit: "Pa", sortOrder: 10 }),
        A("Haritalama", "haritalama", "BOOLEAN", { sortOrder: 11 }),
        A("Islak Silme", "islak-silme", "BOOLEAN", { sortOrder: 12 }),
        A("Toz Haznesi", "toz-haznesi", "SINGLE_SELECT", { optionValues: "0.3 L;0.5 L;0.6 L;0.8 L", sortOrder: 13 }),
        A("Çalışma Süresi", "calisma-suresi", "NUMBER", { unit: "dk", sortOrder: 14 }),
      ],
    },
    {
      category: "Kahve Makinesi",
      template: "SMALL_APPLIANCE",
      extra: [
        A("Kahve Tipi", "kahve-tipi", "SINGLE_SELECT", { required: true, optionValues: "Espresso;Filtre;Kapsül;Türk;Otomatik", sortOrder: 10 }),
        A("Basınç", "basinc", "NUMBER", { unit: "bar", sortOrder: 11 }),
        A("Su Haznesi", "su-haznesi", "SINGLE_SELECT", { optionValues: "1 L;1.5 L;1.8 L;2 L", sortOrder: 12 }),
        A("Süt Köpürtücü", "sut-kopurtucu", "BOOLEAN", { sortOrder: 13 }),
      ],
    },
    {
      category: "Endüstriyel Makineler",
      template: "INDUSTRIAL_MACHINE",
      extra: [
        A("Makine Tipi", "makine-tipi", "SINGLE_SELECT", { required: true, optionValues: "Tarım;İnşaat;Üretim;Depo;Diğer", sortOrder: 10 }),
        A("Yakıt Tipi", "yakit-tipi", "SINGLE_SELECT", { optionValues: "Elektrik;Dizel;Benzin;LPG;Hibrit", sortOrder: 11 }),
      ],
    },
  ];

  const criticalRows: Record<string, unknown>[] = [];
  for (const c of criticalDefs) {
    const base = TEMPLATES[c.template] || TEMPLATES.GENERIC;
    const merged = [...base.map((a) => ({ ...a })), ...c.extra];
    // dedupe by slug keeping higher sort / extra
    const bySlug = new Map<string, AttrDef>();
    for (const a of merged) bySlug.set(a.attributeSlug, a);
    let order = 1;
    for (const a of bySlug.values()) {
      criticalRows.push({
        categoryName: c.category,
        template: c.template,
        attributeName: a.attributeName,
        attributeSlug: a.attributeSlug,
        type: a.type,
        required: a.required,
        filterable: a.filterable,
        searchable: a.searchable,
        comparisonVisible: a.comparisonVisible,
        isVariant: a.isVariant,
        optionValues: a.optionValues,
        unit: a.unit,
        sortOrder: order++,
        notes:
          c.category === "Çamaşır Makinesi"
            ? "REMOVE fridge attrs hacim/kapi-tipi/no-frost if present"
            : c.category === "Bisiklet"
              ? "DB currently empty/weak — seed this set"
              : "",
      });
    }
  }
  writeCsv(
    join(OUT, "critical-category-attributes-final.csv"),
    [
      "categoryName",
      "template",
      "attributeName",
      "attributeSlug",
      "type",
      "required",
      "filterable",
      "searchable",
      "comparisonVisible",
      "isVariant",
      "optionValues",
      "unit",
      "sortOrder",
      "notes",
    ],
    criticalRows
  );

  // ========== 6) Templates + assignments + overrides ==========
  const templateRows: Record<string, unknown>[] = [];
  for (const [tpl, attrs] of Object.entries(TEMPLATES)) {
    if (tpl === "GENERIC") continue;
    for (const a of attrs) {
      templateRows.push({
        templateId: tpl,
        attributeName: a.attributeName,
        attributeSlug: a.attributeSlug,
        type: a.type,
        required: a.required,
        filterable: a.filterable,
        searchable: a.searchable,
        comparisonVisible: a.comparisonVisible,
        isVariant: a.isVariant,
        optionValues: a.optionValues,
        unit: a.unit,
        sortOrder: a.sortOrder,
      });
    }
  }
  // include GENERIC
  for (const a of TEMPLATES.GENERIC) {
    templateRows.push({
      templateId: "GENERIC",
      attributeName: a.attributeName,
      attributeSlug: a.attributeSlug,
      type: a.type,
      required: a.required,
      filterable: a.filterable,
      searchable: a.searchable,
      comparisonVisible: a.comparisonVisible,
      isVariant: a.isVariant,
      optionValues: a.optionValues,
      unit: a.unit,
      sortOrder: a.sortOrder,
    });
  }
  writeCsv(
    join(OUT, "attribute-templates.csv"),
    [
      "templateId",
      "attributeName",
      "attributeSlug",
      "type",
      "required",
      "filterable",
      "searchable",
      "comparisonVisible",
      "isVariant",
      "optionValues",
      "unit",
      "sortOrder",
    ],
    templateRows
  );

  const assignRows: Record<string, unknown>[] = [];
  const overrideRows: Record<string, unknown>[] = [];
  const tplCount: Record<string, number> = {};
  for (const leaf of leaves) {
    const tpl = assignTemplate(leaf.path, leaf.name);
    tplCount[tpl] = (tplCount[tpl] || 0) + 1;
    assignRows.push({
      categoryPath: leaf.path,
      leafName: leaf.name,
      templateId: tpl,
      notes: tpl === "GENERIC" ? "fallback — improve via overrides when traffic warrants" : "",
    });
  }
  // overrides for critical categories by path match
  for (const c of criticalDefs) {
    const matchLeaves = leaves.filter((l) => norm(l.name) === norm(c.category) || norm(l.name).includes(norm(c.category)));
    for (const leaf of matchLeaves.slice(0, 8)) {
      for (const a of c.extra) {
        overrideRows.push({
          categoryPath: leaf.path,
          action: "UPSERT",
          attributeSlug: a.attributeSlug,
          attributeName: a.attributeName,
          type: a.type,
          required: a.required,
          filterable: a.filterable,
          searchable: a.searchable,
          comparisonVisible: a.comparisonVisible,
          isVariant: a.isVariant,
          optionValues: a.optionValues,
          unit: a.unit,
          reason: `critical override for ${c.category}`,
        });
      }
      if (c.category === "Çamaşır Makinesi") {
        for (const bad of ["hacim", "kapi-tipi", "no-frost"]) {
          overrideRows.push({
            categoryPath: leaf.path,
            action: "REMOVE",
            attributeSlug: bad,
            attributeName: "",
            type: "",
            required: false,
            filterable: false,
            searchable: false,
            comparisonVisible: false,
            isVariant: false,
            optionValues: "",
            unit: "",
            reason: "fridge attr wrongly on washer",
          });
        }
      }
    }
  }
  writeCsv(
    join(OUT, "attribute-template-assignments.csv"),
    ["categoryPath", "leafName", "templateId", "notes"],
    assignRows
  );
  writeCsv(
    join(OUT, "attribute-overrides.csv"),
    [
      "categoryPath",
      "action",
      "attributeSlug",
      "attributeName",
      "type",
      "required",
      "filterable",
      "searchable",
      "comparisonVisible",
      "isVariant",
      "optionValues",
      "unit",
      "reason",
    ],
    overrideRows
  );

  // ========== 7) Brand quality ==========
  const brandRowsOut: Record<string, unknown>[] = [];
  const sifirCats = cats.filter((c) => c.slug.startsWith("sifir-urun") || c.slug === "sifir-urun");
  // sample CategoryBrand for high-count cats
  const highBrand = sifirCats.filter((c) => c._count.categoryBrands >= 20).slice(0, 80);
  for (const c of highBrand) {
    const links = await prisma.categoryBrand.findMany({
      where: { categoryId: c.id },
      select: { brand: { select: { name: true, slug: true } } },
      take: 60,
    });
    const names = links.map((l) => l.brand.name);
    const cross =
      (/bisiklet|pet|mama|gida|bahce/.test(norm(c.name + " " + (c.path || ""))) &&
        names.some((n) => /nike|adidas|apple|samsung|xiaomi/i.test(n))) ||
      (/telefon|elektronik/.test(norm(c.path || "")) === false && names.filter((n) => /apple|samsung|xiaomi/i.test(n)).length >= 3);
    brandRowsOut.push({
      categoryId: c.id,
      categoryName: c.name,
      categoryPath: c.path || c.slug,
      brandCount: c._count.categoryBrands,
      issueType: cross ? "CROSS_VERTICAL_OR_INHERIT" : c._count.categoryBrands >= 25 ? "TOO_MANY_BRANDS" : "REVIEW",
      sampleBrands: names.slice(0, 12).join(";"),
      missingCoreBrands: "",
      allowUnbrandedSuggested: /gida|icecek|kirtasiye|hobi|diger/.test(norm(c.name)),
      brandRequiredSuggested: /telefon|laptop|televizyon|buzdolabi|camasir/.test(norm(c.name)),
      recommendation: cross
        ? "Strip irrelevant brands; re-seed from vertical list"
        : "Cap featured brands; keep allowUnbranded policy explicit",
      mutateDb: false,
    });
  }
  // plan gaps: leaves with only weak brands in plan
  const brandsByPath = new Map<string, Row[]>();
  for (const b of brandPlan) {
    const list = brandsByPath.get(b.categoryPath) || [];
    list.push(b);
    brandsByPath.set(b.categoryPath, list);
  }
  let onlyDigerPlan = 0;
  for (const leaf of leaves) {
    const list = brandsByPath.get(leaf.path) || [];
    if (list.length === 1 && /diger|markasiz/i.test(list[0].brandName || "")) {
      onlyDigerPlan++;
      brandRowsOut.push({
        categoryId: "",
        categoryName: leaf.name,
        categoryPath: leaf.path,
        brandCount: 1,
        issueType: "ONLY_DIGER_IN_PLAN",
        sampleBrands: list[0].brandName,
        missingCoreBrands: "add vertical core brands or set brandOptional=true",
        allowUnbrandedSuggested: true,
        brandRequiredSuggested: false,
        recommendation: "Markasız/Diğer policy OK if allowUnbranded; else seed 3–8 core brands",
        mutateDb: false,
      });
    }
  }
  writeCsv(
    join(OUT, "category-brand-quality-final.csv"),
    [
      "categoryId",
      "categoryName",
      "categoryPath",
      "brandCount",
      "issueType",
      "sampleBrands",
      "missingCoreBrands",
      "allowUnbrandedSuggested",
      "brandRequiredSuggested",
      "recommendation",
      "mutateDb",
    ],
    brandRowsOut
  );

  // ========== 8) Batches ==========
  const batchRows: Record<string, unknown>[] = [];
  let b1 = 0,
    b2 = 0,
    b3 = 0;

  function pushBatch(row: Record<string, unknown>, batch: string) {
    batchRows.push({ ...row, batch });
    if (batch === "BATCH_1_SAFE_STRUCTURE") b1++;
    else if (batch === "BATCH_2_RELATION_AWARE") b2++;
    else b3++;
  }

  // From mapping + decisions
  for (const m of mapping) {
    const action = m.action;
    const risk = m.riskLevel;
    const rel =
      Number(m.listingCount || 0) + Number(m.productCount || 0) + Number(m.sellerOfferCount || 0);

    if (action === "KEEP") {
      pushBatch({ ...m, batchReason: "KEEP" }, "BATCH_1_SAFE_STRUCTURE");
    } else if (action === "CREATE_NEW") {
      const d = createDecisions.find((c) => c.targetPath === m.targetPath);
      if (!d) {
        // NO_MATCH / LOW from earlier validation
        const v = createVal.find((c) => c.targetPath === m.targetPath);
        if (v && (v.confidence === "NO_MATCH" || v.confidence === "LOW")) {
          pushBatch({ ...m, batchReason: "CREATE_NEW_CONFIRMED" }, "BATCH_1_SAFE_STRUCTURE");
        } else {
          pushBatch({ ...m, batchReason: "create unknown" }, "BATCH_3_MANUAL");
        }
      } else if (d.finalDecision === "CREATE_NEW_CONFIRMED" && d.reviewerRequired === false) {
        pushBatch({ ...m, batchReason: String(d.finalDecision) }, "BATCH_1_SAFE_STRUCTURE");
      } else if (["USE_EXISTING_ID", "RENAME_EXISTING", "MOVE_EXISTING"].includes(String(d.finalDecision)) && !d.reviewerRequired) {
        pushBatch({ ...m, batchReason: String(d.finalDecision) }, "BATCH_2_RELATION_AWARE");
      } else if (["USE_EXISTING_ID", "RENAME_EXISTING", "MOVE_EXISTING"].includes(String(d.finalDecision))) {
        pushBatch({ ...m, batchReason: String(d.finalDecision) }, "BATCH_2_RELATION_AWARE");
      } else {
        pushBatch({ ...m, batchReason: String(d.finalDecision) }, "BATCH_3_MANUAL");
      }
    } else if (action === "MOVE") {
      if (riskyNames.includes(m.currentName)) {
        pushBatch({ ...m, batchReason: "risky move" }, "BATCH_3_MANUAL");
      } else if (rel === 0) {
        pushBatch({ ...m, batchReason: "empty MOVE" }, "BATCH_1_SAFE_STRUCTURE");
      } else {
        pushBatch({ ...m, batchReason: "related MOVE" }, "BATCH_2_RELATION_AWARE");
      }
    } else if (["SPLIT", "MERGE", "MANUAL_REVIEW", "ARCHIVE"].includes(action)) {
      pushBatch({ ...m, batchReason: action }, "BATCH_3_MANUAL");
    } else {
      pushBatch({ ...m, batchReason: "other" }, "BATCH_3_MANUAL");
    }
  }

  // Archive confirmed → batch 2 (txn soft-delete)
  // already in mapping as ARCHIVE → batch 3; refine using archiveVal
  for (const row of batchRows) {
    if (row.action !== "ARCHIVE") continue;
    const a = archiveVal.find((x) => x.categoryId === row.currentCategoryId);
    if (a?.revisedAction === "ARCHIVE_CONFIRMED" && a.archiveConfirmed === "true") {
      row.batch = "BATCH_2_RELATION_AWARE";
      row.batchReason = "ARCHIVE_CONFIRMED link cleanup";
    } else {
      const d = archiveDec.find((x) => x.categoryId === row.currentCategoryId);
      if (d && ["RENAME", "RENAME_EXISTING", "MOVE", "MOVE_EXISTING"].includes(String(d.finalDecision)) && d.reviewerRequired === false) {
        row.batch = "BATCH_2_RELATION_AWARE";
        row.batchReason = String(d.finalDecision);
      } else {
        row.batch = "BATCH_3_MANUAL";
        row.batchReason = String(d?.finalDecision || a?.revisedAction || "ARCHIVE");
      }
    }
  }
  b1 = batchRows.filter((b) => b.batch === "BATCH_1_SAFE_STRUCTURE").length;
  b2 = batchRows.filter((b) => b.batch === "BATCH_2_RELATION_AWARE").length;
  b3 = batchRows.filter((b) => b.batch === "BATCH_3_MANUAL").length;

  writeCsv(
    join(OUT, "application-batches-final.csv"),
    [
      "currentCategoryId",
      "currentName",
      "targetPath",
      "action",
      "riskLevel",
      "listingCount",
      "productCount",
      "sellerOfferCount",
      "batch",
      "batchReason",
      "notes",
    ],
    batchRows.map((b) => ({
      currentCategoryId: b.currentCategoryId,
      currentName: b.currentName,
      targetPath: b.targetPath,
      action: b.action,
      riskLevel: b.riskLevel,
      listingCount: b.listingCount,
      productCount: b.productCount,
      sellerOfferCount: b.sellerOfferCount,
      batch: b.batch,
      batchReason: b.batchReason,
      notes: b.notes,
    }))
  );

  const batchMeta = {
    BATCH_1_SAFE_STRUCTURE: {
      count: b1,
      transactionScope: "per ana category create/keep/empty-move; max 200 ops/txn",
      checkpoint: "export Category id,parentId,path,slug JSON before batch",
      rollback: "delete created rows by batch tag; restore parentId/path from checkpoint",
      tests: ["tree depth counts", "no orphan parentId", "slug unique", "smoke /elektronik"],
      affectedEstimate: "structure only — 0 product id changes",
    },
    BATCH_2_RELATION_AWARE: {
      count: b2,
      transactionScope: "single category move/rename/archive + alias insert",
      checkpoint: "Category + CategoryAlias + CategoryBrand counts",
      rollback: "SQL parentId/path restore + alias delete",
      tests: ["product.categoryId stable", "listing filter", "alias 301"],
      affectedEstimate: "path/breadcrumb; commercial FKs preserved via same id",
    },
    BATCH_3_MANUAL: {
      count: b3,
      transactionScope: "human-approved one-by-one",
      checkpoint: "full row dump for touched ids",
      rollback: "per-ticket restore",
      tests: ["split mapping queue empty", "risky move checklist"],
      affectedEstimate: "phones/fridge/splits — listings+products",
    },
  };
  writeFileSync(join(OUT, "application-batches-meta.json"), JSON.stringify(batchMeta, null, 2), "utf8");

  const stillManual =
    createDecisions.filter((d) => d.reviewerRequired === true || String(d.finalDecision).includes("MANUAL") || d.finalDecision === "SPLIT_EXISTING")
      .length +
    archiveDec.filter((d) => d.reviewerRequired === true).length +
    3 + // risky moves
    3; // splits

  const summary = {
    generatedAt: new Date().toISOString(),
    dbMutations: false,
    readyToWriteDb: false,
    createNewDuplicateDecisions: {
      total: createDecisions.length,
      distribution: createDist,
      reviewerRequired: createDecisions.filter((d) => d.reviewerRequired === true).length,
    },
    archiveReclass: {
      total: archiveDec.length,
      distribution: archiveDist,
      scopeAdds: archiveDec.filter((d) => d.finalDecision === "ADD_TO_TARGET_TREE").length,
    },
    riskyMoves: riskyPlans.length,
    splits: splitRules.length,
    attributeTemplates: Object.keys(TEMPLATES).length,
    templateAssignmentCounts: tplCount,
    criticalAttributeRows: criticalRows.length,
    brandQualityRows: brandRowsOut.length,
    onlyDigerPlan,
    batches: { batch1: b1, batch2: b2, batch3: b3 },
    firstApplicableBatch: "BATCH_1_SAFE_STRUCTURE",
    stillManualDecisionEstimate: stillManual,
    files: {
      createDecisions: "docs/catalog-taxonomy/manual-create-new-decisions.csv",
      archiveReclass: "docs/catalog-taxonomy/manual-archive-reclass-decisions.csv",
      riskyMoves: "docs/catalog-taxonomy/manual-risky-move-plans.csv",
      splits: "docs/catalog-taxonomy/manual-split-distribution-rules.csv",
      criticalAttrs: "docs/catalog-taxonomy/critical-category-attributes-final.csv",
      templates: "docs/catalog-taxonomy/attribute-templates.csv",
      assignments: "docs/catalog-taxonomy/attribute-template-assignments.csv",
      overrides: "docs/catalog-taxonomy/attribute-overrides.csv",
      brands: "docs/catalog-taxonomy/category-brand-quality-final.csv",
      batches: "docs/catalog-taxonomy/application-batches-final.csv",
      batchMeta: "docs/catalog-taxonomy/application-batches-meta.json",
    },
  };
  writeFileSync(join(SCRIPT_OUT, "catalog-taxonomy-manual-decisions.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
