"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SpEmpty, SpStatus } from "@/components/magaza/MagazaPanelShell";
import { formatTl } from "@/lib/format";

type Order = {
  id: string;
  status: string;
  amountTl: number;
  sellerPayoutTl: number;
  shipDays: number;
  cargoTrackingNo: string | null;
  cargoCarrier: string | null;
  shippedAt: string | null;
  shipDeadlineAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    coverImage: string | null;
    listingNo: string | null;
    isCatalog?: boolean;
    productId?: string | null;
  } | null;
  buyer: { id: string; name: string | null };
};

const STATUS_TR: Record<string, { label: string; tone: string }> = {
  AWAITING_PAYMENT: { label: "Ödeme bekliyor", tone: "neutral" },
  FUNDED: { label: "Ödendi — kargo hazırla", tone: "warn" },
  AWAITING_SHIPMENT: { label: "Kargo bekliyor", tone: "warn" },
  SHIPPED: { label: "Kargoda", tone: "info" },
  BUYER_REVIEW: { label: "Alıcı incelemesi", tone: "info" },
  RELEASED: { label: "Tamamlandı", tone: "ok" },
  REFUNDED: { label: "İade edildi", tone: "danger" },
  DISPUTED: { label: "Anlaşmazlık", tone: "danger" },
  CANCELLED: { label: "İptal", tone: "neutral" },
  EXPIRED: { label: "Süresi doldu", tone: "neutral" },
};

export default function MagazaSiparislerPage() {
  const [tab, setTab] = useState("ship");
  const [rows, setRows] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, { tracking: string; carrier: string; note: string }>>({});
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const q = tab === "all" ? "" : `&status=${tab}`;
    fetch(`/api/magaza/panel?view=orders${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setRows(d.orders || []);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Hata"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  function form(id: string) {
    return forms[id] || { tracking: "", carrier: "", note: "" };
  }

  async function submitCargo(id: string) {
    const f = form(id);
    if (!f.tracking.trim()) {
      setError("Kargo takip numarası gerekli");
      return;
    }
    setBusy(id);
    try {
      const res = await fetch("/api/magaza/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit-cargo",
          dealId: id,
          cargoTrackingNo: f.tracking,
          cargoCarrier: f.carrier,
          cargoNote: f.note,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Kargo kaydı başarısız");
        return;
      }
      load();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="sp-card">
      <h2 className="sp-h2">Sipariş / kargo / iade</h2>
      <p className="sp-muted">
        Güvenli Öde siparişlerinizi yönetin. Ödeme alındıktan sonra kargo bilgisi girin; alıcı onaylayınca ödeme
        serbest kalır.
      </p>

      <div className="sp-filters" style={{ marginTop: 12 }}>
        {(
          [
            ["ship", "Kargo bekleyen"],
            ["transit", "Yolda"],
            ["dispute", "Anlaşmazlık / iade"],
            ["done", "Tamamlanan"],
            ["all", "Tümü"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`sp-filter${tab === k ? " is-active" : ""}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="sp-alert" style={{ marginTop: 10 }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Yükleniyor…</div> : null}

      {!loading && !rows.length ? (
        <SpEmpty>Bu filtrede sipariş yok.</SpEmpty>
      ) : (
        <div style={{ marginTop: 8 }}>
          {rows.map((o) => {
            const st = STATUS_TR[o.status] || { label: o.status, tone: "neutral" };
            const canShip = o.status === "AWAITING_SHIPMENT" || o.status === "FUNDED";
            // FUNDED might not accept cargo - escrow only AWAITING_SHIPMENT. Keep UI for AWAITING_SHIPMENT only.
            const shipOk = o.status === "AWAITING_SHIPMENT";
            return (
              <div key={o.id} className="sp-row" style={{ gridTemplateColumns: "56px 1fr", alignItems: "start" }}>
                {o.listing?.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.listing.coverImage} alt="" className="sp-thumb" />
                ) : (
                  <div className="sp-thumb-ph" />
                )}
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <SpStatus tone={st.tone}>{st.label}</SpStatus>
                    <span className="sp-row-meta">{formatTl(o.amountTl)}</span>
                  </div>
                  <p className="sp-row-title">{o.listing?.title || "Katalog sipariş"}</p>
                  <div className="sp-row-meta">
                    Alıcı: {o.buyer.name || "—"} · {new Date(o.createdAt).toLocaleString("tr-TR")}
                    {o.cargoTrackingNo ? ` · ${o.cargoCarrier || "Kargo"} ${o.cargoTrackingNo}` : ""}
                  </div>
                  <div className="sp-actions">
                    {o.listing?.isCatalog && o.listing.productId ? (
                      <Link href={`/urun/${o.listing.productId}`} className="sp-btn-outline">
                        Ürün
                      </Link>
                    ) : o.listing?.id ? (
                      <Link href={`/ilan/${o.listing.id}`} className="sp-btn-outline">
                        İlan
                      </Link>
                    ) : null}
                  </div>
                  {shipOk ? (
                    <div style={{ marginTop: 12, display: "grid", gap: 8, maxWidth: 480 }}>
                      <input
                        className="sp-input"
                        placeholder="Kargo takip no *"
                        value={form(o.id).tracking}
                        onChange={(e) =>
                          setForms((f) => ({
                            ...f,
                            [o.id]: { ...form(o.id), tracking: e.target.value },
                          }))
                        }
                      />
                      <input
                        className="sp-input"
                        placeholder="Kargo firması (Yurtiçi, MNG…)"
                        value={form(o.id).carrier}
                        onChange={(e) =>
                          setForms((f) => ({
                            ...f,
                            [o.id]: { ...form(o.id), carrier: e.target.value },
                          }))
                        }
                      />
                      <input
                        className="sp-input"
                        placeholder="Not (opsiyonel)"
                        value={form(o.id).note}
                        onChange={(e) =>
                          setForms((f) => ({
                            ...f,
                            [o.id]: { ...form(o.id), note: e.target.value },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="sp-btn"
                        disabled={busy === o.id}
                        onClick={() => void submitCargo(o.id)}
                      >
                        {busy === o.id ? "Kaydediliyor…" : "Kargoya verildi olarak işaretle"}
                      </button>
                    </div>
                  ) : null}
                  {canShip && !shipOk ? (
                    <p className="sp-muted" style={{ marginTop: 8 }}>
                      Sipariş kargo aşamasına geçince takip no girebilirsiniz.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
