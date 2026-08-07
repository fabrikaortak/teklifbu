/**
 * Runtime gate tests: version vs trim separation + BMW 5 Series deep catalog.
 * npx tsx scripts/vehicle/test-deep-version-trim-runtime.ts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  mergeVersionsForCascade,
  normalizeCatalogVersion,
  filterTrimsForVersion,
} from "../../src/lib/vasitaCatalogNormalize";

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
  // Unit: normalize
  const legacy = normalizeCatalogVersion("520i");
  record("Normalize legacy string version", !!legacy && legacy.name === "520i" && legacy.trims.length === 0);
  const nested = normalizeCatalogVersion({
    slug: "520i",
    name: "520i",
    trims: [{ name: "M Sport" }, { name: "Luxury Line" }],
  });
  record("Normalize nested trims", !!nested && nested.trims.length === 2 && nested.trims.every((t) => t.name !== "520i"));

  const merged = mergeVersionsForCascade([
    {
      generationCode: "G30",
      versions: [{ name: "520i", trims: [{ name: "M Sport", yearFrom: 2017, yearTo: 2023, generationCode: "G30" }] }],
      modelYears: [2017, 2018, 2019],
    },
    {
      generationCode: "G60",
      versions: [{ name: "520i", trims: [{ name: "M Sport", yearFrom: 2023, yearTo: 2026, generationCode: "G60" }] }],
      modelYears: [2024, 2025],
    },
  ]);
  record("Merge versions dedupe by name", merged.length === 1 && merged[0].name === "520i");
  record("Merge trims dedupe M Sport once in UI list", merged[0].trims.filter((t) => t.name === "M Sport").length === 1);

  const g30Only = mergeVersionsForCascade(
    [
      {
        generationCode: "G30",
        versions: [
          {
            name: "520i",
            trims: [
              { name: "Sport Line", yearFrom: 2017, yearTo: 2020, generationCode: "G30" },
              { name: "M Sport", yearFrom: 2017, yearTo: 2023, generationCode: "G30" },
            ],
          },
        ],
      },
      {
        generationCode: "G60",
        versions: [{ name: "520i", trims: [{ name: "Edition M Sport", yearFrom: 2023, yearTo: 2026, generationCode: "G60" }] }],
      },
    ],
    { generationCode: "G30" }
  );
  const g30Trims = filterTrimsForVersion(g30Only, "520i", { generationCode: "G30" }).map((t) => t.name);
  record("Generation filter excludes G60 Edition M Sport", g30Trims.includes("M Sport") && !g30Trims.includes("Edition M Sport"));

  // API
  const brands = await api("/api/vasita/catalog?action=brands&subtype=otomobil");
  record("1 BMW brand present", (brands.body.brands || []).some((b: { slug: string }) => b.slug === "bmw"));

  const models = await api("/api/vasita/catalog?action=models&subtype=otomobil&brand=bmw");
  record("2 5 Serisi series present", (models.body.models || []).some((m: { slug: string }) => m.slug === "5-serisi"));

  const gens = await api("/api/vasita/catalog?action=generations&subtype=otomobil&brand=bmw&model=5-serisi");
  const versions = gens.body.versions || [];
  const v520i = versions.find((v: { name: string; slug: string }) => v.name === "520i" || v.slug === "520i");
  const v520d = versions.find(
    (v: { name: string; slug: string }) => v.name === "520d" || v.slug === "520d" || v.name === "520d xDrive"
  );
  record("3 520i is VERSION", !!v520i, `names=${versions.map((v: { name: string }) => v.name).slice(0, 12).join(",")}`);
  record("4 520d family is VERSION", !!v520d);

  const versionNames = versions.map((v: { name: string }) => v.name);
  record("5 M Sport not in version list", !versionNames.includes("M Sport") && !versionNames.includes("Luxury Line"));

  const trims520i = v520i?.trims || [];
  const trimNames520i = trims520i.map((t: { name: string }) => t.name);
  record("6 520i has M Sport trim", trimNames520i.includes("M Sport"), `trims=${trimNames520i.join("|")}`);
  record(
    "7 520i has Luxury Line or Edition M Sport",
    trimNames520i.includes("Luxury Line") || trimNames520i.includes("Edition M Sport"),
    `n=${trimNames520i.length}`
  );

  const v520dExact = versions.find((v: { name: string }) => v.name === "520d");
  const v520dXd = versions.find((v: { name: string }) => v.name === "520d xDrive");
  const trims520dFamily = [
    ...((v520dExact?.trims || []) as Array<{ name: string }>),
    ...((v520dXd?.trims || []) as Array<{ name: string }>),
  ].map((t) => t.name);
  record("8 520d family has M Sport trim", trims520dFamily.includes("M Sport"), `trims=${[...new Set(trims520dFamily)].join("|")}`);

  const trimsApi = await api(
    `/api/vasita/catalog?action=trims&subtype=otomobil&brand=bmw&model=5-serisi&version=${encodeURIComponent(v520i?.slug || "520i")}`
  );
  record("9 action=trims returns packages", (trimsApi.body.trims || []).length > 0, `n=${(trimsApi.body.trims || []).length}`);

  const yearG60 = await api(
    "/api/vasita/catalog?action=generations&subtype=otomobil&brand=bmw&model=5-serisi&generation=G60&year=2025"
  );
  const g60_520i = (yearG60.body.versions || []).find((v: { name: string }) => v.name === "520i");
  const g60TrimNames = (g60_520i?.trims || []).map((t: { name: string }) => t.name);
  record(
    "10 G60/2025 520i trims exclude G30-only Sport Line",
    !g60TrimNames.includes("Sport Line"),
    `trims=${g60TrimNames.join("|")}`
  );

  // Listings preserved
  const listingCount = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  record("11 Listings preserved (13)", listingCount === 13, `count=${listingCount}`);

  // Electric still works
  const ev = await api("/api/vasita/catalog?action=brands&subtype=elektrikli-otomobil");
  record("12 Electric overlay brands > 0", (ev.body.brands || []).length > 0, `n=${(ev.body.brands || []).length}`);

  // BMW 3 Serisi still works (legacy versions without trims)
  const b3 = await api("/api/vasita/catalog?action=generations&subtype=otomobil&brand=bmw&model=3-serisi");
  record("13 BMW 3 Serisi versions still load", (b3.body.versions || []).length > 0, `n=${(b3.body.versions || []).length}`);

  const failed = results.filter((r) => r.status === "FAIL").length;
  const report = { passed: results.length - failed, failed, results };
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(join(process.cwd(), "scripts/output/deep-version-trim-runtime-test.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }, null, 2));
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
