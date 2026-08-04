"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatTl } from "@/lib/format";
import { escrowStatusLabelTr } from "@/lib/escrowTypes";
import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

type PoolSummary = {
  heldTl: number;
  heldCount: number;
  releasedTl: number;
  releasedCount: number;
  refundedTl: number;
  refundedCount: number;
  byStatus?: Record<string, number>;
};

type PoolInfo = { name: string; iban: string; bank: string };

type DealRow = {
  id: string;
  status: string;
  amountTl: number;
  commissionTl: number;
  sellerPayoutTl: number;
  shipDays: number;
  sellerIbanSnapshot?: string | null;
  cargoTrackingNo?: string | null;
  cargoCarrier?: string | null;
  cargoReceiptUrl?: string | null;
  shipDeadlineAt?: string | null;
  buyerConfirmDeadlineAt?: string | null;
  createdAt: string;
  listing?: { id: string; title: string; listingNo?: string | null } | null;
  buyer?: { id: string; name?: string | null; phone?: string | null } | null;
  seller?: { id: string; name?: string | null; phone?: string | null; iban?: string | null } | null;
};

export function AdminEscrowPanel() {
  const [summary, setSummary] = useState<PoolSummary | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<DealRow | null>(null);

  const load = useCallback(async () => {
    const [sumRes, listRes] = await Promise.all([
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escrow-pool-summary" }),
      }),
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-escrow", status: status || undefined, take: 80 }),
      }),
    ]);
    const sum = await sumRes.json().catch(() => ({}));
    const list = await listRes.json().catch(() => ({}));
    if (sumRes.ok && sum.summary) setSummary(sum.summary);
    if (sumRes.ok && sum.pool) setPool(sum.pool);
    if (listRes.ok) setDeals(list.deals || []);
  }, [status]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function adminAction(action: string, dealId: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dealId, note: note || undefined, reason: note || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "İşlem başarısız");
        return;
      }
      setMsg("İşlem tamamlandı.");
      setSelected(null);
      setNote("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function processTimeouts() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escrow-process-timeouts" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "Timeout işlenemedi");
        return;
      }
      setMsg(
        `Süre aşımı işlendi: satıcı ${data.sellerTimeouts ?? 0}, alıcı ${data.buyerTimeouts ?? 0} (${(data.actions || []).length} aksiyon)`
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {msg ? (
        <div className="adm-card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46", fontSize: 13 }}>
          {msg}
        </div>
      ) : null}

      <div className="adm-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>GET Havuzu Özeti</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)" }}>
              {pool?.name || "Güvenli Öde havuzu"}
              {pool?.bank ? ` · ${pool.bank}` : ""}
              {pool?.iban ? ` · ${pool.iban}` : ""}
            </p>
          </div>
          <button type="button" className="btn-outline" disabled={busy} onClick={processTimeouts} style={{ padding: "8px 12px" }}>
            Süre aşımlarını işle
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 14 }}>
          {[
            { t: "Havuzda tutulan", v: formatTl(summary?.heldTl || 0), s: `${summary?.heldCount || 0} işlem` },
            { t: "Satıcıya ödenen", v: formatTl(summary?.releasedTl || 0), s: `${summary?.releasedCount || 0} işlem` },
            { t: "İade edilen", v: formatTl(summary?.refundedTl || 0), s: `${summary?.refundedCount || 0} işlem` },
            { t: "Anlaşmazlık", v: String(summary?.byStatus?.DISPUTED || 0), s: "açık kayıt" },
          ].map((c) => (
            <div key={c.t} style={{ background: "#f8fafc", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)" }}>{c.t}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{c.v}</div>
              <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{c.s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Güvenli Öde İşlemleri</h2>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Tüm durumlar</option>
            {[
              "AWAITING_PAYMENT",
              "FUNDED",
              "AWAITING_SHIPMENT",
              "SHIPPED",
              "BUYER_REVIEW",
              "RELEASED",
              "REFUNDED",
              "DISPUTED",
              "CANCELLED",
              "EXPIRED",
            ].map((s) => (
              <option key={s} value={s}>
                {escrowStatusLabelTr(s)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İlan</th>
                <th>Alıcı</th>
                <th>Satıcı</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleString("tr-TR")}</td>
                  <td>
                    {d.listing ? (
                      <Link href={`/ilan/${d.listing.id}`} target="_blank">
                        {d.listing.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{d.buyer?.name || d.buyer?.phone || "—"}</td>
                  <td>{d.seller?.name || d.seller?.phone || "—"}</td>
                  <td>
                    <strong>{formatTl(d.amountTl)}</strong>
                    <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>Ödeme: {formatTl(d.sellerPayoutTl)}</div>
                  </td>
                  <td>{escrowStatusLabelTr(d.status)}</td>
                  <td>
                    <button type="button" className="btn-outline" style={{ padding: "4px 8px" }} onClick={() => setSelected(d)}>
                      Yönet
                    </button>
                  </td>
                </tr>
              ))}
              {!deals.length && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--adm-muted)", padding: 16 }}>
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Güvenli Öde Kuralları (Admin)</h2>
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
          Komisyon, kargo süreleri (3/7/10), alıcı onay süresi, satıcı/alıcı süre aşımı aksiyonları ve havuz bilgileri
          buradan yönetilir.
        </p>
        <AdminSettingsPanel onlyGroups={["escrow"]} />
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)", padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>İşlem yönetimi</h3>
            <div style={{ fontSize: 13, display: "grid", gap: 6, marginBottom: 12 }}>
              <div>
                <strong>{selected.listing?.title}</strong>
              </div>
              <div>Durum: {escrowStatusLabelTr(selected.status)}</div>
              <div>Tutar: {formatTl(selected.amountTl)} · Satıcıya: {formatTl(selected.sellerPayoutTl)}</div>
              <div>IBAN: {selected.sellerIbanSnapshot || selected.seller?.iban || "—"}</div>
              {selected.cargoTrackingNo ? <div>Kargo: {selected.cargoCarrier} {selected.cargoTrackingNo}</div> : null}
              {selected.cargoReceiptUrl ? (
                <a href={selected.cargoReceiptUrl} target="_blank" rel="noreferrer">
                  Kargo fişi
                </a>
              ) : null}
            </div>
            <textarea
              className="input"
              rows={3}
              placeholder="Admin notu / anlaşmazlık gerekçesi"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button
                type="button"
                className="btn-orange"
                disabled={busy}
                onClick={() => adminAction("escrow-release", selected.id)}
              >
                Satıcıya serbest bırak
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={() => adminAction("escrow-refund", selected.id)}
              >
                Alıcıya iade
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={() => adminAction("escrow-dispute", selected.id)}
              >
                Anlaşmazlık aç
              </button>
              <button type="button" className="btn-outline" onClick={() => setSelected(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
