"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTl } from "@/lib/format";
import { ESCROW_STATUS_LABELS_TR, escrowStatusLabelTr } from "@/lib/escrowTypes";
import { AdminToast } from "@/components/admin/AdminToast";

type DealRow = {
  id: string;
  status: string;
  amountTl: number;
  commissionTl: number;
  sellerPayoutTl: number;
  shipDays: number;
  cargoTrackingNo?: string | null;
  cargoCarrier?: string | null;
  createdAt: string;
  shippedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  listing?: {
    id: string;
    title: string;
    listingNo?: string | null;
    coverImage?: string | null;
  } | null;
  linkedOrder?: {
    id: string;
    orderNo: string;
    items?: Array<{
      productNameSnapshot: string;
      variantTitleSnapshot?: string | null;
      productId?: string | null;
    }>;
  } | null;
  sellerOffer?: {
    id: string;
    product?: { id: string; name: string; mainImage?: string | null } | null;
    variant?: { title: string } | null;
  } | null;
  buyer?: { id: string; name?: string | null; phone?: string | null } | null;
  seller?: { id: string; name?: string | null; phone?: string | null } | null;
};

function dealDisplayTitle(d: DealRow): string {
  if (d.listing?.title) return d.listing.title;
  const item = d.linkedOrder?.items?.[0];
  if (item?.productNameSnapshot) {
    return `${item.productNameSnapshot}${
      item.variantTitleSnapshot ? ` · ${item.variantTitleSnapshot}` : ""
    }`;
  }
  if (d.sellerOffer?.product?.name) {
    return `${d.sellerOffer.product.name}${
      d.sellerOffer.variant?.title ? ` · ${d.sellerOffer.variant.title}` : ""
    }`;
  }
  if (d.linkedOrder?.orderNo) return `Sipariş ${d.linkedOrder.orderNo}`;
  return "Katalog sipariş";
}

function dealProductHref(d: DealRow): string | null {
  if (d.listing?.id) return `/ilan/${d.listing.id}`;
  const productId = d.linkedOrder?.items?.[0]?.productId || d.sellerOffer?.product?.id;
  return productId ? `/urun/${productId}` : null;
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tümü" },
  { key: "AWAITING_PAYMENT", label: "Ödeme bekliyor" },
  { key: "AWAITING_SHIPMENT", label: "Kargo bekliyor" },
  { key: "SHIPPED", label: "Kargoda" },
  { key: "BUYER_REVIEW", label: "Alıcı onayı" },
  { key: "DISPUTED", label: "Anlaşmazlık" },
  { key: "RELEASED", label: "Tamamlandı" },
  { key: "REFUNDED", label: "İade" },
  { key: "CANCELLED", label: "İptal" },
];

function statusTone(status: string): string {
  switch (status) {
    case "RELEASED":
      return "ok";
    case "REFUNDED":
    case "DISPUTED":
    case "CANCELLED":
    case "EXPIRED":
      return "danger";
    case "AWAITING_PAYMENT":
    case "AWAITING_SHIPMENT":
    case "FUNDED":
      return "warn";
    case "SHIPPED":
    case "BUYER_REVIEW":
      return "info";
    default:
      return "neutral";
  }
}

function Pill({ label, tone }: { label: string; tone: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ok: { bg: "#dcfce7", color: "#166534" },
    warn: { bg: "#fef3c7", color: "#92400e" },
    danger: { bg: "#fee2e2", color: "#991b1b" },
    info: { bg: "#dbeafe", color: "#1e40af" },
    neutral: { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[tone] || map.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 800,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function AdminShoppingOrdersPanel() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list-escrow",
            status: status || undefined,
            q: q || undefined,
            take: 200,
          }),
        }),
        fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "escrow-pool-summary" }),
        }),
      ]);
      const list = await listRes.json().catch(() => ({}));
      const sum = await sumRes.json().catch(() => ({}));
      if (listRes.ok) setDeals(list.deals || []);
      if (sumRes.ok && sum.summary?.byStatus) setByStatus(sum.summary.byStatus);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalCount = useMemo(
    () => Object.values(byStatus).reduce((a, n) => a + Number(n || 0), 0),
    [byStatus]
  );

  async function adminAction(action: string, dealId: string) {
    setBusy(dealId + action);
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dealId, note: note || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.error || "İşlem başarısız");
        return;
      }
      setMsg("Sipariş güncellendi");
      await load();
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <AdminToast
        message={msg || null}
        tone={/başarısız|Hata|hata/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10,
        }}
      >
        <div className="adm-card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)" }}>Toplam</div>
          <div style={{ fontSize: 20, fontWeight: 850, marginTop: 2 }}>{totalCount}</div>
        </div>
        {(
          [
            "AWAITING_SHIPMENT",
            "SHIPPED",
            "BUYER_REVIEW",
            "DISPUTED",
            "RELEASED",
            "REFUNDED",
            "AWAITING_PAYMENT",
          ] as const
        ).map((key) => (
          <button
            key={key}
            type="button"
            className="adm-card"
            style={{
              padding: 12,
              textAlign: "left",
              cursor: "pointer",
              borderColor: status === key ? "#f97316" : undefined,
            }}
            onClick={() => setStatus(status === key ? "" : key)}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)" }}>
              {ESCROW_STATUS_LABELS_TR[key]}
            </div>
            <div style={{ fontSize: 20, fontWeight: 850, marginTop: 2 }}>{byStatus[key] || 0}</div>
          </button>
        ))}
      </div>

      <div className="adm-card" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key || "all"}
                type="button"
                className={status === f.key ? "btn-orange" : "btn-outline"}
                style={{ padding: "6px 11px", fontSize: 12.5 }}
                onClick={() => setStatus(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <form
            style={{ display: "flex", gap: 8, flex: "1 1 220px", maxWidth: 360 }}
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qDraft.trim());
            }}
          >
            <input
              className="input"
              placeholder="İlan, alıcı, satıcı, takip no…"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="submit" className="btn-outline" style={{ padding: "8px 12px" }}>
              Ara
            </button>
          </form>
        </div>

        {loading ? <div style={{ padding: 20, color: "var(--adm-muted)" }}>Yükleniyor…</div> : null}
        {!loading && !deals.length ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--adm-muted)", fontWeight: 600 }}>
            Sipariş bulunamadı.
          </div>
        ) : null}

        {!loading && deals.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Sipariş / İlan</th>
                  <th>Alıcı</th>
                  <th>Satıcı</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Kargo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const tone = statusTone(d.status);
                  const orderRef =
                    d.linkedOrder?.orderNo ||
                    d.listing?.listingNo ||
                    d.id.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase();
                  const title = dealDisplayTitle(d);
                  const href = dealProductHref(d);
                  return (
                    <tr key={d.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(d.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <div style={{ fontSize: 11, color: "var(--adm-muted)", fontWeight: 700 }}>
                          #{orderRef}
                        </div>
                        {href ? (
                          <Link href={href} target="_blank" style={{ fontWeight: 700 }}>
                            {title}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 700 }}>{title}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 650 }}>{d.buyer?.name || "—"}</div>
                        <div style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>
                          {d.buyer?.phone || ""}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 650 }}>{d.seller?.name || "—"}</div>
                        <div style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>
                          {d.seller?.phone || ""}
                        </div>
                      </td>
                      <td>
                        <strong>{formatTl(d.amountTl)}</strong>
                        {d.commissionTl > 0 ? (
                          <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>
                            Komisyon {formatTl(d.commissionTl)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <Pill label={escrowStatusLabelTr(d.status)} tone={tone} />
                      </td>
                      <td style={{ fontSize: 12, color: "var(--adm-muted)", maxWidth: 140 }}>
                        {d.cargoTrackingNo
                          ? `${d.cargoCarrier || "Kargo"} · ${d.cargoTrackingNo}`
                          : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <Link
                            href="/admin/guvenli-ode"
                            className="btn-outline"
                            style={{ padding: "5px 9px", fontSize: 12, textDecoration: "none" }}
                          >
                            Havuz
                          </Link>
                          {d.status === "DISPUTED" ? (
                            <>
                              <button
                                type="button"
                                className="btn-orange"
                                style={{ padding: "5px 9px", fontSize: 12 }}
                                disabled={!!busy}
                                onClick={() => void adminAction("escrow-release", d.id)}
                              >
                                Satıcıya öde
                              </button>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ padding: "5px 9px", fontSize: 12 }}
                                disabled={!!busy}
                                onClick={() => void adminAction("escrow-refund", d.id)}
                              >
                                İade
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {deals.some((d) => d.status === "DISPUTED") ? (
          <div style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Anlaşmazlık işlemleri için admin notu (opsiyonel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
