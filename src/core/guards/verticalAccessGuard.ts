import { isCorporateAccount } from "@/lib/accountTypes";
import {
  type ListingVertical,
  requiredSubtypeForVertical,
} from "@/lib/listingVertical";
import { writeAuditLog } from "@/core/services/tenantService";
import {
  allowedVerticalsForUser,
  userHasAlisverisCommerceAccess,
  allowedListingKindsForUser,
  type VerticalUserInput,
} from "@/lib/verticalAccessPolicy";

export type VerticalAction =
  | "CREATE_LISTING"
  | "UPDATE_LISTING_CATEGORY"
  | "CREATE_SELLER_OFFER"
  | "CREATE_PRODUCT_REQUEST"
  | "PUBLISH_DRAFT"
  | "REPUBLISH";

export class VerticalAccessError extends Error {
  code: string;
  vertical?: ListingVertical;
  requiredSubtype?: string | null;
  status: number;

  constructor(
    code: string,
    message: string,
    opts?: { vertical?: ListingVertical; requiredSubtype?: string | null; status?: number }
  ) {
    super(message);
    this.name = "VerticalAccessError";
    this.code = code;
    this.vertical = opts?.vertical;
    this.requiredSubtype = opts?.requiredSubtype;
    this.status = opts?.status ?? 403;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.vertical ? { vertical: this.vertical } : {}),
      ...(this.requiredSubtype ? { requiredSubtype: this.requiredSubtype } : {}),
    };
  }
}

export type VerticalShopInput = {
  id: string;
  ownerId: string;
  isActive?: boolean | null;
} | null;

export {
  allowedVerticalsForUser,
  userHasAlisverisCommerceAccess,
  allowedListingKindsForUser,
  type VerticalUserInput,
};

/**
 * Deny-by-default for corporate without subtype/shopFocus.
 */
export async function assertUserMayPostVertical(opts: {
  user: VerticalUserInput;
  shop?: VerticalShopInput;
  vertical: ListingVertical;
  action: VerticalAction;
  categoryId?: string | null;
  /** Admin kullanıcı adına oluştururken açık bypass */
  adminBypass?: boolean;
  adminId?: string | null;
}): Promise<void> {
  const { user, shop, vertical, action } = opts;

  if (opts.adminBypass) {
    await writeAuditLog({
      actorId: opts.adminId || user.id || null,
      action: "vertical.access.admin_bypass",
      entity: "User",
      entityId: user.id || null,
      meta: {
        targetUserId: user.id || null,
        shopId: shop?.id || null,
        requestedVertical: vertical,
        categoryId: opts.categoryId || null,
        verticalAction: action,
      },
    });
    return;
  }

  if (
    user.id &&
    (action === "CREATE_LISTING" ||
      action === "PUBLISH_DRAFT" ||
      action === "REPUBLISH" ||
      action === "UPDATE_LISTING_CATEGORY")
  ) {
    const { assertTrustAllowsListing } = await import("@/core/services/trustScoreService");
    const trust = await assertTrustAllowsListing(user.id);
    if (!trust.ok) {
      await logDenied(opts, trust.code, trust.error);
      throw new VerticalAccessError(trust.code, trust.error, { status: 403 });
    }
  }

  if (vertical === "unknown") {
    await logDenied(opts, "VERTICAL_UNKNOWN", "Kategori dikeyi belirlenemedi");
    throw new VerticalAccessError("VERTICAL_UNKNOWN", "Kategori dikeyi belirlenemedi", {
      vertical,
      status: 400,
    });
  }

  // SellerOffer / ProductRequest: alışveriş + mağaza
  const { getCommercialPublishMap } = await import("@/core/services/commercialPublishMapService");
  const publishMap = await getCommercialPublishMap();

  if (action === "CREATE_SELLER_OFFER" || action === "CREATE_PRODUCT_REQUEST") {
    if (shop && shop.isActive === false) {
      await logDenied(opts, "SHOP_INACTIVE", "Mağaza pasif");
      throw new VerticalAccessError("SHOP_INACTIVE", "Mağaza pasif", { status: 403 });
    }
    if (action === "CREATE_SELLER_OFFER") {
      if (!shop) {
        await logDenied(opts, "VERTICAL_ACCESS_DENIED", "Mağaza gerekli");
        throw new VerticalAccessError("VERTICAL_ACCESS_DENIED", "SellerOffer için mağaza gerekli", {
          vertical: "alisveris",
          requiredSubtype: "MAGAZA",
        });
      }
      if (user.id && shop.ownerId !== user.id) {
        await logDenied(opts, "VERTICAL_ACCESS_DENIED", "Mağaza yetkisi yok");
        throw new VerticalAccessError("VERTICAL_ACCESS_DENIED", "Mağaza yetkisi yok", {
          vertical: "alisveris",
          requiredSubtype: "MAGAZA",
        });
      }
    }
    if (vertical !== "alisveris") {
      await logDenied(opts, "VERTICAL_ACCESS_DENIED", "Alışveriş dikeyi gerekli");
      throw new VerticalAccessError(
        "VERTICAL_ACCESS_DENIED",
        "Bu işlem yalnız alışveriş dikeyi için geçerlidir",
        { vertical, requiredSubtype: "MAGAZA" }
      );
    }
    if (!userHasAlisverisCommerceAccess(user, publishMap)) {
      await logDenied(opts, "VERTICAL_ACCESS_DENIED", "MAGAZA yetkisi yok");
      throw new VerticalAccessError("VERTICAL_ACCESS_DENIED", "Alışveriş mağazası yetkiniz yok", {
        vertical: "alisveris",
        requiredSubtype: "MAGAZA",
      });
    }
    return;
  }

  // Listing create / category update / publish / republish
  const allowed = allowedVerticalsForUser(user, publishMap);

  if (isCorporateAccount(user.accountType) && allowed.size === 0) {
    await logDenied(opts, "VERTICAL_ACCESS_DENIED", "Subtype/shopFocus yok — deny");
    throw new VerticalAccessError(
      "VERTICAL_ACCESS_DENIED",
      "Faaliyet alanı (emlak ofisi / galeri / mağaza) seçilmeden ilan verilemez",
      {
        vertical,
        requiredSubtype: requiredSubtypeForVertical(vertical),
      }
    );
  }

  if (!allowed.has(vertical)) {
    await logDenied(opts, "VERTICAL_ACCESS_DENIED", "Dikey yetkisiz");
    throw new VerticalAccessError(
      "VERTICAL_ACCESS_DENIED",
      `Bu kategori dikeyine (${vertical}) ilan verme yetkiniz yok`,
      {
        vertical,
        requiredSubtype: requiredSubtypeForVertical(vertical),
      }
    );
  }
}

async function logDenied(
  opts: {
    user: VerticalUserInput;
    shop?: VerticalShopInput;
    vertical: ListingVertical;
    action: VerticalAction;
    categoryId?: string | null;
  },
  code: string,
  note: string
) {
  try {
    await writeAuditLog({
      actorId: opts.user.id || null,
      action: "VERTICAL_ACCESS_DENIED",
      entity: "VerticalAcl",
      entityId: opts.categoryId || opts.user.id || null,
      meta: {
        code,
        note,
        userId: opts.user.id || null,
        shopId: opts.shop?.id || null,
        requestedVertical: opts.vertical,
        categoryId: opts.categoryId || null,
        action: opts.action,
        currentSubtypes: opts.user.commercialSubtypes || [],
        accountType: opts.user.accountType || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    /* audit best-effort */
  }
}

export function verticalAccessJsonResponse(err: VerticalAccessError) {
  return Response.json(err.toJSON(), { status: err.status });
}
