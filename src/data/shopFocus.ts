/** Kurumsal kayıt — mağaza ilan odağı (ana + alt kategori) */

export type ShopFocusRoot = "emlak" | "vasita" | "alisveris" | "premium";

export type ShopFocus = {
  root: ShopFocusRoot | "";
  /** Alt kategori slug; «diger» özel */
  sub: string;
  /** Diğer seçilince zorunlu açıklama */
  otherNote: string;
};

export const EMPTY_SHOP_FOCUS: ShopFocus = {
  root: "",
  sub: "",
  otherNote: "",
};

export const SHOP_FOCUS_ROOTS: Array<{ id: ShopFocusRoot; label: string }> = [
  { id: "emlak", label: "Emlak" },
  { id: "vasita", label: "Vasıta" },
  { id: "alisveris", label: "Alışveriş" },
  { id: "premium", label: "Premium" },
];

export const SHOP_FOCUS_EMLAK_SUBS: Array<{ id: string; label: string }> = [
  { id: "konut", label: "Konut" },
  { id: "isyeri", label: "İşyeri" },
  { id: "arsa", label: "Arsa" },
  { id: "diger", label: "Diğer" },
];

export const SHOP_FOCUS_VASITA_SUBS: Array<{ id: string; label: string }> = [
  { id: "otomobil", label: "Otomobil" },
  { id: "arazi-suv-pickup", label: "Arazi, SUV & Pickup" },
  { id: "motosiklet", label: "Motosiklet" },
  { id: "minivan-panelvan", label: "Minivan & Panelvan" },
  { id: "ticari-araclar", label: "Ticari Araçlar" },
  { id: "deniz-araclari", label: "Deniz Araçları" },
  { id: "diger", label: "Diğer" },
];

export const SHOP_FOCUS_ALISVERIS_SUBS: Array<{ id: string; label: string }> = [
  { id: "elektronik", label: "Elektronik" },
  { id: "ev-yasam", label: "Ev & Yaşam" },
  { id: "moda", label: "Moda & Aksesuar" },
  { id: "hobi", label: "Hobi & Spor" },
  { id: "diger", label: "Diğer" },
];

export const SHOP_FOCUS_PREMIUM_SUBS: Array<{ id: string; label: string }> = [
  { id: "premium-otel", label: "Otel Konaklama" },
  { id: "premium-lojistik", label: "Lojistik Taşıma" },
  { id: "premium-yolculuk", label: "Yolculuk Paylaşımı" },
  { id: "diger", label: "Diğer" },
];

export function shopFocusSubsFor(root: ShopFocusRoot | ""): Array<{ id: string; label: string }> {
  if (root === "emlak") return SHOP_FOCUS_EMLAK_SUBS;
  if (root === "vasita") return SHOP_FOCUS_VASITA_SUBS;
  if (root === "alisveris") return SHOP_FOCUS_ALISVERIS_SUBS;
  if (root === "premium") return SHOP_FOCUS_PREMIUM_SUBS;
  return [];
}

export function shopFocusRootLabel(root?: string | null) {
  return SHOP_FOCUS_ROOTS.find((r) => r.id === root)?.label || root || "—";
}

export function shopFocusSubLabel(root: ShopFocusRoot | "", sub?: string | null) {
  if (!sub) return "—";
  const hit = shopFocusSubsFor(root).find((s) => s.id === sub);
  return hit?.label || sub;
}

export function parseShopFocus(raw: unknown): ShopFocus {
  const base = { ...EMPTY_SHOP_FOCUS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    // Geriye dönük: düz alanlar commercial profile üzerinde olabilir
    return base;
  }
  const o = raw as Record<string, unknown>;
  const root = String(o.root || o.shopFocusRoot || "").trim();
  if (root === "emlak" || root === "vasita" || root === "alisveris" || root === "premium") {
    base.root = root;
  }
  base.sub = String(o.sub || o.shopFocusSub || "").trim();
  base.otherNote = String(o.otherNote || o.shopFocusOtherNote || "").trim();
  return base;
}

/** CommercialProfile / profile JSON içinden oku */
export function shopFocusFromProfileMap(o: Record<string, unknown>): ShopFocus {
  if (o.shopFocus && typeof o.shopFocus === "object") {
    return parseShopFocus(o.shopFocus);
  }
  return parseShopFocus({
    root: o.shopFocusRoot,
    sub: o.shopFocusSub,
    otherNote: o.shopFocusOtherNote,
  });
}

export function validateShopFocus(f: ShopFocus): string | null {
  if (!f.root) return "Mağaza ana kategorisi zorunludur (Emlak / Vasıta / Alışveriş / Premium)";
  if (!f.sub) return "Mağaza alt kategorisi zorunludur";
  const allowed = shopFocusSubsFor(f.root).map((s) => s.id);
  if (!allowed.includes(f.sub)) return "Geçerli bir alt kategori seçin";
  if (f.sub === "diger" && !String(f.otherNote || "").trim()) {
    return "Diğer seçildiğinde açıklama zorunludur";
  }
  return null;
}

export function formatShopFocusLine(f: ShopFocus): string {
  if (!f.root) return "—";
  const root = shopFocusRootLabel(f.root);
  const sub = shopFocusSubLabel(f.root, f.sub);
  if (f.sub === "diger" && f.otherNote) return `${root} › Diğer: ${f.otherNote}`;
  return `${root} › ${sub}`;
}

/** Alışveriş satıcı paneline erişim için */
export function shopFocusNeedsMagazaPanel(f: ShopFocus): boolean {
  return f.root === "alisveris";
}
