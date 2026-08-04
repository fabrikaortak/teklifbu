/** İlan süresi dolunca davranış — Sistem ayarları */

export type ExpiryAfterEndMode = "hide_immediate" | "grace" | "selection";

export type ListingExpiryRules = {
  /** Teklifli ilanlar */
  bidding: {
    /** Süre bitince: selection = seçim penceresi; hide_immediate = hemen kalkar; grace = X dk daha vitrinde */
    afterEnd: ExpiryAfterEndMode;
    selectionMinutes: number;
    /** afterEnd=grace iken ekstra bekleme (dk) */
    graceMinutes: number;
    /** EXPIRED olduktan sonra vitrinde “süresi doldu” kaç gün */
    expiredVisibleDays: number;
    /** Teklif onaylanınca */
    onApprove: "hide_immediate" | "show_completed";
    /** show_completed iken “sonuçlandı” kaç gün görünsün */
    approvedVisibleDays: number;
  };
  /** Teklifsiz (klasik) ilanlar */
  classified: {
    afterEnd: "hide_immediate" | "grace";
    graceDays: number;
    expiredVisibleDays: number;
  };
  /** Satın al / Güvenli Öde (Al butonu) — teklifsiz veya hibrit */
  buy: {
    afterEnd: "hide_immediate" | "grace";
    graceDays: number;
    expiredVisibleDays: number;
    /** Hibrit: teklif süresi bitince Al butonu kapansın */
    closesWhenBiddingEnds: boolean;
  };
  /** Al butonu metni */
  buyButtonLabel: string;
};

export const DEFAULT_LISTING_EXPIRY_RULES: ListingExpiryRules = {
  bidding: {
    afterEnd: "selection",
    selectionMinutes: 30,
    graceMinutes: 0,
    expiredVisibleDays: 7,
    onApprove: "show_completed",
    approvedVisibleDays: 14,
  },
  classified: {
    afterEnd: "grace",
    graceDays: 3,
    expiredVisibleDays: 7,
  },
  buy: {
    afterEnd: "hide_immediate",
    graceDays: 0,
    expiredVisibleDays: 3,
    closesWhenBiddingEnds: true,
  },
  buyButtonLabel: "Satın al",
};

export function normalizeListingExpiryRules(raw: unknown): ListingExpiryRules {
  const d = DEFAULT_LISTING_EXPIRY_RULES;
  if (!raw || typeof raw !== "object") return { ...d, bidding: { ...d.bidding }, classified: { ...d.classified }, buy: { ...d.buy } };
  const o = raw as Record<string, any>;
  const bidding = o.bidding && typeof o.bidding === "object" ? o.bidding : {};
  const classified = o.classified && typeof o.classified === "object" ? o.classified : {};
  const buy = o.buy && typeof o.buy === "object" ? o.buy : {};

  const afterEndBid =
    bidding.afterEnd === "hide_immediate" || bidding.afterEnd === "grace" || bidding.afterEnd === "selection"
      ? bidding.afterEnd
      : d.bidding.afterEnd;

  return {
    bidding: {
      afterEnd: afterEndBid,
      selectionMinutes: Math.max(0, Number(bidding.selectionMinutes ?? d.bidding.selectionMinutes) || 0),
      graceMinutes: Math.max(0, Number(bidding.graceMinutes ?? d.bidding.graceMinutes) || 0),
      expiredVisibleDays: Math.max(0, Number(bidding.expiredVisibleDays ?? d.bidding.expiredVisibleDays) || 0),
      onApprove: bidding.onApprove === "hide_immediate" ? "hide_immediate" : "show_completed",
      approvedVisibleDays: Math.max(0, Number(bidding.approvedVisibleDays ?? d.bidding.approvedVisibleDays) || 0),
    },
    classified: {
      afterEnd: classified.afterEnd === "hide_immediate" ? "hide_immediate" : "grace",
      graceDays: Math.max(0, Number(classified.graceDays ?? d.classified.graceDays) || 0),
      expiredVisibleDays: Math.max(0, Number(classified.expiredVisibleDays ?? d.classified.expiredVisibleDays) || 0),
    },
    buy: {
      afterEnd: buy.afterEnd === "grace" ? "grace" : "hide_immediate",
      graceDays: Math.max(0, Number(buy.graceDays ?? d.buy.graceDays) || 0),
      expiredVisibleDays: Math.max(0, Number(buy.expiredVisibleDays ?? d.buy.expiredVisibleDays) || 0),
      closesWhenBiddingEnds: buy.closesWhenBiddingEnds !== false,
    },
    buyButtonLabel: String(buyButtonLabelSafe(o.buyButtonLabel ?? d.buyButtonLabel)),
  };
}

function buyButtonLabelSafe(v: unknown) {
  const s = String(v || "Satın al").trim().slice(0, 32);
  return s || "Satın al";
}

export type ListingExpiryKind = "bidding" | "classified" | "buy";

/** İlanın süre kurallarında hangi kova? */
export function resolveListingExpiryKind(opts: {
  offersEnabled: boolean;
  escrowEligible?: boolean | null;
}): ListingExpiryKind {
  if (!opts.offersEnabled) {
    return opts.escrowEligible ? "buy" : "classified";
  }
  // Teklifli mod: Al (escrow) açıksa hibrit — süre bitişi teklif kuralları + Al kapanır
  return "bidding";
}
