"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type FeeMode = "free" | "paid" | "freemium";

type TypeMap = Record<string, number>;

const INDIVIDUAL_KEYS = ["BIREYSEL_TICARI", "BIREYSEL"] as const;
const CORPORATE_KEYS = ["TICARI", "EMLAKCI", "GALERICI"] as const;

function numMap(raw: unknown, fallback: number): TypeMap {
  const base: TypeMap = {
    BIREYSEL_TICARI: fallback,
    TICARI: fallback,
    BIREYSEL: fallback,
    EMLAKCI: fallback,
    GALERICI: fallback,
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(base)) {
    const n = Number(o[k]);
    if (Number.isFinite(n) && n >= 0) base[k] = n;
  }
  return base;
}

function pickGroup(map: TypeMap, keys: readonly string[], fallback: number) {
  for (const k of keys) {
    const n = Number(map[k]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

function applyGroup(map: TypeMap, keys: readonly string[], value: number): TypeMap {
  const next = { ...map };
  for (const k of keys) next[k] = Math.max(0, Number(value) || 0);
  return next;
}

export function AdminListingQuotaPanel() {
  const [mode, setMode] = useState<FeeMode>("free");
  const [quotaGlobal, setQuotaGlobal] = useState(3);
  const [feeGlobal, setFeeGlobal] = useState(0);
  const [quotaByType, setQuotaByType] = useState<TypeMap>(() => numMap(null, 3));
  const [feeByType, setFeeByType] = useState<TypeMap>(() => numMap(null, 0));
  const [vatPercent, setVatPercent] = useState(20);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin?view=settings");
      if (!res.ok) {
        setError(res.status === 403 ? "Yetkisiz" : "Yüklenemedi");
        return;
      }
      const json = await res.json();
      const s = (json.settings || {}) as Record<string, unknown>;
      const m = String(s.listing_fee_mode || "free");
      setMode(m === "paid" || m === "freemium" ? m : "free");
      const qg = Math.max(0, Number(s.listing_free_quota) || 0);
      const fg = Math.max(0, Number(s.listing_fee_tl) || 0);
      setQuotaGlobal(qg);
      setFeeGlobal(fg);
      setQuotaByType(numMap(s.listing_free_quota_by_account_type, qg || 3));
      setFeeByType(numMap(s.listing_fee_by_account_type, 0));
      setVatPercent(Math.max(0, Math.min(40, Number(s.listing_fee_vat_percent) || 0)));
      setPricesIncludeVat(s.listing_fee_prices_include_vat !== false);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const settings: Record<string, unknown> = {
        listing_fee_mode: mode,
        listing_free_quota: Math.max(0, Number(quotaGlobal) || 0),
        listing_free_quota_by_account_type: quotaByType,
        listing_fee_tl: Math.max(0, Number(feeGlobal) || 0),
        listing_fee_by_account_type: feeByType,
        listing_fee_vat_percent: Math.max(0, Math.min(40, Number(vatPercent) || 0)),
        listing_fee_prices_include_vat: Boolean(pricesIncludeVat),
      };
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-settings", settings }),
      });
      if (!res.ok) {
        setMsg("Kayıt başarısız");
        return;
      }
      setMsg("İlan hakkı / ücret ayarları kaydedildi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="adm-card">Yükleniyor...</div>;
  if (error) {
    return (
      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div>
        <button className="btn-orange" style={{ padding: 12, width: 160 }} onClick={load}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  const bireyselQuota = pickGroup(quotaByType, INDIVIDUAL_KEYS, quotaGlobal);
  const kurumsalQuota = pickGroup(quotaByType, CORPORATE_KEYS, quotaGlobal);
  const bireyselFee = pickGroup(feeByType, INDIVIDUAL_KEYS, feeGlobal);
  const kurumsalFee = pickGroup(feeByType, CORPORATE_KEYS, feeGlobal);

  const rows: Array<{
    key: string;
    label: string;
    hint: string;
    quota: number;
    fee: number;
    setQuota: (n: number) => void;
    setFee: (n: number) => void;
  }> = [
    {
      key: "bireysel",
      label: "Bireysel üye",
      hint: "İlk N ilan bedava (freemium); sonrası ücretli.",
      quota: bireyselQuota,
      fee: bireyselFee,
      setQuota: (n) => setQuotaByType((m) => applyGroup(m, INDIVIDUAL_KEYS, n)),
      setFee: (n) => setFeeByType((m) => applyGroup(m, INDIVIDUAL_KEYS, n)),
    },
    {
      key: "kurumsal",
      label: "Kurumsal üye",
      hint: "Onaylı ticari mağazalar için ücretsiz ilan hakkı ve kota sonrası ücret.",
      quota: kurumsalQuota,
      fee: kurumsalFee,
      setQuota: (n) => setQuotaByType((m) => applyGroup(m, CORPORATE_KEYS, n)),
      setFee: (n) => setFeeByType((m) => applyGroup(m, CORPORATE_KEYS, n)),
    },
  ];

  return (
    <div className="adm-panel-wrap">
      <AdminToast
        message={msg || null}
        tone={msg && /başarısız|hata/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />

      <div className="adm-card" style={{ display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>İlan hakkı ve ücretler</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Bireysel ve kurumsal üyelerin kaç ilanı bedava açabileceğini ve kota sonrası ücretini buradan
            yönetin. Freemium: ilk N ilan ücretsiz, sonraki ilanlar ücretli.
          </p>
        </div>

        <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Ücret modu</label>
          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as FeeMode)}
          >
            <option value="free">Ücretsiz — tüm ilanlar bedava</option>
            <option value="paid">Ücretli — her ilan ücretli</option>
            <option value="freemium">Freemium — önce ücretsiz kota, sonra ücret</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Üyelik</th>
                <th style={{ textAlign: "left", padding: "8px 10px", width: 160 }}>
                  Ücretsiz ilan hakkı
                </th>
                <th style={{ textAlign: "left", padding: "8px 10px", width: 180 }}>
                  Kota sonrası ücret (TL)
                </th>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px 10px" }}>
                    <strong>{r.label}</strong>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      disabled={mode === "free" || mode === "paid"}
                      value={r.quota}
                      onChange={(e) => r.setQuota(Number(e.target.value))}
                      style={{ width: 100, opacity: mode === "freemium" ? 1 : 0.5 }}
                    />
                    <span style={{ marginLeft: 6, color: "#64748b" }}>adet</span>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      disabled={mode === "free"}
                      value={r.fee}
                      onChange={(e) => r.setFee(Number(e.target.value))}
                      style={{ width: 100, opacity: mode === "free" ? 0.5 : 1 }}
                    />
                    <span style={{ marginLeft: 6, color: "#64748b" }}>TL</span>
                  </td>
                  <td style={{ padding: "12px 10px", fontSize: 12, color: "#64748b" }}>{r.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mode === "freemium" && (
          <p style={{ margin: 0, fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
            Örnek: Kurumsal ücretsiz hak <strong>{kurumsalQuota}</strong> ise 1–{kurumsalQuota || 0}.
            ilan bedava; {kurumsalQuota + 1}. ilandan itibaren{" "}
            <strong>{kurumsalFee > 0 ? `${kurumsalFee} TL` : "genel ücret"}</strong> uygulanır.
          </p>
        )}

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            paddingTop: 4,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              Genel ücretsiz kota (yedek)
            </label>
            <input
              className="input"
              type="number"
              min={0}
              value={quotaGlobal}
              onChange={(e) => setQuotaGlobal(Number(e.target.value))}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              Genel ilan ücreti (yedek, TL)
            </label>
            <input
              className="input"
              type="number"
              min={0}
              value={feeGlobal}
              onChange={(e) => setFeeGlobal(Number(e.target.value))}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>KDV oranı (%)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={40}
              value={vatPercent}
              onChange={(e) => setVatPercent(Number(e.target.value))}
            />
          </div>
          <div style={{ display: "grid", gap: 6, alignContent: "end" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={pricesIncludeVat}
                onChange={(e) => setPricesIncludeVat(e.target.checked)}
              />
              Fiyatlara KDV dahil
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-orange" style={{ padding: 12, width: 200 }} disabled={saving} onClick={save}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button type="button" className="btn-outline" style={{ padding: 12 }} disabled={saving} onClick={load}>
            Vazgeç / Yenile
          </button>
        </div>
      </div>
    </div>
  );
}
