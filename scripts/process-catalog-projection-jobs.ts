/**
 * CLI: npx tsx scripts/process-catalog-projection-jobs.ts [--limit=20] [--job=id] [--retry]
 */
import {
  processDueCatalogProjectionJobs,
  retryCatalogProjectionJob,
} from "../src/core/services/catalog/catalogProjectionJobService";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const jobArg = process.argv.find((a) => a.startsWith("--job="));
  const retry = process.argv.includes("--retry");
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 20;
  const jobId = jobArg ? jobArg.split("=")[1] : undefined;

  const report =
    jobId && retry
      ? await retryCatalogProjectionJob(jobId)
      : await processDueCatalogProjectionJobs({ limit, forceJobId: jobId });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
