"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SpEmpty, SpKpi } from "@/components/magaza/MagazaPanelShell";
import { MessageCircleQuestion, Package, Truck } from "lucide-react";

type Overview = {
  shop: { name: string; packageName: string | null; listingLimit: number | null };
  kpis: {
    activeListings: number;
    pendingListings: number;
    unansweredQuestions: number;
    overdueQuestions: number;
    awaitShip: number;
    overdueShip: number;
    shipped: number;
    disputes: number;
    released: number;
    qaSlaHours: number;
    shipReminderHours: number;
  };
  access: { modules: { listings: boolean; questions: boolean; orders: boolean } };
};

export default function MagazaPanelHomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/magaza/panel?view=overview")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Hata"));
  }, []);

  if (error) return <div className="sp-alert">{error}</div>;
  if (!data) return <div className="sp-card">Özet yükleniyor…</div>;

  const k = data.kpis;
  const m = data.access.modules;

  return (
    <>
      <div className="sp-card">
        <h2 className="sp-h2">Mağaza özeti</h2>
        <p className="sp-muted">
          {data.shop.name}
          {data.shop.packageName
            ? ` · Paket: ${data.shop.packageName}${
                data.shop.listingLimit != null ? ` (${data.shop.listingLimit} ilan hakkı)` : ""
              }`
            : ""}
        </p>
        <div className="sp-kpi-grid" style={{ marginTop: 14 }}>
          <SpKpi label="Aktif ilan" value={k.activeListings} tone="ok" />
          <SpKpi label="Onay bekleyen" value={k.pendingListings} tone={k.pendingListings ? "warn" : "neutral"} />
          {m.questions ? (
            <SpKpi
              label="Yanıtsız soru"
              value={k.unansweredQuestions}
              tone={k.overdueQuestions ? "danger" : k.unansweredQuestions ? "warn" : "ok"}
              hint={k.overdueQuestions ? `${k.overdueQuestions} SLA aştı (${k.qaSlaHours}s)` : `SLA ${k.qaSlaHours}s`}
            />
          ) : null}
          {m.orders ? (
            <>
              <SpKpi
                label="Kargo bekleyen"
                value={k.awaitShip}
                tone={k.overdueShip ? "danger" : k.awaitShip ? "warn" : "ok"}
                hint={k.overdueShip ? `${k.overdueShip} gecikmiş` : undefined}
              />
              <SpKpi label="Yolda / inceleme" value={k.shipped} />
              <SpKpi label="Anlaşmazlık" value={k.disputes} tone={k.disputes ? "danger" : "neutral"} />
              <SpKpi label="Tamamlanan" value={k.released} />
            </>
          ) : null}
        </div>
      </div>

      {(k.overdueQuestions > 0 || k.overdueShip > 0 || k.disputes > 0) && (
        <div className="sp-alert">
          Dikkat:{" "}
          {[
            k.overdueQuestions ? `${k.overdueQuestions} geciken soru` : null,
            k.overdueShip ? `${k.overdueShip} geciken kargo` : null,
            k.disputes ? `${k.disputes} anlaşmazlık` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          . Öncelikli işlemleri panellerden tamamlayın.
        </div>
      )}

      <div className="sp-quick">
        {m.listings ? (
          <Link href="/magaza/panel/ilanlar">
            <Package size={18} color="#ea580c" />
            <strong>İlanları yönet</strong>
            <span>Yayın, onay ve Güvenli Öde uygunluğu</span>
          </Link>
        ) : null}
        {m.questions ? (
          <Link href="/magaza/panel/sorular">
            <MessageCircleQuestion size={18} color="#ea580c" />
            <strong>Soruları yanıtla</strong>
            <span>{k.unansweredQuestions} açık soru</span>
          </Link>
        ) : null}
        {m.orders ? (
          <Link href="/magaza/panel/siparisler">
            <Truck size={18} color="#ea580c" />
            <strong>Sipariş & kargo</strong>
            <span>{k.awaitShip} kargo bekliyor</span>
          </Link>
        ) : null}
      </div>

      {!m.listings && !m.questions && !m.orders ? (
        <SpEmpty>Tüm satıcı paneli modülleri yönetici tarafından kapatılmış.</SpEmpty>
      ) : null}
    </>
  );
}
