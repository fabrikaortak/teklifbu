/** Ürün modu: teklifli pazar vs Sahibinden tarzı teklifsiz ilan */

export type MarketplaceMode = "bidding" | "classified";

export function normalizeMarketplaceMode(raw?: string | null): MarketplaceMode {
  const v = String(raw || "").toLowerCase().trim();
  if (v === "classified" || v === "teklifsiz" || v === "sahibinden" || v === "sahibinden_teklifsiz") {
    return "classified";
  }
  return "bidding";
}

export function isOffersEnabledMode(mode?: string | null): boolean {
  return normalizeMarketplaceMode(mode) === "bidding";
}

export function marketplaceModeLabelTr(mode?: string | null): string {
  return normalizeMarketplaceMode(mode) === "classified"
    ? "Sahibinden Teklifsiz"
    : "TeklifBu (teklifli)";
}
