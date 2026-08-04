import { AdminTokenRefundsPanel } from "@/components/admin/AdminTokenRefundsPanel";

export default function AdminTokenRefundsPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>İade Jetonlar</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
          İlan değişikliği sonrası teklif silme/güncelleme ile iade edilen jetonlar.
        </p>
      </div>
      <AdminTokenRefundsPanel />
    </div>
  );
}
