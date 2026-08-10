"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMMERCIAL_ENTRY_PATH_OPTIONS,
  COMMERCIAL_LISTING_FORM_OPTIONS,
  COMMERCIAL_VERTICAL_ROOT_OPTIONS,
  defaultCommercialPublishMap,
  type CommercialPublishMap,
  type CommercialPublishMapRow,
  type CommercialListingFormKind,
} from "@/lib/commercialPublishMap";
import type { ShopFocusRoot } from "@/data/shopFocus";
import type { CommercialBusinessType } from "@/lib/commercialBusinessTypes";
import { shopFocusSubsFor } from "@/data/shopFocus";

export function AdminCommercialPublishMapPanel() {
  const [map, setMap] = useState<CommercialPublishMap>(defaultCommercialPublishMap());
  const [types, setTypes] = useState<CommercialBusinessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin?view=commercial-publish-map");
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        if (d.map) setMap(d.map);
        if (Array.isArray(d.businessTypes)) setTypes(d.businessTypes);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const byKey = new Map(map.rows.map((r) => [r.subtypeKey, r]));
    const keys = types.length
      ? types.map((t) => t.key)
      : map.rows.map((r) => r.subtypeKey);
    return keys.map((key) => {
      const t = types.find((x) => x.key === key);
      const row =
        byKey.get(key) ||
        defaultCommercialPublishMap().rows.find((r) => r.subtypeKey === key) ||
        ({
          subtypeKey: key,
          verticalRoot: "emlak",
          listingForm: "genel",
          entryPath: "/ilan-ver?kind=genel",
          defaultSub: "diger",
          enabled: true,
        } as CommercialPublishMapRow);
      return { ...row, label: t?.label || key, typeActive: t?.active !== false };
    });
  }, [map, types]);

  function patchRow(subtypeKey: string, patch: Partial<CommercialPublishMapRow>) {
    setMap((prev) => {
      const exists = prev.rows.some((r) => r.subtypeKey === subtypeKey);
      const rows = exists
        ? prev.rows.map((r) => (r.subtypeKey === subtypeKey ? { ...r, ...patch } : r))
        : [
            ...prev.rows,
            {
              subtypeKey,
              verticalRoot: "emlak" as ShopFocusRoot,
              listingForm: "genel" as CommercialListingFormKind,
              entryPath: "/ilan-ver?kind=genel",
              defaultSub: "diger",
              enabled: true,
              ...patch,
            },
          ];
      return { rows };
    });
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-commercial-publish-map", map }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || "Kayıt başarısız");
      return;
    }
    if (d.map) setMap(d.map);
    setMsg("Kaydedildi");
  }

  if (loading) {
    return <div className="adm-card" style={{ padding: 18 }}>Yükleniyor…</div>;
  }

  return (
    <div className="adm-card" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          Faaliyet → kategori / ilan formu
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Müşteri kayıtta yalnız faaliyet seçer. Hangi faaliyetin hangi mağaza kategorisine ve hangi
          ilan formuna gideceğini buradan belirlersiniz. Yeni form eklenince satırı güncellemeniz
          yeter.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => {
          const subs = shopFocusSubsFor(row.verticalRoot);
          return (
            <div
              key={row.subtypeKey}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                background: row.enabled ? "#fff" : "#f8fafc",
                opacity: row.typeActive === false ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Kod: <code>{row.subtypeKey}</code>
                    {row.typeActive === false ? " · tip pasif" : ""}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => patchRow(row.subtypeKey, { enabled: e.target.checked })}
                  />
                  Eşleme aktif
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 10,
                }}
              >
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                  Mağaza kategorisi (dikey)
                  <select
                    className="select"
                    value={row.verticalRoot}
                    onChange={(e) =>
                      patchRow(row.subtypeKey, {
                        verticalRoot: e.target.value as ShopFocusRoot,
                        defaultSub: shopFocusSubsFor(e.target.value as ShopFocusRoot)[0]?.id || "diger",
                      })
                    }
                  >
                    {COMMERCIAL_VERTICAL_ROOT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontWeight: 500, color: "#94a3b8", fontSize: 11 }}>
                    Emlak / Vasıta / Alışveriş / Premium
                  </span>
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                  İlan formu
                  <select
                    className="select"
                    value={row.listingForm}
                    onChange={(e) =>
                      patchRow(row.subtypeKey, {
                        listingForm: e.target.value as CommercialListingFormKind,
                      })
                    }
                  >
                    {COMMERCIAL_LISTING_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontWeight: 500, color: "#94a3b8", fontSize: 11 }}>
                    {COMMERCIAL_LISTING_FORM_OPTIONS.find((o) => o.value === row.listingForm)?.description}
                  </span>
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                  Giriş sayfası (URL)
                  <select
                    className="select"
                    value={
                      COMMERCIAL_ENTRY_PATH_OPTIONS.some((o) => o.value === row.entryPath)
                        ? row.entryPath
                        : "__custom__"
                    }
                    onChange={(e) => {
                      if (e.target.value === "__custom__") return;
                      patchRow(row.subtypeKey, { entryPath: e.target.value });
                    }}
                  >
                    {COMMERCIAL_ENTRY_PATH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    <option value="__custom__">Özel URL…</option>
                  </select>
                  {!COMMERCIAL_ENTRY_PATH_OPTIONS.some((o) => o.value === row.entryPath) ||
                  row.entryPath === "__custom__" ? null : null}
                  <input
                    className="input"
                    style={{ marginTop: 4 }}
                    value={row.entryPath}
                    onChange={(e) => patchRow(row.subtypeKey, { entryPath: e.target.value })}
                    placeholder="/ilan-ver?kind=…"
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                  Varsayılan alt kategori
                  <select
                    className="select"
                    value={row.defaultSub}
                    onChange={(e) => patchRow(row.subtypeKey, { defaultSub: e.target.value })}
                  >
                    {subs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontWeight: 500, color: "#94a3b8", fontSize: 11 }}>
                    Profile otomatik yazılır (müşteri görmez)
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn-orange" disabled={saving} onClick={save}>
          {saving ? "Kaydediliyor…" : "Eşlemeleri kaydet"}
        </button>
        {msg ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: msg.includes("başarısız") ? "#b91c1c" : "#059669" }}>
            {msg}
          </span>
        ) : null}
      </div>
    </div>
  );
}
