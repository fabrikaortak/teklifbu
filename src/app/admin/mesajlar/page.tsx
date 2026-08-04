"use client";

import { AdminMessagesPanel } from "@/components/admin/AdminPanels";

export default function AdminMessagesPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Mesajlar</h1>
          <p>Kullanıcılar arası mesaj trafiğini görüntüleyin.</p>
        </div>
      </div>
      <AdminMessagesPanel />
    </div>
  );
}
