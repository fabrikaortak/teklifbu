"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SpEmpty, SpStatus } from "@/components/magaza/MagazaPanelShell";
import { formatTl } from "@/lib/format";

type Row = {
  id: string;
  listingNo: string;
  title: string;
  status: string;
  askPrice: number;
  coverImage: string | null;
  city: string;
  district: string | null;
  escrowEligible: boolean;
  questionCount: number;
  orderCount: number;
};

const STATUS_TR: Record<string, string> = {
  ACTIVE: "Yayında",
  SELECTION: "Seçim",
  PENDING_REVIEW: "Onay bekliyor",
  REJECTED: "Reddedildi",
  APPROVED: "Sonuçlandı",
  EXPIRED: "Süresi doldu",
  DRAFT: "Taslak",
  ARCHIVED: "Arşiv",
};

function toneFor(status: string) {
  if (status === "ACTIVE" || status === "SELECTION") return "ok";
  if (status === "PENDING_REVIEW") return "warn";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

export default function MagazaIlanlarPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/magaza/panel?view=listings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setRows(d.listings || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Hata"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="sp-card">İlanlar yükleniyor…</div>;
  if (error) return <div className="sp-alert">{error}</div>;

  return (
    <div className="sp-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 className="sp-h2">İlanlar & kargo uygunluğu</h2>
          <p className="sp-muted">
            Mağaza ilanlarınız. Güvenli Öde açık olanlar sipariş/kargo akışına girebilir.
          </p>
        </div>
        <Link href="/ilan-ver" className="sp-btn" style={{ textDecoration: "none" }}>
          Yeni ilan
        </Link>
      </div>

      {!rows.length ? (
        <SpEmpty>Henüz ilan yok. İlk ürününüzü ekleyin.</SpEmpty>
      ) : (
        <div style={{ marginTop: 8 }}>
          {rows.map((r) => (
            <div key={r.id} className="sp-row">
              {r.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverImage} alt="" className="sp-thumb" />
              ) : (
                <div className="sp-thumb-ph" />
              )}
              <div>
                <p className="sp-row-title">{r.title}</p>
                <div className="sp-row-meta">
                  #{r.listingNo} · {[r.district, r.city].filter(Boolean).join(", ")} ·{" "}
                  {formatTl(r.askPrice)}
                  {r.questionCount ? ` · ${r.questionCount} soru` : ""}
                  {r.orderCount ? ` · ${r.orderCount} sipariş` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <SpStatus tone={toneFor(r.status)}>{STATUS_TR[r.status] || r.status}</SpStatus>
                  {r.escrowEligible ? (
                    <SpStatus tone="info">Güvenli Öde</SpStatus>
                  ) : (
                    <SpStatus>Kargo siparişi kapalı</SpStatus>
                  )}
                </div>
              </div>
              <div className="sp-actions" style={{ marginTop: 0 }}>
                <Link href={`/ilan/${r.id}`} className="sp-btn-outline">
                  Görüntüle
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
