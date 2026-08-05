/**
 * Katalog projection / mirror sync retry (Faz 1.5).
 * Hafif DB job tablosu — event bus / queue yok.
 */
import { CatalogProjectionJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { syncListingMirrorFromOffer } from "@/core/services/catalog/sellerOfferSyncService";
import { writeAuditLog } from "@/core/services/tenantService";

export const JOB_MIRROR_SYNC = "MIRROR_SYNC";

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function backoffMs(attempts: number): number {
  // Exponential: 30s, 60s, 120s, 240s, 480s (cap ~10m)
  const ms = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(ms, 10 * 60_000);
}

/** Test hook — post-commit sync zorunlu fail */
let __testForceMirrorSyncFail = false;
export function __setTestForceMirrorSyncFail(v: boolean) {
  __testForceMirrorSyncFail = v;
}

/** Flag ON checkout sonrası mirror sync; hata → audit + kalıcı job */
export async function runPostCommitMirrorSync(opts: {
  sellerOfferId: string;
  actorId?: string | null;
  orderId?: string | null;
}): Promise<{ synced: boolean; jobId?: string }> {
  try {
    if (__testForceMirrorSyncFail) {
      throw new Error("TEST_FORCE_MIRROR_SYNC_FAIL");
    }
    await syncListingMirrorFromOffer(prisma, opts.sellerOfferId);
    const offer = await prisma.sellerOffer.findUnique({
      where: { id: opts.sellerOfferId },
      select: { listingId: true },
    });
    // Mirror yoksa oluşturmayı job'a bırak (checkout'u etkilemez)
    if (!offer?.listingId) {
      const job = await enqueueMirrorSyncJob({
        sellerOfferId: opts.sellerOfferId,
        reason: "NO_LISTING_AFTER_SYNC",
        payload: { orderId: opts.orderId || null },
      });
      return { synced: false, jobId: job.id };
    }
    return { synced: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeAuditLog({
      actorId: opts.actorId || undefined,
      action: "catalog.mirror_sync.failed",
      entity: "SellerOffer",
      entityId: opts.sellerOfferId,
      meta: { error: msg, orderId: opts.orderId || null },
    });
    const job = await enqueueMirrorSyncJob({
      sellerOfferId: opts.sellerOfferId,
      reason: msg,
      payload: { orderId: opts.orderId || null },
    });
    return { synced: false, jobId: job.id };
  }
}

/**
 * Aynı offer için PENDING/PROCESSING job varken duplicate üretme.
 */
export async function enqueueMirrorSyncJob(opts: {
  sellerOfferId: string;
  listingId?: string | null;
  reason?: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}) {
  const existing = await prisma.catalogProjectionJob.findFirst({
    where: {
      sellerOfferId: opts.sellerOfferId,
      jobType: JOB_MIRROR_SYNC,
      status: { in: [CatalogProjectionJobStatus.PENDING, CatalogProjectionJobStatus.PROCESSING] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (opts.reason) {
      await prisma.catalogProjectionJob.update({
        where: { id: existing.id },
        data: {
          lastError: opts.reason.slice(0, 2000),
          payloadJson: opts.payload ? asJson(opts.payload) : undefined,
        },
      });
    }
    return existing;
  }

  return prisma.catalogProjectionJob.create({
    data: {
      jobType: JOB_MIRROR_SYNC,
      sellerOfferId: opts.sellerOfferId,
      listingId: opts.listingId || null,
      payloadJson: opts.payload ? asJson(opts.payload) : undefined,
      status: CatalogProjectionJobStatus.PENDING,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
      lastError: opts.reason?.slice(0, 2000) || null,
    },
  });
}

export async function processDueCatalogProjectionJobs(opts?: {
  limit?: number;
  forceJobId?: string;
}): Promise<{
  scanned: number;
  completed: number;
  failed: number;
  deferred: number;
  results: Array<{ id: string; ok: boolean; status: string; error?: string }>;
}> {
  const limit = Math.min(Math.max(Number(opts?.limit) || 20, 1), 100);
  const now = new Date();

  const jobs = opts?.forceJobId
    ? await prisma.catalogProjectionJob.findMany({
        where: { id: opts.forceJobId },
        take: 1,
      })
    : await prisma.catalogProjectionJob.findMany({
        where: {
          status: CatalogProjectionJobStatus.PENDING,
          nextAttemptAt: { lte: now },
        },
        orderBy: { nextAttemptAt: "asc" },
        take: limit,
      });

  const results: Array<{ id: string; ok: boolean; status: string; error?: string }> = [];
  let completed = 0;
  let failed = 0;
  let deferred = 0;

  for (const job of jobs) {
    const claimed = await prisma.catalogProjectionJob.updateMany({
      where: {
        id: job.id,
        status: {
          in: opts?.forceJobId
            ? [CatalogProjectionJobStatus.PENDING, CatalogProjectionJobStatus.FAILED, CatalogProjectionJobStatus.PROCESSING]
            : [CatalogProjectionJobStatus.PENDING],
        },
      },
      data: { status: CatalogProjectionJobStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      results.push({ id: job.id, ok: false, status: "SKIP_CLAIM" });
      continue;
    }

    const attempt = job.attempts + 1;
    try {
      if (job.jobType !== JOB_MIRROR_SYNC) {
        throw new Error(`UNKNOWN_JOB_TYPE:${job.jobType}`);
      }
      if (!job.sellerOfferId) throw new Error("MISSING_SELLER_OFFER_ID");

      if (__testForceMirrorSyncFail) {
        throw new Error("TEST_FORCE_MIRROR_SYNC_FAIL");
      }
      await syncListingMirrorFromOffer(prisma, job.sellerOfferId);

      // Hâlâ listing yoksa — bu fazda sync no-op; COMPLETED say (oluşturma opsiyonel)
      const offer = await prisma.sellerOffer.findUnique({
        where: { id: job.sellerOfferId },
        select: { listingId: true },
      });

      await prisma.catalogProjectionJob.update({
        where: { id: job.id },
        data: {
          status: CatalogProjectionJobStatus.COMPLETED,
          attempts: attempt,
          listingId: offer?.listingId || job.listingId,
          completedAt: new Date(),
          lastError: offer?.listingId ? null : "NO_LISTING_MIRROR (sync no-op)",
        },
      });
      completed += 1;
      results.push({ id: job.id, ok: true, status: "COMPLETED" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const max = job.maxAttempts || DEFAULT_MAX_ATTEMPTS;
      if (attempt >= max) {
        await prisma.catalogProjectionJob.update({
          where: { id: job.id },
          data: {
            status: CatalogProjectionJobStatus.FAILED,
            attempts: attempt,
            lastError: msg.slice(0, 2000),
            completedAt: new Date(),
          },
        });
        failed += 1;
        results.push({ id: job.id, ok: false, status: "FAILED", error: msg });
      } else {
        await prisma.catalogProjectionJob.update({
          where: { id: job.id },
          data: {
            status: CatalogProjectionJobStatus.PENDING,
            attempts: attempt,
            lastError: msg.slice(0, 2000),
            nextAttemptAt: new Date(Date.now() + backoffMs(attempt)),
          },
        });
        deferred += 1;
        results.push({ id: job.id, ok: false, status: "DEFERRED", error: msg });
      }
    }
  }

  return { scanned: jobs.length, completed, failed, deferred, results };
}

export async function retryCatalogProjectionJob(jobId: string) {
  await prisma.catalogProjectionJob.update({
    where: { id: jobId },
    data: {
      status: CatalogProjectionJobStatus.PENDING,
      nextAttemptAt: new Date(),
      completedAt: null,
    },
  });
  return processDueCatalogProjectionJobs({ forceJobId: jobId, limit: 1 });
}
