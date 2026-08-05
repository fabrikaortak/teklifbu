"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type Cat = { id: string; name: string; slug: string };
type Model = { id: string; name: string; brand?: { name: string } };
type Link = {
  categoryId: string;
  modelId: string;
  sortOrder: number;
  model: Model & { brand?: { name: string } };
};

export function AdminCategoryModelsPanel() {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [modelId, setModelId] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [msg, setMsg] = useState("");

  const loadMeta = useCallback(async () => {
    const [cRes, mRes] = await Promise.all([
      fetch("/api/admin/catalog/category-models"),
      fetch("/api/admin/catalog/models"),
    ]);
    const cData = await cRes.json();
    const mData = await mRes.json();
    if (cData.ok) setCategories(cData.categories || []);
    if (mData.ok) setModels(mData.models || []);
  }, []);

  const loadLinks = useCallback(async () => {
    if (!categoryId) {
      setLinks([]);
      return;
    }
    const res = await fetch(`/api/admin/catalog/category-models?categoryId=${encodeURIComponent(categoryId)}`);
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
    const res = await fetch("/api/admin/catalog/category-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, modelId, sortOrder: links.length }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMsg(data.error || "Hata");
      return;
    }
    setMsg("Model kategoriye bağlandı");
    await loadLinks();
  }

  async function remove(id: string) {
    await fetch("/api/admin/catalog/category-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", categoryId, modelId: id }),
    });
    await loadLinks();
  }

  return (
    <div className="adm-panel" style={{ display: "grid", gap: 16 }}>
      <AdminToast message={msg} onClose={() => setMsg("")} />
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Kategori modelleri</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Marka modellerini alışveriş kategorilerine bağlayın.</p>
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

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1.6fr auto", maxWidth: 640, alignItems: "end" }}>
        <select className="select" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!categoryId}>
          <option value="">Model seçin</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {(m.brand?.name ? `${m.brand.name} · ` : "") + m.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" disabled={!categoryId || !modelId} onClick={() => void bind()}>
          Bağla
        </button>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {links.map((l) => (
          <li
            key={`${l.categoryId}-${l.modelId}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <span>
              <strong>{l.model.name}</strong>
              {l.model.brand?.name ? (
                <span style={{ color: "#64748b", marginLeft: 8 }}>{l.model.brand.name}</span>
              ) : null}
            </span>
            <button type="button" className="btn" onClick={() => void remove(l.modelId)}>
              Kaldır
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
