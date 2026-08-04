"use client";

import { AdminUserSettingsPanel } from "@/components/admin/AdminUserSettingsPanel";
import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

export default function AdminUserSettingsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kullanıcı Ayarları</h1>
          <p>
            Profil form alanları, kimlik doğrulama, bildirimler, hesap ve EİDS kuralları.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        <AdminUserSettingsPanel />
        <AdminSettingsPanel onlyGroups={["auth", "account", "notification", "eids"]} />
      </div>
    </div>
  );
}
