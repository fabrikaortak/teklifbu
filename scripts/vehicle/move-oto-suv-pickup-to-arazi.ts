/**
 * Otomobil altındaki SUV / Pickup serilerini Arazi-SUV-Pickup'a taşı.
 *
 * Kurallar:
 * 1) Aynı marka + (slug veya normalize isim) Arazi'de varsa →
 *    pack alt kategorilerini (version/trim) Arazi kaydına birleştir,
 *    Otomobil CategoryModel + otomobil pack path'lerini kaldır.
 * 2) Yoksa → komple taşı (CategoryModel/Brand Arazi'ye, pack path otomobil→arazi),
 *    Otomobil'den sil.
 *
 * npx tsx scripts/vehicle/move-oto-suv-pickup-to-arazi.ts --dry-run
 * npx tsx scripts/vehicle/move-oto-suv-pickup-to-arazi.ts
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const OTO_PATH = "arac/otomobil";
const ARAZI_PATH = "arac/arazi-suv-pickup";
const STAGE1_FILE = join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json");

type Trim = { slug: string; name: string; generationCode?: string; yearFrom?: number; yearTo?: number };
type Version = {
  slug: string;
  name: string;
  trims?: Trim[];
  yearFrom?: number;
  yearTo?: number;
  fuelTypes?: string[];
  generationCode?: string;
};
type PackEntry = {
  categoryPaths: string[];
  brandSlug: string;
  brandName?: string;
  modelSlug: string;
  modelName?: string;
  generationCode?: string;
  generationLabel?: string;
  versions?: Version[];
  modelYears?: number[];
  fuelTypes?: string[];
  transmissions?: string[];
  bodyTypes?: string[];
  source?: string;
  verified?: boolean;
  market?: string;
  active?: boolean;
  [k: string]: unknown;
};

function normName(s: string) {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Bilinen binek false-positive (otomobilde kalsın) */
const DENY: Array<{ brandSlug: string; modelSlug: string }> = [
  { brandSlug: "ford", modelSlug: "sierra" }, // klasik sedan
  { brandSlug: "mitsubishi", modelSlug: "eclipse" }, // coupe; eclipse-cross ayrı
  { brandSlug: "volkswagen", modelSlug: "caddy" }, // hafif ticari
  { brandSlug: "volkswagen", modelSlug: "caddy-maxi" },
];

/**
 * SUV / pickup / arazi ipuçları (TR Sahibinden tarzı).
 * Marka-bağımsız gövde + bilinen seri kodları.
 */
function looksLikeSuvOrPickup(brandSlug: string, modelSlug: string, modelName: string): boolean {
  const slug = modelSlug.toLowerCase();
  const name = modelName.toLocaleLowerCase("tr");
  const blob = `${slug} ${name}`;

  if (DENY.some((d) => d.brandSlug === brandSlug && d.modelSlug === slug)) return false;

  if (/\b(suv|pickup|pikap|pick[\s-]?up|crossover|arazi|off[\s-]?road)\b/i.test(blob)) return true;

  // Genel seri kalıpları
  if (
    /^(gl[abceks]?|gla|glb|glc|gle|gls|glk|ml|macan|cayenne|urus|levante|bentayga|dbx|cullinan|rav4|cr-?v|hr-?v|wr-?v|tucson|sportage|sorento|santa-?fe|kona|niro|duster|captur|kadjar|koleos|outlander|asx|eclipse-cross|cx-?\d|forester|outback|\bxv\b|land-?cruiser|prado|hilux|ranger|l200|triton|navara|frontier|d-?max|amarok|colorado|canyon|tacoma|tundra|wrangler|cherokee|compass|renegade|gladiator|defender|discovery|range-?rover|evoque|velar|touareg|tiguan|t-?roc|t-?cross|taigo|atlas|yukon|tahoe|suburban|expedition|explorer|escape|edge|bronco|everest|territory|trailblazer|equinox|blazer|traverse|enclave|encore|envision|xt[456]|escalade|navigator|aviator|nautilus|corsair|gx|lx|rx|nx|ux|tx|rz|bz4x|solterra|ariya|ioniq-?[57]|ev[69]|id-[467]|model-[yx]|cybertruck|hummer-ev|f-?1\d0|silverado|ram-?\d|jimny|vitara|s-cross|across|patrol|pathfinder|murano|x-trail|qashqai|juke|kicks|rocky|terios|raize|urban-cruiser|corolla-cross|c-hr|b-z4x|yv|grandland|crossland|mokka|combo-life)$/i.test(
      slug
    )
  ) {
    return true;
  }

  // BMW X / Audi Q / Mercedes G & EQ SUV / Volvo XC
  if (brandSlug === "bmw" && /^(x[1-7]|xm|ix|i[nx]\d*)$/i.test(slug)) return true;
  if (brandSlug === "audi" && /^(q[2-8]|sq[2-8]|rsq[38]|e-tron|q[48]-e-tron)$/i.test(slug)) return true;
  if (brandSlug.includes("mercedes") && /^(g-serisi|g-class|g-wagen|gla|glb|glc|gle|gls|glk|gl|ml|eqa|eqb|eqc|eqe-suv|eqs-suv|maybach-gls|x|x-class|g-580-eq)$/i.test(slug))
    return true;
  if (brandSlug === "volvo" && /^xc/i.test(slug)) return true;
  if (brandSlug === "porsche" && /^(macan|cayenne)$/i.test(slug)) return true;
  if (brandSlug === "lexus" && /^(ux|nx|rx|gx|lx|tx|rz)$/i.test(slug)) return true;
  if (brandSlug === "tesla" && /^(model-y|model-x|cybertruck)$/i.test(slug)) return true;
  if (brandSlug === "land-rover" || brandSlug === "landrover") return /defender|discovery|range|evoque|velar/i.test(slug);
  if ((brandSlug === "gmc" || brandSlug === "chevrolet") && /sierra|silverado|colorado|canyon|tahoe|suburban|yukon|traverse|equinox|blazer|trailblazer/i.test(slug))
    return true;

  // İsimde SUV / Pickup / Arazi
  if (/\b(suv|pickup|pikap|crossover|arazi\s*arac)/i.test(name)) return true;

  return false;
}

function mergeVersions(into: Version[], from: Version[]): Version[] {
  const map = new Map<string, Version>();
  for (const v of into) {
    if (!v?.slug) continue;
    map.set(v.slug, {
      ...v,
      trims: Array.isArray(v.trims) ? [...v.trims] : [],
    });
  }
  for (const v of from) {
    if (!v?.slug) continue;
    const cur = map.get(v.slug);
    if (!cur) {
      map.set(v.slug, {
        ...v,
        trims: Array.isArray(v.trims) ? [...v.trims] : [],
      });
      continue;
    }
    const trimMap = new Map<string, Trim>();
    for (const t of cur.trims || []) if (t?.slug) trimMap.set(t.slug, t);
    for (const t of v.trims || []) if (t?.slug && !trimMap.has(t.slug)) trimMap.set(t.slug, t);
    cur.trims = [...trimMap.values()];
    if (!cur.name && v.name) cur.name = v.name;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

async function main() {
  const oto = await prisma.category.findFirst({
    where: { OR: [{ path: OTO_PATH }, { slug: "arac__otomobil" }], deletedAt: null },
  });
  const arazi = await prisma.category.findFirst({
    where: { OR: [{ path: ARAZI_PATH }, { slug: "arac__arazi-suv-pickup" }], deletedAt: null },
  });
  if (!oto || !arazi) throw new Error(`category missing oto=${!!oto} arazi=${!!arazi}`);

  const otoRows = await prisma.categoryModel.findMany({
    where: { categoryId: oto.id, model: { isActive: true, deletedAt: null } },
    include: { model: { include: { brand: true } } },
  });
  const araziRows = await prisma.categoryModel.findMany({
    where: { categoryId: arazi.id, model: { isActive: true, deletedAt: null } },
    include: { model: { include: { brand: true } } },
  });

  type AraziHit = { modelId: string; slug: string; name: string };
  const araziByBrandSlug = new Map<string, Map<string, AraziHit>>();
  const araziByBrandName = new Map<string, Map<string, AraziHit>>();
  for (const r of araziRows) {
    const b = r.model.brand.slug;
    if (!araziByBrandSlug.has(b)) araziByBrandSlug.set(b, new Map());
    if (!araziByBrandName.has(b)) araziByBrandName.set(b, new Map());
    const hit = { modelId: r.model.id, slug: r.model.slug, name: r.model.name };
    araziByBrandSlug.get(b)!.set(r.model.slug, hit);
    araziByBrandName.get(b)!.set(normName(r.model.name), hit);
  }

  type Plan = {
    brandSlug: string;
    brandName: string;
    brandId: string;
    otoModelId: string;
    otoSlug: string;
    otoName: string;
    action: "merge" | "move";
    araziModelId?: string;
    araziSlug?: string;
    araziName?: string;
    detect: "slug-match" | "name-match" | "heuristic";
  };

  const plans: Plan[] = [];
  for (const r of otoRows) {
    const brandSlug = r.model.brand.slug;
    const brandName = r.model.brand.name;
    const brandId = r.model.brand.id;
    const otoSlug = r.model.slug;
    const otoName = r.model.name;
    const bySlug = araziByBrandSlug.get(brandSlug)?.get(otoSlug);
    const byName = araziByBrandName.get(brandSlug)?.get(normName(otoName));
    if (bySlug) {
      plans.push({
        brandSlug,
        brandName,
        brandId,
        otoModelId: r.model.id,
        otoSlug,
        otoName,
        action: "merge",
        araziModelId: bySlug.modelId,
        araziSlug: bySlug.slug,
        araziName: bySlug.name,
        detect: "slug-match",
      });
      continue;
    }
    if (byName) {
      plans.push({
        brandSlug,
        brandName,
        brandId,
        otoModelId: r.model.id,
        otoSlug,
        otoName,
        action: "merge",
        araziModelId: byName.modelId,
        araziSlug: byName.slug,
        araziName: byName.name,
        detect: "name-match",
      });
      continue;
    }
    if (looksLikeSuvOrPickup(brandSlug, otoSlug, otoName)) {
      plans.push({
        brandSlug,
        brandName,
        brandId,
        otoModelId: r.model.id,
        otoSlug,
        otoName,
        action: "move",
        detect: "heuristic",
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: DRY,
        otoModels: otoRows.length,
        araziModels: araziRows.length,
        planned: plans.length,
        merge: plans.filter((p) => p.action === "merge").length,
        move: plans.filter((p) => p.action === "move").length,
        byDetect: {
          slug: plans.filter((p) => p.detect === "slug-match").length,
          name: plans.filter((p) => p.detect === "name-match").length,
          heuristic: plans.filter((p) => p.detect === "heuristic").length,
        },
      },
      null,
      2
    )
  );
  console.log(
    "mercedes sample:",
    plans.filter((p) => p.brandSlug.includes("mercedes")).map((p) => `${p.action}:${p.otoName}→${p.araziName || "NEW"}`)
  );

  const setting = await prisma.systemSetting.findUnique({ where: { key: "vasita_stage1_catalog" } });
  const packValue = (setting?.value || {}) as { version?: string; entries?: PackEntry[]; [k: string]: unknown };
  let entries: PackEntry[] = Array.isArray(packValue.entries) ? [...packValue.entries] : [];

  const report: Array<Record<string, unknown>> = [];

  for (const plan of plans) {
    const otoPackIdx = entries
      .map((e, i) => ({ e, i }))
      .filter(
        ({ e }) =>
          e.brandSlug === plan.brandSlug &&
          e.modelSlug === plan.otoSlug &&
          (e.categoryPaths || []).includes(OTO_PATH)
      );

    const targetSlug = plan.action === "merge" ? plan.araziSlug! : plan.otoSlug;
    const targetName = plan.action === "merge" ? plan.araziName! : plan.otoName;

    // Collect versions from otomobil pack rows
    let incomingVersions: Version[] = [];
    for (const { e } of otoPackIdx) {
      incomingVersions = mergeVersions(incomingVersions, e.versions || []);
    }

    if (plan.action === "merge") {
      // Merge into existing arazi pack rows (same brand + targetSlug)
      const araziIdx = entries
        .map((e, i) => ({ e, i }))
        .filter(
          ({ e }) =>
            e.brandSlug === plan.brandSlug &&
            e.modelSlug === targetSlug &&
            (e.categoryPaths || []).includes(ARAZI_PATH)
        );

      if (!DRY) {
        if (araziIdx.length) {
          const first = araziIdx[0]!;
          const merged = mergeVersions(first.e.versions || [], incomingVersions);
          entries[first.i] = { ...first.e, versions: merged, verified: true, active: true };
          // drop duplicate arazi rows for same brand/model after merging into first
          const drop = new Set(araziIdx.slice(1).map((x) => x.i));
          // also drop oto rows
          for (const { i } of otoPackIdx) drop.add(i);
          entries = entries.filter((_, i) => !drop.has(i));
        } else if (incomingVersions.length || otoPackIdx.length) {
          // Arazi CategoryModel var ama pack yok → oto pack'i arazi path ile taşı
          for (const { i } of otoPackIdx) {
            const e = entries[i]!;
            entries[i] = {
              ...e,
              categoryPaths: [ARAZI_PATH],
              modelSlug: targetSlug,
              modelName: targetName,
              versions: mergeVersions(e.versions || [], []),
            };
          }
          // dedupe: keep one
          const kept: number[] = [];
          const remove = new Set<number>();
          for (let i = 0; i < entries.length; i++) {
            const e = entries[i]!;
            if (e.brandSlug === plan.brandSlug && e.modelSlug === targetSlug && (e.categoryPaths || []).includes(ARAZI_PATH)) {
              if (kept.length) {
                const k = kept[0]!;
                entries[k] = {
                  ...entries[k]!,
                  versions: mergeVersions(entries[k]!.versions || [], e.versions || []),
                };
                remove.add(i);
              } else kept.push(i);
            }
          }
          entries = entries.filter((_, i) => !remove.has(i));
        }

        // DB: remove otomobil link (keep arazi)
        await prisma.categoryModel.deleteMany({
          where: { categoryId: oto.id, modelId: plan.otoModelId },
        });
      }

      report.push({
        ...plan,
        otoPackRows: otoPackIdx.length,
        incomingVersions: incomingVersions.length,
        result: "merged-into-arazi-deleted-oto",
      });
    } else {
      // MOVE komple
      if (!DRY) {
        await prisma.categoryBrand.upsert({
          where: { categoryId_brandId: { categoryId: arazi.id, brandId: plan.brandId } },
          create: { categoryId: arazi.id, brandId: plan.brandId, sortOrder: 0 },
          update: {},
        });
        await prisma.categoryModel.upsert({
          where: { categoryId_modelId: { categoryId: arazi.id, modelId: plan.otoModelId } },
          create: { categoryId: arazi.id, modelId: plan.otoModelId, sortOrder: 0 },
          update: {},
        });
        await prisma.categoryModel.deleteMany({
          where: { categoryId: oto.id, modelId: plan.otoModelId },
        });

        // Pack: otomobil → arazi (or create)
        if (otoPackIdx.length) {
          for (const { i } of otoPackIdx) {
            const e = entries[i]!;
            const paths = new Set((e.categoryPaths || []).filter((p) => p !== OTO_PATH));
            paths.add(ARAZI_PATH);
            entries[i] = { ...e, categoryPaths: [...paths], verified: true, active: true };
          }
        } else {
          entries.push({
            categoryPaths: [ARAZI_PATH],
            brandSlug: plan.brandSlug,
            brandName: plan.brandName,
            modelSlug: plan.otoSlug,
            modelName: plan.otoName,
            generationCode: "MOVED-FROM-OTO",
            generationLabel: "Otomobil → Arazi taşıma",
            versions: [],
            modelYears: [],
            fuelTypes: [],
            transmissions: [],
            bodyTypes: ["SUV"],
            source: "move-oto-suv-pickup-to-arazi",
            verified: true,
            market: "TR",
            active: true,
          });
        }
      }

      report.push({
        ...plan,
        otoPackRows: otoPackIdx.length,
        incomingVersions: incomingVersions.length,
        result: "moved-komple-to-arazi",
      });
    }
  }

  // Otomobilde modeli kalmayan markaların CategoryBrand bağını temizle
  if (!DRY) {
    const remainingOto = await prisma.categoryModel.findMany({
      where: { categoryId: oto.id },
      select: { model: { select: { brandId: true } } },
    });
    const brandsWithModels = new Set(remainingOto.map((r) => r.model.brandId));
    const otoBrands = await prisma.categoryBrand.findMany({
      where: { categoryId: oto.id },
      select: { brandId: true },
    });
    const orphanBrands = otoBrands.filter((b) => !brandsWithModels.has(b.brandId)).map((b) => b.brandId);
    if (orphanBrands.length) {
      await prisma.categoryBrand.deleteMany({
        where: { categoryId: oto.id, brandId: { in: orphanBrands } },
      });
    }

    // Persist pack
    const nextPack = {
      ...packValue,
      version: `${packValue.version || "vehicle-stage1-catalog"}-oto-suv-moved`,
      entries,
      meta: {
        ...((packValue as any).meta || {}),
        lastOtoSuvMoveAt: new Date().toISOString(),
        lastOtoSuvMoveCount: plans.length,
      },
    };

    // Backup JSON file + setting
    const bakDir = join(process.cwd(), "docs/vertical-taxonomy/_bak");
    mkdirSync(bakDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (existsSync(STAGE1_FILE)) {
      copyFileSync(STAGE1_FILE, join(bakDir, `vehicle-stage1-catalog.before-oto-suv-move-${stamp}.json`));
    }
    writeFileSync(STAGE1_FILE, JSON.stringify(nextPack, null, 2), "utf8");
    writeFileSync(
      join(bakDir, `oto-suv-move-report-${stamp}.json`),
      JSON.stringify({ planned: plans.length, report }, null, 2),
      "utf8"
    );

    await prisma.systemSetting.upsert({
      where: { key: "vasita_stage1_catalog" },
      create: { key: "vasita_stage1_catalog", value: nextPack as any },
      update: { value: nextPack as any },
    });
  } else {
    const bakDir = join(process.cwd(), "docs/vertical-taxonomy/_bak");
    mkdirSync(bakDir, { recursive: true });
    writeFileSync(
      join(bakDir, `oto-suv-move-dry-run-${Date.now()}.json`),
      JSON.stringify({ planned: plans.length, report: plans }, null, 2),
      "utf8"
    );
  }

  console.log(DRY ? "DRY-RUN complete (no DB writes)." : `Applied ${plans.length} moves/merges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
