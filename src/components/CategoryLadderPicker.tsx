"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CATEGORY_BROWSE_TREE,
  BrowseNode,
  findBrowseNode,
  matchBrowsePath,
} from "@/data/categoryBrowseTree";
// ⚠️ EMERGENCY FALLBACK ONLY — used when /api/vasita/catalog has no data for a subtype/brand
// (e.g. DB down, or brand/model not yet in the curated Stage1 pack). Primary path is the API.
import {
  brandsForSubtype,
  modelRequiresTrim,
  modelsForBrand,
  trimsForModel,
} from "@/data/vehicleCatalog";
import { readBrowseExtraAttrs } from "@/lib/vasitaBrowseFromTarget";

export type CategoryLadderValue = {
  categorySlug: string;
  dealType: string;
  subtype: string;
  rentalPeriod: string;
  brand: string;
  model: string;
  trim: string;
  /** Nesil / kasa kodu (Stage1: genellikle "default"). */
  generation?: string;
  /** Versiyon/paket — legacy attributes.trim ile senkron tutulur. */
  version?: string;
  /** Model yılı (opsiyonel; formda ayrıca serbest "Model Yılı" alanı da vardır). */
  modelYear?: string;
  /** Segment / class flags from Stage1 browse tree (fuelType, motorcycleClass, …) */
  extraAttrs?: Record<string, string>;
};

type CatalogOption = { slug: string; name: string };
type GenerationOption = { code: string; label: string };

type VasitaCatalogState = {
  brands: CatalogOption[];
  brandsLoaded: boolean;
  models: CatalogOption[];
  modelsLoaded: boolean;
  generations: GenerationOption[];
  versions: CatalogOption[];
  years: number[];
  generationsLoaded: boolean;
};

const EMPTY_CATALOG_STATE: VasitaCatalogState = {
  brands: [],
  brandsLoaded: false,
  models: [],
  modelsLoaded: false,
  generations: [],
  versions: [],
  years: [],
  generationsLoaded: false,
};

/** /api/vasita/catalog cascade — DB source of truth. Empty result → caller falls back to vehicleCatalog.ts. */
function useVasitaCatalogCascade(subtype: string, brand: string, model: string): VasitaCatalogState {
  const [state, setState] = useState<VasitaCatalogState>(EMPTY_CATALOG_STATE);

  useEffect(() => {
    if (!subtype) {
      setState(EMPTY_CATALOG_STATE);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...EMPTY_CATALOG_STATE, generations: s.generations }));
    fetch(`/api/vasita/catalog?action=brands&subtype=${encodeURIComponent(subtype)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setState((s) => ({ ...s, brands: Array.isArray(data?.brands) ? data.brands : [], brandsLoaded: true }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, brands: [], brandsLoaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [subtype]);

  useEffect(() => {
    if (!subtype || !brand) {
      setState((s) => ({ ...s, models: [], modelsLoaded: false }));
      return;
    }
    let cancelled = false;
    fetch(
      `/api/vasita/catalog?action=models&subtype=${encodeURIComponent(subtype)}&brand=${encodeURIComponent(brand)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setState((s) => ({ ...s, models: Array.isArray(data?.models) ? data.models : [], modelsLoaded: true }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, models: [], modelsLoaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [subtype, brand]);

  useEffect(() => {
    if (!subtype || !brand || !model) {
      setState((s) => ({ ...s, generations: [], versions: [], years: [], generationsLoaded: false }));
      return;
    }
    let cancelled = false;
    fetch(
      `/api/vasita/catalog?action=generations&subtype=${encodeURIComponent(subtype)}&brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          generations: Array.isArray(data?.generations) ? data.generations : [],
          versions: Array.isArray(data?.versions) ? data.versions : [],
          years: Array.isArray(data?.years) ? data.years : [],
          generationsLoaded: true,
        }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, generations: [], versions: [], years: [], generationsLoaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [subtype, brand, model]);

  return state;
}

type Props = {
  value: CategoryLadderValue;
  onChange: (next: CategoryLadderValue) => void;
  disabled?: boolean;
  /** Kök ağaç: genel (emlak/vasıta) veya alışveriş */
  tree?: BrowseNode[];
  /** İpucu metni */
  hint?: ReactNode;
};

function applyNodeFilter(node: BrowseNode, prev: CategoryLadderValue): CategoryLadderValue {
  const f = node.filter;
  const isLeaf = !node.children?.length;
  let dealType = f.dealType || "";
  if (isLeaf && !dealType && f.category !== "arac") {
    dealType = f.category === "kiralik" ? "KIRALIK" : "SATILIK";
  }
  const extras = readBrowseExtraAttrs(f);
  const next: CategoryLadderValue = {
    categorySlug: f.category || "",
    dealType,
    subtype: f.subtype || "",
    rentalPeriod: f.rental || extras.rentalPeriod || "",
    brand: "",
    model: "",
    trim: "",
    generation: "",
    version: "",
    modelYear: "",
    extraAttrs: extras,
  };
  // Vasıta alt tip seçildiğinde marka/model sıfırlanır; dealType korunur (kiralık hub hariç)
  if (f.category === "arac" && f.subtype) {
    if (f.dealType === "KIRALIK") next.dealType = "KIRALIK";
    else next.dealType = prev.dealType || "SATILIK";
  }
  return next;
}

function isBrowseComplete(node: BrowseNode | null, value: CategoryLadderValue) {
  if (!node || node.children?.length) return false;
  if (value.categorySlug === "arac") {
    const brands = brandsForSubtype(value.subtype);
    if (!brands.length) return Boolean(value.subtype);
    if (!value.brand || !value.model) return false;
    if (modelRequiresTrim(value.subtype, value.brand, value.model) && !value.trim) return false;
    return true;
  }
  return true;
}

function pathMatchesValue(path: BrowseNode[], value: CategoryLadderValue): boolean {
  if (!path.length) return !value.categorySlug;
  const last = path[path.length - 1];
  if ((last.filter.category || "") !== value.categorySlug) return false;
  if (last.filter.dealType && value.dealType && last.filter.dealType !== value.dealType) return false;
  if (last.filter.subtype && value.subtype && last.filter.subtype !== value.subtype) return false;
  if (last.filter.rental && value.rentalPeriod && last.filter.rental !== value.rentalPeriod) {
    return false;
  }
  return true;
}

function hydratePath(value: CategoryLadderValue, tree: BrowseNode[]): BrowseNode[] {
  if (!value.categorySlug) return [];
  const ids = matchBrowsePath(
    {
      category: value.categorySlug,
      dealType: value.dealType,
      subtype: value.subtype,
      rental: value.rentalPeriod,
    },
    tree
  );
  return ids.map((id) => findBrowseNode(id, tree)).filter(Boolean) as BrowseNode[];
}

export function CategoryLadderPicker({
  value,
  onChange,
  disabled,
  tree = CATEGORY_BROWSE_TREE,
  hint,
}: Props) {
  const [path, setPath] = useState<BrowseNode[]>(() => hydratePath(value, tree));
  /** Kullanıcı seçimi sonrası value sync’inin path’i ezmesini engeller */
  const skipHydrateRef = useRef(false);

  useEffect(() => {
    if (skipHydrateRef.current) {
      skipHydrateRef.current = false;
      return;
    }
    setPath((prev) => {
      if (pathMatchesValue(prev, value)) return prev;
      const next = hydratePath(value, tree);
      // Eşleşme bulunamadıysa mevcut merdiveni koru (ara seçim sıfırlanmasın)
      if (!next.length && prev.length && value.categorySlug) return prev;
      const same =
        next.length === prev.length && next.every((n, i) => n.id === prev[i]?.id);
      return same ? prev : next;
    });
  }, [value.categorySlug, value.dealType, value.subtype, value.rentalPeriod, tree]);

  const levels: Array<{ options: BrowseNode[]; selectedId: string }> = [];
  levels.push({
    options: tree,
    selectedId: path[0]?.id || "",
  });
  for (let i = 0; i < path.length; i++) {
    const children = path[i].children;
    if (children?.length) {
      levels.push({
        options: children,
        selectedId: path[i + 1]?.id || "",
      });
    }
  }

  const last = path[path.length - 1] || null;
  const isVehicle = value.categorySlug === "arac" && Boolean(value.subtype);

  // Primary path: /api/vasita/catalog (DB). Empty/failed → vehicleCatalog.ts fallback.
  const cascade = useVasitaCatalogCascade(isVehicle ? value.subtype : "", value.brand, value.model);
  const fallbackBrandOptions = isVehicle ? brandsForSubtype(value.subtype) : [];
  const usingDbBrands = cascade.brandsLoaded && cascade.brands.length > 0;
  const brandOptions = usingDbBrands ? cascade.brands : fallbackBrandOptions;

  const fallbackModelOptions = isVehicle && value.brand ? modelsForBrand(value.subtype, value.brand) : [];
  const usingDbModels = usingDbBrands && cascade.modelsLoaded && cascade.models.length > 0;
  const modelOptions = usingDbModels ? cascade.models : fallbackModelOptions;

  const fallbackTrimOptions =
    isVehicle && value.brand && value.model ? trimsForModel(value.subtype, value.brand, value.model) : [];
  // When DB brand/model cascade is live, do NOT flash static vehicleCatalog trims while
  // generations/versions are still loading — that mixed SoT breaks required trim selection.
  const usingDbVersions = usingDbModels && cascade.generationsLoaded && cascade.versions.length > 0;
  const versionOptions = usingDbModels
    ? cascade.generationsLoaded
      ? cascade.versions
      : []
    : fallbackTrimOptions;
  const generationOptions =
    usingDbModels && cascade.generationsLoaded ? cascade.generations : [];
  const yearOptions = usingDbModels && cascade.generationsLoaded ? cascade.years : [];

  const complete = isBrowseComplete(last, value);
  const breadcrumbParts = path.map((n) => n.name);
  if (value.brand) {
    const b = brandOptions.find((x) => x.slug === value.brand);
    breadcrumbParts.push(b?.name || value.brand);
  }
  if (value.model) {
    const m = modelOptions.find((x) => x.slug === value.model);
    breadcrumbParts.push(m?.name || value.model);
  }
  if (value.trim) {
    const t = versionOptions.find((x) => x.slug === value.trim);
    breadcrumbParts.push(t?.name || value.trim);
  }
  const breadcrumb = breadcrumbParts.join(" › ");

  function pickAtLevel(levelIndex: number, nodeId: string) {
    if (!nodeId) {
      const nextPath = path.slice(0, levelIndex);
      skipHydrateRef.current = true;
      setPath(nextPath);
      if (nextPath.length === 0) {
        onChange({
          categorySlug: "",
          dealType: "",
          subtype: "",
          rentalPeriod: "",
          brand: "",
          model: "",
          trim: "",
        });
      } else {
        onChange(applyNodeFilter(nextPath[nextPath.length - 1], value));
      }
      return;
    }
    const options = levels[levelIndex]?.options || [];
    const node = options.find((o) => o.id === nodeId);
    if (!node) return;
    const nextPath = [...path.slice(0, levelIndex), node];
    skipHydrateRef.current = true;
    setPath(nextPath);
    onChange(applyNodeFilter(node, value));
  }

  const stepLabels = ["Tür / bölüm", "Alt kategori", "Detay"];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
        {hint || (
          <>
            Kategoriyi merdiven gibi adım adım seçin. Her adımda bir seçenek belirleyin; seçim
            korunur.
          </>
        )}
      </div>

      {levels.map((level, idx) => (
        <div key={`lvl-${idx}-${level.options.map((o) => o.id).join("|").slice(0, 48)}`}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
            {idx === 0 ? "1) Ana kategori *" : `${idx + 1}) ${stepLabels[Math.min(idx - 1, stepLabels.length - 1)]} *`}
          </label>
          <select
            className="select"
            disabled={disabled}
            value={level.selectedId}
            required={idx === 0}
            onChange={(e) => pickAtLevel(idx, e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">{idx === 0 ? "Ana kategori seçin" : "Seçin…"}</option>
            {level.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ))}

      {isVehicle && brandOptions.length > 0 && (
        <>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
              Marka *
            </label>
            <select
              className="select"
              disabled={disabled}
              value={value.brand}
              onChange={(e) =>
                onChange({
                  ...value,
                  brand: e.target.value,
                  model: "",
                  trim: "",
                  generation: "",
                  version: "",
                  modelYear: "",
                  dealType: value.dealType || "SATILIK",
                })
              }
              style={{ width: "100%" }}
            >
              <option value="">Marka seçin</option>
              {brandOptions.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {value.brand && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
                Model *
              </label>
              <select
                className="select"
                disabled={disabled}
                value={value.model}
                onChange={(e) =>
                  onChange({
                    ...value,
                    model: e.target.value,
                    trim: "",
                    generation: "",
                    version: "",
                    modelYear: "",
                  })
                }
                style={{ width: "100%" }}
              >
                <option value="">Model seçin</option>
                {modelOptions.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {value.model && usingDbModels && generationOptions.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
                Kasa / Nesil
              </label>
              <select
                className="select"
                disabled={disabled}
                value={value.generation || (generationOptions.length === 1 ? generationOptions[0].code : "")}
                onChange={(e) =>
                  onChange({
                    ...value,
                    generation: e.target.value,
                    version: "",
                    trim: "",
                    modelYear: "",
                  })
                }
                style={{ width: "100%" }}
              >
                {generationOptions.length > 1 ? <option value="">Seçin…</option> : null}
                {generationOptions.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {value.model && versionOptions.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
                {usingDbVersions ? "Versiyon" : "Paket / motor *"}
              </label>
              <select
                className="select"
                disabled={disabled}
                value={value.version || value.trim}
                onChange={(e) =>
                  onChange({
                    ...value,
                    version: e.target.value,
                    trim: e.target.value,
                    modelYear: "",
                  })
                }
                style={{ width: "100%" }}
              >
                <option value="">{usingDbVersions ? "Versiyon seçin" : "Paket seçin"}</option>
                {versionOptions.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {value.model && usingDbModels && yearOptions.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
                Model yılı
              </label>
              <select
                className="select"
                disabled={disabled}
                value={value.modelYear || ""}
                onChange={(e) => onChange({ ...value, modelYear: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="">Seçin…</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {complete ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255, 106, 0, 0.08)",
            border: "1px solid rgba(255, 106, 0, 0.25)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--navy)",
          }}
        >
          Seçilen kategori: {breadcrumb}
        </div>
      ) : path.length > 0 ? (
        <div style={{ fontSize: 12.5, color: "#b45309", fontWeight: 600 }}>
          {isVehicle
            ? "Seçimi tamamlayın — marka / model / paket seçilmeden ilan yayınlanamaz."
            : "Seçimi tamamlayın — tüm alt kategorileri sırayla seçin."}
        </div>
      ) : null}
    </div>
  );
}

export function isCategoryLadderComplete(value: CategoryLadderValue, tree?: BrowseNode[]): boolean {
  if (!value.categorySlug) return false;
  // Virgüllü ara seçim (henüz yaprak değil) tamamlanmış sayılmaz
  if (value.categorySlug.includes(",")) return false;
  const ids = matchBrowsePath(
    {
      category: value.categorySlug,
      dealType: value.dealType,
      subtype: value.subtype,
      rental: value.rentalPeriod,
    },
    tree
  );
  if (!ids.length) return false;
  const leaf = findBrowseNode(ids[ids.length - 1], tree);
  return isBrowseComplete(leaf, value);
}
