"use client";

import { AdminCommercialUsersPanel } from "@/components/admin/AdminCommercialUsersPanel";

export default function AdminTicariUyelerPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kurumsal Onay</h1>
          <p>Kurumsal üyelik başvurularını ve güncelleme taleplerini onaylayın veya reddedin.</p>
        </div>
      </div>
      <AdminCommercialUsersPanel />
    </div>
  );
}
