"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";
import { DEFAULT_SITE_FOOTER, normalizeSiteFooter, type SiteFooterConfig } from "@/core/siteFooter";

export function AdminFooterPanel() {
  const [draft, setDraft] = useState<SiteFooterConfig>(DEFAULT_SITE_FOOTER);
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
      setDraft(normalizeSiteFooter(json.settings?.site_footer));
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof SiteFooterConfig>(key: K, value: SiteFooterConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = normalizeSiteFooter(draft);
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: { site_footer: payload },
        }),
      });
      if (!res.ok) {
        setMsg("Kayıt başarısız");
        return;
      }
      setDraft(payload);
      setMsg("Footer bilgileri kaydedildi");
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

  return (
    <div className="adm-panel-wrap">
      <AdminToast
        message={msg || null}
        tone={msg && /başarısız|hata/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />

      <div className="adm-card" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>İletişim & şirket</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Site en altındaki müşteri hizmetleri, adres ve sicil bilgileri. Demo değerler yüklü; buradan
            değiştirebilirsiniz.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Telefon etiketi</span>
            <input
              className="input"
              value={draft.phoneLabel}
              onChange={(e) => setField("phoneLabel", e.target.value)}
              placeholder="Müşteri Hizmetleri"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Telefon</span>
            <input
              className="input"
              value={draft.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="0216 606 60 00"
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Adres</span>
          <textarea
            className="input"
            rows={3}
            value={draft.address}
            onChange={(e) => setField("address", e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Ticaret Sicil No</span>
            <input
              className="input"
              value={draft.tradeRegistryNo}
              onChange={(e) => setField("tradeRegistryNo", e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>MERSİS</span>
            <input className="input" value={draft.mersis} onChange={(e) => setField("mersis", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Yasal metin & uygulama</h2>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Yasal açıklama</span>
          <textarea
            className="input"
            rows={5}
            value={draft.disclaimer}
            onChange={(e) => setField("disclaimer", e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Google Play URL</span>
            <input
              className="input"
              value={draft.googlePlayUrl}
              onChange={(e) => setField("googlePlayUrl", e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>App Store URL</span>
            <input
              className="input"
              value={draft.appStoreUrl}
              onChange={(e) => setField("appStoreUrl", e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>App Gallery URL</span>
            <input
              className="input"
              value={draft.appGalleryUrl}
              onChange={(e) => setField("appGalleryUrl", e.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>ETBİS metni</span>
            <input
              className="input"
              value={draft.etbisText}
              onChange={(e) => setField("etbisText", e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>ETBİS QR görsel URL</span>
            <input
              className="input"
              value={draft.etbisQrUrl}
              onChange={(e) => setField("etbisQrUrl", e.target.value)}
              placeholder="/uploads/... veya https://..."
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, maxWidth: 200 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Sürüm yazısı</span>
          <input className="input" value={draft.version} onChange={(e) => setField("version", e.target.value)} />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {(
            [
              ["showPaymentIcons", "Ödeme ikonları (Visa/MC)"],
              ["showAppBadges", "Uygulama indir rozetleri"],
              ["showEtbis", "ETBİS alanı"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={draft[key] ? "btn-orange" : "btn-outline"}
              style={{ padding: "8px 14px" }}
              onClick={() => setField(key, !draft[key])}
            >
              {label}: {draft[key] ? "Açık" : "Kapalı"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-orange" style={{ padding: 12, width: 200 }} disabled={saving} onClick={save}>
            {saving ? "Kaydediliyor…" : "Footer’ı Kaydet"}
          </button>
          <button type="button" className="btn-outline" style={{ padding: 12 }} disabled={saving} onClick={load}>
            Yenile
          </button>
          <button
            type="button"
            className="btn-outline"
            style={{ padding: 12 }}
            disabled={saving}
            onClick={() => setDraft({ ...DEFAULT_SITE_FOOTER })}
          >
            Demo bilgilere dön
          </button>
        </div>
      </div>
    </div>
  );
}
