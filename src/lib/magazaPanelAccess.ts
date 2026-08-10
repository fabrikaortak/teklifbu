import { commercialToShopFocus, parseCommercialProfile } from "@/data/commercialProfile";
import { shopFocusNeedsMagazaPanel } from "@/data/shopFocus";
import { getSetting } from "@/core/settings";
import { parseCommercialSubtypes } from "@/lib/accountTypes";
import { verticalRootsForSubtypes } from "@/lib/commercialPublishMap";

export type MagazaPanelUser = {
  accountType?: string | null;
  commercialStatus?: string | null;
  commercialSubtypes?: string[] | null;
  profile?: unknown;
} | null;

export function isApprovedCorporate(user: MagazaPanelUser): boolean {
  if (!user) return false;
  const at = String(user.accountType || "").toUpperCase();
  if (at !== "TICARI" && at !== "EMLAKCI" && at !== "GALERICI") return false;
  return String(user.commercialStatus || "").toUpperCase() === "APPROVED";
}

/** Sync check — alışveriş dikeyi (faaliyet haritası veya eski shopFocus) + onay */
export function canAccessMagazaPanel(user: MagazaPanelUser): boolean {
  if (!isApprovedCorporate(user)) return false;
  const subs = parseCommercialSubtypes(user?.commercialSubtypes || [], null, true);
  if (verticalRootsForSubtypes(subs).has("alisveris")) return true;
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
    const { getCommercialPublishMap } = await import(
      "@/core/services/commercialPublishMapService"
    );
    const map = await getCommercialPublishMap();
    const subs = parseCommercialSubtypes(user?.commercialSubtypes || [], null, true);
    if (!verticalRootsForSubtypes(subs, map).has("alisveris")) {
      const p = parseCommercialProfile(user?.profile);
      if (!shopFocusNeedsMagazaPanel(commercialToShopFocus(p))) {
        return {
          allowed: false,
          reason: "Satıcı paneli Alışveriş / Mağaza faaliyeti için aktiftir.",
          buttonLabel,
          modules,
        };
      }
    }
  }
  return { allowed: true, buttonLabel, modules };
}
