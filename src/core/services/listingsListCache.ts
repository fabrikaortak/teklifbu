import { getSetting } from "@/core/settings";

type CacheEntry = { at: number; payload: unknown };

const store = new Map<string, CacheEntry>();

export async function getListingsListCacheTtlMs(): Promise<number> {
  const enabled = await getSetting<boolean>("listings_list_cache_enabled", false);
  if (!enabled) return 0;
  const sec = Math.floor(Number(await getSetting<number>("listings_list_cache_ttl_sec", 30)) || 30);
  return Math.max(5, Math.min(120, sec)) * 1000;
}

export function buildListingsListCacheKey(searchParams: URLSearchParams): string {
  const entries = [...searchParams.entries()]
    .filter(([k]) => k !== "live" && k !== "id")
    .sort(([a], [b]) => a.localeCompare(b));
  return `list:${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export async function getListingsListCached<T>(
  key: string,
  loader: () => Promise<T>
): Promise<{ data: T; fromCache: boolean; ttlMs: number }> {
  const ttlMs = await getListingsListCacheTtlMs();
  if (ttlMs <= 0) {
    return { data: await loader(), fromCache: false, ttlMs: 0 };
  }
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) {
    return { data: hit.payload as T, fromCache: true, ttlMs };
  }
  const data = await loader();
  store.set(key, { at: now, payload: data });
  if (store.size > 150) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 40);
    for (const [k] of oldest) store.delete(k);
  }
  return { data, fromCache: false, ttlMs };
}

/** Cache hit için loader’sız okuma */
export async function peekListingsListCache<T>(
  key: string
): Promise<{ data: T; ttlMs: number } | null> {
  const ttlMs = await getListingsListCacheTtlMs();
  if (ttlMs <= 0) return null;
  const hit = store.get(key);
  if (!hit || Date.now() - hit.at >= ttlMs) return null;
  return { data: hit.payload as T, ttlMs };
}

export function putListingsListCache(key: string, payload: unknown) {
  store.set(key, { at: Date.now(), payload });
}

export function invalidateListingsListCache() {
  store.clear();
}
