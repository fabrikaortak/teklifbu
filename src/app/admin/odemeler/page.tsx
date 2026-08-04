"use client";

import { AdminPaymentsPanel } from "@/components/admin/AdminPanels";

export default function AdminPaymentsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Ödeme Kayıtları</h1>
          <p>Ödeme geçmişi ve detaylar. POS / jeton ve simülasyon için Ödemeler → Altyapı.</p>
        </div>
      </div>
      <AdminPaymentsPanel />
    </div>
  );
}
