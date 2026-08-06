/**
 * Mirror src/data/vehicleExtras.ts VEHICLE_EXTRA_GROUPS into SystemSetting
 * key `vasita_stage1_extras`. Documentation-only mirror: VehicleExtrasPicker.tsx
 * keeps reading directly from the TS module (no behavior change); this pack
 * exists so other consumers (e.g. future API/admin tooling) can read extras
 * from the DB without re-deploying code. Idempotent (upsert). No Vehicle*
 * tables, no UI changes.
 *
 * npx tsx scripts/vehicle-stage1-extras-apply.ts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { VEHICLE_EXTRA_GROUPS } from "@/data/vehicleExtras";

const prisma = new PrismaClient();

async function main() {
  const value = {
    source: "mirror-vehicleExtras-ts",
    groups: VEHICLE_EXTRA_GROUPS,
    itemCount: VEHICLE_EXTRA_GROUPS.reduce((n, g) => n + g.items.length, 0),
    generatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: "vasita_stage1_extras" },
    create: { key: "vasita_stage1_extras", value, label: "Vasıta Stage1 — donanım/güvenlik ekstraları", group: "vasita" },
    update: { value, label: "Vasıta Stage1 — donanım/güvenlik ekstraları", group: "vasita" },
  });

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  const out = join(process.cwd(), "scripts/output/vehicle-stage1-extras-apply-report.json");
  const report = { ok: true, groups: VEHICLE_EXTRA_GROUPS.length, items: value.itemCount, out };
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
