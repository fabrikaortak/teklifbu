"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { AdminSettingsPanel, useAdminData } from "@/components/admin/AdminPanels";

/** POS / jeton altyapı kontrolleri + ödeme simülasyonu */
export function AdminPaymentInfraPanel() {
  const { data, load } = useAdminData();
  const { alert } = useDialog();
  const [sim, setSim] = useState({
    userId: "",
    amountTl: 99,
    purpose: "token_purchase",
    tokenAmount: 10,
  });
  const [demoPos, setDemoPos] = useState(true);
  const [tokensOnly, setTokensOnly] = useState(false);
  const [posBusy, setPosBusy] = useState(false);
  const [simBusy, setSimBusy] = useState(false);

  useEffect(() => {
    if (data?.settings && typeof data.settings.payment_demo_pos_enabled === "boolean") {
      setDemoPos(Boolean(data.settings.payment_demo_pos_enabled));
    }
    if (data?.settings && typeof data.settings.payment_tokens_only_enabled === "boolean") {
      setTokensOnly(Boolean(data.settings.payment_tokens_only_enabled));
    }
  }, [data]);

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  async function toggleDemoPos() {
    setPosBusy(true);
    try {
      const next = !demoPos;
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: { payment_demo_pos_enabled: next },
        }),
      });
      if (!res.ok) {
        await alert({ title: "Hata", message: "Demo POS ayarı kaydedilemedi.", tone: "warning" });
        return;
      }
      setDemoPos(next);
      await load();
    } finally {
      setPosBusy(false);
    }
  }

  async function toggleTokensOnly() {
    setPosBusy(true);
    try {
      const next = !tokensOnly;
      const settings: Record<string, boolean> = { payment_tokens_only_enabled: next };
      if (next) settings.payment_demo_pos_enabled = false;
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-settings", settings }),
      });
      if (!res.ok) {
        await alert({ title: "Hata", message: "Jeton-only ayarı kaydedilemedi.", tone: "warning" });
        return;
      }
      setTokensOnly(next);
      if (next) setDemoPos(false);
      await load();
    } finally {
      setPosBusy(false);
    }
  }

  async function runSimulate() {
    if (!sim.userId) {
      await alert({ title: "Eksik bilgi", message: "Lütfen bir kullanıcı seçin.", tone: "warning" });
      return;
    }
    setSimBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate-payment", ...sim }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        await alert({
          title: "Simülasyon başarısız",
          message: j.error || "Ödeme simüle edilemedi.",
          tone: "danger",
        });
        return;
      }
      await load();
      await alert({ title: "Tamam", message: "Ödeme simüle edildi.", tone: "success" });
    } finally {
      setSimBusy(false);
    }
  }

  return (
    <div className="adm-panel-wrap">
      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>POS / jeton ödemesi</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
              Demo POS ile TL tahsilatı simüle edilir. «Yalnızca jeton» açılınca POS kapanır; ilan ücreti ve
              paketler jetonla ödenir. Paketlere jeton fiyatı tanımlayın; temel ilan ücreti hızlı jeton birim
              fiyatına göre çevrilir.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={tokensOnly ? "btn-orange" : "btn-outline"}
              style={{ padding: "10px 16px", whiteSpace: "nowrap", fontWeight: 800 }}
              disabled={posBusy}
              onClick={() => void toggleTokensOnly()}
            >
              {posBusy ? "…" : tokensOnly ? "Yalnızca jeton: Açık" : "Yalnızca jeton: Kapalı"}
            </button>
            <button
              type="button"
              className={demoPos && !tokensOnly ? "btn-orange" : "btn-outline"}
              style={{ padding: "10px 16px", whiteSpace: "nowrap", fontWeight: 800 }}
              disabled={posBusy || tokensOnly}
              onClick={() => void toggleDemoPos()}
              title={tokensOnly ? "Yalnızca jeton açıkken POS kullanılamaz" : undefined}
            >
              {posBusy ? "…" : demoPos && !tokensOnly ? "Demo POS: Açık" : "Demo POS: Kapalı"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--adm-muted)" }}>
          {tokensOnly
            ? "Mod: yalnızca jeton — kullanıcılar TL/POS görmez."
            : "Kullanıcı yolu (POS): İlan onayla → ücret → /odeme/demo-pos"}
        </div>
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Ödeme simüle et</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
            Test için kullanıcıya manuel ödeme kaydı oluşturur (jeton yükleme vb.).
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
          }}
        >
          <select
            className="select"
            value={sim.userId}
            onChange={(e) => setSim({ ...sim, userId: e.target.value })}
          >
            <option value="">Kullanıcı seç</option>
            {(data.users || []).map((u: { id: string; name?: string | null; phone?: string }) => (
              <option key={u.id} value={u.id}>
                {u.name || u.phone}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            value={sim.amountTl}
            onChange={(e) => setSim({ ...sim, amountTl: Number(e.target.value) })}
            placeholder="Tutar TL"
          />
          <input
            className="input"
            value={sim.purpose}
            onChange={(e) => setSim({ ...sim, purpose: e.target.value })}
            placeholder="Amaç"
          />
          <input
            className="input"
            type="number"
            value={sim.tokenAmount}
            onChange={(e) => setSim({ ...sim, tokenAmount: Number(e.target.value) })}
            placeholder="Jeton"
          />
          <button
            className="btn-orange"
            style={{ padding: "10px 14px" }}
            disabled={simBusy}
            onClick={() => void runSimulate()}
          >
            {simBusy ? "…" : "Simüle Et"}
          </button>
        </div>
      </div>

      <div>
        <div className="adm-page-head" style={{ marginBottom: 8, padding: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>POS / jeton ayarları</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--adm-muted)" }}>
              Sanal POS kuralları ve jeton ekonomi ayarları.
            </p>
          </div>
        </div>
        <AdminSettingsPanel onlyGroups={["payment", "token"]} />
      </div>
    </div>
  );
}
