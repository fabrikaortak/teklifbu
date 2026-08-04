import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/core/defaultSettings";

type Cache = { at: number; map: Record<string, unknown> };
let cache: Cache | null = null;

export async function getSettingsMap(force = false): Promise<Record<string, unknown>> {
  if (!force && cache && Date.now() - cache.at < 5000) return cache.map;
  const rows = await prisma.systemSetting.findMany();
  const map: Record<string, unknown> = {};
  for (const [k, meta] of Object.entries(DEFAULT_SETTINGS)) {
    map[k] = meta.value;
  }
  for (const row of rows) {
    map[row.key] = row.value;
  }
  cache = { at: Date.now(), map };
  return map;
}

export async function getSetting<T>(key: string, fallback?: T): Promise<T> {
  const map = await getSettingsMap();
  if (key in map) return map[key] as T;
  return fallback as T;
}

export async function setSetting(key: string, value: unknown, label?: string, group?: string) {
  const meta = DEFAULT_SETTINGS[key];
  await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: value as object,
      label: label || meta?.label || key,
      group: group || meta?.group || "general",
    },
    update: { value: value as object, ...(label ? { label } : {}), ...(group ? { group } : {}) },
  });
  cache = null;
}

export function invalidateSettingsCache() {
  cache = null;
}
