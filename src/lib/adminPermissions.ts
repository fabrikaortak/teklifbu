/** Alt yönetici (STAFF) yetki matrisi — client + server güvenli */

export type AdminMenuKey =
  | "overview"
  | "emlak-vasita"
  | "alisveris"
  | "premium"
  | "satici-paneli"
  | "kullanicilar"
  | "mesajlar"
  | "odemeler"
  | "gelirler"
  | "reklam"
  | "ai"
  | "raporlar"
  | "tema"
  | "footer"
  | "ayarlar"
  | "alt-yoneticiler";

export type AdminVerticalKey = "emlak-vasita" | "alisveris" | "premium";

export type AdminActionKey =
  | "listings.read"
  | "listings.approve"
  | "listings.reject"
  | "listings.extensions"
  | "listings.editRequests"
  | "listings.republish"
  | "listings.demo"
  | "categories.manage"
  | "users.read"
  | "users.update"
  | "users.commercialApprove"
  | "users.reviews"
  | "users.sellerRequests"
  | "payments.read"
  | "payments.manage"
  | "tokens.manage"
  | "revenue.read"
  | "content.manage"
  | "ads.manage"
  | "theme.manage"
  | "settings.read"
  | "settings.write"
  | "messages.read"
  | "reports.read"
  | "ai.use"
  | "staff.manage";

export type AdminPermissions = {
  /** Menü bölümleri */
  menus: AdminMenuKey[];
  /** Dikeyler (Vasıta/Alışveriş/Premium) */
  verticals: AdminVerticalKey[];
  /** İşlem yetkileri */
  actions: AdminActionKey[];
  /** Ayar grupları (DEFAULT_SETTINGS.group) — settings.read/write ile birlikte */
  settingGroups: string[];
};

export const EMPTY_ADMIN_PERMISSIONS: AdminPermissions = {
  menus: [],
  verticals: [],
  actions: [],
  settingGroups: [],
};

export const ADMIN_MENU_OPTIONS: Array<{ key: AdminMenuKey; label: string; description: string }> = [
  { key: "overview", label: "Genel bakış", description: "Admin ana özet sayfası" },
  { key: "emlak-vasita", label: "Vasıta & Emlak", description: "Emlak/vasıta dikey menüsü" },
  { key: "alisveris", label: "Alışveriş", description: "Alışveriş dikey + katalog" },
  { key: "premium", label: "Premium", description: "Otel / lojistik / yolculuk" },
  { key: "satici-paneli", label: "Satıcı paneli", description: "Mağaza paneli yönetimi" },
  { key: "kullanicilar", label: "Kullanıcılar", description: "Üye listesi ve kurumsal onay" },
  { key: "mesajlar", label: "Mesajlar", description: "Sistem mesajları" },
  { key: "odemeler", label: "Ödemeler", description: "Ödeme, jeton, escrow" },
  { key: "gelirler", label: "Gelirler", description: "Gelir özeti" },
  { key: "reklam", label: "Reklam", description: "Reklam alanları" },
  { key: "ai", label: "AI", description: "Yapay zeka araçları" },
  { key: "raporlar", label: "Raporlar", description: "Özet raporlar" },
  { key: "tema", label: "Tema", description: "Tema ayarları" },
  { key: "footer", label: "Footer", description: "Site alt bilgi" },
  { key: "ayarlar", label: "Sistem ayarları", description: "Genel sistem ayarları" },
  { key: "alt-yoneticiler", label: "Alt yöneticiler", description: "Başka alt admin atama (dikkat)" },
];

export const ADMIN_VERTICAL_OPTIONS: Array<{ key: AdminVerticalKey; label: string }> = [
  { key: "emlak-vasita", label: "Vasıta & Emlak" },
  { key: "alisveris", label: "Alışveriş" },
  { key: "premium", label: "Premium" },
];

export const ADMIN_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; description: string }> = [
  { key: "listings.read", label: "İlanları görüntüle", description: "İlan listeleri" },
  { key: "listings.approve", label: "İlan onayla", description: "Bekleyen ilanı yayınla" },
  { key: "listings.reject", label: "İlan reddet", description: "Bekleyen ilanı reddet" },
  { key: "listings.extensions", label: "Ek süre talepleri", description: "Süre uzatma onay/red" },
  { key: "listings.editRequests", label: "Düzenleme talepleri", description: "Canlı ilan düzenleme onayı" },
  { key: "listings.republish", label: "Yeniden yayın", description: "Sonuçlanan yeniden yayın onayı" },
  { key: "listings.demo", label: "Demo ilanlar", description: "Demo veri işlemleri" },
  { key: "categories.manage", label: "Kategoriler", description: "Kategori ağacı düzenleme" },
  { key: "users.read", label: "Kullanıcıları gör", description: "Üye listesi" },
  { key: "users.update", label: "Kullanıcı düzenle", description: "Üye bilgisi / durum" },
  { key: "users.commercialApprove", label: "Kurumsal onay", description: "Ticari üyelik onay/red" },
  { key: "users.reviews", label: "Satıcı yorumları", description: "Yorum moderasyonu" },
  { key: "users.sellerRequests", label: "Satıcı talepleri", description: "Satıcı admin talepleri" },
  { key: "payments.read", label: "Ödemeleri gör", description: "Ödeme kayıtları" },
  { key: "payments.manage", label: "Ödeme yönet", description: "Escrow / silme vb." },
  { key: "tokens.manage", label: "Jeton paketleri", description: "Jeton paket yönetimi" },
  { key: "revenue.read", label: "Gelirleri gör", description: "Gelir paneli" },
  { key: "content.manage", label: "İçerik", description: "İçerik sayfaları" },
  { key: "ads.manage", label: "Reklam yönet", description: "Reklam alanları" },
  { key: "theme.manage", label: "Tema yönet", description: "Tema kaydetme" },
  { key: "settings.read", label: "Ayarları gör", description: "Ayar panellerini aç" },
  { key: "settings.write", label: "Ayar kaydet", description: "İzinli gruplarda kayıt" },
  { key: "messages.read", label: "Mesajları gör", description: "Admin mesaj kutusu" },
  { key: "reports.read", label: "Raporları gör", description: "Rapor sayfası" },
  { key: "ai.use", label: "AI kullan", description: "AI test / araçlar" },
  { key: "staff.manage", label: "Alt yönetici ata", description: "Başka STAFF oluşturma" },
];

export const ADMIN_SETTING_GROUP_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "bid", label: "Teklif" },
  { key: "listing", label: "İlan" },
  { key: "lifecycle", label: "Yaşam döngüsü" },
  { key: "token", label: "Jeton" },
  { key: "auth", label: "Kimlik" },
  { key: "commercial", label: "Ticari üyelik" },
  { key: "notification", label: "Bildirim" },
  { key: "pwa", label: "PWA" },
  { key: "premium", label: "Premium" },
  { key: "seller_panel", label: "Satıcı paneli" },
  { key: "escrow", label: "Güvenli Öde" },
  { key: "payment", label: "Ödeme" },
  { key: "ads", label: "Reklam" },
  { key: "ai", label: "AI" },
  { key: "trust", label: "Puanlama" },
  { key: "performance", label: "Performans" },
  { key: "v2", label: "v2 Tema" },
  { key: "general", label: "Genel" },
];

export type AdminPermissionPreset = {
  id: string;
  label: string;
  description: string;
  permissions: AdminPermissions;
};

export const ADMIN_PERMISSION_PRESETS: AdminPermissionPreset[] = [
  {
    id: "listing_moderator",
    label: "İlan moderatörü",
    description: "Seçili dikeylerde ilan onay / red / ek süre / düzenleme",
    permissions: {
      menus: ["overview", "emlak-vasita", "alisveris", "premium"],
      verticals: ["emlak-vasita", "alisveris", "premium"],
      actions: [
        "listings.read",
        "listings.approve",
        "listings.reject",
        "listings.extensions",
        "listings.editRequests",
        "listings.republish",
      ],
      settingGroups: [],
    },
  },
  {
    id: "vasita_only",
    label: "Sadece Vasıta & Emlak",
    description: "Yalnız emlak-vasıta dikeyi + ilan işlemleri",
    permissions: {
      menus: ["emlak-vasita"],
      verticals: ["emlak-vasita"],
      actions: [
        "listings.read",
        "listings.approve",
        "listings.reject",
        "listings.extensions",
        "listings.editRequests",
        "listings.republish",
        "categories.manage",
        "settings.read",
      ],
      settingGroups: ["listing", "lifecycle", "trust"],
    },
  },
  {
    id: "shopping_ops",
    label: "Alışveriş operasyon",
    description: "Alışveriş dikeyi, satıcı paneli, sipariş/katalog",
    permissions: {
      menus: ["alisveris", "satici-paneli"],
      verticals: ["alisveris"],
      actions: [
        "listings.read",
        "listings.approve",
        "listings.reject",
        "categories.manage",
        "settings.read",
        "settings.write",
      ],
      settingGroups: ["seller_panel", "commercial"],
    },
  },
  {
    id: "user_support",
    label: "Kullanıcı destek",
    description: "Üyeler, kurumsal onay, mesajlar",
    permissions: {
      menus: ["kullanicilar", "mesajlar"],
      verticals: [],
      actions: [
        "users.read",
        "users.update",
        "users.commercialApprove",
        "users.reviews",
        "users.sellerRequests",
        "messages.read",
      ],
      settingGroups: [],
    },
  },
  {
    id: "finance",
    label: "Finans",
    description: "Ödemeler, jeton, gelirler",
    permissions: {
      menus: ["odemeler", "gelirler"],
      verticals: [],
      actions: ["payments.read", "payments.manage", "tokens.manage", "revenue.read"],
      settingGroups: ["payment", "escrow", "token"],
    },
  },
];

export function normalizeAdminPermissions(raw: unknown): AdminPermissions {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ADMIN_PERMISSIONS, menus: [], verticals: [], actions: [], settingGroups: [] };
  const o = raw as Record<string, unknown>;
  const menus = Array.isArray(o.menus)
    ? o.menus.map(String).filter((k) => ADMIN_MENU_OPTIONS.some((m) => m.key === k))
    : [];
  const verticals = Array.isArray(o.verticals)
    ? o.verticals.map(String).filter((k) => ADMIN_VERTICAL_OPTIONS.some((m) => m.key === k))
    : [];
  const actions = Array.isArray(o.actions)
    ? o.actions.map(String).filter((k) => ADMIN_ACTION_OPTIONS.some((m) => m.key === k))
    : [];
  const settingGroups = Array.isArray(o.settingGroups)
    ? o.settingGroups.map(String).filter((k) => ADMIN_SETTING_GROUP_OPTIONS.some((m) => m.key === k))
    : [];
  return {
    menus: menus as AdminMenuKey[],
    verticals: verticals as AdminVerticalKey[],
    actions: actions as AdminActionKey[],
    settingGroups,
  };
}

export function isFullAdminRole(role?: string | null) {
  return String(role || "").toUpperCase() === "ADMIN";
}

export function isStaffRole(role?: string | null) {
  return String(role || "").toUpperCase() === "STAFF";
}

export function canAccessAdminPanel(role?: string | null) {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "STAFF";
}

export function hasAdminAction(
  role: string | null | undefined,
  perms: AdminPermissions | null | undefined,
  action: AdminActionKey
) {
  if (isFullAdminRole(role)) return true;
  if (!isStaffRole(role)) return false;
  return Boolean(perms?.actions?.includes(action));
}

export function hasAdminMenu(
  role: string | null | undefined,
  perms: AdminPermissions | null | undefined,
  menu: AdminMenuKey
) {
  if (isFullAdminRole(role)) return true;
  if (!isStaffRole(role)) return false;
  return Boolean(perms?.menus?.includes(menu));
}

export function hasAdminVertical(
  role: string | null | undefined,
  perms: AdminPermissions | null | undefined,
  vertical: string
) {
  if (isFullAdminRole(role)) return true;
  if (!isStaffRole(role)) return false;
  return Boolean(perms?.verticals?.includes(vertical as AdminVerticalKey));
}

export function hasSettingGroup(
  role: string | null | undefined,
  perms: AdminPermissions | null | undefined,
  group: string
) {
  if (isFullAdminRole(role)) return true;
  if (!isStaffRole(role)) return false;
  if (!hasAdminAction(role, perms, "settings.read") && !hasAdminAction(role, perms, "settings.write")) {
    return false;
  }
  return Boolean(perms?.settingGroups?.includes(group));
}

/** API action → gereken yetki (STAFF için; ADMIN tümüne sahip) */
export const ADMIN_API_ACTION_PERMISSION: Record<string, AdminActionKey | AdminActionKey[]> = {
  "approve-listing": "listings.approve",
  "reject-listing": "listings.reject",
  "bulk-approve-listings": "listings.approve",
  "bulk-reject-listings": "listings.reject",
  "set-listing-status": ["listings.approve", "listings.reject"],
  "set-listing-duration": "listings.approve",
  "delete-listing": "listings.reject",
  "approve-extension": "listings.extensions",
  "reject-extension": "listings.extensions",
  "approve-edit": "listings.editRequests",
  "reject-edit": "listings.editRequests",
  "approve-edit-request": "listings.editRequests",
  "reject-edit-request": "listings.editRequests",
  "approve-bulk-listing-update": "listings.editRequests",
  "reject-bulk-listing-update": "listings.editRequests",
  "demo-seed": "listings.demo",
  "demo-publish": "listings.demo",
  "demo-reload": "listings.demo",
  "demo-remove": "listings.demo",
  "demo-flow-start": "listings.demo",
  "demo-flow-stop": "listings.demo",
  "toggle-category": "categories.manage",
  "save-category": "categories.manage",
  "delete-category": "categories.manage",
  "save-browse-nav-config": "categories.manage",
  "save-settings": "settings.write",
  "save-trust-score": "settings.write",
  "save-commercial-publish-map": "settings.write",
  "test-trust-score": "settings.write",
  "toggle-user": "users.update",
  "update-user": "users.update",
  "delete-user": "users.update",
  "approve-commercial-user": "users.commercialApprove",
  "reject-commercial-user": "users.commercialApprove",
  "set-commercial-premium": "users.commercialApprove",
  "approve-seller-review": "users.reviews",
  "reject-seller-review": "users.reviews",
  "resolve-seller-request": "users.sellerRequests",
  "grant-seller-edit-fields": "users.sellerRequests",
  "approve-seller-edit": "users.sellerRequests",
  "reject-seller-edit": "users.sellerRequests",
  "save-token-package": "tokens.manage",
  "save-shop-package": "tokens.manage",
  "assign-shop-subscription": "tokens.manage",
  "cancel-shop-subscription": "tokens.manage",
  "toggle-shop": "users.update",
  "set-bid-status": "listings.approve",
  "mark-message-read": "messages.read",
  "save-revenue-finance": "revenue.read",
  "add-revenue-expense": "revenue.read",
  "delete-revenue-expense": "revenue.read",
  "simulate-payment": "payments.manage",
  "preview-payment-delete": "payments.manage",
  "delete-payment": "payments.manage",
  "list-escrow": "payments.read",
  "escrow-pool-summary": "payments.read",
  "escrow-release": "payments.manage",
  "escrow-refund": "payments.manage",
  "escrow-dispute": "payments.manage",
  "escrow-process-timeouts": "payments.manage",
  "save-content": "content.manage",
  "delete-content": "content.manage",
  "save-staff": "staff.manage",
  "revoke-staff": "staff.manage",
};

/** GET view → gereken menü veya işlem (STAFF) */
export const ADMIN_GET_VIEW_PERMISSION: Record<
  string,
  { menus?: AdminMenuKey[]; actions?: AdminActionKey[]; any?: boolean }
> = {
  nav: { any: true },
  settings: { actions: ["settings.read", "settings.write"] },
  "trust-score": { actions: ["settings.read", "settings.write"] },
  "commercial-publish-map": { menus: ["kullanicilar"], actions: ["users.update"] },
  "commercial-users": { actions: ["users.commercialApprove", "users.read"] },
  "user-detail": { actions: ["users.read", "users.update"] },
  users: { actions: ["users.read", "users.update"] },
  staff: { actions: ["staff.manage"], menus: ["alt-yoneticiler"] },
  "staff-search": { actions: ["staff.manage"], menus: ["alt-yoneticiler"] },
  revenue: { actions: ["revenue.read"], menus: ["gelirler"] },
  messages: { actions: ["messages.read"], menus: ["mesajlar"] },
  reports: { actions: ["reports.read"], menus: ["raporlar"] },
  ads: { actions: ["ads.manage"], menus: ["reklam"] },
  "seller-panel-overview": { menus: ["satici-paneli"] },
  "seller-panel-orders": { menus: ["satici-paneli"] },
  "seller-panel-questions": { menus: ["satici-paneli"] },
};

export function pathToAdminMenu(pathname: string): AdminMenuKey | null {
  if (pathname === "/admin" || pathname === "/admin/") return "overview";
  if (pathname.startsWith("/admin/emlak-vasita")) return "emlak-vasita";
  if (pathname.startsWith("/admin/alisveris")) return "alisveris";
  if (pathname.startsWith("/admin/premium")) return "premium";
  if (pathname.startsWith("/admin/satici-paneli")) return "satici-paneli";
  if (pathname.startsWith("/admin/kullanicilar/alt-yoneticiler")) return "alt-yoneticiler";
  if (
    pathname.startsWith("/admin/kullanicilar") ||
    pathname.startsWith("/admin/ticari-uyeler") ||
    pathname.startsWith("/admin/yorumlar") ||
    pathname.startsWith("/admin/satici-talepleri") ||
    pathname.startsWith("/admin/kullanici-ayarlari")
  ) {
    return "kullanicilar";
  }
  if (pathname.startsWith("/admin/mesajlar")) return "mesajlar";
  if (
    pathname.startsWith("/admin/odemeler") ||
    pathname.startsWith("/admin/guvenli-ode") ||
    pathname.startsWith("/admin/jeton") ||
    pathname.startsWith("/admin/iade-jetonlar") ||
    pathname.startsWith("/admin/kurumsal")
  ) {
    return "odemeler";
  }
  if (pathname.startsWith("/admin/gelirler")) return "gelirler";
  if (pathname.startsWith("/admin/reklam")) return "reklam";
  if (pathname.startsWith("/admin/ai")) return "ai";
  if (pathname.startsWith("/admin/raporlar")) return "raporlar";
  if (pathname.startsWith("/admin/tema")) return "tema";
  if (pathname.startsWith("/admin/footer")) return "footer";
  if (pathname.startsWith("/admin/ayarlar")) return "ayarlar";
  return null;
}
