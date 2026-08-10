/**
 * Vasıta display labels — no vehicleCatalog.ts.
 * Prefer API/DB names when available; otherwise humanize the slug.
 */
export function humanizeVasitaSlug(slug: string): string {
  const s = String(slug || "").trim();
  if (!s) return "";
  return s
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[a-z]$/i.test(part)) return part.toUpperCase();
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1);
    })
    .join(" ");
}

export function brandLabel(brandSlug: string, resolvedName?: string | null) {
  return (resolvedName && String(resolvedName).trim()) || humanizeVasitaSlug(brandSlug) || brandSlug;
}

export function modelLabel(modelSlug: string, resolvedName?: string | null) {
  return (resolvedName && String(resolvedName).trim()) || humanizeVasitaSlug(modelSlug) || modelSlug;
}

export function trimLabel(trimSlug: string, resolvedName?: string | null) {
  return (resolvedName && String(resolvedName).trim()) || humanizeVasitaSlug(trimSlug) || trimSlug;
}
