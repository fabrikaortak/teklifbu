import { getSetting } from "@/core/settings";

type CacheEntry = { at: number; payload: unknown };

const store = new Map<string, CacheEntry>();

/** Cache kapalıysa 0; açıksa 1–60 sn (ms). */
export async function getOffersFeedCacheTtlMs(): Promise<number> {
  const enabled = await getSetting<boolean>("offers_feed_cache_enabled", false);
  if (!enabled) return 0;
  const sec = Math.floor(Number(await getSetting<number>("offers_feed_cache_ttl_sec", 10)) || 10);
  return Math.max(1, Math.min(60, sec)) * 1000;
}

export async function getOffersFeedCached<T>(
  key: string,
  loader: () => Promise<T>
): Promise<{ data: T; fromCache: boolean; ttlMs: number }> {
  const ttlMs = await getOffersFeedCacheTtlMs();
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
  // Basit sınır: çok anahtar birikmesin
  if (store.size > 200) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 50);
    for (const [k] of oldest) store.delete(k);
  }
  return { data, fromCache: false, ttlMs };
}

/** Yeni teklif / onay / çekilme sonrası — canlı akış + ilgili ilan teklif listesi. */
export function invalidateOffersFeedCache(listingId?: string) {
  store.delete("live:default");
  for (const k of [...store.keys()]) {
    if (k.startsWith("live:")) store.delete(k);
  }
  if (listingId) {
    store.delete(`bids:${listingId}`);
  } else {
    for (const k of [...store.keys()]) {
      if (k.startsWith("bids:")) store.delete(k);
    }
  }
}
