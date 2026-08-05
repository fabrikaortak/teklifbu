import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(process.cwd(), "backups");
fs.mkdirSync(dir, { recursive: true });

const prisma = new PrismaClient();

async function dumpTable(name, finder) {
  const rows = await finder();
  return { table: name, count: rows.length, rows };
}

async function main() {
  const meta = await prisma.$queryRawUnsafe(
    `select current_database() as db, current_user as u, now() as at`
  );

  const payload = {
    meta,
    createdAt: new Date().toISOString(),
    note: "pre-catalog-phase0 checkpoint JSON dump (pg_dump unavailable)",
    tables: {},
  };

  const dumps = [
    ["Category", () => prisma.category.findMany()],
    ["Listing", () =>
      prisma.listing.findMany({
        select: {
          id: true,
          listingNo: true,
          tenantId: true,
          shopId: true,
          sellerId: true,
          categoryId: true,
          title: true,
          status: true,
          askPrice: true,
          attributes: true,
          city: true,
          district: true,
          coverImage: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          escrowEligible: true,
        },
      }),
    ],
    ["Shop", () => prisma.shop.findMany()],
    ["User", () =>
      prisma.user.findMany({
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          accountType: true,
          role: true,
          isActive: true,
          tenantId: true,
          createdAt: true,
        },
      }),
    ],
    ["SystemSetting", () => prisma.systemSetting.findMany()],
    ["ShopPackage", () => prisma.shopPackage.findMany()],
    ["ShopSubscription", () => prisma.shopSubscription.findMany()],
    ["EscrowDeal", () => prisma.escrowDeal.findMany()],
    ["ContentPage", () => prisma.contentPage.findMany()],
  ];

  for (const [name, finder] of dumps) {
    try {
      payload.tables[name] = await dumpTable(name, finder);
      console.log(`ok ${name} ${payload.tables[name].count}`);
    } catch (e) {
      console.error(`fail ${name}`, e.message);
      payload.tables[name] = { table: name, error: String(e.message) };
    }
  }

  // BigInt-safe JSON
  const out = path.join(dir, `teklifbu-db-pre-catalog-${stamp}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(payload, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
    "utf8"
  );

  fs.copyFileSync(
    path.join(process.cwd(), "prisma", "schema.prisma"),
    path.join(dir, `schema-pre-catalog-${stamp}.prisma`)
  );

  console.log("WROTE", out);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
