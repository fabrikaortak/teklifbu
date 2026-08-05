"use client";

import { useEffect, useState } from "react";

export function AdminCatalogDuplicatesPanel() {
  const [data, setData] = useState<{
    barcodeConflicts: Array<{ barcode: string; products: Array<{ id: string; name: string }> }>;
    nameDuplicates: Array<{ key: string; products: Array<{ id: string; name: string }> }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/catalog/duplicates")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="card" style={{ padding: 16 }}>Yükleniyor…</div>;

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Duplicate / barkod çakışması</h2>
      <section>
        <h3 style={{ fontSize: 15 }}>Barkod çakışmaları</h3>
        {data.barcodeConflicts.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Yok</p>
        ) : (
          data.barcodeConflicts.map((g) => (
            <div key={g.barcode} style={{ marginBottom: 8 }}>
              <strong>{g.barcode}</strong>
              <ul>
                {g.products.map((p) => (
                  <li key={p.id}>
                    {p.name} <code>{p.id}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <section>
        <h3 style={{ fontSize: 15 }}>Benzer ad / marka-model</h3>
        {data.nameDuplicates.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Yok</p>
        ) : (
          data.nameDuplicates.slice(0, 30).map((g) => (
            <div key={g.key} style={{ marginBottom: 8 }}>
              <ul>
                {g.products.map((p) => (
                  <li key={p.id}>
                    {p.name} <code>{p.id}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
