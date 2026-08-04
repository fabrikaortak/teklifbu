import { PrismaClient } from "@prisma/client";

/** AccountType enum + veri migrate (client generate olmadan raw SQL) */
async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'BIREYSEL_TICARI';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'TICARI';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  } catch (e) {
    console.warn("enum add:", e);
  }

  // Kolon yoksa ekle
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commercialSubtypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "User" SET "accountType" = 'BIREYSEL_TICARI' WHERE "accountType"::text = 'BIREYSEL';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "accountType" = 'TICARI',
        "commercialSubtypes" = CASE
          WHEN cardinality("commercialSubtypes") = 0 THEN ARRAY['EMLAK_OFISI']::TEXT[]
          ELSE "commercialSubtypes"
        END
    WHERE "accountType"::text = 'EMLAKCI';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "accountType" = 'TICARI',
        "commercialSubtypes" = CASE
          WHEN cardinality("commercialSubtypes") = 0 THEN ARRAY['GALERI']::TEXT[]
          ELSE "commercialSubtypes"
        END
    WHERE "accountType"::text = 'GALERICI';
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Shop" SET "accountType" = 'TICARI' WHERE "accountType"::text IN ('EMLAKCI', 'GALERICI');
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Shop" SET "accountType" = 'BIREYSEL_TICARI' WHERE "accountType"::text = 'BIREYSEL';
  `);

  const counts = await prisma.$queryRawUnsafe<Array<{ accountType: string; c: bigint }>>(
    `SELECT "accountType"::text as "accountType", count(*)::bigint as c FROM "User" GROUP BY 1`
  );
  console.log("User account types:", counts);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
