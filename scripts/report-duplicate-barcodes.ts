/**
 * Barkod unique öncesi duplicate raporu (constraint eklemez).
 * npx tsx scripts/report-duplicate-barcodes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, barcode: { not: null } },
    select: { id: true, name: true, barcode: true },
  });
  const variants = await prisma.productVariant.findMany({
    where: { deletedAt: null, barcode: { not: null } },
    select: { id: true, title: true, barcode: true, productId: true },
  });

  const map = new Map<string, Array<{ type: string; id: string; label: string }>>();
  for (const p of products) {
    const b = String(p.barcode).trim();
    if (!b) continue;
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push({ type: "product", id: p.id, label: p.name });
  }
  for (const v of variants) {
    const b = String(v.barcode).trim();
    if (!b) continue;
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push({ type: "variant", id: v.id, label: v.title });
  }

  const dups = [...map.entries()].filter(([, rows]) => rows.length > 1);
  console.log(JSON.stringify({ duplicateBarcodeCount: dups.length, duplicates: dups }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
