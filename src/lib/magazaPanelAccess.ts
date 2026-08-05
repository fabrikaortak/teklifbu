import { commercialToShopFocus, parseCommercialProfile } from "@/data/commercialProfile";
import { shopFocusNeedsMagazaPanel } from "@/data/shopFocus";
import { getSetting } from "@/core/settings";

export type MagazaPanelUser = {
  accountType?: string | null;
  commercialStatus?: string | null;
  profile?: unknown;
} | null;

export function isApprovedCorporate(user: MagazaPanelUser): boolean {
  if (!user) return false;
  const at = String(user.accountType || "").toUpperCase();
  if (at !== "TICARI" && at !== "EMLAKCI" && at !== "GALERICI") return false;
  return String(user.commercialStatus || "").toUpperCase() === "APPROVED";
}

/** Sync check (ayarlar yok) — alışveriş odağı + onay */
export function canAccessMagazaPanel(user: MagazaPanelUser): boolean {
  if (!isApprovedCorporate(user)) return false;
  const p = parseCommercialProfile(user?.profile);
  return shopFocusNeedsMagazaPanel(commercialToShopFocus(p));
}

/** Ayarlı erişim (API / gate) */
export async function resolveMagazaPanelAccess(user: MagazaPanelUser): Promise<{
  allowed: boolean;
  reason?: string;
  buttonLabel: string;
  modules: { listings: boolean; questions: boolean; orders: boolean };
}> {
  const buttonLabel = String(
    (await getSetting<string>("seller_panel_button_label", "Satıcı Paneli")) || "Satıcı Paneli"
  );
  const modules = {
    listings: (await getSetting<boolean>("seller_panel_module_listings", true)) !== false,
    questions: (await getSetting<boolean>("seller_panel_module_questions", true)) !== false,
    orders: (await getSetting<boolean>("seller_panel_module_orders", true)) !== false,
  };

  if ((await getSetting<boolean>("seller_panel_enabled", true)) === false) {
    return { allowed: false, reason: "Satıcı paneli şu an kapalı.", buttonLabel, modules };
  }
  if (!isApprovedCorporate(user)) {
    return {
      allowed: false,
      reason: "Mağazanız yönetici onayından sonra aktif olacak.",
      buttonLabel,
      modules,
    };
  }
  const requireFocus =
    (await getSetting<boolean>("seller_panel_require_alisveris_focus", true)) !== false;
  if (requireFocus) {
    const p = parseCommercialProfile(user?.profile);
    if (!shopFocusNeedsMagazaPanel(commercialToShopFocus(p))) {
      return {
        allowed: false,
        reason: "Satıcı paneli Alışveriş mağaza odağı için aktiftir.",
        buttonLabel,
        modules,
      };
    }
  }
  return { allowed: true, buttonLabel, modules };
}
