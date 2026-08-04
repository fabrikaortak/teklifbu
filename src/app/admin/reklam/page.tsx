"use client";

import { AdminAdsPanel } from "@/components/admin/AdminAdsPanel";
import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

export default function AdminAdsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Reklam Ayarları</h1>
          <p>
            Kuşak bannerları, orta slaytlar, sağ alt banner ve reklam zamanlama / boyut ayarları. GIF desteklenir.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        <AdminSettingsPanel onlyGroups={["ads"]} />
        <AdminAdsPanel />
      </div>
    </div>
  );
}
