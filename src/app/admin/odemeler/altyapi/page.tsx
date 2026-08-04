"use client";

import { AdminPaymentInfraPanel } from "@/components/admin/AdminPaymentInfraPanel";

export default function AdminOdemeAltyapiPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Ödeme Altyapısı</h1>
          <p>Demo POS / jeton modu, ödeme simülasyonu ve sanal POS–jeton ayarları.</p>
        </div>
      </div>
      <AdminPaymentInfraPanel />
    </div>
  );
}
