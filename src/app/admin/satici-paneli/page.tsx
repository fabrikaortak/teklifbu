"use client";

import { AdminSellerPanelOverview } from "@/components/admin/AdminSellerStorePanel";

export default function AdminSaticiPaneliPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Satıcı / Mağaza Paneli</h1>
          <p>Mağaza siparişleri, soru–cevap ve satıcı paneli operasyon özeti.</p>
        </div>
      </div>
      <AdminSellerPanelOverview />
    </div>
  );
}
