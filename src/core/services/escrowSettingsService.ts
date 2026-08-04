import { getSetting } from "@/core/settings";
import { parseShipDaysOptions } from "@/lib/escrowTypes";

export type EscrowSellerTimeoutAction = "auto_refund" | "open_dispute" | "admin_hold";
export type EscrowBuyerTimeoutAction = "auto_release" | "open_dispute" | "admin_hold";

export type EscrowRuntimeSettings = {
  enabled: boolean;
  poolName: string;
  poolIban: string;
  poolBank: string;
  commissionPercent: number;
  shipDaysOptions: number[];
  defaultShipDays: number;
  buyerConfirmDays: number;
  sellerTimeoutAction: EscrowSellerTimeoutAction;
  buyerTimeoutAction: EscrowBuyerTimeoutAction;
  requireSellerIban: boolean;
  minAmountTl: number;
  maxAmountTl: number;
  allowInBiddingMode: boolean;
  buttonLabel: string;
};

function clampNumber(n: number, min: number, max?: number) {
  let v = Number.isFinite(n) ? n : min;
  if (v < min) v = min;
  if (max != null && v > max) v = max;
  return v;
}

function normalizeSellerTimeoutAction(raw: unknown): EscrowSellerTimeoutAction {
  const v = String(raw || "");
  if (v === "open_dispute" || v === "admin_hold") return v;
  return "auto_refund";
}

function normalizeBuyerTimeoutAction(raw: unknown): EscrowBuyerTimeoutAction {
  const v = String(raw || "");
  if (v === "open_dispute" || v === "admin_hold") return v;
  return "auto_release";
}

/** Admin panelinde tanımlı escrow_* ayarlarını okuyup makul sınırlara oturtur. */
export async function getEscrowRuntimeSettings(): Promise<EscrowRuntimeSettings> {
  const [
    enabled,
    poolName,
    poolIban,
    poolBank,
    commissionPercentRaw,
    shipDaysOptionsRaw,
    defaultShipDaysRaw,
    buyerConfirmDaysRaw,
    sellerTimeoutActionRaw,
    buyerTimeoutActionRaw,
    requireSellerIban,
    minAmountTlRaw,
    maxAmountTlRaw,
    allowInBiddingMode,
    buttonLabel,
  ] = await Promise.all([
    getSetting<boolean>("escrow_enabled", false),
    getSetting<string>("escrow_pool_name", "TeklifBu Güvenli Öde GET Havuzu"),
    getSetting<string>("escrow_pool_iban", ""),
    getSetting<string>("escrow_pool_bank", ""),
    getSetting<number>("escrow_commission_percent", 0),
    getSetting<string>("escrow_ship_days_options", "3,7,10"),
    getSetting<number>("escrow_default_ship_days", 7),
    getSetting<number>("escrow_buyer_confirm_days", 3),
    getSetting<string>("escrow_seller_timeout_action", "auto_refund"),
    getSetting<string>("escrow_buyer_timeout_action", "auto_release"),
    getSetting<boolean>("escrow_require_seller_iban", true),
    getSetting<number>("escrow_min_amount_tl", 0),
    getSetting<number>("escrow_max_amount_tl", 0),
    getSetting<boolean>("escrow_allow_in_bidding_mode", true),
    getSetting<string>("escrow_button_label", "Güvenli Öde"),
  ]);

  const shipDaysOptions = parseShipDaysOptions(shipDaysOptionsRaw);
  const defaultShipDays = shipDaysOptions.includes(Math.floor(Number(defaultShipDaysRaw)))
    ? Math.floor(Number(defaultShipDaysRaw))
    : shipDaysOptions[0];

  return {
    enabled: Boolean(enabled),
    poolName: String(poolName || "TeklifBu Güvenli Öde GET Havuzu"),
    poolIban: String(poolIban || ""),
    poolBank: String(poolBank || ""),
    commissionPercent: clampNumber(Number(commissionPercentRaw) || 0, 0, 30),
    shipDaysOptions,
    defaultShipDays,
    buyerConfirmDays: clampNumber(Math.floor(Number(buyerConfirmDaysRaw)) || 3, 1, 60),
    sellerTimeoutAction: normalizeSellerTimeoutAction(sellerTimeoutActionRaw),
    buyerTimeoutAction: normalizeBuyerTimeoutAction(buyerTimeoutActionRaw),
    requireSellerIban: requireSellerIban !== false,
    minAmountTl: clampNumber(Math.floor(Number(minAmountTlRaw)) || 0, 0),
    maxAmountTl: clampNumber(Math.floor(Number(maxAmountTlRaw)) || 0, 0),
    allowInBiddingMode: allowInBiddingMode !== false,
    buttonLabel: String(buttonLabel || "Güvenli Öde"),
  };
}
