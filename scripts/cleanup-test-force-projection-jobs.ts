/**
 * Staging: TEST_FORCE_MIRROR_SYNC_FAIL job'larını IGNORED_TEST_ARTIFACT olarak kapat.
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING npx tsx scripts/cleanup-test-force-projection-jobs.ts
 */
import "dotenv/config";
import { PrismaClient, CatalogProjectionJobStatus } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import { writeAuditLog } from "../src/core/services/tenantService";

const prisma = new PrismaClient();

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("DB", fp.maskedUrl, "prodLook=", fp.looksProduction);

  const failed = await prisma.catalogProjectionJob.findMany({
    where: { status: CatalogProjectionJobStatus.FAILED },
  });
  console.log(
    "FAILED_BEFORE",
    failed.map((j) => ({ id: j.id, err: j.lastError, attempts: j.attempts }))
  );

  const targets = failed.filter((j) => String(j.lastError || "") === "TEST_FORCE_MIRROR_SYNC_FAIL");
  if (targets.length === 0) {
    console.log("No TEST_FORCE targets; FAILED count=", failed.length);
  }
  if (failed.some((j) => String(j.lastError || "") !== "TEST_FORCE_MIRROR_SYNC_FAIL")) {
    throw new Error("Non-test FAILED jobs present — abort (manual review)");
  }

  for (const j of targets) {
    await prisma.catalogProjectionJob.update({
      where: { id: j.id },
      data: {
        status: CatalogProjectionJobStatus.COMPLETED,
        lastError: "IGNORED_TEST_ARTIFACT",
        completedAt: new Date(),
      },
    });
    await writeAuditLog({
      action: "catalog.projection_job.ignore_test_artifact",
      entity: "CatalogProjectionJob",
      entityId: j.id,
      meta: {
        sellerOfferId: j.sellerOfferId,
        previousError: j.lastError,
        previousAttempts: j.attempts,
        stagingOnly: true,
      },
    });
    console.log("CLOSED", j.id);
  }

  const left = await prisma.catalogProjectionJob.count({
    where: { status: CatalogProjectionJobStatus.FAILED },
  });
  console.log("FAILED_AFTER", left);
  if (left !== 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
