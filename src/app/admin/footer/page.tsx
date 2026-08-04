"use client";

import { AdminFooterPanel } from "@/components/admin/AdminFooterPanel";

export default function AdminFooterPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Footer / Alt Bilgi</h1>
          <p>
            Sitenin en altındaki müşteri hizmetleri, adres, sicil, MERSİS, yasal metin ve uygulama linklerini
            buradan düzenleyin.
          </p>
        </div>
      </div>
      <AdminFooterPanel />
    </div>
  );
}
