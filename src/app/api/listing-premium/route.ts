import { NextResponse } from "next/server";
import {
  getPremiumPrices,
  getPremiumTokenPrices,
  isPremiumPayWithTokensEnabled,
} from "@/core/services/listingPremiumService";
import { isPaymentTokensOnly } from "@/core/services/paymentModeService";
import { getSetting } from "@/core/settings";

/** Genel premium fiyatları + rozet kuralı (ilan verme ekranı). */
export async function GET() {
  const [prices, tokenPrices, payWithTokensEnabled, tokensOnly, badgeRule] = await Promise.all([
    getPremiumPrices(),
    getPremiumTokenPrices(),
    isPremiumPayWithTokensEnabled(),
    isPaymentTokensOnly(),
    getSetting<string>("premium_badge_rule", "premium_3"),
  ]);
  return NextResponse.json({
    prices,
    tokenPrices,
    payWithTokensEnabled: payWithTokensEnabled || tokensOnly,
    tokensOnly,
    badgeRule,
  });
}
