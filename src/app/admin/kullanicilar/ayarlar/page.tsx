"use client";

import { AdminSettingsPanel } from "@/components/admin/AdminPanels";
import { AdminCommercialPublishMapPanel } from "@/components/admin/AdminCommercialPublishMapPanel";

export default function AdminUsersSettingsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kullanıcı Ayarları</h1>
          <p>
            Kurumsal üyelik, işletme tipleri, faaliyet→ilan formu eşlemesi, onay ve mağaza paket
            kuralları. Onay listesi Kullanıcılar → Kurumsal Onay’dadır.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        <AdminCommercialPublishMapPanel />
        <AdminSettingsPanel
          onlyGroups={["commercial"]}
          excludeKeys={["commercial_publish_map"]}
        />
      </div>
    </div>
  );
}
