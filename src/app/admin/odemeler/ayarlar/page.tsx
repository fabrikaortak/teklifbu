"use client";

import { AdminSettingsPanel } from "@/components/admin/AdminPanels";

export default function AdminOdemeAyarlariPage() {
  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Ödeme Ayarları</h1>
          <p>
            Kurumsal / bireysel paket satışı, hesap ödemeleri görünürlüğü ve premium ilan jeton ödemesi
            kuralları.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        <div className="adm-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800 }}>Müşteri paket satışı</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
            Bireysel ve Ticari için paket satın alma / popup’ı ayrı ayrı açıp kapatabilirsiniz. Kapalıysa ilgili
            üyelik tipinde «Paket al» ve ilan sırasındaki satın alma penceresi gizlenir; yalnızca uyarı kalır.
            Admin abonelik ataması her zaman çalışır. Hangi paketlerin kimde görüneceği paket kartındaki «Üyelik
            tipi» ile belirlenir.
          </p>
          <AdminSettingsPanel
            onlyKeys={[
              "shop_package_buy_popup_bireysel",
              "shop_package_buy_popup_ticari",
              "shop_package_pay_with_tokens_enabled",
              "account_payments_visible_bireysel",
              "account_payments_visible_ticari",
            ]}
          />
        </div>
        <div className="adm-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800 }}>Premium ilan — jeton ödemesi</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
            Premium özellikleri (kalın başlık, renkli ilan, öne çıkarma) jetonla da ödenebilir hale getirin ve
            jeton fiyatlarını tanımlayın. TL fiyatlar Sistem Ayarları → İlan grubunda kalır.
          </p>
          <AdminSettingsPanel
            onlyKeys={[
              "premium_pay_with_tokens_enabled",
              "premium_title_bold_tokens",
              "premium_title_large_tokens",
              "premium_colored_tokens",
              "premium_feature_3d_tokens",
              "premium_feature_7d_tokens",
            ]}
          />
        </div>
      </div>
    </div>
  );
}
