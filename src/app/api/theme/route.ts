import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";
import { getMarketplaceMode } from "@/core/services/marketplaceModeService";
import { isOffersEnabledMode } from "@/lib/marketplaceMode";
import { getEscrowRuntimeSettings } from "@/core/services/escrowSettingsService";

/** Satırdaki ilan → içerik max genişlik */
export const V2_COLS_MAX_WIDTH: Record<string, string> = {
  "4": "1360px",
  "5": "1520px",
  "6": "1720px",
};

function normalizeGridCols(raw: unknown): "4" | "5" | "6" {
  const s = String(raw || "4");
  if (s === "5" || s === "6") return s;
  return "4";
}

export async function GET() {
  const theme = String((await getSetting<string>("ui_theme", "v1")) || "v1");
  const categoriesTheme = String((await getSetting<string>("ui_categories_theme", "v2")) || "v2");
  const homeGridCols = normalizeGridCols(await getSetting<string>("v2_home_grid_cols", "4"));
  const brandPrimary = String((await getSetting<string>("brand_primary", "#FF6A00")) || "#FF6A00");
  const brandNavy = String((await getSetting<string>("brand_navy", "#0B1F3A")) || "#0B1F3A");
  const brandName = String((await getSetting<string>("brand_name", "TeklifBu")) || "TeklifBu");
  const headerBelt = String((await getSetting<string>("v2_header_belt", "navy")) || "navy");
  const detailLayoutRaw = String((await getSetting<string>("listing_detail_layout", "classic")) || "classic");
  const premiumDetailLayoutRaw = String(
    (await getSetting<string>("listing_detail_layout_premium", "premium")) || "premium"
  );
  const premiumVerticalsRaw =
    (await getSetting<Record<string, boolean>>("premium_verticals_enabled", {
      hotel: true,
      logistics: true,
      rideshare: true,
    })) || {};
  const recentSalesRaw = (await getSetting<Record<string, boolean>>("recent_sales_placements", {
    home: true,
    listing_detail: false,
    profile: false,
    ilanlar: false,
  })) || {};
  const marketplaceMode = await getMarketplaceMode();
  const offersEnabled = isOffersEnabledMode(marketplaceMode);
  const shoppingFormTemplateSetting = await getSetting<string>(
    "shopping_listing_form_template",
    "classic"
  );
  const insightDefaults = {
    ending_soon: true,
    most_bids_today: true,
    top_profit: true,
    turkey_map: true,
    live_stats: true,
    for_you: true,
  };
  const insightRaw =
    (await getSetting<Record<string, boolean>>("home_insight_sections", insightDefaults)) ||
    insightDefaults;
  const escrowSettings = await getEscrowRuntimeSettings();
  /** Modül kapalıysa veya sadece teklifsiz modda çalışıyorsa (mevcut mod teklifli ise) UI'da gizli kalır */
  const escrowEnabledForUi =
    escrowSettings.enabled && !(!escrowSettings.allowInBiddingMode && offersEnabled);
  const buyColorRaw = String(
    (await getSetting<string>("shopping_buy_button_color", "#2563eb")) || "#2563eb"
  ).trim();
  const shoppingBuyButtonColor = /^#[0-9a-fA-F]{6}$/.test(buyColorRaw) ? buyColorRaw : "#2563eb";
  /** Teklifsiz modda teklif panelleri zorla kapalı; harita üye haritası olarak kalır */
  const homeInsightSections = offersEnabled
    ? insightRaw
    : {
        ending_soon: false,
        most_bids_today: false,
        top_profit: false,
        turkey_map: insightRaw.turkey_map !== false,
        live_stats: false,
        for_you: insightRaw.for_you !== false,
      };
  return NextResponse.json({
    theme: theme === "v2" ? "v2" : "v1",
    categoriesTheme: categoriesTheme === "v2" ? "v2" : "tree",
    marketplaceMode,
    offersEnabled,
    homeGridCols,
    pageMaxWidth: V2_COLS_MAX_WIDTH[homeGridCols],
    brandPrimary,
    brandNavy,
    brandName,
    headerBelt: headerBelt === "white" ? "white" : "navy",
    listingDetailLayout: !offersEnabled
      ? "sahibinden"
      : detailLayoutRaw === "sahibinden"
        ? "sahibinden"
        : "classic",
    listingDetailLayoutPremium:
      premiumDetailLayoutRaw === "sahibinden" || premiumDetailLayoutRaw === "classic"
        ? premiumDetailLayoutRaw
        : "premium",
    premiumVerticals: {
      hotel: premiumVerticalsRaw.hotel !== false,
      logistics: premiumVerticalsRaw.logistics !== false,
      rideshare: premiumVerticalsRaw.rideshare !== false,
    },
    premiumHomeLimits: {
      hotel: Math.min(12, Math.max(1, Number((await getSetting<number>("premium_home_limit_hotel", 4)) || 4))),
      logistics: Math.min(
        12,
        Math.max(1, Number((await getSetting<number>("premium_home_limit_logistics", 4)) || 4))
      ),
      rideshare: Math.min(
        12,
        Math.max(1, Number((await getSetting<number>("premium_home_limit_rideshare", 4)) || 4))
      ),
    },
    maxBidsPerListing: Math.min(
      20,
      Math.max(1, Number((await getSetting<number>("max_bids_per_user_per_listing", 4)) || 4))
    ),
    recentSalesPlacements: offersEnabled
      ? {
          home: recentSalesRaw.home !== false,
          listing_detail: Boolean(recentSalesRaw.listing_detail),
          profile: Boolean(recentSalesRaw.profile),
          ilanlar: Boolean(recentSalesRaw.ilanlar),
        }
      : {
          home: false,
          listing_detail: false,
          profile: false,
          ilanlar: false,
        },
    homeInsightSections,
    featuredCardTitlePriceOnly: Boolean(
      await getSetting<boolean>("featured_card_title_price_only", false)
    ),
    featuredCardHoverLift: Boolean(
      await getSetting<boolean>("featured_card_hover_lift", true)
    ),
    escrow: {
      enabled: escrowEnabledForUi,
      buttonLabel: escrowSettings.buttonLabel,
      shipDaysOptions: escrowSettings.shipDaysOptions,
      defaultShipDays: escrowSettings.defaultShipDays,
      requireSellerIban: escrowSettings.requireSellerIban,
      allowInBiddingMode: escrowSettings.allowInBiddingMode,
    },
    shoppingListingDetailTemplate:
      String((await getSetting<string>("shopping_listing_detail_template", "classic")) || "classic") ===
      "ecommerce_v1"
        ? "ecommerce_v1"
        : "classic",
    shoppingListingFormTemplate: (() => {
      const raw = String(shoppingFormTemplateSetting || "classic");
      if (raw === "ecommerce_v1" || raw === "modern_v1") return raw;
      return "classic";
    })(),
    shoppingOffersEnabled: (await getSetting<boolean>("shopping_offers_enabled", true)) !== false,
    shoppingCartPlacement:
      String((await getSetting<string>("shopping_cart_placement", "alt")) || "alt") === "ust"
        ? "ust"
        : "alt",
    shoppingBuyButtonColor,
    premiumStorePopup: {
      enabled: (await getSetting<boolean>("premium_store_popup_enabled", true)) !== false,
      title: String(
        (await getSetting<string>("premium_store_popup_title", "Premium Mağaza nedir?")) ||
          "Premium Mağaza nedir?"
      ),
      body: String(
        (await getSetting<string>(
          "premium_store_popup_body",
          "Premium Mağaza rozeti hakkında bilgi yakında."
        )) || ""
      ),
      applyEnabled: (await getSetting<boolean>("premium_store_popup_apply_enabled", true)) !== false,
      applyLabel: String((await getSetting<string>("premium_store_popup_apply_label", "Başvur")) || "Başvur"),
      applyUrl: String(
        (await getSetting<string>("premium_store_popup_apply_url", "/hesabim?s=magaza")) ||
          "/hesabim?s=magaza"
      ),
    },
  });
}
