/**
 * Dikey yetki matrisi (saf / client-safe).
 * Backend assertUserMayPostVertical aynı kuralları uygular.
 */

import { isCorporateAccount, legacySubtypesForAccountType, parseCommercialSubtypes } from "@/lib/accountTypes";
import { commercialToShopFocus, parseCommercialProfile } from "@/data/commercialProfile";
import { type ListingVertical, requiredSubtypeForVertical } from "@/lib/listingVertical";

export type VerticalUserInput = {
  id?: string;
  accountType?: string | null;
  commercialSubtypes?: string[] | null;
  commercialStatus?: string | null;
  profile?: unknown;
  role?: string | null;
};

/** Kullanıcının sahip olduğu dikeyler (read-only / UI). */
export function allowedVerticalsForUser(user: VerticalUserInput): Set<ListingVertical> {
  const allowed = new Set<ListingVertical>();
  const at = String(user.accountType || "").toUpperCase();

  if (!isCorporateAccount(at)) {
    allowed.add("emlak");
    allowed.add("vasita");
    return allowed;
  }

  const subtypes = new Set(
    parseCommercialSubtypes(user.commercialSubtypes || [], null, true).map((s) => s.toUpperCase())
  );
  for (const k of legacySubtypesForAccountType(at) || []) {
    subtypes.add(k);
  }

  const focus = commercialToShopFocus(parseCommercialProfile(user.profile));

  if (subtypes.has("EMLAK_OFISI") || focus.root === "emlak") allowed.add("emlak");
  if (subtypes.has("GALERI") || focus.root === "vasita") allowed.add("vasita");
  if (subtypes.has("MAGAZA") || focus.root === "alisveris") allowed.add("alisveris");
  if (subtypes.has("OTEL") || subtypes.has("LOJISTIK") || focus.root === "premium") {
    allowed.add("premium");
  }

  return allowed;
}

export function userHasAlisverisCommerceAccess(user: VerticalUserInput): boolean {
  return allowedVerticalsForUser(user).has("alisveris");
}

/** UI: ListingKindChooser için izinli kind’ler */
export function allowedListingKindsForUser(user: VerticalUserInput): {
  genel: boolean;
  alisveris: boolean;
  premium: boolean;
} {
  const v = allowedVerticalsForUser(user);
  return {
    genel: v.has("emlak") || v.has("vasita"),
    alisveris: v.has("alisveris"),
    premium: v.has("premium"),
  };
}

export { requiredSubtypeForVertical };
