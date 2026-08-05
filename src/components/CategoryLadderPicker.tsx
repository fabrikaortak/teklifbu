"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CATEGORY_BROWSE_TREE,
  BrowseNode,
  findBrowseNode,
  matchBrowsePath,
} from "@/data/categoryBrowseTree";
import {
  brandsForSubtype,
  modelRequiresTrim,
  modelsForBrand,
  trimsForModel,
} from "@/data/vehicleCatalog";

export type CategoryLadderValue = {
  categorySlug: string;
  dealType: string;
  subtype: string;
  rentalPeriod: string;
  brand: string;
  model: string;
  trim: string;
};

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
  const next: CategoryLadderValue = {
    categorySlug: f.category || "",
    dealType,
    subtype: f.subtype || "",
    rentalPeriod: f.rental || "",
    brand: "",
    model: "",
    trim: "",
  };
  // Vasıta alt tip seçildiğinde marka/model sıfırlanır; dealType korunur
  if (f.category === "arac" && f.subtype) {
    next.dealType = prev.dealType || "SATILIK";
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
  const brandOptions = isVehicle ? brandsForSubtype(value.subtype) : [];
  const modelOptions = isVehicle && value.brand ? modelsForBrand(value.subtype, value.brand) : [];
  const trimOptions =
    isVehicle && value.brand && value.model ? trimsForModel(value.subtype, value.brand, value.model) : [];

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
    const t = trimOptions.find((x) => x.slug === value.trim);
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
                onChange={(e) => onChange({ ...value, model: e.target.value, trim: "" })}
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
          {value.model && trimOptions.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
                Paket / motor *
              </label>
              <select
                className="select"
                disabled={disabled}
                value={value.trim}
                onChange={(e) => onChange({ ...value, trim: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="">Paket seçin</option>
                {trimOptions.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
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
