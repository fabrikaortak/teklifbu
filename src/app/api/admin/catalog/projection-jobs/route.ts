import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  processDueCatalogProjectionJobs,
  retryCatalogProjectionJob,
} from "@/core/services/catalog/catalogProjectionJobService";

/** POST /api/admin/catalog/projection-jobs — due job işle veya tek job retry */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.jobId && body.retry) {
    const report = await retryCatalogProjectionJob(String(body.jobId));
    return NextResponse.json({ ok: true, report });
  }
  const report = await processDueCatalogProjectionJobs({
    limit: Number(body.limit) || 20,
    forceJobId: body.jobId ? String(body.jobId) : undefined,
  });
  return NextResponse.json({ ok: true, report });
}
