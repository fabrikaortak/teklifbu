"use client";

import { AdminReportsPanel } from "@/components/admin/AdminPanels";

export default function AdminReportsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Raporlar</h1>
          <p>Tenant verilerine dayalı özet performans raporları.</p>
        </div>
      </div>
      <AdminReportsPanel />
    </div>
  );
}
