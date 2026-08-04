"use client";

import { AdminTokensPanel } from "@/components/admin/AdminPanels";

export default function AdminTokensPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Jeton Paketleri</h1>
          <p>Teklif jeton paketlerini ekleyin veya düzenleyin.</p>
        </div>
      </div>
      <AdminTokensPanel />
    </div>
  );
}
