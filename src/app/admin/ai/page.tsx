"use client";

import { AdminAiPanel } from "@/components/admin/AdminAiPanel";

export default function AdminAiPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>AI</h1>
          <p>
            OpenAI bağlantısı, jeton ücreti ve profildeki “AI ile ilan ekle” menüsünü buradan yönetin. API anahtarı
            yalnızca sunucuda saklanır.
          </p>
        </div>
      </div>
      <AdminAiPanel />
    </div>
  );
}
