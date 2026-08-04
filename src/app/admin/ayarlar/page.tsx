"use client";

import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

/** Platform geneli: teklif, PWA, süre dolunca / yaşam döngüsü */
const SYSTEM_GROUPS = ["bid", "pwa", "lifecycle"];

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Sistem Ayarları</h1>
          <p>
            Teklif kuralları, PWA ve ilan süresi dolunca (teklifli / teklifsiz / satın al) davranışları. Diğer ayarlar
            ilgili menülerdedir.
          </p>
        </div>
      </div>
      <AdminSettingsPanel onlyGroups={SYSTEM_GROUPS} />
    </div>
  );
}
