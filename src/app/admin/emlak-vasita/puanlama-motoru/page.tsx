"use client";

import { AdminTrustScorePanel } from "@/components/admin/AdminTrustScorePanel";

export default function EmlakVasitaPuanlamaMotoruPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Puanlama motoru</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Kullanıcı güven puanı kuralları. Olayları açıp kapatın, puan ve eşikleri seçin. Yeniden yayın
          doğrulama (alıcı onayladı / onaylamadı) bu motorla bağlıdır.
        </p>
      </div>
      <AdminTrustScorePanel />
    </div>
  );
}
