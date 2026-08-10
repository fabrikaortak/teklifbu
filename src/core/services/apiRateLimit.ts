import { getSetting } from "@/core/settings";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export async function getApiRateLimitConfig(): Promise<{
  enabled: boolean;
  windowMs: number;
  max: number;
}> {
  const enabled = await getSetting<boolean>("api_rate_limit_enabled", false);
  if (!enabled) return { enabled: false, windowMs: 60_000, max: 40 };
  const windowSec = Math.floor(Number(await getSetting<number>("api_rate_limit_window_sec", 60)) || 60);
  const max = Math.floor(Number(await getSetting<number>("api_rate_limit_max", 40)) || 40);
  return {
    enabled: true,
    windowMs: Math.max(10, Math.min(600, windowSec)) * 1000,
    max: Math.max(5, Math.min(300, max)),
  };
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Rate limit kapalıysa her zaman ok.
 * Açıksa pencere içinde max aşılırsa retryAfterSec döner.
 */
export async function checkApiRateLimit(input: {
  bucket: string;
  ip?: string;
  userId?: string | null;
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const cfg = await getApiRateLimitConfig();
  if (!cfg.enabled) return { ok: true };

  const id = input.userId || input.ip || "anon";
  const key = `${input.bucket}:${id}`;
  const now = Date.now();
  const cut = now - cfg.windowMs;
  let b = buckets.get(key);
  if (!b) {
    b = { timestamps: [] };
    buckets.set(key, b);
  }
  b.timestamps = b.timestamps.filter((t) => t > cut);
  if (b.timestamps.length >= cfg.max) {
    const oldest = b.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + cfg.windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  b.timestamps.push(now);

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      v.timestamps = v.timestamps.filter((t) => t > cut);
      if (!v.timestamps.length) buckets.delete(k);
    }
  }
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number) {
  return {
    body: {
      error: "Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.",
      code: "RATE_LIMITED",
      retryAfterSec,
    },
    init: {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  };
}
