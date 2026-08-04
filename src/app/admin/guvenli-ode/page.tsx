"use client";

import { AdminEscrowPanel } from "@/components/admin/AdminEscrowPanel";

export default function AdminGuvenliOdePage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Güvenli Öde / GET Havuzu</h1>
          <p>Escrow işlemleri, havuz bakiyesi ve güvenli ödeme kuralları.</p>
        </div>
      </div>
      <AdminEscrowPanel />
    </div>
  );
}
