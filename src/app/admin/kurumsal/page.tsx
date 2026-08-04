"use client";

import { AdminShopsManagePanel } from "@/components/admin/AdminPanels";

export default function AdminShopsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kurumsal Paketler & Mağazalar</h1>
          <p>Tenant altındaki mağazalara abonelik atayın ve paketleri yönetin. Satış / jeton kuralları Ödemeler → Ayarlar’da.</p>
        </div>
      </div>
      <AdminShopsManagePanel />
    </div>
  );
}
