"use client";

import { AdminTrustScorePanel } from "@/components/admin/AdminTrustScorePanel";

export default function PremiumPuanlamaMotoruPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Puanlama motoru</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Platform geneli güven puanı ayarları (Vasıta ile aynı motor).
        </p>
      </div>
      <AdminTrustScorePanel />
    </div>
  );
}
