import { getSettingsMap } from "@/core/settings";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";

export type VerticalBidRules = {
  vertical: "alisveris" | "emlak_vasita";
  stepTl: number;
  stepByCategory: Record<string, number>;
  requireHigherThanHighest: boolean;
  maxBidsPerUserPerListing: number;
  secondBidReplacesPrevious: boolean;
  secondBidMustBeHigher: boolean;
  durationOptionsDays: number[];
  canExceedListingEnd: boolean;
  exceedPolicy: string;
};

/** Kuruş hassasiyetli basamak kontrolü (Alışveriş 0,01 TL olabilir). */
export function amountMatchesBidStep(amount: number, step: number): boolean {
  if (!(amount > 0) || !Number.isFinite(amount)) return false;
  const stepTl = Number(step);
  if (!Number.isFinite(stepTl) || stepTl <= 0) return true;
  const amountCents = Math.round(amount * 100);
  const stepCents = Math.max(1, Math.round(stepTl * 100));
  return amountCents % stepCents === 0;
}

export function resolveVerticalBidRules(
  categorySlug: string | null | undefined,
  settings: Record<string, unknown>
): VerticalBidRules {
  const shopping = isAlisverisCategorySlug(categorySlug);
  if (shopping) {
    return {
      vertical: "alisveris",
      stepTl: Number(settings.alisveris_bid_step_tl ?? 0.01) || 0.01,
      stepByCategory: (settings.alisveris_bid_step_by_category as Record<string, number>) || {},
      requireHigherThanHighest: Boolean(
        settings.alisveris_require_higher_than_highest ?? settings.require_higher_than_highest ?? true
      ),
      maxBidsPerUserPerListing: Number(
        settings.alisveris_max_bids_per_user_per_listing ?? settings.max_bids_per_user_per_listing ?? 4
      ),
      secondBidReplacesPrevious: Boolean(
        settings.alisveris_second_bid_replaces_previous ?? settings.second_bid_replaces_previous ?? true
      ),
      secondBidMustBeHigher: Boolean(
        settings.alisveris_second_bid_must_be_higher ?? settings.second_bid_must_be_higher ?? true
      ),
      durationOptionsDays: (Array.isArray(settings.alisveris_bid_duration_options_days)
        ? (settings.alisveris_bid_duration_options_days as number[])
        : null) ||
        (Array.isArray(settings.bid_duration_options_days)
          ? (settings.bid_duration_options_days as number[])
          : [1, 3, 7]),
      canExceedListingEnd: Boolean(
        settings.alisveris_bid_can_exceed_listing_end ?? settings.bid_can_exceed_listing_end ?? false
      ),
      exceedPolicy: String(
        settings.alisveris_bid_exceed_policy ?? settings.bid_exceed_policy ?? "clamp"
      ),
    };
  }

  return {
    vertical: "emlak_vasita",
    stepTl: Number(settings.bid_step_tl ?? 10000) || 10000,
    stepByCategory: (settings.bid_step_by_category as Record<string, number>) || {},
    requireHigherThanHighest: Boolean(settings.require_higher_than_highest ?? true),
    maxBidsPerUserPerListing: Number(settings.max_bids_per_user_per_listing ?? 4),
    secondBidReplacesPrevious: Boolean(settings.second_bid_replaces_previous ?? true),
    secondBidMustBeHigher: Boolean(settings.second_bid_must_be_higher ?? true),
    durationOptionsDays: (settings.bid_duration_options_days as number[]) || [1, 3, 7],
    canExceedListingEnd: Boolean(settings.bid_can_exceed_listing_end ?? false),
    exceedPolicy: String(settings.bid_exceed_policy || "clamp"),
  };
}

export async function getVerticalBidRules(categorySlug: string | null | undefined) {
  const settings = await getSettingsMap();
  return { settings, rules: resolveVerticalBidRules(categorySlug, settings) };
}

export function effectiveBidStep(rules: VerticalBidRules, categorySlug: string | null | undefined) {
  const slug = String(categorySlug || "");
  const byCat = rules.stepByCategory[slug];
  return Number(byCat ?? rules.stepTl) || rules.stepTl;
}
