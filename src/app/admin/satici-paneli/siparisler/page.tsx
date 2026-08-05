"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AdminSellerPanelOrders } from "@/components/admin/AdminSellerStorePanel";

function Inner() {
  const sp = useSearchParams();
  const t = sp.get("t") || "ship";
  return <AdminSellerPanelOrders initialTab={t} />;
}

export default function Page() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Sipariş & Kargo</h1>
          <p>Kargo bekleyen, yolda, anlaşmazlık, tamamlanan ve iade siparişleri.</p>
        </div>
      </div>
      <Suspense fallback={<div className="adm-card">Yükleniyor…</div>}>
        <Inner />
      </Suspense>
    </div>
  );
}
