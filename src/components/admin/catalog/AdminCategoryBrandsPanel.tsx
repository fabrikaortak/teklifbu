"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type Cat = { id: string; name: string; slug: string };
type Brand = { id: string; name: string; slug: string };
type Link = {
  categoryId: string;
  brandId: string;
  sortOrder: number;
  isFeatured: boolean;
  brand: Brand;
};

export function AdminCategoryBrandsPanel() {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [featured, setFeatured] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [msg, setMsg] = useState("");

  const loadMeta = useCallback(async () => {
    const [cRes, bRes] = await Promise.all([
      fetch("/api/admin/catalog/category-brands"),
      fetch("/api/admin/catalog/brands"),
    ]);
    const cData = await cRes.json();
    const bData = await bRes.json();
    if (cData.ok) setCategories(cData.categories || []);
    if (bData.ok) setBrands((bData.brands || []).filter((b: Brand & { isActive?: boolean }) => b.isActive !== false));
  }, []);

  const loadLinks = useCallback(async () => {
    if (!categoryId) {
      setLinks([]);
      return;
    }
    const res = await fetch(`/api/admin/catalog/category-brands?categoryId=${encodeURIComponent(categoryId)}`);
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
    const res = await fetch("/api/admin/catalog/category-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, brandId, isFeatured: featured, sortOrder: links.length }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMsg(data.error || "Hata");
      return;
    }
    setMsg("Marka kategoriye bağlandı");
    await loadLinks();
  }

  async function remove(brandIdToRemove: string) {
    await fetch("/api/admin/catalog/category-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", categoryId, brandId: brandIdToRemove }),
    });
    await loadLinks();
  }

  return (
    <div className="adm-panel" style={{ display: "grid", gap: 16 }}>
      <AdminToast message={msg} onClose={() => setMsg("")} />
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Kategori markaları</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Alışveriş leaf kategorilerine marka bağlama / öne çıkarma.
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

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1.4fr auto auto", alignItems: "end", maxWidth: 720 }}>
        <select className="select" value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={!categoryId}>
          <option value="">Marka seçin</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Öne çıkan
        </label>
        <button type="button" className="btn btn-primary" disabled={!categoryId || !brandId} onClick={() => void bind()}>
          Bağla
        </button>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {links.map((l) => (
          <li
            key={`${l.categoryId}-${l.brandId}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <span>
              <strong>{l.brand.name}</strong>
              {l.isFeatured ? (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309" }}>öne çıkan</span>
              ) : null}
            </span>
            <button type="button" className="btn" onClick={() => void remove(l.brandId)}>
              Kaldır
            </button>
          </li>
        ))}
        {categoryId && !links.length ? (
          <li style={{ color: "#94a3b8", fontSize: 13 }}>Bu kategoride bağlı marka yok.</li>
        ) : null}
      </ul>
    </div>
  );
}
