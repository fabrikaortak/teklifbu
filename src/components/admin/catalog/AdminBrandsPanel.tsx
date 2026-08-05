"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type Brand = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { categoryBrands: number; models: number };
};

export function AdminBrandsPanel() {
  const [rows, setRows] = useState<Brand[]>([]);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/catalog/brands?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.ok) setRows(data.brands || []);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/catalog/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined, logo: logo || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Kayıt başarısız");
      setName("");
      setSlug("");
      setLogo("");
      setMsg("Marka eklendi");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Brand) {
    await fetch("/api/admin/catalog/brands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, isActive: !b.isActive }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Marka pasife alınıp soft-delete edilsin mi?")) return;
    await fetch(`/api/admin/catalog/brands?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="adm-panel" style={{ display: "grid", gap: 16 }}>
      <AdminToast message={msg} onClose={() => setMsg("")} />
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Marka yönetimi</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Katalog markaları (Listing formuna henüz bağlı değil). Soft delete kullanılır.
        </p>
      </header>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1.4fr 1fr 1.2fr auto", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Ad</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Samsung" />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Slug (ops.)</span>
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="samsung" />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Logo URL</span>
          <input className="input" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
        </label>
        <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void create()}>
          Ekle
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara…"
        />
        <button type="button" className="btn" onClick={() => void load()}>
          Yenile
        </button>
      </div>

      <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: 10 }}>Marka</th>
              <th style={{ padding: 10 }}>Slug</th>
              <th style={{ padding: 10 }}>Model</th>
              <th style={{ padding: 10 }}>Kategori</th>
              <th style={{ padding: 10 }}>Durum</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: 10, fontWeight: 700 }}>{b.name}</td>
                <td style={{ padding: 10, color: "#64748b" }}>{b.slug}</td>
                <td style={{ padding: 10 }}>{b._count?.models ?? 0}</td>
                <td style={{ padding: 10 }}>{b._count?.categoryBrands ?? 0}</td>
                <td style={{ padding: 10 }}>{b.isActive ? "Aktif" : "Pasif"}</td>
                <td style={{ padding: 10, display: "flex", gap: 6 }}>
                  <button type="button" className="btn" onClick={() => void toggle(b)}>
                    {b.isActive ? "Pasifleştir" : "Aktifleştir"}
                  </button>
                  <button type="button" className="btn" onClick={() => void remove(b.id)}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: "#94a3b8" }}>
                  Henüz marka yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
