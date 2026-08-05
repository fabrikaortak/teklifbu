"use client";

import { AdminSellerPanelSettings } from "@/components/admin/AdminSellerStorePanel";

export default function Page() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Satıcı Paneli Ayarları</h1>
          <p>
            Panel izinleri, komisyon, ilan ücretleri / kota ve mağaza paket satış kuralları.
          </p>
        </div>
      </div>
      <AdminSellerPanelSettings />
    </div>
  );
}
