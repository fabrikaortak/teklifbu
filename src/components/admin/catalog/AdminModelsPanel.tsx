"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type Brand = { id: string; name: string };
type Model = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  isActive: boolean;
  brand?: Brand;
  _count?: { categoryModels: number };
};

export function AdminModelsPanel() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rows, setRows] = useState<Model[]>([]);
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const loadBrands = useCallback(async () => {
    const res = await fetch("/api/admin/catalog/brands");
    const data = await res.json();
    if (data.ok) setBrands((data.brands || []).map((b: Brand & { id: string; name: string }) => ({ id: b.id, name: b.name })));
  }, []);

  const load = useCallback(async () => {
    const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
    const res = await fetch(`/api/admin/catalog/models${qs}`);
    const data = await res.json();
    if (data.ok) setRows(data.models || []);
  }, [brandId]);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const res = await fetch("/api/admin/catalog/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, name }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMsg(data.error || "Hata");
      return;
    }
    setName("");
    setMsg("Model eklendi");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Model soft-delete edilsin mi?")) return;
    await fetch(`/api/admin/catalog/models?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="adm-panel" style={{ display: "grid", gap: 16 }}>
      <AdminToast message={msg} onClose={() => setMsg("")} />
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Model yönetimi</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Markaya bağlı ürün modelleri.</p>
      </header>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1.4fr auto", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Marka</span>
          <select className="select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Tümü / seçin</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Model adı</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="iPhone 15 Pro" />
        </label>
        <button type="button" className="btn btn-primary" disabled={!brandId || !name.trim()} onClick={() => void create()}>
          Ekle
        </button>
      </div>

      <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: 10 }}>Marka</th>
              <th style={{ padding: 10 }}>Model</th>
              <th style={{ padding: 10 }}>Slug</th>
              <th style={{ padding: 10 }}>Kategori bağ</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: 10 }}>{m.brand?.name || "—"}</td>
                <td style={{ padding: 10, fontWeight: 700 }}>{m.name}</td>
                <td style={{ padding: 10, color: "#64748b" }}>{m.slug}</td>
                <td style={{ padding: 10 }}>{m._count?.categoryModels ?? 0}</td>
                <td style={{ padding: 10 }}>
                  <button type="button" className="btn" onClick={() => void remove(m.id)}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "#94a3b8" }}>
                  Model yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
