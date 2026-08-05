"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

const TYPES = [
  "TEXT",
  "NUMBER",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
  "COLOR",
  "DATE",
  "RANGE",
] as const;

type Option = { id: string; label: string; value: string; colorCode: string | null; sortOrder: number };
type Attr = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  options: Option[];
  _count?: { categoryAttributes: number };
};

export function AdminAttributesPanel() {
  const [rows, setRows] = useState<Attr[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("SINGLE_SELECT");
  const [selectedId, setSelectedId] = useState("");
  const [optLabel, setOptLabel] = useState("");
  const [optColor, setOptColor] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/catalog/attributes");
    const data = await res.json();
    if (data.ok) setRows(data.attributes || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) || null;

  async function create() {
    const res = await fetch("/api/admin/catalog/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMsg(data.error || "Hata");
      return;
    }
    setName("");
    setMsg("Özellik eklendi");
    await load();
  }

  async function addOption() {
    if (!selectedId || !optLabel.trim()) return;
    const res = await fetch("/api/admin/catalog/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "option-create",
        attributeId: selectedId,
        label: optLabel,
        colorCode: optColor || null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMsg(data.error || "Hata");
      return;
    }
    setOptLabel("");
    setOptColor("");
    await load();
  }

  async function removeAttr(id: string) {
    if (!confirm("Özellik soft-delete?")) return;
    await fetch(`/api/admin/catalog/attributes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId("");
    await load();
  }

  return (
    <div className="adm-panel" style={{ display: "grid", gap: 16 }}>
      <AdminToast message={msg} onClose={() => setMsg("")} />
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Özellik yönetimi</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Dinamik filtre / form alanları. Kategori bağlama ayrı ekranda.
        </p>
      </header>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1.4fr 1fr auto", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Özellik adı</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Depolama" />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Tip</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => void create()}>
          Ekle
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 10, maxHeight: 480 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: 10 }}>Ad</th>
                <th style={{ padding: 10 }}>Tip</th>
                <th style={{ padding: 10 }}>Seçenek</th>
                <th style={{ padding: 10 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    borderTop: "1px solid #e2e8f0",
                    background: selectedId === a.id ? "#eff6ff" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedId(a.id)}
                >
                  <td style={{ padding: 10, fontWeight: 700 }}>{a.name}</td>
                  <td style={{ padding: 10 }}>{a.type}</td>
                  <td style={{ padding: 10 }}>{a.options?.length || 0}</td>
                  <td style={{ padding: 10 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeAttr(a.id);
                      }}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}>
          <strong>{selected ? selected.name : "Seçenekler"}</strong>
          {!selected ? (
            <span style={{ color: "#94a3b8", fontSize: 13 }}>Soldan özellik seçin</span>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto auto", alignItems: "end" }}>
                <input
                  className="input"
                  value={optLabel}
                  onChange={(e) => setOptLabel(e.target.value)}
                  placeholder="128 GB"
                />
                <input
                  className="input"
                  style={{ width: 100 }}
                  value={optColor}
                  onChange={(e) => setOptColor(e.target.value)}
                  placeholder="#000"
                />
                <button type="button" className="btn btn-primary" onClick={() => void addOption()}>
                  Seçenek
                </button>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {(selected.options || []).map((o) => (
                  <li key={o.id}>
                    {o.label}
                    {o.colorCode ? (
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: 99,
                          background: o.colorCode,
                          marginLeft: 6,
                          verticalAlign: "middle",
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
