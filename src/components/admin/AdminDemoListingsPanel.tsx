"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";
import { useDialog } from "@/components/ui/ConfirmDialog";
import type { AdminVertical } from "@/lib/adminVertical";
import { ADMIN_VERTICAL_META } from "@/lib/adminVertical";

export function AdminDemoListingsPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  const dialog = useDialog();
  const [count, setCount] = useState(0);
  const [catalogSize, setCatalogSize] = useState(50);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const clearMsg = useCallback(() => setMsg(""), []);

  async function load() {
    const res = await fetch("/api/admin?view=tables");
    if (!res.ok) return;
    const d = await res.json();
    setCount(Number(d.demo?.count || 0));
    setCatalogSize(Number(d.demo?.catalogSize || 50));
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action: string, confirmText?: string) {
    if (confirmText) {
      const ok = await dialog.confirm({
        title: "Demo",
        message: confirmText,
        confirmLabel: "Devam",
      });
      if (!ok) return;
    }
    setBusy(action);
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok || d.ok === false) {
        setMsg(d.error || "İşlem başarısız");
      } else if (action === "demo-flow-start") {
        setMsg(
          `Demo akış hazır: ${d.created || 0} ilan · ${d.bids || 0} canlı teklif · ${d.sales || 0} tamamlanan satış` +
            (d.usersRemoved || d.cleared?.usersRemoved
              ? ` · önceki demolar temizlendi`
              : "")
        );
      } else if (action === "demo-flow-stop" || action === "demo-remove") {
        setMsg(
          `${d.removed || 0} demo ilan silindi` +
            (d.usersRemoved ? ` · ${d.usersRemoved} demo kullanıcı kaldırıldı` : "")
        );
      } else if (action === "demo-publish") {
        setMsg(`${d.updated || 0} demo ilan yayınlandı (7 gün)`);
      } else {
        setMsg(
          `${d.created || 0} demo ilan yüklendi (${d.status || "DRAFT"})${
            d.skipped ? ` · ${d.skipped} atlandı` : ""
          }`
        );
      }
      await load();
    } catch {
      setMsg("Bağlantı hatası");
    } finally {
      setBusy("");
    }
  }

  const toastTone = msg && /başarısız|hata|yok|Zaten/i.test(msg) ? "err" : "ok";
  const flowActive = count > 0;

  return (
    <div className="adm-panel-wrap">
      <AdminToast message={msg || null} tone={toastTone} onClose={clearMsg} />

      {vertical ? (
        <div className="adm-card" style={{ fontSize: 13 }}>
          Dikey: <strong>{ADMIN_VERTICAL_META[vertical].label}</strong> — demo işlemleri şu an site-geneli
          (tüm dikeyler); filtreleme sonraki sürümde.
        </div>
      ) : null}

      <div className="adm-card" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
        <h2 style={{ marginTop: 0 }}>Demo akışı</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
          Tek tıkla vitrin + canlı teklifler + <strong>Son Gerçekleşen Satışlar</strong> için örnek veri üretir. İşiniz
          bitince kapatıp tüm demo veriyi silebilirsiniz; gerçek ilanlara dokunulmaz (<code>_demo</code> bayrağı).
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
            padding: "12px 14px",
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #fed7aa",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 15 }}>
            Durum:{" "}
            <span style={{ color: flowActive ? "#16a34a" : "#94a3b8" }}>
              {flowActive ? `Açık (${count} demo ilan)` : "Kapalı"}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="btn-orange"
            disabled={!!busy}
            onClick={() =>
              run(
                "demo-flow-start",
                "Mevcut demolar silinip tam demo akışı (ilan + teklif + tamamlanan satış) yeniden oluşturulsun mu?"
              )
            }
          >
            {busy === "demo-flow-start" ? "…" : "Demo akışını başlat"}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={!!busy || !flowActive}
            style={{ borderColor: "#fca5a5", color: "#b91c1c" }}
            onClick={() =>
              run(
                "demo-flow-stop",
                "Demo akışı kapatılsın ve tüm demo ilan / kullanıcı verileri silinsin mi? Bu işlem geri alınamaz."
              )
            }
          >
            {busy === "demo-flow-stop" ? "…" : "Demo akışını kapat ve sil"}
          </button>
        </div>
        <ol style={{ margin: "16px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.6 }}>
          <li>
            <strong>Başlat</strong> — demoları temizler, yayınlar, canlı teklif ve sonuçlanmış satışlar ekler; ana
            sayfada «Son satışlar» şeridini açar.
          </li>
          <li>
            <strong>Kapat ve sil</strong> — tüm demo ilanları ve demo kullanıcıları kaldırır.
          </li>
        </ol>
      </div>

      <div className="adm-card">
        <h2 style={{ marginTop: 0 }}>Demo İlanlar (manuel)</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
          Yaklaşık <strong>{catalogSize}</strong> hazır demo ilan. İsterseniz adım adım yükleyip yayınlayabilirsiniz.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            marginBottom: 16,
            padding: "12px 14px",
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 15 }}>
            Mevcut demo: <span style={{ color: "var(--orange)" }}>{count}</span>
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="btn-outline"
            disabled={!!busy}
            onClick={() => run("demo-seed", `${catalogSize} demo ilan taslak olarak yüklensin mi?`)}
          >
            {busy === "demo-seed" ? "…" : "Demo ilanları yükle"}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={!!busy || count === 0}
            onClick={() => run("demo-publish", "Tüm demo ilanlar ACTIVE yapılsın mı? (7 gün süre)")}
          >
            {busy === "demo-publish" ? "…" : "Yayınla"}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={!!busy || count === 0}
            style={{ borderColor: "#fca5a5", color: "#b91c1c" }}
            onClick={() => run("demo-remove", "Tüm demo ilanlar ve demo kullanıcılar silinsin mi?")}
          >
            {busy === "demo-remove" ? "…" : "Demo ilanları kaldır"}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={!!busy}
            onClick={() => run("demo-reload", "Mevcut demolar silinip yeniden yüklensin mi?")}
          >
            {busy === "demo-reload" ? "…" : "Yeniden yükle"}
          </button>
        </div>
      </div>
    </div>
  );
}
