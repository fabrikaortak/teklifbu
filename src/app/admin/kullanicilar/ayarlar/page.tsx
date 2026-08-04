"use client";

import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

export default function AdminUsersSettingsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kullanıcı Ayarları</h1>
          <p>
            Kurumsal üyelik, işletme tipleri, onay ve mağaza paket kuralları. Onay listesi Kullanıcılar → Kurumsal
            Onay’dadır.
          </p>
        </div>
      </div>
      <AdminSettingsPanel onlyGroups={["commercial"]} />
    </div>
  );
}
