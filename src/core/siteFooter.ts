import { getSetting } from "@/core/settings";

export type SiteFooterConfig = {
  phoneLabel: string;
  phone: string;
  address: string;
  tradeRegistryNo: string;
  mersis: string;
  disclaimer: string;
  googlePlayUrl: string;
  appStoreUrl: string;
  appGalleryUrl: string;
  etbisText: string;
  etbisQrUrl: string;
  version: string;
  showPaymentIcons: boolean;
  showAppBadges: boolean;
  showEtbis: boolean;
};

export const DEFAULT_SITE_FOOTER: SiteFooterConfig = {
  phoneLabel: "Müşteri Hizmetleri",
  phone: "0216 606 60 00",
  address:
    "Adres: Atatürk Mah. Ertuğrul Gazi Sk. Metropol İstanbul Sitesi C1 Blok No: 2b İç Kapı No: 303 Ataşehir / İSTANBUL",
  tradeRegistryNo: "1073204",
  mersis: "0752106837400001",
  disclaimer:
    "teklifbu.com'da yer alan kullanıcıların oluşturduğu tüm içerik, görüş ve bilgilerin doğruluğunu garanti etmez. İçeriklerin sorumluluğu içerik sağlayıcılarına aittir. Yer sağlanan içerikler hakkında her türlü fikri ve sınai mülkiyet hakları ihlali, haksız rekabet, kişilik hakları ihlali gibi durumlarda 5651 sayılı Kanun kapsamında bildirimlerinizi iletişime geçerek iletebilirsiniz. Yapılan bildirimlerin incelenmesi sonucunda gerekli görülen aksiyonlar alınacaktır.",
  googlePlayUrl: "#",
  appStoreUrl: "#",
  appGalleryUrl: "#",
  etbisText: "ETBİS'e Kayıtlıdır.",
  etbisQrUrl: "",
  version: "v1.0.0",
  showPaymentIcons: true,
  showAppBadges: true,
  showEtbis: true,
};

export function normalizeSiteFooter(raw: unknown): SiteFooterConfig {
  const base = { ...DEFAULT_SITE_FOOTER };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    phoneLabel: String(o.phoneLabel ?? base.phoneLabel),
    phone: String(o.phone ?? base.phone),
    address: String(o.address ?? base.address),
    tradeRegistryNo: String(o.tradeRegistryNo ?? base.tradeRegistryNo),
    mersis: String(o.mersis ?? base.mersis),
    disclaimer: String(o.disclaimer ?? base.disclaimer),
    googlePlayUrl: String(o.googlePlayUrl ?? base.googlePlayUrl),
    appStoreUrl: String(o.appStoreUrl ?? base.appStoreUrl),
    appGalleryUrl: String(o.appGalleryUrl ?? base.appGalleryUrl),
    etbisText: String(o.etbisText ?? base.etbisText),
    etbisQrUrl: String(o.etbisQrUrl ?? base.etbisQrUrl),
    version: String(o.version ?? base.version),
    showPaymentIcons: o.showPaymentIcons !== false,
    showAppBadges: o.showAppBadges !== false,
    showEtbis: o.showEtbis !== false,
  };
}

export async function getSiteFooterConfig(): Promise<SiteFooterConfig> {
  const raw = await getSetting<unknown>("site_footer", DEFAULT_SITE_FOOTER);
  return normalizeSiteFooter(raw);
}
