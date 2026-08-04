"use client";

import { AdminLogsPanel } from "@/components/admin/AdminPanels";

export default function AdminLogsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Log Kayıtları</h1>
          <p>Admin ve sistem işlemlerinin denetim izi (AuditLog).</p>
        </div>
      </div>
      <AdminLogsPanel />
    </div>
  );
}
