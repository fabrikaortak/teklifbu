import { getSetting } from "@/core/settings";

/** AI ilan ayarları — sharp/parse bağımlılığı yok (build-safe) */
export async function getAiListingConfig() {
  const [enabled, offerPopupEnabled, apiKey, baseUrl, model, tokenCost] = await Promise.all([
    getSetting<boolean>("ai_listing_import_enabled", false),
    getSetting<boolean>("ai_listing_offer_popup_enabled", true),
    getSetting<string>("ai_openai_api_key", ""),
    getSetting<string>("ai_openai_base_url", "https://api.openai.com/v1"),
    getSetting<string>("ai_openai_model", "gpt-4o"),
    getSetting<number>("ai_listing_parse_token_cost", 2),
  ]);
  return {
    enabled: Boolean(enabled),
    /** İlan Ver sayfasındaki kampanya popup’ı */
    offerPopupEnabled: Boolean(offerPopupEnabled),
    apiKey: String(apiKey || "").trim(),
    baseUrl: String(baseUrl || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: String(model || "gpt-4o").trim() || "gpt-4o",
    tokenCost: Math.max(0, Math.floor(Number(tokenCost) || 0)),
  };
}
