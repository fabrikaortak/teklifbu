"use client";

import { AdminUserSettingsPanel } from "@/components/admin/AdminUserSettingsPanel";
import { AdminListingQuotaPanel } from "@/components/admin/AdminListingQuotaPanel";
import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

export default function AdminUserSettingsPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Kullanıcı Ayarları</h1>
          <p>
            Profil alanları, ilan hakkı / ücretler, kimlik doğrulama, bildirimler, hesap ve EİDS kuralları.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        <AdminListingQuotaPanel />
        <AdminUserSettingsPanel />
        <AdminSettingsPanel
          onlyGroups={["auth", "account", "notification", "eids"]}
          excludeKeys={[
            "listing_fee_mode",
            "listing_free_quota",
            "listing_free_quota_by_account_type",
            "listing_fee_tl",
            "listing_fee_by_account_type",
            "listing_fee_vat_percent",
            "listing_fee_prices_include_vat",
          ]}
        />
      </div>
    </div>
  );
}
