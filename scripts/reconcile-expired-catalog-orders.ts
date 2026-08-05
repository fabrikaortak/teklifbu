/**
 * CLI: npx tsx scripts/reconcile-expired-catalog-orders.ts [--force] [--limit=50]
 */
import { reconcileExpiredCatalogOrders } from "../src/core/services/catalog/catalogOrderReconcileService";

async function main() {
  const force = process.argv.includes("--force");
  const limArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limArg ? Number(limArg.split("=")[1]) : 50;
  const report = await reconcileExpiredCatalogOrders({ limit, force });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
