"use client";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  mainImage: string | null;
  brand?: { name: string } | null;
  model?: { name: string } | null;
  categoryPath?: string;
  variantCount?: number;
};

export function AdminCatalogProductsPanel() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/catalog/products?q=${encodeURIComponent(q)}&limit=50`)
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }, [q]);

  useEffect(() => {
    load();
    fetch("/api/admin/catalog/brands")
      .then(() => {})
      .catch(() => {});
    fetch("/api/catalog/tree?root=ikinci-el")
      .then((r) => r.json())
      .then((d) => {
        const flat: Array<{ id: string; slug: string; name: string }> = [];
        function walk(nodes: Array<{ id: string; slug: string; name: string; children?: unknown[] }>) {
          for (const n of nodes || []) {
            flat.push({ id: n.id, slug: n.slug, name: n.name });
            if (n.children) walk(n.children as typeof nodes);
          }
        }
        walk(d.tree?.[0]?.children || []);
        setCategories(flat.filter((c) => c.slug.includes("cep-telefonu") || c.slug.includes("__") || c.slug.includes("beyaz")));
      })
      .catch(() => {});
  }, [load]);

  async function createProduct() {
    setMsg("");
    const res = await fetch("/api/admin/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, categoryId, status: "ACTIVE" }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(d.error || "Oluşturulamadı");
      return;
    }
    setName("");
    setMsg("Ürün eklendi");
    load();
  }

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Katalog ürünleri</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="msf-input"
          placeholder="Ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <button type="button" className="btn-orange" onClick={load}>
          Ara
        </button>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 8 }}>
        <strong>Yeni ürün (admin)</strong>
        <select className="msf-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
        <input
          className="msf-input"
          placeholder="Kanonik ad — örn. Apple iPhone 15 Pro 256 GB"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn-orange" disabled={!name || !categoryId} onClick={createProduct}>
          Product oluştur
        </button>
        {msg ? <span style={{ color: "var(--muted)", fontSize: 13 }}>{msg}</span> : null}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {products.map((p) => (
          <div key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
            <strong>{p.name}</strong>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {[p.brand?.name, p.model?.name, p.categoryPath, p.barcode].filter(Boolean).join(" · ")}
              {typeof p.variantCount === "number" ? ` · ${p.variantCount} varyant` : ""}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <code style={{ fontSize: 11 }}>{p.id}</code>
              <a href={`/urun/${p.id}`} style={{ fontSize: 13, color: "#ea580c" }}>
                Vitrin
              </a>
              <button
                type="button"
                style={{ fontSize: 12 }}
                onClick={async () => {
                  const title = window.prompt("Varyant başlığı (örn. 256 GB / Beden M):");
                  if (!title) return;
                  const res = await fetch("/api/admin/catalog/products/variants", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productId: p.id, title, values: [] }),
                  });
                  const d = await res.json().catch(() => ({}));
                  setMsg(res.ok ? "Varyant eklendi" : d.error || "Varyant eklenemedi");
                  load();
                }}
              >
                + Varyant
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
