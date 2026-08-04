import { AdminSellerRequestPanel } from "@/components/admin/AdminSellerRequestPanel";

export default function AdminSellerRequestsPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Satıcı Talepleri</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
          Teklif alan ilanlarda satıcının düzenleme talebi. Alan seçip satıcıya iletin; gelen
          değişikliği onaylayınca teklif verenler bilgilendirilir.
        </p>
      </div>
      <AdminSellerRequestPanel />
    </div>
  );
}
