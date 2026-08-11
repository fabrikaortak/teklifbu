"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AdminVertical } from "@/lib/adminVertical";
import { ARAC_TYPES, KONUT_TYPES, type BrowseNode } from "@/data/categoryBrowseTree";
import {
  ALISVERIS_GROUP_IDS,
  CLASSIC_SHOP_GROUPS,
} from "@/data/classicBrowseTree";
import { SHOP_SUBCATEGORIES, childSlug } from "@/data/shopCategories";
import { PREMIUM_CATEGORY_SEEDS, childPremiumSlug } from "@/data/premiumCategories";
import {
  aracBrandKey,
  aracModelKey,
  aracSubtypeKey,
  displayNameFor,
  isNodeActive,
  konutSubtypeKey,
  normalizeBrowseNavConfig,
  premiumNodeKey,
  sortOrderFor,
  type BrowseNavConfig,
} from "@/lib/browseNavConfig";
import type { FacetCounts } from "@/lib/facetHelpers";

type CatRow = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId?: string | null;
  listingCount: number;
};

function slugsFromFilter(category?: string | null) {
  return String(category || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function catsForBrowseNode(node: BrowseNode, catBySlug: Map<string, CatRow>): CatRow[] {
  const out: CatRow[] = [];
  const seen = new Set<string>();
  function walk(n: BrowseNode) {
    for (const s of slugsFromFilter(n.filter?.category)) {
      const c = catBySlug.get(s);
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
    for (const ch of n.children || []) walk(ch);
  }
  walk(node);
  return out;
}

function VerticalMasterCard({
  title,
  description,
  enabled,
  busy,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className="adm-card"
      style={{
        padding: 16,
        display: "flex",
        gap: 14,
        alignItems: "center",
        flexWrap: "wrap",
        border: enabled ? "1px solid #bbf7d0" : "1px solid #fecaca",
        background: enabled ? "#f0fdf4" : "#fef2f2",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
          {description}
        </div>
      </div>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 800,
          fontSize: 14,
          cursor: busy ? "wait" : "pointer",
          padding: "10px 14px",
          borderRadius: 10,
          background: "#fff",
          border: "1px solid #e2e8f0",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => onChange(e.target.checked)}
        />
        {enabled ? "Açık" : "Kapalı"}
      </label>
    </div>
  );
}

type EditTarget = {
  nodeKey: string;
  defaultName: string;
  sortValue: number;
  active: boolean;
  /** Alışveriş DB satırı — adı Category.name olarak da kaydedilir */
  categoryId?: string;
  categorySlug?: string;
  categoryIcon?: string | null;
};

type TreeRowProps = {
  name: string;
  count: number;
  depth: number;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
  sortValue: number;
  onSortBlur: (v: number) => void;
  active: boolean;
  onActiveChange: (v: boolean) => void;
  saving?: boolean;
  onEdit?: () => void;
};

function SoonBtn({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn-outline"
      disabled
      title="Yakında"
      style={{ padding: "5px 10px", fontSize: 12, opacity: 0.55, cursor: "not-allowed" }}
    >
      {label}
    </button>
  );
}

function EditMenuModal({
  target,
  busy,
  onClose,
  onSave,
}: {
  target: EditTarget & { returnPolicyText?: string };
  busy: boolean;
  onClose: () => void;
  onSave: (patch: {
    label: string;
    sortOrder: number;
    active: boolean;
    returnPolicyText?: string;
  }) => void;
}) {
  const isShopLeaf = Boolean(target.categorySlug) && target.nodeKey.startsWith("shop/leaf/");
  const [label, setLabel] = useState(target.defaultName);
  const [sortOrder, setSortOrder] = useState(String(target.sortValue));
  const [active, setActive] = useState(target.active);
  const [returnPolicyText, setReturnPolicyText] = useState(target.returnPolicyText || "");

  useEffect(() => {
    setLabel(target.defaultName);
    setSortOrder(String(target.sortValue));
    setActive(target.active);
    setReturnPolicyText(target.returnPolicyText || "");
  }, [target]);

  return (
    <div className="tb-dialog-backdrop" onClick={onClose}>
      <div
        className="tb-dialog"
        style={{ textAlign: "left", width: "min(480px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <h3 className="tb-dialog-title" style={{ textAlign: "left", paddingRight: 28 }}>
          Menü düzenle
        </h3>
        <p className="tb-dialog-message" style={{ textAlign: "left", marginBottom: 14, fontSize: 13 }}>
          Sitedeki menü adı değişir (sol menü ve anasayfa). Teknik anahtar değişmez; ilan eşleşmesi bozulmaz.
        </p>

        <label style={{ display: "grid", gap: 6, marginBottom: 12, fontSize: 13, fontWeight: 650 }}>
          Menü adı
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Örn. Otomobil"
            autoFocus
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginBottom: 12, fontSize: 13, fontWeight: 650 }}>
          Sıra
          <input
            className="input"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            fontSize: 13.5,
            cursor: "pointer",
            fontWeight: 650,
          }}
        >
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Sitede görünür
        </label>

        {isShopLeaf ? (
          <label style={{ display: "grid", gap: 6, marginBottom: 14, fontSize: 13, fontWeight: 650 }}>
            Kargo &amp; İade — iade metni
            <textarea
              className="input"
              rows={3}
              value={returnPolicyText}
              onChange={(e) => setReturnPolicyText(e.target.value)}
              placeholder={
                String(target.categorySlug || "").startsWith("ikinci-el")
                  ? "Örn. İkinci el ürünlerde iade koşulları satıcıya özeldir."
                  : "Örn. Teslimattan sonra 14 gün içinde kolay iade"
              }
              style={{ resize: "vertical", minHeight: 72, fontWeight: 500 }}
            />
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, lineHeight: 1.4 }}>
              Ürün detayındaki «Kargo &amp; İade» sekmesinde görünür. Boş bırakılırsa kategori tipine göre
              varsayılan metin kullanılır.
            </span>
          </label>
        ) : null}

        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 16,
            wordBreak: "break-all",
          }}
        >
          Teknik anahtar: <code style={{ fontWeight: 700 }}>{target.nodeKey}</code>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-outline" style={{ padding: "10px 14px" }} onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button
            type="button"
            className="btn-orange"
            style={{ padding: "10px 16px" }}
            disabled={busy || !label.trim()}
            onClick={() => {
              const n = Number(sortOrder);
              onSave({
                label: label.trim(),
                sortOrder: Number.isFinite(n) ? n : target.sortValue,
                active,
                ...(isShopLeaf ? { returnPolicyText: returnPolicyText.trim() } : {}),
              });
            }}
          >
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TreeRow({
  name,
  count,
  depth,
  expandable,
  open,
  onToggle,
  sortValue,
  onSortBlur,
  active,
  onActiveChange,
  saving,
  onEdit,
}: TreeRowProps) {
  const [sortDraft, setSortDraft] = useState(String(sortValue));
  useEffect(() => {
    setSortDraft(String(sortValue));
  }, [sortValue]);

  return (
    <tr style={{ opacity: saving ? 0.7 : 1 }}>
      <td style={{ paddingLeft: 12 + depth * 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {expandable ? (
            <button
              type="button"
              aria-label={open ? "Kapat" : "Aç"}
              onClick={onToggle}
              style={{
                border: "none",
                background: "transparent",
                padding: 4,
                cursor: "pointer",
                color: "#64748b",
                display: "grid",
                placeItems: "center",
              }}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span style={{ width: 22, flexShrink: 0 }} />
          )}
          <button
            type="button"
            onClick={() => {
              if (expandable && onToggle) onToggle();
            }}
            style={{
              border: "none",
              background: "transparent",
              padding: "6px 2px",
              cursor: expandable ? "pointer" : "default",
              fontWeight: depth === 0 ? 750 : 600,
              fontSize: 13.5,
              textAlign: "left",
              color: "inherit",
            }}
          >
            {name}
          </button>
        </div>
      </td>
      <td style={{ fontVariantNumeric: "tabular-nums", color: "#64748b" }}>{count}</td>
      <td style={{ width: 88 }}>
        <input
          className="input"
          type="number"
          value={sortDraft}
          onChange={(e) => setSortDraft(e.target.value)}
          onBlur={() => {
            const n = Number(sortDraft);
            if (Number.isFinite(n) && n !== sortValue) onSortBlur(n);
            else setSortDraft(String(sortValue));
          }}
          style={{ width: 72, padding: "6px 8px", fontSize: 13 }}
        />
      </td>
      <td>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onActiveChange(e.target.checked)}
            disabled={saving}
          />
          <span style={{ color: active ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>
            {active ? "Görünür" : "Gizli"}
          </span>
        </label>
      </td>
      <td style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="btn-outline"
          style={{ padding: "5px 10px", fontSize: 12 }}
          onClick={onEdit}
          disabled={!onEdit || saving}
        >
          Düzenle
        </button>
        <SoonBtn label="Sil" />
      </td>
    </tr>
  );
}

function SectionTable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="adm-card" style={{ overflow: "auto", padding: 0 }}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--adm-line)",
          fontWeight: 800,
          fontSize: 15,
        }}
      >
        {title}
      </div>
      <table className="adm-table" style={{ margin: 0 }}>
        <thead>
          <tr>
            <th>Ad</th>
            <th style={{ width: 100 }}>İlan adedi</th>
            <th style={{ width: 88 }}>Sıra</th>
            <th style={{ width: 120 }}>Durum</th>
            <th style={{ width: 160 }} />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const GROUP_LABELS: Record<string, string> = {
  elektronik: "Elektronik",
  "ev-yasam": "Ev & Yaşam",
  moda: "Moda & Aksesuar",
  hobi: "Hobi & Spor",
  diger: "Diğer",
};

type VasitaBrandNode = {
  slug: string;
  name: string;
  models: Array<{ slug: string; name: string; trims?: Array<{ slug: string; name: string }> }>;
};

export function AdminCategoryTreePanel({ vertical }: { vertical: AdminVertical }) {
  const [config, setConfig] = useState<BrowseNavConfig | null>(null);
  const [facets, setFacets] = useState<FacetCounts | null>(null);
  const [categories, setCategories] = useState<CatRow[]>([]);
  const [alisverisTree, setAlisverisTree] = useState<BrowseNode[]>([]);
  const [alisverisMaster, setAlisverisMaster] = useState(true);
  const [premiumMaster, setPremiumMaster] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  /** Stage1 DB brands — never vehicleCatalog.ts */
  const [dbVasitaBrands, setDbVasitaBrands] = useState<Record<string, VasitaBrandNode[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [navRes, browseRes, themeRes] = await Promise.all([
        fetch("/api/admin?view=category-nav"),
        vertical === "alisveris"
          ? fetch("/api/catalog/tree?format=browse", { cache: "no-store" })
          : Promise.resolve(null),
        vertical === "alisveris" || vertical === "premium"
          ? fetch("/api/theme", { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      if (!navRes.ok) {
        const j = await navRes.json().catch(() => ({}));
        throw new Error(j.error || "Yüklenemedi");
      }
      const data = await navRes.json();
      setConfig(normalizeBrowseNavConfig(data.config));
      setFacets(data.facets || null);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      if (browseRes) {
        const b = await browseRes.json().catch(() => ({}));
        setAlisverisTree(Array.isArray(b.browseTree) ? b.browseTree : []);
      }
      if (themeRes) {
        const t = await themeRes.json().catch(() => ({}));
        if (typeof t.alisverisEnabled === "boolean") setAlisverisMaster(t.alisverisEnabled);
        if (typeof t.premiumEnabled === "boolean") setPremiumMaster(t.premiumEnabled);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [vertical]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (vertical !== "emlak-vasita") return;
    let cancelled = false;
    void Promise.all(
      ARAC_TYPES.map(async (t) => {
        try {
          const res = await fetch(`/api/vasita/catalog?action=nav&subtype=${encodeURIComponent(t.slug)}`, {
            cache: "no-store",
          });
          const data = await res.json();
          const brands = Array.isArray(data?.brands)
            ? data.brands.map((b: { slug: string; name: string; models?: Array<{ slug: string; name: string }> }) => ({
                slug: b.slug,
                name: b.name,
                models: (b.models || []).map((m) => ({ slug: m.slug, name: m.name, trims: [] as Array<{ slug: string; name: string }> })),
              }))
            : [];
          return [t.slug, brands] as const;
        } catch {
          return [t.slug, [] as VasitaBrandNode[]] as const;
        }
      })
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, VasitaBrandNode[]> = {};
      for (const [slug, brands] of rows) next[slug] = brands;
      setDbVasitaBrands(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  const catBySlug = useMemo(() => {
    const m = new Map<string, CatRow>();
    for (const c of categories) m.set(c.slug, c);
    return m;
  }, [categories]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchConfig(body: Record<string, unknown>) {
    const key =
      body.nodeKey != null && String(body.nodeKey)
        ? String(body.nodeKey)
        : body.sahibindenTreeExpand !== undefined
          ? "sahibinden"
          : "hide";
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-browse-nav-config", ...body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kayıt başarısız");
      if (j.config) setConfig(normalizeBrowseNavConfig(j.config));
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleDbCategory(c: CatRow, isActive: boolean) {
    setBusyKey(c.id);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-category", id: c.id, isActive }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Güncellenemedi");
      }
      setCategories((list) => list.map((x) => (x.id === c.id ? { ...x, isActive } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveVerticalMaster(key: "alisveris_vertical_enabled" | "premium_vertical_enabled", next: boolean) {
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-settings", settings: { [key]: next } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kayıt başarısız");
      if (key === "alisveris_vertical_enabled") setAlisverisMaster(next);
      else setPremiumMaster(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveEdit(patch: {
    label: string;
    sortOrder: number;
    active: boolean;
    returnPolicyText?: string;
  }) {
    if (!editTarget) return;
    const t = editTarget;
    setBusyKey(t.nodeKey);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-browse-nav-config",
          nodeKey: t.nodeKey,
          label: patch.label,
          sortOrder: patch.sortOrder,
          active: patch.active,
          ...(patch.returnPolicyText !== undefined
            ? { returnPolicyText: patch.returnPolicyText }
            : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kayıt başarısız");
      if (j.config) setConfig(normalizeBrowseNavConfig(j.config));

      if (t.categoryId && t.categorySlug) {
        const catRes = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-category",
            id: t.categoryId,
            name: patch.label,
            slug: t.categorySlug,
            icon: t.categoryIcon || "grid",
            sortOrder: patch.sortOrder,
            isActive: patch.active,
          }),
        });
        if (!catRes.ok) {
          const cj = await catRes.json().catch(() => ({}));
          throw new Error(cj.error || "Kategori adı kaydedilemedi");
        }
        setCategories((list) =>
          list.map((x) =>
            x.id === t.categoryId
              ? { ...x, name: patch.label, sortOrder: patch.sortOrder, isActive: patch.active }
              : x
          )
        );
      }
      setEditTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setBusyKey(null);
    }
  }

  function openEdit(t: EditTarget) {
    setEditTarget(t);
  }

  if (loading || !config) {
    return <div className="adm-card">Yükleniyor...</div>;
  }

  const hideEmpty = config.hideEmptyUntilListing;

  return (
    <div className="adm-panel-wrap" style={{ display: "grid", gap: 14 }}>
      {error ? (
        <div className="adm-card" style={{ color: "var(--adm-red)", fontWeight: 600 }}>
          {error}
          <button type="button" className="btn-outline" style={{ marginLeft: 12, padding: "6px 10px" }} onClick={() => load()}>
            Yenile
          </button>
        </div>
      ) : null}

      {editTarget ? (
        <EditMenuModal
          target={{
            ...editTarget,
            defaultName: displayNameFor(config, editTarget.nodeKey, editTarget.defaultName),
            returnPolicyText: config.nodes[editTarget.nodeKey]?.returnPolicyText || "",
          }}
          busy={busyKey === editTarget.nodeKey}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
        />
      ) : null}

      <div className="adm-card" style={{ padding: 14, display: "grid", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={hideEmpty}
            disabled={busyKey === "hide"}
            onChange={(e) => patchConfig({ hideEmptyUntilListing: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong>İlanı olmayanlar ilan açılana kadar sitede görünmez</strong>
            <div style={{ fontSize: 12.5, color: "var(--adm-muted)", marginTop: 4, lineHeight: 1.45 }}>
              Açıkken ilan sayısı 0 olan dallar sitede gizlenir; ilk ilan gelince otomatik görünür.
            </div>
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={Boolean(config.sahibindenTreeExpand)}
            disabled={busyKey === "sahibinden"}
            onChange={(e) => patchConfig({ sahibindenTreeExpand: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong>Sahibinden menü ağaç açılımı</strong>
            <div style={{ fontSize: 12.5, color: "var(--adm-muted)", marginTop: 4, lineHeight: 1.45 }}>
              Ana kontrol: <strong>Tema → Kategoriler teması</strong>. «v2» = Sahibinden drill (kardeş dallar
              gizlenir). «Ağaç» = accordion. Bu kutu artık sol menü davranışını değiştirmez; kayıt uyumu için
              tutulur.
            </div>
          </span>
        </label>
      </div>

      {vertical === "emlak-vasita" && (
        <>
          <SectionTable title="Vasıta kategorileri">
            {ARAC_TYPES.map((t, ti) => {
              const key = aracSubtypeKey(t.slug);
              const open = openIds.has(key);
              const brands = dbVasitaBrands[t.slug] || [];
              const count = facets?.subtypes[`arac:${t.slug}`] || 0;
              const active = isNodeActive(config, key);
              const sort = sortOrderFor(config, key, ti);
              return (
                <VasitaBranch
                  key={key}
                  subtype={t.slug}
                  name={displayNameFor(config, key, t.name)}
                  catalogName={t.name}
                  count={count}
                  open={open}
                  brands={brands}
                  openIds={openIds}
                  config={config}
                  facets={facets}
                  busyKey={busyKey}
                  onToggle={() => toggleOpen(key)}
                  onToggleChild={toggleOpen}
                  onPatch={patchConfig}
                  onEdit={openEdit}
                  sort={sort}
                  active={active}
                />
              );
            })}
          </SectionTable>

          <SectionTable title="Emlak kategorileri">
            {KONUT_TYPES.map((t, ti) => {
              const key = konutSubtypeKey(t.slug);
              const count = facets?.subtypes[`konut:${t.slug}`] || 0;
              const sort = sortOrderFor(config, key, ti);
              const active = isNodeActive(config, key);
              return (
                <TreeRow
                  key={key}
                  name={displayNameFor(config, key, t.name)}
                  count={count}
                  depth={0}
                  sortValue={sort}
                  onSortBlur={(v) => patchConfig({ nodeKey: key, sortOrder: v })}
                  active={active}
                  onActiveChange={(v) => patchConfig({ nodeKey: key, active: v })}
                  saving={busyKey === key}
                  onEdit={() =>
                    openEdit({
                      nodeKey: key,
                      defaultName: t.name,
                      sortValue: sort,
                      active,
                    })
                  }
                />
              );
            })}
          </SectionTable>
        </>
      )}

      {vertical === "alisveris" && (
        <>
          <VerticalMasterCard
            title="Alışveriş dikeyi (tümü)"
            description="Kapalıysa sitede alışveriş menüsü, /alisveris ve ilan türü seçiminde alışveriş gizlenir. Alt kategoriler saklanır."
            enabled={alisverisMaster}
            busy={busyKey === "alisveris_vertical_enabled"}
            onChange={(v) => void saveVerticalMaster("alisveris_vertical_enabled", v)}
          />
          <SectionTable title={`Alışveriş kategorileri (DB · ${alisverisTree.length} ana)`}>
            {alisverisTree.length === 0 ? (
              <div style={{ padding: 16, color: "#64748b", fontSize: 13 }}>
                Katalog ağacı boş. Seed / taxonomy uygulandıktan sonra burada görünür.
              </div>
            ) : (
              alisverisTree.map((node, i) => (
                <AlisverisDbBranch
                  key={node.id}
                  node={node}
                  depth={0}
                  index={i}
                  openIds={openIds}
                  catBySlug={catBySlug}
                  facets={facets}
                  config={config}
                  busyKey={busyKey}
                  onToggle={toggleOpen}
                  onToggleCategory={toggleDbCategory}
                  onPatch={patchConfig}
                  onEdit={openEdit}
                />
              ))
            )}
          </SectionTable>
        </>
      )}

      {vertical === "premium" && (
        <>
          <VerticalMasterCard
            title="Premium dikeyi (tümü)"
            description="Kapalıysa otel / lojistik / yolculuk tamamen gizlenir. Açıkken aşağıdaki alt dikeyleri ayrı yönetin."
            enabled={premiumMaster}
            busy={busyKey === "premium_vertical_enabled"}
            onChange={(v) => void saveVerticalMaster("premium_vertical_enabled", v)}
          />
          <SectionTable title="Premium kategorileri">
            {PREMIUM_CATEGORY_SEEDS.map((root, ri) => {
              const key = premiumNodeKey(root.vertical);
              const open = openIds.has(key);
              const rootCat = catBySlug.get(root.slug);
              const childCounts = root.children.map((c) => {
                const slug = childPremiumSlug(root.slug, c.slug);
                return catBySlug.get(slug)?.listingCount || facets?.categories[slug] || 0;
              });
              const count =
                rootCat?.listingCount ||
                facets?.categories[root.slug] ||
                childCounts.reduce((a, b) => a + b, 0);
              return (
                <PremiumBranch
                  key={key}
                  root={root}
                  count={count}
                  open={open}
                  openIds={openIds}
                  config={config}
                  catBySlug={catBySlug}
                  facets={facets}
                  busyKey={busyKey}
                  sort={sortOrderFor(config, key, ri)}
                  active={isNodeActive(config, key)}
                  onToggle={() => toggleOpen(key)}
                  onToggleChild={toggleOpen}
                  onPatch={patchConfig}
                  onToggleCategory={toggleDbCategory}
                  onEdit={openEdit}
                />
              );
            })}
          </SectionTable>
        </>
      )}
    </div>
  );
}

function AlisverisDbBranch({
  node,
  depth,
  index,
  openIds,
  catBySlug,
  facets,
  config,
  busyKey,
  onToggle,
  onToggleCategory,
  onPatch,
  onEdit,
}: {
  node: BrowseNode;
  depth: number;
  index: number;
  openIds: Set<string>;
  catBySlug: Map<string, CatRow>;
  facets: FacetCounts | null;
  config: BrowseNavConfig;
  busyKey: string | null;
  onToggle: (id: string) => void;
  onToggleCategory: (c: CatRow, isActive: boolean) => void;
  onPatch: (body: Record<string, unknown>) => void;
  onEdit: (t: EditTarget) => void;
}) {
  const nodeKey = `shop/db/${node.id}`;
  const open = openIds.has(nodeKey);
  const kids = node.children || [];
  const allCats = catsForBrowseNode(node, catBySlug);
  const directCats = slugsFromFilter(node.filter?.category)
    .map((s) => catBySlug.get(s))
    .filter(Boolean) as CatRow[];
  const count =
    allCats.reduce((s, c) => s + (c.listingCount || 0), 0) ||
    directCats.reduce((s, c) => s + (facets?.categories[c.slug] || 0), 0);
  const active = allCats.length
    ? allCats.some((c) => c.isActive)
    : isNodeActive(config, nodeKey);
  const sort = sortOrderFor(config, nodeKey, index);
  const expandable = kids.length > 0;

  return (
    <>
      <TreeRow
        name={displayNameFor(config, nodeKey, node.name)}
        count={count}
        depth={depth}
        expandable={expandable}
        open={open}
        onToggle={() => onToggle(nodeKey)}
        sortValue={sort}
        onSortBlur={(v) => onPatch({ nodeKey, sortOrder: v })}
        active={active}
        onActiveChange={(v) => {
          const targets = allCats.length ? allCats : directCats;
          for (const c of targets) onToggleCategory(c, v);
          onPatch({ nodeKey, active: v });
        }}
        saving={busyKey === nodeKey || allCats.some((c) => busyKey === c.id)}
        onEdit={() =>
          onEdit({
            nodeKey,
            defaultName: node.name,
            sortValue: sort,
            active,
            categoryId: directCats[0]?.id,
            categorySlug: directCats[0]?.slug,
            categoryIcon: directCats[0]?.icon,
          })
        }
      />
      {open &&
        kids.map((ch, i) => (
          <AlisverisDbBranch
            key={ch.id}
            node={ch}
            depth={depth + 1}
            index={i}
            openIds={openIds}
            catBySlug={catBySlug}
            facets={facets}
            config={config}
            busyKey={busyKey}
            onToggle={onToggle}
            onToggleCategory={onToggleCategory}
            onPatch={onPatch}
            onEdit={onEdit}
          />
        ))}
    </>
  );
}

function VasitaBranch({
  subtype,
  name,
  catalogName,
  count,
  open,
  brands,
  openIds,
  config,
  facets,
  busyKey,
  onToggle,
  onToggleChild,
  onPatch,
  onEdit,
  sort,
  active,
}: {
  subtype: string;
  name: string;
  catalogName: string;
  count: number;
  open: boolean;
  brands: VasitaBrandNode[];
  openIds: Set<string>;
  config: BrowseNavConfig;
  facets: FacetCounts | null;
  busyKey: string | null;
  onToggle: () => void;
  onToggleChild: (id: string) => void;
  onPatch: (body: Record<string, unknown>) => void;
  onEdit: (t: EditTarget) => void;
  sort: number;
  active: boolean;
}) {
  const key = aracSubtypeKey(subtype);
  const hasBrands = brands.length > 0;

  return (
    <>
      <TreeRow
        name={name}
        count={count}
        depth={0}
        expandable={hasBrands}
        open={open}
        onToggle={onToggle}
        sortValue={sort}
        onSortBlur={(v) => onPatch({ nodeKey: key, sortOrder: v })}
        active={active}
        onActiveChange={(v) => onPatch({ nodeKey: key, active: v })}
        saving={busyKey === key}
        onEdit={() =>
          onEdit({
            nodeKey: key,
            defaultName: catalogName,
            sortValue: sort,
            active,
          })
        }
      />
      {open &&
        brands.map((b, bi) => {
          const bKey = aracBrandKey(subtype, b.slug);
          const bOpen = openIds.has(bKey);
          const bCount = facets?.brands[`arac:${subtype}:${b.slug}`] || 0;
          return (
            <FragmentBrand
              key={bKey}
              subtype={subtype}
              brand={b}
              brandIndex={bi}
              open={bOpen}
              config={config}
              facets={facets}
              busyKey={busyKey}
              count={bCount}
              onToggle={() => onToggleChild(bKey)}
              onPatch={onPatch}
              onEdit={onEdit}
            />
          );
        })}
    </>
  );
}

function FragmentBrand({
  subtype,
  brand,
  brandIndex,
  open,
  config,
  facets,
  busyKey,
  count,
  onToggle,
  onPatch,
  onEdit,
}: {
  subtype: string;
  brand: { slug: string; name: string; models: Array<{ slug: string; name: string }> };
  brandIndex: number;
  open: boolean;
  config: BrowseNavConfig;
  facets: FacetCounts | null;
  busyKey: string | null;
  count: number;
  onToggle: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onEdit: (t: EditTarget) => void;
}) {
  const bKey = aracBrandKey(subtype, brand.slug);
  const bSort = sortOrderFor(config, bKey, brandIndex);
  const bActive = isNodeActive(config, bKey);
  return (
    <>
      <TreeRow
        name={displayNameFor(config, bKey, brand.name)}
        count={count}
        depth={1}
        expandable={brand.models.length > 0}
        open={open}
        onToggle={onToggle}
        sortValue={bSort}
        onSortBlur={(v) => onPatch({ nodeKey: bKey, sortOrder: v })}
        active={bActive}
        onActiveChange={(v) => onPatch({ nodeKey: bKey, active: v })}
        saving={busyKey === bKey}
        onEdit={() =>
          onEdit({
            nodeKey: bKey,
            defaultName: brand.name,
            sortValue: bSort,
            active: bActive,
          })
        }
      />
      {open &&
        brand.models.map((m, mi) => {
          const mKey = aracModelKey(subtype, brand.slug, m.slug);
          const mCount = facets?.models[`arac:${subtype}:${brand.slug}:${m.slug}`] || 0;
          const mSort = sortOrderFor(config, mKey, mi);
          const mActive = isNodeActive(config, mKey);
          return (
            <TreeRow
              key={mKey}
              name={displayNameFor(config, mKey, m.name)}
              count={mCount}
              depth={2}
              sortValue={mSort}
              onSortBlur={(v) => onPatch({ nodeKey: mKey, sortOrder: v })}
              active={mActive}
              onActiveChange={(v) => onPatch({ nodeKey: mKey, active: v })}
              saving={busyKey === mKey}
              onEdit={() =>
                onEdit({
                  nodeKey: mKey,
                  defaultName: m.name,
                  sortValue: mSort,
                  active: mActive,
                })
              }
            />
          );
        })}
    </>
  );
}

function AlisverisGroupBranch({
  groupId,
  name,
  catalogName,
  count,
  open,
  openIds,
  subSlugs,
  catBySlug,
  facets,
  config,
  sort,
  active,
  busyKey,
  onToggle,
  onToggleChild,
  onToggleCategory,
  onPatch,
  onEdit,
}: {
  groupId: string;
  name: string;
  catalogName: string;
  count: number;
  open: boolean;
  openIds: Set<string>;
  subSlugs: string[];
  catBySlug: Map<string, CatRow>;
  facets: FacetCounts | null;
  config: BrowseNavConfig;
  sort: number;
  active: boolean;
  busyKey: string | null;
  onToggle: () => void;
  onToggleChild: (id: string) => void;
  onToggleCategory: (c: CatRow, isActive: boolean) => void;
  onPatch: (body: Record<string, unknown>) => void;
  onEdit: (t: EditTarget) => void;
}) {
  const groupKey = `shop/${groupId}`;
  return (
    <>
      <TreeRow
        name={name}
        count={count}
        depth={0}
        expandable
        open={open}
        onToggle={onToggle}
        sortValue={sort}
        onSortBlur={(v) => onPatch({ nodeKey: groupKey, sortOrder: v })}
        active={active}
        onActiveChange={(v) => {
          for (const sub of subSlugs) {
            for (const root of ["ikinci-el", "sifir-urun"] as const) {
              const c = catBySlug.get(childSlug(root, sub));
              if (c) onToggleCategory(c, v);
            }
          }
          onPatch({ nodeKey: groupKey, active: v });
        }}
        saving={busyKey != null && subSlugs.some((s) => {
          const a = catBySlug.get(childSlug("ikinci-el", s));
          const b = catBySlug.get(childSlug("sifir-urun", s));
          return (a && busyKey === a.id) || (b && busyKey === b.id) || busyKey === groupKey;
        })}
        onEdit={() =>
          onEdit({
            nodeKey: groupKey,
            defaultName: catalogName,
            sortValue: sort,
            active,
          })
        }
      />
      {open &&
        subSlugs.map((sub, si) => {
          const meta = SHOP_SUBCATEGORIES.find((s) => s.slug === sub);
          const subKey = `shop/${groupId}/${sub}`;
          const subOpen = openIds.has(subKey);
          const leaves = (["ikinci-el", "sifir-urun"] as const)
            .map((root) => catBySlug.get(childSlug(root, sub)))
            .filter(Boolean) as CatRow[];
          const subCount = leaves.reduce((s, c) => s + (c.listingCount || 0), 0) ||
            (facets?.categories[`ikinci-el-${sub}`] || 0) + (facets?.categories[`sifir-urun-${sub}`] || 0);
          const subActive = leaves.length ? leaves.some((c) => c.isActive) : isNodeActive(config, subKey);
          const subSort = sortOrderFor(config, subKey, si);
          const catalogSubName = meta?.name || sub;
          return (
            <Fragment key={subKey}>
              <TreeRow
                name={displayNameFor(config, subKey, catalogSubName)}
                count={subCount}
                depth={1}
                expandable={leaves.length > 0}
                open={subOpen}
                onToggle={() => onToggleChild(subKey)}
                sortValue={subSort}
                onSortBlur={(v) => onPatch({ nodeKey: subKey, sortOrder: v })}
                active={subActive}
                onActiveChange={(v) => {
                  for (const c of leaves) onToggleCategory(c, v);
                  onPatch({ nodeKey: subKey, active: v });
                }}
                saving={leaves.some((c) => busyKey === c.id) || busyKey === subKey}
                onEdit={() =>
                  onEdit({
                    nodeKey: subKey,
                    defaultName: catalogSubName,
                    sortValue: subSort,
                    active: subActive,
                  })
                }
              />
              {subOpen &&
                leaves.map((c) => {
                  const leafKey = `shop/leaf/${c.slug}`;
                  const leafSort = sortOrderFor(config, leafKey, c.sortOrder);
                  const leafName = displayNameFor(config, leafKey, c.name);
                  return (
                    <TreeRow
                      key={c.id}
                      name={leafName}
                      count={c.listingCount || facets?.categories[c.slug] || 0}
                      depth={2}
                      sortValue={leafSort}
                      onSortBlur={(v) => onPatch({ nodeKey: leafKey, sortOrder: v })}
                      active={c.isActive}
                      onActiveChange={(v) => onToggleCategory(c, v)}
                      saving={busyKey === c.id || busyKey === leafKey}
                      onEdit={() =>
                        onEdit({
                          nodeKey: leafKey,
                          defaultName: c.name,
                          sortValue: leafSort,
                          active: c.isActive,
                          categoryId: c.id,
                          categorySlug: c.slug,
                          categoryIcon: c.icon,
                        })
                      }
                    />
                  );
                })}
            </Fragment>
          );
        })}
    </>
  );
}

function PremiumBranch({
  root,
  count,
  open,
  openIds,
  config,
  catBySlug,
  facets,
  busyKey,
  sort,
  active,
  onToggle,
  onToggleChild,
  onPatch,
  onToggleCategory,
  onEdit,
}: {
  root: (typeof PREMIUM_CATEGORY_SEEDS)[number];
  count: number;
  open: boolean;
  openIds: Set<string>;
  config: BrowseNavConfig;
  catBySlug: Map<string, CatRow>;
  facets: FacetCounts | null;
  busyKey: string | null;
  sort: number;
  active: boolean;
  onToggle: () => void;
  onToggleChild: (id: string) => void;
  onPatch: (body: Record<string, unknown>) => void;
  onToggleCategory: (c: CatRow, isActive: boolean) => void;
  onEdit: (t: EditTarget) => void;
}) {
  const key = premiumNodeKey(root.vertical);
  const rootCat = catBySlug.get(root.slug);

  return (
    <>
      <TreeRow
        name={displayNameFor(config, key, root.name)}
        count={count}
        depth={0}
        expandable={root.children.length > 0}
        open={open}
        onToggle={onToggle}
        sortValue={sort}
        onSortBlur={(v) => onPatch({ nodeKey: key, sortOrder: v })}
        active={active}
        onActiveChange={(v) => {
          onPatch({ nodeKey: key, active: v });
          if (rootCat) onToggleCategory(rootCat, v);
        }}
        saving={busyKey === key || busyKey === rootCat?.id}
        onEdit={() =>
          onEdit({
            nodeKey: key,
            defaultName: root.name,
            sortValue: sort,
            active,
            categoryId: rootCat?.id,
            categorySlug: rootCat?.slug,
            categoryIcon: rootCat?.icon,
          })
        }
      />
      {open &&
        root.children.map((c, ci) => {
          const cKey = premiumNodeKey(root.vertical, c.slug);
          const slug = childPremiumSlug(root.slug, c.slug);
          const db = catBySlug.get(slug);
          const cCount = db?.listingCount || facets?.categories[slug] || 0;
          const cSort = sortOrderFor(config, cKey, ci);
          const cActive = isNodeActive(config, cKey) && (db ? db.isActive : true);
          return (
            <TreeRow
              key={cKey}
              name={displayNameFor(config, cKey, c.name)}
              count={cCount}
              depth={1}
              sortValue={cSort}
              onSortBlur={(v) => onPatch({ nodeKey: cKey, sortOrder: v })}
              active={cActive}
              onActiveChange={(v) => {
                onPatch({ nodeKey: cKey, active: v });
                if (db) onToggleCategory(db, v);
              }}
              saving={busyKey === cKey || busyKey === db?.id}
              onEdit={() =>
                onEdit({
                  nodeKey: cKey,
                  defaultName: c.name,
                  sortValue: cSort,
                  active: cActive,
                  categoryId: db?.id,
                  categorySlug: db?.slug,
                  categoryIcon: db?.icon,
                })
              }
            />
          );
        })}
    </>
  );
}
