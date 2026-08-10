/**
 * Dikey yetki matrisi (saf / client-safe).
 * Backend assertUserMayPostVertical aynı kuralları uygular.
 */

import { isCorporateAccount, legacySubtypesForAccountType, parseCommercialSubtypes } from "@/lib/accountTypes";
import { commercialToShopFocus, parseCommercialProfile } from "@/data/commercialProfile";
import { type ListingVertical, requiredSubtypeForVertical } from "@/lib/listingVertical";
import {
  defaultCommercialPublishMap,
  type CommercialPublishMap,
  verticalRootsForSubtypes,
  listingFormsForSubtypes,
} from "@/lib/commercialPublishMap";

export type VerticalUserInput = {
  id?: string;
  accountType?: string | null;
  commercialSubtypes?: string[] | null;
  commercialStatus?: string | null;
  profile?: unknown;
  role?: string | null;
};

function rootToVertical(root: string): ListingVertical | null {
  if (root === "emlak") return "emlak";
  if (root === "vasita") return "vasita";
  if (root === "alisveris") return "alisveris";
  if (root === "premium") return "premium";
  return null;
}

/** Kullanıcının sahip olduğu dikeyler (read-only / UI). */
export function allowedVerticalsForUser(
  user: VerticalUserInput,
  publishMap: CommercialPublishMap = defaultCommercialPublishMap()
): Set<ListingVertical> {
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

  const roots = verticalRootsForSubtypes([...subtypes], publishMap);
  for (const root of roots) {
    const v = rootToVertical(root);
    if (v) allowed.add(v);
  }

  // Geriye dönük: eski kayıtlarda shopFocus dolu, harita satırı yoksa
  if (allowed.size === 0) {
    const focus = commercialToShopFocus(parseCommercialProfile(user.profile));
    const v = rootToVertical(focus.root);
    if (v) allowed.add(v);
  }

  return allowed;
}

export function userHasAlisverisCommerceAccess(
  user: VerticalUserInput,
  publishMap?: CommercialPublishMap
): boolean {
  return allowedVerticalsForUser(user, publishMap).has("alisveris");
}

/** UI: ListingKindChooser için izinli kind’ler */
export function allowedListingKindsForUser(
  user: VerticalUserInput,
  publishMap: CommercialPublishMap = defaultCommercialPublishMap()
): {
  genel: boolean;
  alisveris: boolean;
  premium: boolean;
} {
  const forms = listingFormsForSubtypes(
    parseCommercialSubtypes(user.commercialSubtypes || [], null, true),
    publishMap
  );
  if (forms.size > 0) {
    return {
      genel: forms.has("genel"),
      alisveris: forms.has("alisveris"),
      premium: forms.has("premium"),
    };
  }
  const v = allowedVerticalsForUser(user, publishMap);
  return {
    genel: v.has("emlak") || v.has("vasita"),
    alisveris: v.has("alisveris"),
    premium: v.has("premium"),
  };
}

export { requiredSubtypeForVertical };
