"use client";

import { AdminSellerReviewsPanel } from "@/components/admin/AdminSellerReviewsPanel";

export default function AdminYorumlarPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Satıcı Yorumları</h1>
          <p>
            Kullanıcı yorumlarını onaylayın veya reddedin. Yorum özelliğini, otomatik onayı ve ticari
            rozet/logo ayarlarını buradan yönetin.
          </p>
        </div>
      </div>
      <AdminSellerReviewsPanel />
    </div>
  );
}
