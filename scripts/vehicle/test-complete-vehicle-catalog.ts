/**
 * Acceptance tests for complete vehicle catalog (empty brands, manual, electric).
 * npx tsx scripts/vehicle/test-complete-vehicle-catalog.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
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

async function api(path: string) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const listingCount = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  record("10 Listings preserved (13)", listingCount === 13, `count=${listingCount}`);

  // Visible brands must have ≥1 model
  const otomobil = await prisma.category.findFirst({ where: { path: "arac/otomobil" } });
  let emptyVisible = 0;
  if (otomobil) {
    const cbs = await prisma.categoryBrand.findMany({
      where: { categoryId: otomobil.id, brand: { isActive: true } },
      include: { brand: true },
    });
    for (const cb of cbs) {
      const n = await prisma.categoryModel.count({
        where: { categoryId: otomobil.id, model: { brandId: cb.brandId, isActive: true } },
      });
      if (n === 0) emptyVisible++;
    }
  }
  record("3 Visible otomobil brands have ≥1 series", emptyVisible === 0, `empty=${emptyVisible}`);

  const stillHidden = await prisma.brand.count({
    where: { slug: { in: ["cheeta", "fosti", "better", "bianchi"] }, isActive: false },
  });
  record("8 Unverified/invalid brands stay inactive", stillHidden >= 3, `inactiveSample=${stillHidden}`);

  const jawa = await prisma.brand.findUnique({ where: { slug: "jawa" } });
  const jawaModels = jawa
    ? await prisma.productModel.count({ where: { brandId: jawa.id, isActive: true } })
    : 0;
  record("Empty brand FILL Jawa has series", jawaModels >= 1, `models=${jawaModels}`);

  const abush = await prisma.brand.findUnique({ where: { slug: "abush" } });
  const abushModels = abush
    ? await prisma.productModel.count({ where: { brandId: abush.id, isActive: true } })
    : 0;
  record("Hidden brand FILL Abush active with series", !!abush?.isActive && abushModels >= 1, `active=${abush?.isActive} models=${abushModels}`);

  // Special paths
  async function has(path: string, brand: string, model: string) {
    const cat = await prisma.category.findFirst({ where: { path } });
    const b = await prisma.brand.findUnique({ where: { slug: brand } });
    if (!cat || !b) return false;
    const m = await prisma.productModel.findFirst({ where: { brandId: b.id, slug: model } });
    if (!m) return false;
    const link = await prisma.categoryModel.findUnique({
      where: { categoryId_modelId: { categoryId: cat.id, modelId: m.id } },
    });
    return !!link;
  }
  record("13 BMW 3 Serisi otomobil", await has("arac/otomobil", "bmw", "3-serisi"));
  record("15 BMW X3 arazi", await has("arac/arazi-suv-pickup", "bmw", "x3"));
  record("16 Tesla Model 3 otomobil", await has("arac/otomobil", "tesla", "model-3"));
  record("17 Tesla Model Y arazi", await has("arac/arazi-suv-pickup", "tesla", "model-y"));
  record("18 TOGG T10X arazi", await has("arac/arazi-suv-pickup", "togg", "t10x"));
  record("19 TOGG T10F otomobil", await has("arac/otomobil", "togg", "t10f"));
  record("20 Subaru Legacy otomobil", await has("arac/otomobil", "subaru", "legacy"));
  record("21 Smart #1 otomobil", await has("arac/otomobil", "smart", "1"));

  const formentorOto = await has("arac/otomobil", "cupra", "formentor");
  const formentorArazi = await has("arac/arazi-suv-pickup", "cupra", "formentor");
  record("23 Formentor only arazi", formentorArazi && !formentorOto, `arazi=${formentorArazi} oto=${formentorOto}`);
  record("24 MG HS arazi", await has("arac/arazi-suv-pickup", "mg", "hs"));
  record("25 MG ZS arazi", await has("arac/arazi-suv-pickup", "mg", "zs"));
  record("26 Vito minivan", await has("arac/minivan-panelvan", "mercedes-benz", "vito"));
  const dailyMinivan = await has("arac/minivan-panelvan", "iveco", "daily");
  const dailyTicari = await has("arac/ticari-araclar", "iveco", "daily");
  record("27 Daily dual-link minivan+ticari", dailyMinivan && dailyTicari, `m=${dailyMinivan} t=${dailyTicari}`);
  const crafterMinivan = await has("arac/minivan-panelvan", "volkswagen", "crafter");
  const crafterTicari = await has("arac/ticari-araclar", "volkswagen", "crafter");
  record("28 Crafter dual-link", crafterMinivan && crafterTicari, `m=${crafterMinivan} t=${crafterTicari}`);

  // Electric API
  const types = await api("/api/vasita/catalog?action=types&subtype=elektrikli-araclar");
  record("30 Electric types", types.status === 200 && (types.body.types || []).length >= 4, `n=${(types.body.types || []).length}`);

  const evOtoBrands = await api("/api/vasita/catalog?action=brands&subtype=elektrikli-otomobil");
  const evSuvBrands = await api("/api/vasita/catalog?action=brands&subtype=elektrikli-suv-pickup");
  const evVanBrands = await api("/api/vasita/catalog?action=brands&subtype=elektrikli-minivan-panelvan");
  record("31 EV otomobil brands > 0", (evOtoBrands.body.brands || []).length > 0, `n=${(evOtoBrands.body.brands || []).length}`);
  record("32 EV SUV brands > 0", (evSuvBrands.body.brands || []).length > 0, `n=${(evSuvBrands.body.brands || []).length}`);
  record("33 EV minivan brands > 0", (evVanBrands.body.brands || []).length > 0, `n=${(evVanBrands.body.brands || []).length}`);
  record("50 Electric brand count > 0", (evOtoBrands.body.brands || []).length + (evSuvBrands.body.brands || []).length > 0);

  async function hasEv(type: string, brand: string, model: string) {
    const r = await api(`/api/vasita/catalog?action=models&subtype=${type}&brand=${brand}`);
    return (r.body.models || []).some((m: { slug: string }) => m.slug === model);
  }
  record("35 BMW i3 EV otomobil", await hasEv("elektrikli-otomobil", "bmw", "i3"));
  record("36 BMW i4 EV otomobil", await hasEv("elektrikli-otomobil", "bmw", "i4"));
  record("39 BMW iX3 EV SUV", await hasEv("elektrikli-suv-pickup", "bmw", "ix3"));
  record("40 Tesla Model 3 EV otomobil", await hasEv("elektrikli-otomobil", "tesla", "model-3"));
  record("41 Tesla Model Y EV SUV", await hasEv("elektrikli-suv-pickup", "tesla", "model-y"));
  record("42 TOGG T10X EV SUV", await hasEv("elektrikli-suv-pickup", "togg", "t10x"));
  record("43 TOGG T10F EV otomobil", await hasEv("elektrikli-otomobil", "togg", "t10f"));
  record("44 Fiat 500e EV otomobil", await hasEv("elektrikli-otomobil", "fiat", "500e"));
  record("45 Mustang Mach-E EV SUV", await hasEv("elektrikli-suv-pickup", "ford", "mustang-mach-e"));
  record("46 ID. Buzz EV minivan", await hasEv("elektrikli-minivan-panelvan", "volkswagen", "id-buzz"));

  // ICE models should not appear in EV otomobil for BMW 3-serisi
  const bmwEvModels = await api("/api/vasita/catalog?action=models&subtype=elektrikli-otomobil&brand=bmw");
  const has3serisi = (bmwEvModels.body.models || []).some((m: { slug: string }) => m.slug === "3-serisi");
  record("47 No BMW 3 Serisi in EV otomobil", !has3serisi);

  const overlay = await prisma.systemSetting.findUnique({ where: { key: "vasita_electric_overlay" } });
  const entries = ((overlay?.value as { entries?: unknown[] }) || {}).entries || [];
  record("49 Overlay entries = 134", entries.length === 134, `n=${entries.length}`);
  record("51 EV series count > 0", entries.length > 0);
  const withVersions = entries.filter((e: { versions?: unknown[] }) => (e.versions || []).length > 0);
  record("52 EV variant count > 0", withVersions.length > 0, `withVersions=${withVersions.length}`);

  const std = await api("/api/vasita/catalog?action=brands&subtype=otomobil");
  record("54 Standard otomobil cascade", std.status === 200 && (std.body.brands || []).length > 0, `n=${(std.body.brands || []).length}`);
  const abushInOto = (std.body.brands || []).some((b: { slug: string }) => b.slug === "abush");
  record("60 API does not return hidden brands", !abushInOto);

  const packRaw = readFileSync(join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json"), "utf8");
  record("22 No PremiumLegacy", !packRaw.includes("PremiumLegacy"));

  const failed = results.filter((r) => r.status === "FAIL");
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "scripts/output/complete-vehicle-catalog-tests.json"),
    JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2)
  );
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
