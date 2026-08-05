"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type Cat = { id: string; name: string; slug: string };
type Attr = { id: string; name: string; type: string };
type Link = {
  categoryId: string;
  attributeId: string;
  required: boolean;
  filterable: boolean;
  formVisible: boolean;
  detailVisible: boolean;
  comparisonVisible: boolean;
  searchable: boolean;
  isVariant: boolean;
  unit: string | null;
  sortOrder: number;
  attribute: Attr;
};

const FLAGS: Array<{ key: keyof Link; label: string }> = [
  { key: "required", label: "Zorunlu" },
  { key: "filterable", label: "Filtre" },
  { key: "formVisible", label: "Form" },
  { key: "detailVisible", label: "Detay" },
  { key: "comparisonVisible", label: "Karşılaştırma" },
  { key: "searchable", label: "Arama" },
  { key: "isVariant", label: "Varyant" },
];

export function AdminCategoryAttributesPanel() {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [attributeId, setAttributeId] = useState("");
  const [flags, setFlags] = useState<Record<string, boolean>>({
    required: false,
    filterable: true,
    formVisible: true,
    detailVisible: true,
    comparisonVisible: false,
    searchable: false,
    isVariant: false,
  });
  const [unit, setUnit] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [msg, setMsg] = useState("");

  const loadMeta = useCallback(async () => {
    const [cRes, aRes] = await Promise.all([
      fetch("/api/admin/catalog/category-attributes"),
      fetch("/api/admin/catalog/attributes"),
    ]);
    const cData = await cRes.json();
    const aData = await aRes.json();
    if (cData.ok) setCategories(cData.categories || []);
    if (aData.ok) {
      setAttrs((aData.attributes || []).map((a: Attr) => ({ id: a.id, name: a.name, type: a.type })));
    }
  }, []);

  const loadLinks = useCallback(async () => {
    if (!categoryId) {
      setLinks([]);
      return;
    }
    const res = await fetch(
      `/api/admin/catalog/category-attributes?categoryId=${encodeURIComponent(categoryId)}`
    );
    const data = await res.json();
    if (data.ok) setLinks(data.links || []);
  }, [categoryId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  async function bind() {
    const res = await fetch("/api/admin/catalog/category-attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        attributeId,
        unit: unit || null,
        sortOrder: links.length,
        ...flags,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMsg(data.error || "Hata");
      return;
    }
    setMsg("Özellik kategoriye bağlandı");
    await loadLinks();
  }

  async function remove(attrId: string) {
    await fetch("/api/admin/catalog/category-attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", categoryId, attributeId: attrId }),
    });
    await loadLinks();
  }

  return (
    <div className="adm-panel" style={{ display: "grid", gap: 16 }}>
      <AdminToast message={msg} onClose={() => setMsg("")} />
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Kategori özellikleri</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Zorunlu / filtre / form / varyant bayrakları.
        </p>
      </header>

      <label style={{ display: "grid", gap: 4, maxWidth: 420 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Kategori</span>
        <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Seçin</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
        <select
          className="select"
          value={attributeId}
          onChange={(e) => setAttributeId(e.target.value)}
          disabled={!categoryId}
        >
          <option value="">Özellik seçin</option>
          {attrs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.type}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {FLAGS.map((f) => (
            <label key={f.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
              <input
                type="checkbox"
                checked={Boolean(flags[f.key])}
                onChange={(e) => setFlags((prev) => ({ ...prev, [f.key]: e.target.checked }))}
              />
              {f.label}
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Birim (GB, cm…)" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!categoryId || !attributeId}
            onClick={() => void bind()}
          >
            Bağla / Güncelle
          </button>
        </div>
      </div>

      <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Özellik</th>
              <th style={{ padding: 8 }}>Bayraklar</th>
              <th style={{ padding: 8 }}>Birim</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={`${l.categoryId}-${l.attributeId}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: 8, fontWeight: 700 }}>
                  {l.attribute.name}
                  <div style={{ color: "#94a3b8", fontWeight: 500 }}>{l.attribute.type}</div>
                </td>
                <td style={{ padding: 8 }}>
                  {FLAGS.filter((f) => Boolean(l[f.key])).map((f) => f.label).join(" · ") || "—"}
                </td>
                <td style={{ padding: 8 }}>{l.unit || "—"}</td>
                <td style={{ padding: 8 }}>
                  <button type="button" className="btn" onClick={() => void remove(l.attributeId)}>
                    Kaldır
                  </button>
                </td>
              </tr>
            ))}
            {categoryId && !links.length ? (
              <tr>
                <td colSpan={4} style={{ padding: 14, color: "#94a3b8" }}>
                  Bağlı özellik yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
