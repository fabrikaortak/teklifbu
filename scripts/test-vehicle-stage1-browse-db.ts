/**
 * Smoke tests for Vasıta Stage1 browse tree from DB (vasitaBrowseFromDb.ts).
 * npx tsx scripts/test-vehicle-stage1-browse-db.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildVasitaBrowseFromDb, resolveVasitaBrowseTree } from "@/lib/vasitaBrowseFromDb";
import { readBrowseExtraAttrs } from "@/lib/vasitaBrowseFromTarget";

const prisma = new PrismaClient();

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null, OR: [{ path: "arac" }, { path: { startsWith: "arac/" } }] },
    select: {
      id: true,
      slug: true,
      name: true,
      path: true,
      parentId: true,
      sortOrder: true,
      description: true,
      isActive: true,
    },
  });

  const node = buildVasitaBrowseFromDb(rows);
  assert(node, "node built");
  assert(node!.id === "arac", "root id");
  assert((node!.children?.length || 0) === 15, `expected 15 mains, got ${node!.children?.length}`);

  const names = (node!.children || []).map((c) => c.name);
  assert(names.includes("Otomobil"), "Otomobil present");
  assert(names.includes("Elektrikli Araçlar"), "Elektrikli present");
  assert(names.includes("UTV"), "UTV present");
  assert(names.includes("Hava Araçları"), "Hava Araçları present");

  const oto = node!.children!.find((c) => c.name === "Otomobil")!;
  assert(oto.filter.subtype === "otomobil", `otomobil subtype, got ${oto.filter.subtype}`);
  assert(!oto.children?.length, "otomobil leaf (no children)");

  const moto = node!.children!.find((c) => c.name === "Motosiklet")!;
  assert((moto.children?.length || 0) >= 20, `moto classes, got ${moto.children?.length}`);
  const scooter = moto.children!.find((c) => c.name === "Scooter")!;
  assert(scooter.filter.subtype === "motosiklet", `scooter subtype, got ${scooter.filter.subtype}`);
  const scooterAttrs = readBrowseExtraAttrs(scooter.filter);
  assert(scooterAttrs.motorcycleClass === "SCOOTER", `scooter mapsToAttribute, got ${JSON.stringify(scooterAttrs)}`);

  const elektrikli = node!.children!.find((c) => c.name === "Elektrikli Araçlar")!;
  assert(elektrikli.filter.subtype === "elektrikli-araclar", `hub subtype=own slug, got ${elektrikli.filter.subtype}`);
  const elektrikliOtomobil = elektrikli.children!.find((c) => c.name === "Elektrikli Otomobil")!;
  assert(
    elektrikliOtomobil.filter.subtype === "otomobil",
    `hub child resolves catalogScope, got ${elektrikliOtomobil.filter.subtype}`
  );
  const eoAttrs = readBrowseExtraAttrs(elektrikliOtomobil.filter);
  assert(eoAttrs.fuelType === "ELECTRIC", `hub child fuelType attr, got ${JSON.stringify(eoAttrs)}`);

  const kiralik = node!.children!.find((c) => c.name === "Kiralık Araçlar")!;
  assert(kiralik.filter.dealType === "KIRALIK", "kiralik hub dealType");
  const kiralikOto = kiralik.children!.find((c) => c.name === "Kiralık Otomobil")!;
  assert(kiralikOto.filter.dealType === "KIRALIK", "kiralik child dealType");
  assert(kiralikOto.filter.subtype === "otomobil", `kiralik child subtype, got ${kiralikOto.filter.subtype}`);

  const { root: resolved, meta } = resolveVasitaBrowseTree(rows);
  assert(meta.source === "db", `resolve source should be db, got ${meta.source}`);
  assert((resolved.children?.length || 0) === 15, "resolved mains 15");

  const emptyResolve = resolveVasitaBrowseTree([]);
  assert(emptyResolve.meta.source === "fallback-json", "empty rows → fallback-json");
  assert((emptyResolve.root.children?.length || 0) === 15, "fallback mains 15");

  console.log(
    JSON.stringify(
      {
        ok: true,
        rowCount: rows.length,
        mains: node!.children!.length,
        motoLeaves: moto.children!.length,
        scooterAttrs,
        elektrikliOtomobilSubtype: elektrikliOtomobil.filter.subtype,
        kiralikOtoDealType: kiralikOto.filter.dealType,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
