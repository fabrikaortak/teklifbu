/**
 * Normalize Vasıta pack version leaves for Brand → Series → Version → Trim cascade.
 * Backward compatible with legacy string / {slug,name} versions (no nested trims).
 */

export type CatalogTrim = {
  slug: string;
  name: string;
  generationCode?: string;
  yearFrom?: number;
  yearTo?: number;
};

export type CatalogVersion = {
  slug: string;
  name: string;
  trims: CatalogTrim[];
  generationCode?: string;
  yearFrom?: number;
  yearTo?: number;
  fuelTypes?: string[];
};

const TR: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

export function slugifyVasita(s: string): string {
  return (
    String(s || "")
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR[c] || c)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "diger"
  );
}

function asTrim(raw: unknown, fallbackGen?: string): CatalogTrim | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return { slug: slugifyVasita(name), name };
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const name = String(o.name || o.label || o.slug || "").trim();
    if (!name) return null;
    const slug = String(o.slug || "").trim() || slugifyVasita(name);
    const trim: CatalogTrim = { slug, name };
    const gc = String(o.generationCode || fallbackGen || "").trim();
    if (gc) trim.generationCode = gc;
    if (o.yearFrom != null && Number.isFinite(Number(o.yearFrom))) trim.yearFrom = Number(o.yearFrom);
    if (o.yearTo != null && Number.isFinite(Number(o.yearTo))) trim.yearTo = Number(o.yearTo);
    return trim;
  }
  return null;
}

/** Accept string | {slug,name,trims?} | unknown → CatalogVersion */
export function normalizeCatalogVersion(
  raw: unknown,
  entryMeta?: { generationCode?: string; modelYears?: number[] }
): CatalogVersion | null {
  const gen = (entryMeta?.generationCode || "").trim() || undefined;
  const years = entryMeta?.modelYears || [];
  const yearFrom = years.length ? Math.min(...years) : undefined;
  const yearTo = years.length ? Math.max(...years) : undefined;

  if (raw == null) return null;
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return {
      slug: slugifyVasita(name),
      name,
      trims: [],
      ...(gen ? { generationCode: gen } : {}),
      ...(yearFrom != null ? { yearFrom } : {}),
      ...(yearTo != null ? { yearTo } : {}),
    };
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name || o.label || o.slug || "").trim();
  if (!name) return null;
  const slug = String(o.slug || "").trim() || slugifyVasita(name);
  const trimsRaw = Array.isArray(o.trims) ? o.trims : [];
  const trims: CatalogTrim[] = [];
  for (const t of trimsRaw) {
    const nt = asTrim(t, gen);
    if (nt && !trims.find((x) => x.slug === nt.slug && (x.generationCode || "") === (nt.generationCode || ""))) {
      trims.push(nt);
    }
  }
  const v: CatalogVersion = { slug, name, trims };
  const vGen = String(o.generationCode || gen || "").trim();
  if (vGen) v.generationCode = vGen;
  if (o.yearFrom != null && Number.isFinite(Number(o.yearFrom))) v.yearFrom = Number(o.yearFrom);
  else if (yearFrom != null) v.yearFrom = yearFrom;
  if (o.yearTo != null && Number.isFinite(Number(o.yearTo))) v.yearTo = Number(o.yearTo);
  else if (yearTo != null) v.yearTo = yearTo;
  if (Array.isArray(o.fuelTypes)) v.fuelTypes = o.fuelTypes.map(String);
  return v;
}

export function normalizeCatalogVersions(
  versions: unknown[] | undefined,
  entryMeta?: { generationCode?: string; modelYears?: number[] }
): CatalogVersion[] {
  const out: CatalogVersion[] = [];
  for (const raw of versions || []) {
    const n = normalizeCatalogVersion(raw, entryMeta);
    if (!n) continue;
    const prev = out.find((x) => x.slug === n.slug || x.name.toLowerCase() === n.name.toLowerCase());
    if (!prev) {
      out.push(n);
      continue;
    }
    for (const t of n.trims) {
      if (!prev.trims.find((x) => x.slug === t.slug && (x.generationCode || "") === (t.generationCode || ""))) {
        prev.trims.push(t);
      }
    }
  }
  return out;
}

function yearOverlaps(
  from: number | undefined,
  to: number | undefined,
  year: number | null
): boolean {
  if (year == null || !Number.isFinite(year)) return true;
  if (from != null && year < from) return false;
  if (to != null && year > to) return false;
  return true;
}

/**
 * Merge versions across pack entries (e.g. G30+G60), dedupe by display name,
 * filter trims by optional generation/year. UI gets one "520i" with filtered trims.
 */
export function mergeVersionsForCascade(
  entries: Array<{
    generationCode?: string;
    generationLabel?: string;
    versions?: unknown[];
    modelYears?: number[];
  }>,
  opts?: { generationCode?: string; year?: number | null }
): CatalogVersion[] {
  const genFilter = (opts?.generationCode || "").trim();
  const year = opts?.year != null && Number.isFinite(Number(opts.year)) ? Number(opts.year) : null;

  type Acc = {
    slug: string;
    name: string;
    trims: CatalogTrim[];
    fuelTypes?: string[];
  };
  const byName = new Map<string, Acc>();

  for (const e of entries) {
    const entryGen = (e.generationCode || "").trim();
    if (genFilter && entryGen && entryGen !== genFilter) {
      // Still allow if version-level metadata matches later; skip whole entry when gen selected and mismatch
      // Exception: empty entry gen codes always included
    }
    if (genFilter && entryGen && entryGen !== genFilter) continue;

    const normalized = normalizeCatalogVersions(e.versions, {
      generationCode: entryGen,
      modelYears: e.modelYears,
    });

    for (const v of normalized) {
      if (year != null && !yearOverlaps(v.yearFrom, v.yearTo, year) && (v.yearFrom != null || v.yearTo != null)) {
        // version itself out of year range — still may have per-trim years; keep version if any trim matches
      }
      const key = v.name.toLocaleLowerCase("tr-TR");
      // Prefer clean slug without generation suffix for cascade identity
      const cleanSlug = slugifyVasita(v.name);
      if (!byName.has(key)) {
        byName.set(key, { slug: cleanSlug, name: v.name, trims: [], fuelTypes: v.fuelTypes });
      }
      const acc = byName.get(key)!;
      for (const t of v.trims) {
        const tGen = (t.generationCode || entryGen || "").trim();
        if (genFilter && tGen && tGen !== genFilter) continue;
        if (!yearOverlaps(t.yearFrom ?? v.yearFrom, t.yearTo ?? v.yearTo, year)) continue;
        if (!acc.trims.find((x) => x.name.toLocaleLowerCase("tr-TR") === t.name.toLocaleLowerCase("tr-TR"))) {
          acc.trims.push({
            slug: slugifyVasita(t.name),
            name: t.name,
            ...(tGen ? { generationCode: tGen } : {}),
            ...(t.yearFrom != null ? { yearFrom: t.yearFrom } : {}),
            ...(t.yearTo != null ? { yearTo: t.yearTo } : {}),
          });
        }
      }
      // Legacy: no nested trims — version is engine-only leaf
    }
  }

  return [...byName.values()]
    .map((v) => ({
      slug: v.slug,
      name: v.name,
      trims: v.trims.sort((a, b) => a.name.localeCompare(b.name, "tr")),
      ...(v.fuelTypes ? { fuelTypes: v.fuelTypes } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export function filterTrimsForVersion(
  versions: CatalogVersion[],
  versionSlugOrName: string,
  opts?: { generationCode?: string; year?: number | null }
): CatalogTrim[] {
  const q = versionSlugOrName.trim().toLowerCase();
  const v = versions.find(
    (x) => x.slug.toLowerCase() === q || x.name.toLowerCase() === q || slugifyVasita(x.name) === q
  );
  if (!v) return [];
  const genFilter = (opts?.generationCode || "").trim();
  const year = opts?.year != null && Number.isFinite(Number(opts.year)) ? Number(opts.year) : null;
  return v.trims.filter((t) => {
    if (genFilter && t.generationCode && t.generationCode !== genFilter) return false;
    if (!yearOverlaps(t.yearFrom, t.yearTo, year)) return false;
    return true;
  });
}
