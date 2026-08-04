"use client";

import { useEffect, useState } from "react";
import {
  type CommercialBusinessType,
  normalizeCommercialBusinessTypes,
  slugifyBusinessTypeKey,
} from "@/lib/commercialBusinessTypes";

type Props = {
  value: unknown;
  onChange: (next: CommercialBusinessType[]) => void;
};

export function BusinessTypesEditor({ value, onChange }: Props) {
  const rows = normalizeCommercialBusinessTypes(value);
  const [labelDraft, setLabelDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");

  useEffect(() => {
    if (!labelDraft.trim()) {
      setKeyDraft("");
      return;
    }
    setKeyDraft(slugifyBusinessTypeKey(labelDraft));
  }, [labelDraft]);

  function patch(index: number, partial: Partial<CommercialBusinessType>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...partial } : r));
    onChange(normalizeCommercialBusinessTypes(next));
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    onChange(normalizeCommercialBusinessTypes(next.map((r, i) => ({ ...r, sortOrder: i }))));
  }

  function remove(index: number) {
    onChange(normalizeCommercialBusinessTypes(rows.filter((_, i) => i !== index)));
  }

  function add() {
    const label = labelDraft.trim();
    if (!label) return;
    let key = (keyDraft || slugifyBusinessTypeKey(label)).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!key) return;
    const existing = new Set(rows.map((r) => r.key));
    if (existing.has(key)) {
      let n = 2;
      while (existing.has(`${key}_${n}`)) n++;
      key = `${key}_${n}`;
    }
    onChange(
      normalizeCommercialBusinessTypes([
        ...rows,
        { key, label, active: true, sortOrder: rows.length },
      ])
    );
    setLabelDraft("");
    setKeyDraft("");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
        Aktif tipler üye ol formunda ve Kullanıcılar → Kurumsal alt sekmelerinde görünür. Anahtar bir kez
        kaydedildikten sonra değiştirilmemeli (mevcut üyeler bu anahtara bağlıdır).
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto",
              gap: 8,
              alignItems: "center",
              padding: "8px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: row.active ? "#fff" : "#f8fafc",
            }}
          >
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={row.active}
                onChange={(e) => patch(i, { active: e.target.checked })}
              />
              Aktif
            </label>
            <div style={{ display: "grid", gap: 4 }}>
              <input
                className="input"
                value={row.label}
                onChange={(e) => patch(i, { label: e.target.value })}
                placeholder="Görünen ad"
              />
              <code style={{ fontSize: 11, color: "#64748b" }}>{row.key}</code>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" className="btn-outline" style={{ padding: "6px 8px" }} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="btn-outline" style={{ padding: "6px 8px" }} onClick={() => move(i, 1)}>
                ↓
              </button>
            </div>
            <button
              type="button"
              className="btn-outline"
              style={{ padding: "6px 10px", color: "#b91c1c", borderColor: "#fecaca" }}
              onClick={() => remove(i)}
            >
              Sil
            </button>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 8,
          alignItems: "end",
          paddingTop: 4,
          borderTop: "1px dashed #e2e8f0",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Yeni tip adı
          <input
            className="input"
            placeholder="Örn. Otel Zinciri"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Anahtar
          <input
            className="input"
            value={keyDraft}
            onChange={(e) =>
              setKeyDraft(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9_]/g, "_")
              )
            }
            placeholder="OTEL_ZINCIRI"
          />
        </label>
        <button type="button" className="btn-orange" style={{ padding: "10px 14px" }} onClick={add}>
          Ekle
        </button>
      </div>
    </div>
  );
}
