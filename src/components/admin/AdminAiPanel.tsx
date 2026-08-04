"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";

type AiUsageEntry = {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  meta?: unknown;
  createdAt: string;
  user: { id: string; name: string | null; phone: string | null; email: string | null };
};

type AiUsageSummary = {
  parseCount: number;
  refundCount: number;
  tokensSpent: number;
  tokensRefunded: number;
  netTokens: number;
};

export function AdminAiPanel() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [usageSummary, setUsageSummary] = useState<AiUsageSummary | null>(null);
  const [usageEntries, setUsageEntries] = useState<AiUsageEntry[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await fetch("/api/admin?view=ai-listing-usage");
      if (!res.ok) return;
      const json = await res.json();
      setUsageSummary(json.summary || null);
      setUsageEntries(Array.isArray(json.entries) ? json.entries : []);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/admin?view=settings");
      if (!res.ok) {
        setLoadError(res.status === 403 ? "Yetkisiz" : "Yüklenemedi");
        return;
      }
      const json = await res.json();
      setSettings(json.settings || {});
      setDraft({
        ai_listing_import_enabled: json.settings?.ai_listing_import_enabled,
        ai_listing_offer_popup_enabled: json.settings?.ai_listing_offer_popup_enabled ?? true,
        ai_openai_api_key: json.settings?.ai_openai_api_key ?? "",
        ai_openai_base_url: json.settings?.ai_openai_base_url ?? "https://api.openai.com/v1",
        ai_openai_model: json.settings?.ai_openai_model ?? "gpt-4o",
        ai_listing_parse_token_cost: json.settings?.ai_listing_parse_token_cost ?? 2,
      });
    } catch {
      setLoadError("Bağlantı hatası");
    }
  }, []);

  useEffect(() => {
    load();
    loadUsage();
  }, [load, loadUsage]);

  if (loadError && !settings) {
    return (
      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#b91c1c", fontWeight: 700 }}>{loadError}</div>
        <button className="btn-orange" style={{ padding: 12, width: 160 }} onClick={load}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!settings) return <div className="adm-card">Yükleniyor...</div>;

  async function save(override?: Record<string, unknown>) {
    const next = { ...draft, ...override };
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: {
            ...settings,
            ai_listing_import_enabled: Boolean(next.ai_listing_import_enabled),
            ai_listing_offer_popup_enabled: Boolean(next.ai_listing_offer_popup_enabled),
            ai_openai_api_key: String(next.ai_openai_api_key || ""),
            ai_openai_base_url: String(next.ai_openai_base_url || "https://api.openai.com/v1"),
            ai_openai_model: String(next.ai_openai_model || "gpt-4o"),
            ai_listing_parse_token_cost: Math.min(
              100,
              Math.max(0, Number(next.ai_listing_parse_token_cost) || 0)
            ),
          },
        }),
      });
      if (!res.ok) {
        setMsg("Kayıt başarısız");
        return;
      }
      setDraft(next);
      if (override && "ai_listing_import_enabled" in override) {
        setMsg(
          Boolean(next.ai_listing_import_enabled)
            ? "Menü açıldı ve kaydedildi"
            : "Menü kapatıldı ve kaydedildi"
        );
      } else if (override && "ai_listing_offer_popup_enabled" in override) {
        setMsg(
          Boolean(next.ai_listing_offer_popup_enabled)
            ? "İlan Ver popup’ı açıldı ve kaydedildi"
            : "İlan Ver popup’ı kapatıldı ve kaydedildi"
        );
      } else {
        setMsg("AI ayarları kaydedildi");
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  const enabled = Boolean(draft.ai_listing_import_enabled);
  const popupEnabled = Boolean(draft.ai_listing_offer_popup_enabled);
  const keySet = Boolean(String(draft.ai_openai_api_key || "").trim());
  const tokenCost = Number(draft.ai_listing_parse_token_cost ?? 2);

  return (
    <div className="adm-panel-wrap">
      <AdminToast
        message={msg || null}
        tone={msg && /başarısız|hata/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />

      <div className="adm-card" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>AI ile ilan ekle</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Kullanıcı 1 tam sayfa veya 2 parça SS yükler; sistem okur ve forma aktarır. Her başarılı okuma
            işleminde aşağıda ayarlanan jeton düşülür; harcamalar bu sayfanın altındaki listede görünür.
          </p>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid var(--adm-line, #e2e8f0)",
            background: enabled ? "#fff7ed" : "#f8fafc",
          }}
        >
          <span>
            <strong style={{ display: "block", fontSize: 14 }}>Profil menüsünü aç / kapat</strong>
            <span style={{ fontSize: 12.5, color: "var(--adm-muted)" }}>
              {enabled ? "Açık — Hesabım’da “AI ile ilan ekle” görünür" : "Kapalı — menü gizli"}
            </span>
          </span>
          <button
            type="button"
            className={enabled ? "btn-orange" : "btn-outline"}
            style={{ padding: "10px 16px", minWidth: 96 }}
            disabled={saving}
            onClick={() => save({ ai_listing_import_enabled: !enabled })}
          >
            {enabled ? "Açık" : "Kapalı"}
          </button>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid var(--adm-line, #e2e8f0)",
            background: popupEnabled && enabled ? "#fff7ed" : "#f8fafc",
            opacity: enabled ? 1 : 0.65,
          }}
        >
          <span>
            <strong style={{ display: "block", fontSize: 14 }}>İlan Ver popup’ını aç / kapat</strong>
            <span style={{ fontSize: 12.5, color: "var(--adm-muted)" }}>
              {enabled
                ? popupEnabled
                  ? "Açık — İlan Ver’e girince kampanya popup’ı gösterilir"
                  : "Kapalı — popup yok, yalnızca menüden erişilir"
                : "Önce profil menüsünü açın (AI özelliği kapalı)"}
            </span>
          </span>
          <button
            type="button"
            className={popupEnabled && enabled ? "btn-orange" : "btn-outline"}
            style={{ padding: "10px 16px", minWidth: 96 }}
            disabled={saving || !enabled}
            onClick={() => save({ ai_listing_offer_popup_enabled: !popupEnabled })}
          >
            {popupEnabled ? "Açık" : "Kapalı"}
          </button>
        </label>

        <div
          style={{
            display: "grid",
            gap: 6,
            padding: 12,
            borderRadius: 10,
            background: keySet ? "#f0fdf4" : "#fef2f2",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {keySet ? "✓ OpenAI API anahtarı tanımlı" : "✗ API anahtarı yok — okuma çalışmaz"}
        </div>
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>OpenAI bağlantısı</h2>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>API anahtarı</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              placeholder="sk-..."
              value={String(draft.ai_openai_api_key || "")}
              onChange={(e) => setDraft({ ...draft, ai_openai_api_key: e.target.value })}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-outline" style={{ padding: "0 14px" }} onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Gizle" : "Göster"}
            </button>
          </div>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>API taban URL</span>
          <input
            className="input"
            value={String(draft.ai_openai_base_url || "https://api.openai.com/v1")}
            onChange={(e) => setDraft({ ...draft, ai_openai_base_url: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Model</span>
          <select
            className="input"
            value={String(draft.ai_openai_model || "gpt-4o")}
            onChange={(e) => setDraft({ ...draft, ai_openai_model: e.target.value })}
          >
            <option value="gpt-4o">gpt-4o — önerilen (daha doğru okur)</option>
            <option value="gpt-4o-mini">gpt-4o-mini — ucuz (daha çok hata)</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>İşlem başına jeton ücreti</span>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={tokenCost}
            onChange={(e) => setDraft({ ...draft, ai_listing_parse_token_cost: Number(e.target.value) })}
          />
          <span style={{ fontSize: 12, color: "var(--adm-muted)", lineHeight: 1.45 }}>
            Her “AI ile oku” tıklamasında kullanıcıdan düşülür (1 veya 2 SS fark etmez). Varsayılan: 2. 0 = ücretsiz.
            Hesabım ve İlan Ver popup’ında bu rakam gösterilir.
          </span>
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn-orange" style={{ padding: 12, width: 200 }} disabled={saving} onClick={() => save()}>
            {saving ? "Kaydediliyor…" : "AI Ayarlarını Kaydet"}
          </button>
          <button
            type="button"
            className="btn-outline"
            style={{ padding: 12 }}
            disabled={testing || saving}
            onClick={async () => {
              setTesting(true);
              setTestResult(null);
              try {
                await save();
                const res = await fetch("/api/admin/ai-test", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    apiKey: String(draft.ai_openai_api_key || ""),
                    baseUrl: String(draft.ai_openai_base_url || ""),
                    model: String(draft.ai_openai_model || ""),
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (data.ok) {
                  setTestResult({ ok: true, text: `${data.message} Model: ${data.model}. Yanıt: ${data.reply || "—"}` });
                  setMsg("OpenAI bağlantı testi başarılı");
                } else {
                  setTestResult({ ok: false, text: data.error || "Test başarısız" });
                  setMsg(data.error || "Bağlantı testi başarısız");
                }
              } catch {
                setTestResult({ ok: false, text: "Bağlantı hatası" });
                setMsg("Bağlantı testi başarısız");
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? "Test ediliyor…" : "Bağlantıyı test et"}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: testResult.ok ? "#f0fdf4" : "#fef2f2",
              color: testResult.ok ? "#166534" : "#b91c1c",
            }}
          >
            {testResult.text}
          </div>
        )}
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>AI jeton harcamaları</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
              `ai_listing_parse` düşümleri ve başarısız okumalardaki iadeler. Jeton satış ödemeleri Ödemeler
              panelinde; burada AI kullanımına eşlenen tüketim kaydı tutulur.
            </p>
          </div>
          <button type="button" className="btn-outline" style={{ padding: "8px 14px" }} disabled={usageLoading} onClick={loadUsage}>
            {usageLoading ? "Yükleniyor…" : "Yenile"}
          </button>
        </div>

        {usageSummary && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
            }}
          >
            {[
              ["Okuma", usageSummary.parseCount],
              ["İade", usageSummary.refundCount],
              ["Düşülen jeton", usageSummary.tokensSpent],
              ["İade jeton", usageSummary.tokensRefunded],
              ["Net jeton", usageSummary.netTokens],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Tarih</th>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Kullanıcı</th>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Tür</th>
                <th style={{ textAlign: "right", padding: "8px 10px" }}>Jeton</th>
                <th style={{ textAlign: "right", padding: "8px 10px" }}>Bakiye</th>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>SS</th>
              </tr>
            </thead>
            <tbody>
              {usageEntries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: "#64748b" }}>
                    Henüz AI ile ilan okuma kaydı yok.
                  </td>
                </tr>
              )}
              {usageEntries.map((e) => {
                const isRefund = e.reason === "ai_listing_parse_refund";
                const meta = (e.meta && typeof e.meta === "object" ? e.meta : {}) as {
                  count?: number;
                  tokenCost?: number;
                };
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      {new Date(e.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 700 }}>{e.user?.name || "—"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{e.user?.phone || e.user?.email || e.user?.id}</div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          background: isRefund ? "#fef2f2" : "#fff7ed",
                          color: isRefund ? "#b91c1c" : "#c2410c",
                        }}
                      >
                        {isRefund ? "İade" : "Okuma"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontWeight: 800,
                        color: e.delta < 0 ? "#c2410c" : "#15803d",
                      }}
                    >
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{e.balanceAfter}</td>
                    <td style={{ padding: "10px" }}>{meta.count ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
