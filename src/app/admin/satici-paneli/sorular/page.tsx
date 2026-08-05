"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AdminSellerPanelQuestions } from "@/components/admin/AdminSellerStorePanel";

function Inner() {
  const sp = useSearchParams();
  const f = sp.get("f") || "open";
  return <AdminSellerPanelQuestions initialFilter={f} />;
}

export default function Page() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Soru–Cevap</h1>
          <p>Ürün soruları, SLA aşanlar ve satıcı yanıtları.</p>
        </div>
      </div>
      <Suspense fallback={<div className="adm-card">Yükleniyor…</div>}>
        <Inner />
      </Suspense>
    </div>
  );
}
