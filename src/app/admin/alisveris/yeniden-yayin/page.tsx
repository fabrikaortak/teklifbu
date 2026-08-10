"use client";

import { AdminListingApprovalPanel } from "@/components/admin/AdminListingApprovalPanel";

export default function AlisverisYenidenYayinPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Yeniden yayın (sonuçlanan)</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Sonuçlanan alışveriş ilanlarını yeniden yayınlama talepleri.
        </p>
      </div>
      <AdminListingApprovalPanel vertical="alisveris" republishOnly />
    </div>
  );
}
