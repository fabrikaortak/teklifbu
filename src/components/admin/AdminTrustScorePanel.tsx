"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TRUST_SCORE_ENGINE,
  TRUST_SCORE_DELAY_HOUR_OPTIONS,
  TRUST_SCORE_POINT_OPTIONS,
  TRUST_SCORE_THRESHOLD_OPTIONS,
  type TrustScoreEngineConfig,
  type TrustScoreEventRule,
} from "@/lib/trustScoreConfig";

type LedgerRow = {
  id: string;
  eventKey: string;
  points: number;
  scoreBefore: number;
  scoreAfter: number;
  listingId?: string | null;
  note?: string | null;
  createdAt: string;
  user?: { id: string; name?: string | null; phone?: string | null };
};

function SelectNum({
  value,
  options,
  onChange,
  allowCustom,
}: {
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (n: number) => void;
  allowCustom?: boolean;
}) {
  const known = options.some((o) => o.value === value);
  const [custom, setCustom] = useState(!known && allowCustom);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select
        className="input"
        style={{ minWidth: 160 }}
        value={custom ? "__custom__" : String(value)}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(Number(e.target.value));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={String(o.value)}>
            {o.label}
          </option>
        ))}
        {allowCustom ? <option value="__custom__">Özel sayı…</option> : null}
      </select>
      {custom && allowCustom ? (
        <input
          className="input"
          type="number"
          style={{ width: 100 }}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      ) : null}
    </div>
  );
}

export function AdminTrustScorePanel() {
  const [cfg, setCfg] = useState<TrustScoreEngineConfig>(DEFAULT_TRUST_SCORE_ENGINE);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [testEvent, setTestEvent] = useState("republish_winner_disputed");
  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin?view=trust-score");
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.config) setCfg(d.config);
      if (res.ok && Array.isArray(d.ledger)) setLedger(d.ledger);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateEvent(key: string, patch: Partial<TrustScoreEventRule>) {
    setCfg((c) => ({
      ...c,
      events: c.events.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-trust-score", config: cfg }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || "Kayıt başarısız");
      return;
    }
    if (d.config) setCfg(d.config);
    setMsg("Kaydedildi");
  }

  async function runTest() {
    if (!testUserId.trim()) {
      setMsg("Test için kullanıcı ID gerekli");
      return;
    }
    setTestBusy(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test-trust-score",
        userId: testUserId.trim(),
        eventKey: testEvent,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setTestBusy(false);
    if (!res.ok) {
      setMsg(d.error || "Test başarısız");
      return;
    }
    setMsg(
      d.skipped
        ? `Atlandı: ${d.reason || "—"}`
        : `Uygulandı: ${d.points} puan · ${d.scoreBefore} → ${d.scoreAfter}`
    );
    await load();
  }

  if (loading) {
    return <div className="adm-card" style={{ padding: 20 }}>Yükleniyor…</div>;
  }

  const targetLabel = (t: string) =>
    t === "seller" ? "Satıcı" : t === "buyer" ? "Alıcı" : "Kullanıcı";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="adm-card" style={{ padding: 18 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>Genel ayarlar</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Puanlama motoru kullanıcı güven skorunu olaylara göre artırır/azaltır. Eşiklerin altına düşen
          kullanıcı ilan veremez veya teklif veremez. Açıklamalar her seçeneğin yanında yer alır.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
          />
          <span style={{ fontWeight: 700 }}>Motor aktif</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>Kapalıysa hiçbir olay puan değiştirmez</span>
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Başlangıç puanı</div>
            <SelectNum
              value={cfg.startingScore}
              options={[
                { value: 50, label: "50" },
                { value: 80, label: "80" },
                { value: 100, label: "100" },
                { value: 120, label: "120" },
              ]}
              allowCustom
              onChange={(n) => setCfg((c) => ({ ...c, startingScore: n }))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Yeni üyelerin varsayılan skoru</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Minimum skor</div>
            <SelectNum
              value={cfg.minScore}
              options={[
                { value: 0, label: "0" },
                { value: 10, label: "10" },
                { value: 20, label: "20" },
              ]}
              allowCustom
              onChange={(n) => setCfg((c) => ({ ...c, minScore: n }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Maksimum skor</div>
            <SelectNum
              value={cfg.maxScore}
              options={[
                { value: 150, label: "150" },
                { value: 200, label: "200" },
                { value: 300, label: "300" },
              ]}
              allowCustom
              onChange={(n) => setCfg((c) => ({ ...c, maxScore: n }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>İlan engeli eşiği</div>
            <SelectNum
              value={cfg.blockListingBelow}
              options={TRUST_SCORE_THRESHOLD_OPTIONS}
              onChange={(n) => setCfg((c) => ({ ...c, blockListingBelow: n }))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              Bu skorun altındaki kullanıcı yeni ilan / yeniden yayın yapamaz
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Teklif engeli eşiği</div>
            <SelectNum
              value={cfg.blockBidBelow}
              options={TRUST_SCORE_THRESHOLD_OPTIONS}
              onChange={(n) => setCfg((c) => ({ ...c, blockBidBelow: n }))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              Bu skorun altında teklif verilemez (0 = kapalı)
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              İtirazda ek bekleme (satıcı)
            </div>
            <SelectNum
              value={cfg.republishDelayHoursOnDispute}
              options={TRUST_SCORE_DELAY_HOUR_OPTIONS}
              onChange={(n) => setCfg((c) => ({ ...c, republishDelayHoursOnDispute: n }))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              Alıcı «Onaylamıyorum» derse satıcıya listing cooldown
            </div>
          </div>
        </div>
      </div>

      <div className="adm-card" style={{ padding: 18 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>Olay kuralları</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Her olayı aç/kapa yapın ve kaç puan kırılacağını/verileceğini seçin. Bağlı akışlar (yeniden yayın
          doğrulama vb.) yalnızca «Aktif» olayları uygular.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {cfg.events.map((ev) => (
            <div
              key={ev.key}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                background: ev.enabled ? "#fff" : "#f8fafc",
                opacity: ev.enabled ? 1 : 0.85,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{ev.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
                    {ev.description}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    Kod: <code>{ev.key}</code> · Hedef: {targetLabel(ev.target)}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={ev.enabled}
                    onChange={(e) => updateEvent(ev.key, { enabled: e.target.checked })}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Aktif</span>
                </label>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Puan etkisi</div>
                  <SelectNum
                    value={ev.points}
                    options={TRUST_SCORE_POINT_OPTIONS}
                    allowCustom
                    onChange={(n) => updateEvent(ev.key, { points: n })}
                  />
                </div>
                {ev.key === "republish_winner_no_response" ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Yanıt bekleme (gün)</div>
                    <SelectNum
                      value={ev.delayDays ?? 7}
                      options={[
                        { value: 3, label: "3 gün" },
                        { value: 5, label: "5 gün" },
                        { value: 7, label: "7 gün" },
                        { value: 14, label: "14 gün" },
                      ]}
                      allowCustom
                      onChange={(n) => updateEvent(ev.key, { delayDays: n })}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn-orange" disabled={saving} onClick={save}>
          {saving ? "Kaydediliyor…" : "Ayarları kaydet"}
        </button>
        {msg ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: msg.includes("başarısız") ? "#b91c1c" : "#059669" }}>
            {msg}
          </span>
        ) : null}
      </div>

      <div className="adm-card" style={{ padding: 18 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>Akış testi</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
          Bir kullanıcı ID’sine olay uygular (force). Sonuç deftere düşer. Gerçek yeniden yayın
          doğrulamasında da aynı motor çalışır.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Kullanıcı ID</div>
            <input
              className="input"
              style={{ minWidth: 260 }}
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              placeholder="cm…"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Olay</div>
            <select
              className="input"
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              style={{ minWidth: 260 }}
            >
              {cfg.events.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label} ({e.points > 0 ? "+" : ""}
                  {e.points})
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-outline" disabled={testBusy} onClick={runTest}>
            {testBusy ? "…" : "Test uygula"}
          </button>
        </div>
      </div>

      <div className="adm-card" style={{ padding: 18 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>Son hareketler</h2>
        {!ledger.length ? (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Henüz kayıt yok.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kullanıcı</th>
                  <th>Olay</th>
                  <th>Puan</th>
                  <th>Önce → Sonra</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(r.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td>{r.user?.name || r.user?.phone || r.user?.id || "—"}</td>
                    <td>
                      <code style={{ fontSize: 11 }}>{r.eventKey}</code>
                    </td>
                    <td style={{ fontWeight: 800, color: r.points < 0 ? "#b91c1c" : "#059669" }}>
                      {r.points > 0 ? "+" : ""}
                      {r.points}
                    </td>
                    <td>
                      {r.scoreBefore} → {r.scoreAfter}
                    </td>
                    <td style={{ maxWidth: 220, color: "#64748b" }}>{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
