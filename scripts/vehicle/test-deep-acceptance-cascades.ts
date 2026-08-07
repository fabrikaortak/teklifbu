/**
 * Acceptance cascades for deep catalog (source-derived).
 * npx tsx scripts/vehicle/test-deep-acceptance-cascades.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  filterTrimsForVersion,
  mergeVersionsForCascade,
  type PackVersion,
} from "../../src/lib/vasitaCatalogNormalize";

const prisma = new PrismaClient();

type Case = {
  name: string;
  brandSlug: string;
  seriesSlug: string;
  versionContains?: string | RegExp;
  trimContains?: string | RegExp;
  categoryPath?: string;
};

const CASES: Case[] = [
  { name: "BMW 5→520i→M Sport", brandSlug: "bmw", seriesSlug: "5-serisi", versionContains: "520i", trimContains: /m sport/i },
  { name: "BMW 5→520d→paket", brandSlug: "bmw", seriesSlug: "5-serisi", versionContains: /520d/i, trimContains: /m sport|luxury/i },
  { name: "BMW 3→320i→paket", brandSlug: "bmw", seriesSlug: "3-serisi", versionContains: "320i", trimContains: /m sport|sport line|luxury/i },
  { name: "BMW X3→20d→paket", brandSlug: "bmw", seriesSlug: "x3", versionContains: /20d|xdrive20d/i, trimContains: /m sport|xline|luxury|x-line/i, categoryPath: "arac/arazi-suv-pickup" },
  { name: "MB C→C 200 d→paket", brandSlug: "mercedes-benz", seriesSlug: "c-serisi", versionContains: /c 200 d/i, trimContains: /amg|exclusive|comfort/i },
  { name: "MB E→E 200|E 180→paket", brandSlug: "mercedes-benz", seriesSlug: "e-serisi", versionContains: /e 200|e 180/i, trimContains: /amg|exclusive|avantgarde/i },
  { name: "Audi A4→version→S line", brandSlug: "audi", seriesSlug: "a4", versionContains: /40 tdi|45 tfsi/i, trimContains: /s line/i },
  { name: "VW Golf→1.5 eTSI→R-Line", brandSlug: "volkswagen", seriesSlug: "golf", versionContains: /1\.5 eTSI/i, trimContains: /r-line/i },
  { name: "Renault Clio→1.0 TCe→Icon", brandSlug: "renault", seriesSlug: "clio", versionContains: /1\.0 TCe/i, trimContains: /icon/i },
  { name: "Fiat Egea→version→paket", brandSlug: "fiat", seriesSlug: "egea", versionContains: /1\.6/i, trimContains: /easy|urban|lounge/i },
  { name: "Toyota Corolla→1.8 Hybrid→Dream", brandSlug: "toyota", seriesSlug: "corolla", versionContains: /1\.8 Hybrid/i, trimContains: /dream/i },
  { name: "Peugeot 3008→version→Allure|GT", brandSlug: "peugeot", seriesSlug: "3008", versionContains: /hybrid|bluehdi|puretech/i, trimContains: /allure|gt|active/i },
];

function match(val: string, pat?: string | RegExp) {
  if (!pat) return true;
  if (typeof pat === "string") return val.toLocaleLowerCase("tr-TR").includes(pat.toLocaleLowerCase("tr-TR"));
  return pat.test(val);
}

async function main() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "vasita_stage1_catalog" } });
  const pack = setting?.value as any;
  const entries = pack?.entries || [];
  let passed = 0;
  let failed = 0;
  const lines: string[] = [];

  for (const c of CASES) {
    const hits = entries.filter(
      (e: any) =>
        e.brandSlug === c.brandSlug &&
        e.modelSlug === c.seriesSlug &&
        (!c.categoryPath || (e.categoryPaths || []).includes(c.categoryPath))
    );
    const versions = mergeVersionsForCascade(hits);
    // Prefer a version that both matches version pattern AND has a matching trim
    let version = versions.find(
      (v) => match(v.name, c.versionContains) && (v.trims || []).some((t: any) => match(t.name, c.trimContains))
    );
    if (!version) version = versions.find((v) => match(v.name, c.versionContains));
    const trims = version ? filterTrimsForVersion(versions, version.name) : [];
    const trim = trims.find((t) => match(t.name, c.trimContains));
    const ok = Boolean(version && trim);
    if (ok) {
      passed++;
      lines.push(`[PASS] ${c.name} — ${version!.name} → ${trim!.name}`);
    } else {
      failed++;
      lines.push(
        `[FAIL] ${c.name} — versions=${versions.map((v) => v.name).join("|") || "NONE"} trims=${trims.map((t) => t.name).join("|") || "NONE"}`
      );
    }
  }

  const listingCount = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  const listingOk = listingCount === 13;
  if (listingOk) {
    passed++;
    lines.push(`[PASS] listings=13`);
  } else {
    failed++;
    lines.push(`[FAIL] listings=${listingCount}`);
  }

  console.log(lines.join("\n"));
  console.log(JSON.stringify({ passed, failed, listingCount }, null, 2));
  if (failed) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
