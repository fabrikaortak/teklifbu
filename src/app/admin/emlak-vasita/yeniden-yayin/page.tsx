"use client";

import { AdminListingApprovalPanel } from "@/components/admin/AdminListingApprovalPanel";

export default function EmlakVasitaYenidenYayinPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Yeniden yayın (sonuçlanan)</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Sonuçlanan ilanını yeniden yayınlamak isteyen satıcıların talepleri. Sebep satıcı tarafından
          seçilir; onay sonrası ilan tekrar yayına girer.
        </p>
      </div>
      <AdminListingApprovalPanel vertical="emlak-vasita" republishOnly />
    </div>
  );
}
