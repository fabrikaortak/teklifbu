"use client";

import { AdminUsersPanel } from "@/components/admin/AdminPanels";

export default function AdminUsersPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kullanıcılar</h1>
          <p>
            Üye hesaplarını görüntüleyin ve aktif/pasif durumunu yönetin. Sekmelerle bireysel / kurumsal
            ve faaliyet alanına göre filtreleyin.
          </p>
        </div>
      </div>
      <AdminUsersPanel />
    </div>
  );
}
