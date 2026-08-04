"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Refund = {
  id: string;
  amount: number;
  reason: string;
  description: string;
  bidId?: string | null;
  createdAt: string;
  user?: { id: string; name?: string | null; phone?: string | null } | null;
  listing?: { id: string; title: string; listingNo?: string | null } | null;
};

function reasonLabel(reason: string) {
  switch (reason) {
    case "listing_change_withdraw":
      return "İlan değişikliği — teklif silindi";
    case "listing_change_revise":
      return "İlan değişikliği — teklif güncellendi";
    default:
      return reason;
  }
}

export function AdminTokenRefundsPanel() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin?view=token-refunds")
      .then((r) => r.json())
      .then((d) => setRefunds(d.refunds || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card" style={{ padding: 18 }}>Yükleniyor...</div>;

  return (
    <div className="card" style={{ overflow: "auto", padding: 0 }}>
      <table className="adm-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Kullanıcı</th>
            <th>İlan</th>
            <th>Jeton</th>
            <th>Tür</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {!refunds.length && (
            <tr>
              <td colSpan={6} style={{ padding: 16, color: "var(--muted)" }}>
                Henüz jeton iadesi yok.
              </td>
            </tr>
          )}
          {refunds.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: "nowrap" }}>
                {new Date(r.createdAt).toLocaleString("tr-TR")}
              </td>
              <td>
                {r.user?.name || "—"}
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.user?.phone}</div>
              </td>
              <td>
                {r.listing ? (
                  <Link href={`/ilan/${r.listing.id}`}>{r.listing.title}</Link>
                ) : (
                  "—"
                )}
                {r.listing?.listingNo ? (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>#{r.listing.listingNo}</div>
                ) : null}
              </td>
              <td style={{ fontWeight: 800, color: "#0f766e" }}>+{r.amount}</td>
              <td style={{ fontSize: 13 }}>{reasonLabel(r.reason)}</td>
              <td style={{ maxWidth: 360, fontSize: 13, lineHeight: 1.4 }}>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
