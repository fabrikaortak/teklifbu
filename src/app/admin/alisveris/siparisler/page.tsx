"use client";

import { AdminShoppingOrdersPanel } from "@/components/admin/AdminShoppingOrdersPanel";

export default function Page() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Siparişler</h1>
          <p>Alışveriş Güvenli Öde siparişlerinin tüm durumları — ödeme, kargo, tamamlandı, iade.</p>
        </div>
      </div>
      <AdminShoppingOrdersPanel />
    </div>
  );
}
