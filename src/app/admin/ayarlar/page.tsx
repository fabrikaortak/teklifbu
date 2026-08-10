"use client";

import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

/** Platform geneli: teklif, PWA, süre dolunca / yaşam döngüsü, performans */
const SYSTEM_GROUPS = ["bid", "pwa", "lifecycle", "performance"];

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Sistem Ayarları</h1>
          <p>
            Teklif kuralları, PWA, ilan süresi dolunca davranışlar ve performans (rate limit / cache).
            Satıcı / mağaza paneli için menüde <strong>Satıcı paneli</strong> bölümüne gidin.
          </p>
        </div>
      </div>
      <AdminSettingsPanel onlyGroups={SYSTEM_GROUPS} />
    </div>
  );
}
