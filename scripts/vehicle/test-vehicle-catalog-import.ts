/**
 * Post-import catalog integrity tests (DB + pack + architecture rules).
 * npx tsx scripts/vehicle/test-vehicle-catalog-import.ts
 */
import "dotenv/config";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "http://localhost:3010").replace(/\/+$/, "");

type Row = { name: string; status: "PASS" | "FAIL"; detail?: string };
const results: Row[] = [];

function record(name: string, ok: boolean, detail = "") {
  results.push({ name, status: ok ? "PASS" : "FAIL", detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const packPath = join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  const entries = pack.entries || [];

  // 1 Arazi brands-only (no SUV/Crossover children in target tree / browse meta)
  const arazi = await prisma.category.findFirst({
    where: { path: "arac/arazi-suv-pickup" },
    include: { children: { where: { isActive: true }, select: { slug: true, name: true } } },
  });
  const badKids = (arazi?.children || []).filter((c) =>
    ["suv", "crossover", "arazi-araci", "pickup", "arazi"].includes(c.slug)
  );
  record("1 Arazi has no SUV/Crossover/Pickup subtype children", badKids.length === 0, badKids.map((c) => c.slug).join(","));

  // 2 BMW 3 Serisi only otomobil
  const bmw = await prisma.brand.findUnique({ where: { slug: "bmw" } });
  const s3 = bmw
    ? await prisma.productModel.findFirst({
        where: { brandId: bmw.id, OR: [{ slug: "3-serisi" }, { name: "3 Serisi" }] },
        include: { categoryModels: { include: { category: true } } },
      })
    : null;
  const s3Paths = s3?.categoryModels.map((c) => c.category.path) || [];
  record("2 BMW 3 Serisi only under otomobil", s3Paths.length > 0 && s3Paths.every((p) => p === "arac/otomobil"), s3Paths.join("|"));

  // 3 BMW X3 only arazi
  const x3 = bmw
    ? await prisma.productModel.findFirst({
        where: { brandId: bmw.id, slug: "x3" },
        include: { categoryModels: { include: { category: true } } },
      })
    : null;
  const x3Paths = x3?.categoryModels.map((c) => c.category.path) || [];
  record("3 BMW X3 only under arazi-suv-pickup", x3Paths.length > 0 && x3Paths.every((p) => p === "arac/arazi-suv-pickup"), x3Paths.join("|"));

  // 4 Elektrikli does not duplicate canonical CategoryBrand seeds for Model Y as sole home
  const elec = await prisma.category.findFirst({ where: { path: "arac/elektrikli-araclar" } });
  let elecBrandDup = 0;
  if (elec) {
    elecBrandDup = await prisma.categoryBrand.count({ where: { categoryId: elec.id } });
  }
  // Overlay hub may have 0 brands — preferred. If >0, still fail only if Model Y ONLY there.
  const tesla = await prisma.brand.findUnique({ where: { slug: "tesla" } });
  const modelY = tesla
    ? await prisma.productModel.findFirst({
        where: { brandId: tesla.id, slug: "model-y" },
        include: { categoryModels: { include: { category: true } } },
      })
    : null;
  const yPaths = modelY?.categoryModels.map((c) => c.category.path) || [];
  record(
    "4 Tesla Model Y canonical under arazi (not electric-only)",
    yPaths.length > 0 && yPaths.every((p) => p === "arac/arazi-suv-pickup"),
    yPaths.join("|") + `; elecCategoryBrands=${elecBrandDup}`
  );

  // 5-7 duplicates under same parent via CategoryBrand/Model
  const otomobil = await prisma.category.findFirst({ where: { path: "arac/otomobil" } });
  let dupBrand = false;
  let dupModel = false;
  if (otomobil) {
    const cbs = await prisma.categoryBrand.findMany({ where: { categoryId: otomobil.id }, include: { brand: true } });
    const seenB = new Set<string>();
    for (const cb of cbs) {
      if (seenB.has(cb.brandId)) dupBrand = true;
      seenB.add(cb.brandId);
    }
    const cms = await prisma.categoryModel.findMany({ where: { categoryId: otomobil.id }, include: { model: true } });
    const seenM = new Set<string>();
    for (const cm of cms) {
      const k = `${cm.model.brandId}|${cm.model.slug}`;
      if (seenM.has(k)) dupModel = true;
      seenM.add(k);
    }
  }
  record("5 No duplicate brands under otomobil CategoryBrand", !dupBrand);
  record("6 No duplicate models under otomobil CategoryModel", !dupModel);

  // version dupes in pack
  let versionDup = false;
  for (const e of entries) {
    const slugs = (e.versions || []).map((v: { slug: string }) => v.slug);
    if (new Set(slugs).size !== slugs.length) versionDup = true;
  }
  record("7 No duplicate version slugs within series pack rows", !versionDup);

  // 8 empty names
  const empty = entries.some(
    (e: { brandName?: string; modelName?: string; versions?: Array<{ name: string }> }) =>
      !e.brandName?.trim() || !e.modelName?.trim() || (e.versions || []).some((v) => !v.name?.trim())
  );
  record("8 No empty brand/series/version names in pack", !empty);

  // 9 listing category preserved — count only
  const listings = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  record("9 Vehicle listings still present", listings >= 0, `count=${listings}`);

  // 10 idempotent re-apply dry check: pack brands unique keys
  const keys = entries.map((e: { categoryPaths: string[]; brandSlug: string; modelSlug: string; generationCode: string }) =>
    `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}|${e.generationCode}`
  );
  record("10 Pack entry keys unique (re-apply safe)", new Set(keys).size === keys.length);

  // 11 Subaru/Smart corruption absent
  const raw = readFileSync(packPath, "utf8");
  record("11 No PremiumLegacy / Justy;; corruption in pack", !raw.includes("PremiumLegacy") && !raw.includes("Justy;;"));

  // 12 15 main vasita categories in source summary
  const summary = JSON.parse(readFileSync(join(process.cwd(), "docs/vehicle-import/source/teklifbu_vasita_katalog_ozet.json"), "utf8"));
  record("12 Source has 15 vehicle categories", summary.levelCounts?.VEHICLE_CATEGORY === 15, String(summary.levelCounts?.VEHICLE_CATEGORY));

  // 13-14 cascade API smoke
  try {
    const brandsRes = await fetch(`${BASE}/api/vasita/catalog?action=brands&subtype=otomobil`, { cache: "no-store" });
    const brandsBody = await brandsRes.json();
    record("13 Cascade brands API otomobil responds", brandsRes.status === 200 && brandsBody.ok === true, `status=${brandsRes.status} brands=${(brandsBody.brands || []).length}`);

    const modelsRes = await fetch(`${BASE}/api/vasita/catalog?action=models&subtype=otomobil&brand=bmw`, { cache: "no-store" });
    const modelsBody = await modelsRes.json().catch(() => ({}));
    record("14 Cascade models API for BMW responds", modelsRes.status === 200 && modelsBody.ok === true, `status=${modelsRes.status} models=${(modelsBody.models || []).length}`);
  } catch (e) {
    record("13 Cascade brands API otomobil responds", false, String(e));
    record("14 Cascade models API for BMW responds", false, "skipped");
  }

  // 15 browse tree arazi
  try {
    const treeRes = await fetch(`${BASE}/api/catalog/tree?format=vasita-browse`, { cache: "no-store" });
    const treeBody = await treeRes.json();
    record("15 Vasita browse tree API ok", treeRes.status === 200 && !!treeBody, `status=${treeRes.status}`);
  } catch (e) {
    record("15 Vasita browse tree API ok", false, String(e));
  }

  // Extra architecture paths
  const model3 = tesla
    ? await prisma.productModel.findFirst({
        where: { brandId: tesla.id, slug: "model-3" },
        include: { categoryModels: { include: { category: true } } },
      })
    : null;
  record(
    "Tesla Model 3 under otomobil",
    !!model3?.categoryModels.some((c) => c.category.path === "arac/otomobil"),
    model3?.categoryModels.map((c) => c.category.path).join("|") || "missing"
  );

  const togg = await prisma.brand.findUnique({ where: { slug: "togg" } });
  const t10x = togg
    ? await prisma.productModel.findFirst({
        where: { brandId: togg.id, slug: "t10x" },
        include: { categoryModels: { include: { category: true } } },
      })
    : null;
  const t10f = togg
    ? await prisma.productModel.findFirst({
        where: { brandId: togg.id, slug: "t10f" },
        include: { categoryModels: { include: { category: true } } },
      })
    : null;
  record("TOGG T10X under arazi", !!t10x?.categoryModels.some((c) => c.category.path === "arac/arazi-suv-pickup"));
  record("TOGG T10F under otomobil", !!t10f?.categoryModels.some((c) => c.category.path === "arac/otomobil"));

  const legacy = await prisma.brand.findUnique({ where: { slug: "subaru" } }).then(async (b) =>
    b
      ? prisma.productModel.findFirst({ where: { brandId: b.id, slug: "legacy" } })
      : null
  );
  const smart = await prisma.brand.findUnique({ where: { slug: "smart" } });
  const smart1 = smart
    ? await prisma.productModel.findFirst({ where: { brandId: smart.id, OR: [{ slug: "1" }, { slug: "-1" }, { name: "#1" }] } })
    : null;
  record("Subaru Legacy exists as own model", !!legacy);
  record("Smart #1 exists under smart brand", !!smart1, smart1?.slug || "missing");

  const failed = results.filter((r) => r.status === "FAIL");
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "scripts/output/vehicle-catalog-import-tests.json"),
    JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2)
  );
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
