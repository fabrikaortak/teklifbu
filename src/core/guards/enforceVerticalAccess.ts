import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { resolveListingVerticalFromDb, type ListingVertical } from "@/lib/listingVertical";
import {
  assertUserMayPostVertical,
  VerticalAccessError,
  type VerticalAction,
} from "@/core/guards/verticalAccessGuard";

export { VerticalAccessError };

/** Listing yazma yolları için dikey ACL (user + shop yükler). */
export async function enforceListingVerticalAccess(opts: {
  session: SessionUser;
  categoryId: string;
  categorySlug?: string;
  attributes?: Record<string, unknown> | null;
  listingKind?: string | null;
  action: VerticalAction;
  adminBypass?: boolean;
}): Promise<ListingVertical> {
  const vertical = await resolveListingVerticalFromDb({
    categoryId: opts.categoryId,
    categorySlug: opts.categorySlug,
    attributes: opts.attributes,
    listingKind: opts.listingKind,
  });

  const fullUser = await prisma.user.findUnique({
    where: { id: opts.session.id },
    select: {
      id: true,
      accountType: true,
      commercialSubtypes: true,
      commercialStatus: true,
      profile: true,
      role: true,
    },
  });

  const shop = await prisma.shop.findFirst({
    where: { ownerId: opts.session.id },
    select: { id: true, ownerId: true, isActive: true },
  });

  await assertUserMayPostVertical({
    user: fullUser || {
      id: opts.session.id,
      accountType: opts.session.accountType,
    },
    shop,
    vertical,
    action: opts.action,
    categoryId: opts.categoryId,
    adminBypass: Boolean(opts.adminBypass) && opts.session.role === "ADMIN",
    adminId: opts.session.role === "ADMIN" ? opts.session.id : null,
  });

  return vertical;
}

export async function enforceSellerOfferVerticalAccess(opts: {
  userId: string;
  shopId: string;
  productCategoryId: string;
  productCategorySlug: string;
}) {
  const fullUser = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: {
      id: true,
      accountType: true,
      commercialSubtypes: true,
      commercialStatus: true,
      profile: true,
      role: true,
    },
  });
  const shop = await prisma.shop.findFirst({
    where: { id: opts.shopId },
    select: { id: true, ownerId: true, isActive: true },
  });

  const vertical = await resolveListingVerticalFromDb({
    categoryId: opts.productCategoryId,
    categorySlug: opts.productCategorySlug,
  });

  await assertUserMayPostVertical({
    user: fullUser || { id: opts.userId },
    shop,
    vertical,
    action: "CREATE_SELLER_OFFER",
    categoryId: opts.productCategoryId,
  });

  // Kurumsal paket — mevcut paket hata kodları
  const { guardListingCreate } = await import("@/core/guards/listingGuard");
  const limitCheck = await guardListingCreate(opts.userId);
  if (!limitCheck.allowed) {
    const err = new Error(limitCheck.error || "Paket gerekli") as Error & {
      code: string;
      status: number;
    };
    err.code = limitCheck.code || "SHOP_PACKAGE_REQUIRED";
    err.status = 403;
    throw err;
  }
}
