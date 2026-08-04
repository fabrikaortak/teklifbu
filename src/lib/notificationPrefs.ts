export const NOTIFICATION_EVENT_OPTIONS = [
  {
    key: "bid_received",
    label: "İlanıma yeni teklif geldiğinde",
    desc: "Bir alıcı ilanınıza teklif verdiğinde",
  },
  {
    key: "bid_approved",
    label: "Teklifim onaylandığında",
    desc: "Satıcı teklifinizi kabul ettiğinde",
  },
  {
    key: "bid_rejected",
    label: "Teklifim reddedildiğinde",
    desc: "Teklifiniz reddedildiğinde veya geçersiz olduğunda",
  },
  {
    key: "listing_approved",
    label: "İlanım yayınlandığında",
    desc: "Yönetici ilanınızı onaylayıp yayına aldığında",
  },
  {
    key: "listing_rejected",
    label: "İlanım reddedildiğinde",
    desc: "Yönetici ilanınızı reddettiğinde",
  },
  {
    key: "listing_extension_approved",
    label: "Ek süre onaylandığında",
    desc: "Ek süre talebiniz kabul edildiğinde",
  },
  {
    key: "listing_extension_rejected",
    label: "Ek süre reddedildiğinde",
    desc: "Ek süre talebiniz reddedildiğinde",
  },
  {
    key: "listing_edit_approved",
    label: "İlan düzenlemem onaylandığında",
    desc: "Yayındaki ilan için gönderdiğiniz düzenleme onaylandığında",
  },
  {
    key: "listing_edit_rejected",
    label: "İlan düzenlemem reddedildiğinde",
    desc: "Düzenleme reddedilirse ilan eski haliyle yayında kalır",
  },
  {
    key: "seller_edit_fields_granted",
    label: "Düzenleme izni verildiğinde",
    desc: "Yönetici teklifli ilanda belirli alanları düzenlemenize izin verdiğinde",
  },
  {
    key: "listing_changed_after_bid",
    label: "Teklif verdiğim ilan değiştiğinde",
    desc: "Teklif verdiğiniz ilanda onaylı değişiklik olduğunda",
  },
  {
    key: "favorite_listing_edited",
    label: "Favori ilanım yeniden düzenlendiğinde",
    desc: "Favorilediğiniz bir ilanın içeriği güncellendiğinde",
  },
  {
    key: "favorite_price_dropped",
    label: "Favori ilanımın fiyatı düştüğünde",
    desc: "Favori ilanın ilan fiyatı düşürüldüğünde",
  },
  {
    key: "favorite_price_rose",
    label: "Favori ilanımın fiyatı yükseldiğinde",
    desc: "Favori ilanın ilan fiyatı yükseldiğinde",
  },
  {
    key: "favorite_bid_over_ask",
    label: "Favori ilanıma fiyatından yüksek teklif geldiğinde",
    desc: "Favori ilanın fiyatını aşan bir teklif verildiğinde",
  },
  {
    key: "favorite_new_high_bid",
    label: "Favori ilanımda yeni en yüksek teklif olduğunda",
    desc: "Favori ilanda rekor teklif güncellendiğinde",
  },
  {
    key: "listing_ending_soon",
    label: "İlan sürem bitmek üzereyken",
    desc: "Yayın süreniz dolmak üzere olduğunda",
  },
  {
    key: "listing_ended",
    label: "İlan sürem dolduğunda",
    desc: "İlan süresi veya seçim aşaması bittiğinde",
  },
  {
    key: "token_low",
    label: "Jeton bakiyem düşükken",
    desc: "Teklif için jetonunuz yetersiz veya düşük olduğunda",
  },
  {
    key: "message_received",
    label: "Yeni mesaj geldiğinde",
    desc: "Size mesaj veya sistem bildirimi geldiğinde",
  },
  {
    key: "shop_package_assigned",
    label: "Kurumsal paket atandığında",
    desc: "Yönetici size kurumsal paket tanımladığında veya hak tanıdığında",
  },
  {
    key: "shop_package_changed",
    label: "Kurumsal paketim değiştiğinde",
    desc: "Yönetici paketinizi değiştirdiğinde",
  },
  {
    key: "shop_package_cancelled",
    label: "Kurumsal paketim iptal edildiğinde",
    desc: "Yönetici paket aboneliğinizi iptal ettiğinde",
  },
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENT_OPTIONS)[number]["key"];

/** Sahibinden Teklifsiz (classified) modda gösterilecek tek bildirim seçenekleri */
export const CLASSIFIED_NOTIFICATION_KEYS: NotificationEventKey[] = [
  "favorite_price_dropped",
  "favorite_listing_edited",
];

export type NotificationPrefs = Record<string, boolean>;

export function defaultNotificationPrefs(): NotificationPrefs {
  const prefs: NotificationPrefs = {};
  for (const opt of NOTIFICATION_EVENT_OPTIONS) {
    prefs[opt.key] = true;
  }
  return prefs;
}

export function mergeNotificationPrefs(raw?: unknown): NotificationPrefs {
  const base = defaultNotificationPrefs();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base)) {
    if (typeof obj[key] === "boolean") base[key] = obj[key] as boolean;
  }
  return base;
}

export function isNotificationEventEnabled(
  prefs: NotificationPrefs | null | undefined,
  eventKey: string
) {
  const merged = mergeNotificationPrefs(prefs);
  if (!(eventKey in merged)) return true;
  return merged[eventKey] !== false;
}
