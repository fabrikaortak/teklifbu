"use client";

import { AdminStaffPanel } from "@/components/admin/AdminStaffPanel";

export default function AdminSubAdminsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Alt yöneticiler</h1>
          <p>
            Aynı giriş ile panele giren ama yalnızca sizin seçtiğiniz menüleri, dikeyleri, işlemleri
            ve ayar gruplarını gören alt admin atayın. Hazır paketlerle hızlı başlayıp kutucuklarla
            ince ayar yapabilirsiniz.
          </p>
        </div>
      </div>
      <AdminStaffPanel />
    </div>
  );
}
