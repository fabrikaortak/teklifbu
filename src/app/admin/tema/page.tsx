"use client";

import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

export default function AdminTemaPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Tema</h1>
          <p>Site görünümü, marka / renkler, ana sayfa grid, kuşaklar ve ilan detay düzeni.</p>
        </div>
      </div>
      <AdminSettingsPanel onlyGroups={["v2", "general"]} />
    </div>
  );
}
