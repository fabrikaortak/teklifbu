import { getSetting } from "@/core/settings";

/** POS kapalı; ücretli işlemler yalnızca jetonla. */
export async function isPaymentTokensOnly(): Promise<boolean> {
  return (await getSetting<boolean>("payment_tokens_only_enabled", false)) === true;
}

/** Demo POS — «yalnızca jeton» açıksa her zaman kapalı sayılır. */
export async function isDemoPosEnabled(): Promise<boolean> {
  if (await isPaymentTokensOnly()) return false;
  return Boolean(await getSetting<boolean>("payment_demo_pos_enabled", true));
}

/**
 * TL tutarını jetona çevirir (temel ilan ücreti vb.).
 * Hızlı jeton birim fiyatı > 0 ise onu kullanır; yoksa 1 TL ≈ 1 jeton.
 */
export async function convertTlToTokens(amountTl: number): Promise<number> {
  const tl = Math.max(0, Number(amountTl) || 0);
  if (tl <= 0) return 0;
  const unit = Math.max(0, Number(await getSetting<number>("quick_token_price_per_token_tl", 0)) || 0);
  if (unit > 0) return Math.max(1, Math.ceil(tl / unit));
  return Math.max(1, Math.ceil(tl));
}
