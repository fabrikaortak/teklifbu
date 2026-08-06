/**
 * Seed Attribute + AttributeOption + CategoryAttribute for Vasıta Stage1
 * from docs/vertical-taxonomy/vehicle-attribute-templates.csv, attached to
 * every Category whose VASITA_META.attributeTemplate matches template_key.
 *
 * Attribute.slug is global (field_key), so an attribute used by several
 * templates (e.g. modelYear/mileage/fuelType) is created ONCE and re-linked
 * via CategoryAttribute per category with that row's required/filterable/etc.
 *
 * No Vehicle* tables. Idempotent (upsert). No emlak categories touched
 * (only categories under path "arac"/"arac/...").
 *
 * npx tsx scripts/vehicle-stage1-attributes-apply.ts
 * DRY_RUN=1 npx tsx scripts/vehicle-stage1-attributes-apply.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient, AttributeType } from "@prisma/client";
import { parseVasitaMeta } from "@/lib/vasitaBrowseMeta";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

type CsvRow = {
  template_key: string;
  field_key: string;
  label_tr: string;
  data_type: keyof typeof AttributeType;
  required: boolean;
  filterable: boolean;
  form_visible: boolean;
  detail_visible: boolean;
  unit: string;
  legacy_attributes_key: string;
  option_source: string;
  sort_order: number;
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    rows.push({
      template_key: cols[idx("template_key")],
      field_key: cols[idx("field_key")],
      label_tr: cols[idx("label_tr")],
      data_type: cols[idx("data_type")] as CsvRow["data_type"],
      required: cols[idx("required")] === "true",
      filterable: cols[idx("filterable")] === "true",
      form_visible: cols[idx("form_visible")] === "true",
      detail_visible: cols[idx("detail_visible")] === "true",
      unit: cols[idx("unit")] || "",
      legacy_attributes_key: cols[idx("legacy_attributes_key")] || "",
      option_source: cols[idx("option_source")] || "none",
      sort_order: Number(cols[idx("sort_order")] || 0),
    });
  }
  return rows;
}

/**
 * Static option value sets. Where the field feeds a browse-hub mapsToAttribute
 * (bodySubtype/motorcycleClass/usageClass) we reuse the SAME codes as
 * vehicle-stage1-target-tree.json so a listing's attrs stay filter-compatible
 * with the browse tree. Standard fields (fuel/gear/bodyType/drive/condition/
 * yes-no) reuse the exact TR label strings already used across the codebase
 * (src/data/vehicleFormFields.ts) for legacy compatibility.
 */
const OPTION_SOURCES: Record<string, Array<{ value: string; label: string }>> = {
  FUEL_TYPES: ["Benzin", "Dizel", "LPG", "Hibrit", "Elektrik"].map((v) => ({ value: v, label: v })),
  TRANSMISSIONS: ["Manuel", "Otomatik", "Yarı Otomatik"].map((v) => ({ value: v, label: v })),
  BODY_TYPES_CAR: [
    "Sedan",
    "Hatchback",
    "Station Wagon",
    "SUV",
    "Crossover",
    "Coupe",
    "Cabrio",
    "MPV",
    "Pickup",
    "Panel Van",
    "Minivan",
    "Roadster",
  ].map((v) => ({ value: v, label: v })),
  DRIVE_TYPES: ["4x2 (Önden Çekişli)", "4x2 (Arkadan Çekişli)", "4x4", "AWD"].map((v) => ({ value: v, label: v })),
  VEHICLE_STATUS: ["Sıfır", "İkinci El"].map((v) => ({ value: v, label: v })),
  YES_NO: ["Evet", "Hayır"].map((v) => ({ value: v, label: v })),
  PLATE_STATUS: [
    { value: "TR", label: "Türkiye (TR) Plakalı" },
    { value: "FOREIGN", label: "Yabancı Plakalı" },
    { value: "UNREGISTERED", label: "Plakasız / Tescilsiz" },
  ],
  CABIN_TYPES: [
    { value: "DAY", label: "Gündüz Kabin" },
    { value: "SLEEPER", label: "Yataklı Kabin" },
    { value: "DOUBLE", label: "Çift Kabin" },
    { value: "CREW", label: "Mürettebat Kabin" },
  ],
  SUV_PICKUP_SUBTYPES: [
    { value: "SUV", label: "SUV" },
    { value: "CROSSOVER", label: "Crossover" },
    { value: "OFF_ROAD", label: "Arazi Aracı" },
    { value: "PICKUP", label: "Pickup" },
  ],
  MOTO_CLASSES: [
    { value: "SCOOTER", label: "Scooter" },
    { value: "MAXI_SCOOTER", label: "Maxi Scooter" },
    { value: "CUB", label: "Cub" },
    { value: "COMMUTER", label: "Commuter" },
    { value: "NAKED", label: "Naked" },
    { value: "TOURING", label: "Touring" },
    { value: "SPORT_TOURING", label: "Sport Touring" },
    { value: "SUPERSPORT", label: "SuperSport" },
    { value: "CRUISER", label: "Cruiser" },
    { value: "CHOPPER", label: "Chopper" },
    { value: "ENDURO", label: "Enduro" },
    { value: "ADVENTURE", label: "Adventure" },
    { value: "CROSS", label: "Cross" },
    { value: "MOTOCROSS", label: "Motocross" },
    { value: "TRIAL", label: "Trial" },
    { value: "SUPERMOTO", label: "Supermoto" },
    { value: "CAFE_RACER", label: "Cafe Racer" },
    { value: "CUSTOM", label: "Custom" },
    { value: "ELECTRIC", label: "Elektrikli Motosiklet" },
    { value: "MOPED", label: "Moped" },
    { value: "THREE_WHEEL", label: "Üç Tekerlekli Motosiklet" },
  ],
  COOLING_TYPES: [
    { value: "AIR", label: "Hava Soğutmalı" },
    { value: "LIQUID", label: "Sıvı Soğutmalı" },
  ],
  VAN_USAGE: [
    { value: "MINIVAN", label: "Minivan" },
    { value: "PANELVAN", label: "Panelvan" },
    { value: "GLAZED_VAN", label: "Camlı Van" },
    { value: "KOMBI", label: "Kombi" },
    { value: "PASSENGER", label: "Yolcu Taşıma" },
    { value: "REFRIGERATED", label: "Frigofirik" },
    { value: "CLOSED_BOX", label: "Kapalı Kasa" },
    { value: "VIP", label: "VIP" },
    { value: "DISABLED_TRANSPORT", label: "Engelli Taşıma" },
  ],
  CHARGING_TYPES: [
    { value: "AC_TYPE2", label: "AC (Type 2)" },
    { value: "DC_CCS", label: "DC (CCS)" },
  ],
  FLOOR_TYPES: [
    { value: "FLAT", label: "Düz" },
    { value: "STEP", label: "Step" },
  ],
};

async function main() {
  const csvPath = join(process.cwd(), "docs/vertical-taxonomy/vehicle-attribute-templates.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));

  const report: {
    dryRun: boolean;
    attributesCreated: string[];
    attributesUpdated: string[];
    optionsCreated: string[];
    categoryAttributesLinked: number;
    categoriesTouched: string[];
    templatesSeen: string[];
    skippedCategoriesNoTemplate: number;
    errors: string[];
  } = {
    dryRun: DRY,
    attributesCreated: [],
    attributesUpdated: [],
    optionsCreated: [],
    categoryAttributesLinked: 0,
    categoriesTouched: [],
    templatesSeen: [...new Set(rows.map((r) => r.template_key))],
    skippedCategoriesNoTemplate: 0,
    errors: [],
  };

  // 1) Global Attribute registry — one row per field_key (first row wins name/type).
  const byFieldKey = new Map<string, CsvRow>();
  for (const r of rows) {
    if (!byFieldKey.has(r.field_key)) byFieldKey.set(r.field_key, r);
  }

  const attributeIdByFieldKey = new Map<string, string>();

  for (const [fieldKey, r] of byFieldKey) {
    if (DRY) {
      const existing = await prisma.attribute.findUnique({ where: { slug: fieldKey } });
      if (existing) {
        report.attributesUpdated.push(fieldKey);
        attributeIdByFieldKey.set(fieldKey, existing.id);
      } else {
        report.attributesCreated.push(fieldKey);
      }
      continue;
    }
    const existing = await prisma.attribute.findUnique({ where: { slug: fieldKey } });
    if (existing) {
      if (existing.managedBySeed === false) {
        attributeIdByFieldKey.set(fieldKey, existing.id);
        continue;
      }
      const updated = await prisma.attribute.update({
        where: { slug: fieldKey },
        data: { name: r.label_tr, type: r.data_type as AttributeType, isActive: true, managedBySeed: true },
      });
      attributeIdByFieldKey.set(fieldKey, updated.id);
      report.attributesUpdated.push(fieldKey);
    } else {
      const created = await prisma.attribute.create({
        data: {
          name: r.label_tr,
          slug: fieldKey,
          type: r.data_type as AttributeType,
          isActive: true,
          managedBySeed: true,
        },
      });
      attributeIdByFieldKey.set(fieldKey, created.id);
      report.attributesCreated.push(fieldKey);
    }

    // AttributeOption for SINGLE_SELECT/MULTI_SELECT fields with a known option_source.
    const options = OPTION_SOURCES[r.option_source];
    const attrId = attributeIdByFieldKey.get(fieldKey);
    if (options && attrId) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const existsOpt = await prisma.attributeOption.findUnique({
          where: { attributeId_value: { attributeId: attrId, value: opt.value } },
        });
        if (!existsOpt) {
          await prisma.attributeOption.create({
            data: { attributeId: attrId, label: opt.label, value: opt.value, sortOrder: i },
          });
          report.optionsCreated.push(`${fieldKey}:${opt.value}`);
        }
      }
    }
  }

  if (DRY) {
    mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
    const out = join(process.cwd(), "scripts/output/vehicle-stage1-attributes-dry-run-report.json");
    writeFileSync(out, JSON.stringify({ ...report, at: new Date().toISOString() }, null, 2));
    console.log(JSON.stringify({ ok: true, out, ...report }, null, 2));
    await prisma.$disconnect();
    return;
  }

  // 2) Attach CategoryAttribute for every arac* category whose VASITA_META.attributeTemplate
  //    matches a template_key present in the CSV.
  const rowsByTemplate = new Map<string, CsvRow[]>();
  for (const r of rows) {
    if (!rowsByTemplate.has(r.template_key)) rowsByTemplate.set(r.template_key, []);
    rowsByTemplate.get(r.template_key)!.push(r);
  }

  const categories = await prisma.category.findMany({
    where: { OR: [{ path: "arac" }, { path: { startsWith: "arac/" } }] },
    select: { id: true, slug: true, path: true, description: true },
  });

  for (const cat of categories) {
    const meta = parseVasitaMeta(cat.description);
    const templateKey = meta?.attributeTemplate;
    if (!templateKey || !rowsByTemplate.has(templateKey)) {
      report.skippedCategoriesNoTemplate++;
      continue;
    }
    const templateRows = rowsByTemplate.get(templateKey)!;
    let linkedAny = false;
    for (const r of templateRows) {
      const attrId = attributeIdByFieldKey.get(r.field_key);
      if (!attrId) continue;
      try {
        await prisma.categoryAttribute.upsert({
          where: { categoryId_attributeId: { categoryId: cat.id, attributeId: attrId } },
          create: {
            categoryId: cat.id,
            attributeId: attrId,
            required: r.required,
            filterable: r.filterable,
            formVisible: r.form_visible,
            detailVisible: r.detail_visible,
            unit: r.unit || null,
            sortOrder: r.sort_order,
          },
          update: {
            required: r.required,
            filterable: r.filterable,
            formVisible: r.form_visible,
            detailVisible: r.detail_visible,
            unit: r.unit || null,
            sortOrder: r.sort_order,
          },
        });
        report.categoryAttributesLinked++;
        linkedAny = true;
      } catch (e) {
        report.errors.push(`${cat.slug}/${r.field_key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (linkedAny) report.categoriesTouched.push(cat.slug);
  }

  // 3) Also attach ELECTRIC_OVERLAY / DAMAGE_OVERLAY / CLASSIC_OVERLAY / DISABLED_PLATE_OVERLAY
  //    fields onto their MARKET_SEGMENT hub categories in addition to base VEHICLE_TYPE templates
  //    (these hubs already carry attributeTemplate=<OVERLAY> directly from the target tree, so the
  //    loop above covers them too — no extra pass needed).

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  const out = join(process.cwd(), "scripts/output/vehicle-stage1-attributes-apply-report.json");
  writeFileSync(out, JSON.stringify({ ...report, at: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ ok: report.errors.length === 0, out, ...report }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
