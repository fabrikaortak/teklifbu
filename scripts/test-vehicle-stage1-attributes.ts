/**
 * Smoke tests for Vasıta Stage1 attribute templates
 * (Attribute + AttributeOption + CategoryAttribute, seeded by
 * scripts/vehicle-stage1-attributes-apply.ts).
 * npx tsx scripts/test-vehicle-stage1-attributes.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseVasitaMeta } from "@/lib/vasitaBrowseMeta";
import { FIELD_KEY_TO_LEGACY_ATTR, legacyAttrKeyFor } from "@/lib/vasitaFormAttributes";

const prisma = new PrismaClient();

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  // 1) Attributes exist and are global (one row per field_key across templates).
  const attrCount = await prisma.attribute.count({ where: { deletedAt: null } });
  assert(attrCount >= 34, `expected >=34 attributes, got ${attrCount}`);

  const fuelType = await prisma.attribute.findUnique({
    where: { slug: "fuelType" },
    include: { options: true },
  });
  assert(fuelType, "fuelType attribute exists");
  assert(fuelType!.type === "SINGLE_SELECT", "fuelType is SINGLE_SELECT");
  assert(fuelType!.options.length === 5, `fuelType options, got ${fuelType!.options.length}`);
  assert(fuelType!.options.some((o) => o.value === "Elektrik"), "fuelType has Elektrik option");

  const motorcycleClass = await prisma.attribute.findUnique({
    where: { slug: "motorcycleClass" },
    include: { options: true },
  });
  assert(motorcycleClass, "motorcycleClass attribute exists");
  assert(motorcycleClass!.options.length >= 20, `motorcycleClass options, got ${motorcycleClass!.options.length}`);
  assert(motorcycleClass!.options.some((o) => o.value === "SCOOTER"), "motorcycleClass has SCOOTER");

  // 2) CategoryAttribute linked on VEHICLE_TYPE categories per attributeTemplate.
  const otomobil = await prisma.category.findUnique({
    where: { slug: "arac__otomobil" },
    select: { id: true, description: true },
  });
  assert(otomobil, "arac__otomobil category exists");
  const otomobilMeta = parseVasitaMeta(otomobil!.description);
  assert(otomobilMeta?.attributeTemplate === "PASSENGER_CAR", `otomobil attributeTemplate, got ${otomobilMeta?.attributeTemplate}`);

  const otomobilAttrs = await prisma.categoryAttribute.findMany({
    where: { categoryId: otomobil!.id },
    include: { attribute: { select: { slug: true } } },
  });
  const otomobilKeys = otomobilAttrs.map((a) => a.attribute.slug);
  for (const key of ["modelYear", "mileage", "fuelType", "transmission", "bodyType", "driveType", "condition"]) {
    assert(otomobilKeys.includes(key), `arac__otomobil missing CategoryAttribute ${key}`);
  }
  const modelYearRow = otomobilAttrs.find((a) => a.attribute.slug === "modelYear")!;
  assert(modelYearRow.required === true, "modelYear required on PASSENGER_CAR");

  const scooter = await prisma.category.findUnique({
    where: { slug: "arac__motosiklet__scooter" },
    select: { id: true },
  });
  assert(scooter, "arac__motosiklet__scooter exists");
  const scooterAttrs = await prisma.categoryAttribute.findMany({
    where: { categoryId: scooter!.id },
    include: { attribute: { select: { slug: true } } },
  });
  assert(
    scooterAttrs.some((a) => a.attribute.slug === "motorcycleClass"),
    "scooter has motorcycleClass CategoryAttribute"
  );

  // 3) LIGHT_COMMERCIAL / BUS_MINIBUS / TRACTOR_UNIT / TRAILER templates got seeded.
  const cekici = await prisma.category.findUnique({
    where: { slug: "arac__ticari-araclar__cekici" },
    select: { id: true, description: true },
  });
  assert(cekici, "cekici category exists");
  const cekiciMeta = parseVasitaMeta(cekici!.description);
  assert(cekiciMeta?.attributeTemplate === "TRACTOR_UNIT", `cekici attributeTemplate, got ${cekiciMeta?.attributeTemplate}`);
  const cekiciAttrs = await prisma.categoryAttribute.findMany({
    where: { categoryId: cekici!.id },
    include: { attribute: { select: { slug: true } } },
  });
  assert(
    cekiciAttrs.some((a) => a.attribute.slug === "axleCount"),
    "cekici (TRACTOR_UNIT) has axleCount"
  );

  const dorse = await prisma.category.findUnique({
    where: { slug: "arac__ticari-araclar__dorse" },
    select: { id: true, description: true },
  });
  assert(dorse, "dorse category exists");
  const dorseMeta = parseVasitaMeta(dorse!.description);
  assert(dorseMeta?.attributeTemplate === "TRAILER", `dorse attributeTemplate, got ${dorseMeta?.attributeTemplate}`);

  // 4) legacy key adapter mapping sanity.
  assert(legacyAttrKeyFor("modelYear") === "year", "modelYear→year");
  assert(legacyAttrKeyFor("mileage") === "km", "mileage→km");
  assert(legacyAttrKeyFor("fuelType") === "fuel", "fuelType→fuel");
  assert(legacyAttrKeyFor("transmission") === "gear", "transmission→gear");
  assert(Object.keys(FIELD_KEY_TO_LEGACY_ATTR).length >= 30, "legacy map has >=30 entries");

  console.log(
    JSON.stringify(
      {
        ok: true,
        attrCount,
        fuelTypeOptions: fuelType!.options.length,
        motorcycleClassOptions: motorcycleClass!.options.length,
        otomobilCategoryAttributes: otomobilAttrs.length,
        scooterCategoryAttributes: scooterAttrs.length,
        cekiciTemplate: cekiciMeta?.attributeTemplate,
        dorseTemplate: dorseMeta?.attributeTemplate,
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
