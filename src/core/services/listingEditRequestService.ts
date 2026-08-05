import { EditRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";
import { isLiveListingStatus } from "@/lib/listingStatus";
import { notifyListingFavoriters } from "@/core/services/favoriteNotify";
import { formatTl } from "@/lib/format";

export type ListingEditPayload = {
  categoryId: string;
  title: string;
  description: string;
  city: string;
  district: string | null;
  neighborhood: string | null;
  dealType: string;
  askPrice: number;
  durationDays: number;
  coverImage: string | null;
  images: string[];
  attributes: Prisma.InputJsonValue;
  latitude: number | null;
  longitude: number | null;
  eidsVerified: boolean;
  eidsVerifiedAt: string | null;
  eidsPropertyId: string | null;
  eidsVehiclePlate: string | null;
};

export async function submitListingEditRequest(input: {
  listingId: string;
  sellerId: string;
  payload: ListingEditPayload;
  tenantId?: string | null;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) throw new Error("İlan bulunamadı");
  if (listing.sellerId !== input.sellerId) throw new Error("Yetkisiz");
  if (!isLiveListingStatus(listing.status)) {
    throw new Error("Bu ilan için düzenleme talebi oluşturulamaz");
  }
  if (Number(listing.bidCount) > 0 || Number(listing.highestBid) > 0) {
    throw new Error("İlanınıza teklif geldiği için düzenleme talebi oluşturulamaz");
  }

  // Kategori değişiminde dikey ACL
  if (input.payload.categoryId && input.payload.categoryId !== listing.categoryId) {
    const { resolveListingVerticalFromDb } = await import("@/lib/listingVertical");
    const { assertUserMayPostVertical, VerticalAccessError } = await import(
      "@/core/guards/verticalAccessGuard"
    );
    const seller = await prisma.user.findUnique({
      where: { id: input.sellerId },
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
      where: { ownerId: input.sellerId },
      select: { id: true, ownerId: true, isActive: true },
    });
    const vertical = await resolveListingVerticalFromDb({
      categoryId: input.payload.categoryId,
      attributes: (input.payload.attributes || {}) as Record<string, unknown>,
    });
    try {
      await assertUserMayPostVertical({
        user: seller || { id: input.sellerId },
        shop,
        vertical,
        action: "UPDATE_LISTING_CATEGORY",
        categoryId: input.payload.categoryId,
      });
    } catch (e) {
      if (e instanceof VerticalAccessError) throw e;
      throw e;
    }
  }

  const existing = await prisma.listingEditRequest.findFirst({
    where: { listingId: listing.id, status: EditRequestStatus.PENDING },
  });

  const req = existing
    ? await prisma.listingEditRequest.update({
        where: { id: existing.id },
        data: {
          payload: input.payload as Prisma.InputJsonValue,
          rejectionReason: null,
        },
      })
    : await prisma.listingEditRequest.create({
        data: {
          listingId: listing.id,
          sellerId: input.sellerId,
          payload: input.payload as Prisma.InputJsonValue,
          status: EditRequestStatus.PENDING,
        },
      });

  await writeAuditLog({
    tenantId: input.tenantId || listing.tenantId,
    actorId: input.sellerId,
    action: existing ? "listing.edit_request_update" : "listing.edit_request",
    entity: "ListingEditRequest",
    entityId: req.id,
    meta: { listingId: listing.id, title: listing.title },
  });

  return req;
}

export async function approveListingEditRequest(
  requestId: string,
  adminId: string,
  tenantId?: string | null,
  opts?: {
    /** Admin bilinçli dikey ACL override */
    adminBypass?: boolean;
    /** Bypass gerekçesi (adminBypass true ise zorunlu) */
    bypassReason?: string | null;
  }
) {
  const req = await prisma.listingEditRequest.findUnique({
    where: { id: requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== EditRequestStatus.PENDING) throw new Error("Talep zaten sonuçlanmış");

  const listing = req.listing;
  if (!isLiveListingStatus(listing.status)) {
    throw new Error("İlan artık düzenleme uygulanabilir durumda değil");
  }

  const p = req.payload as ListingEditPayload;
  const nextCategoryId = p.categoryId || listing.categoryId;

  // Onay öncesi güncel subtype/shopFocus ile dikey ACL
  {
    const { resolveListingVerticalFromDb } = await import("@/lib/listingVertical");
    const { assertUserMayPostVertical, VerticalAccessError } = await import(
      "@/core/guards/verticalAccessGuard"
    );
    const seller = await prisma.user.findUnique({
      where: { id: req.sellerId },
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
      where: { ownerId: req.sellerId },
      select: { id: true, ownerId: true, isActive: true },
    });
    const vertical = await resolveListingVerticalFromDb({
      categoryId: nextCategoryId,
      attributes: (p.attributes || listing.attributes || {}) as Record<string, unknown>,
    });

    try {
      await assertUserMayPostVertical({
        user: seller || { id: req.sellerId },
        shop,
        vertical,
        action: "UPDATE_LISTING_CATEGORY",
        categoryId: nextCategoryId,
      });
    } catch (e) {
      if (!(e instanceof VerticalAccessError)) throw e;
      if (!opts?.adminBypass) throw e;
      const reason = String(opts.bypassReason || "").trim();
      if (!reason) {
        throw new Error("Dikey ACL bypass için gerekçe zorunludur");
      }
      await writeAuditLog({
        tenantId: tenantId || listing.tenantId,
        actorId: adminId,
        action: "vertical.access.admin_bypass",
        entity: "ListingEditRequest",
        entityId: req.id,
        meta: {
          userId: req.sellerId,
          adminId,
          listingId: listing.id,
          editRequestId: req.id,
          oldCategoryId: listing.categoryId,
          newCategoryId: nextCategoryId,
          vertical,
          reason,
          currentSubtypes: seller?.commercialSubtypes || [],
          accountType: seller?.accountType || null,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.listingEditRequest.update({
      where: { id: req.id },
      data: {
        status: EditRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: null,
      },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        categoryId: p.categoryId || listing.categoryId,
        title: String(p.title || listing.title),
        description: String(p.description ?? listing.description),
        city: String(p.city || listing.city),
        district: p.district !== undefined ? p.district : listing.district,
        neighborhood: p.neighborhood !== undefined ? p.neighborhood : listing.neighborhood,
        dealType: (p.dealType as typeof listing.dealType) || listing.dealType,
        askPrice: p.askPrice != null ? BigInt(Number(p.askPrice)) : listing.askPrice,
        durationDays: Number(p.durationDays) || listing.durationDays,
        coverImage: p.coverImage ?? listing.coverImage,
        images: Array.isArray(p.images) ? p.images : listing.images,
        attributes: (p.attributes as Prisma.InputJsonValue) ?? listing.attributes ?? undefined,
        latitude: p.latitude !== undefined ? p.latitude : listing.latitude,
        longitude: p.longitude !== undefined ? p.longitude : listing.longitude,
        eidsVerified: Boolean(p.eidsVerified),
        eidsVerifiedAt: p.eidsVerifiedAt ? new Date(p.eidsVerifiedAt) : null,
        eidsPropertyId: p.eidsPropertyId ?? null,
        eidsVehiclePlate: p.eidsVehiclePlate ?? null,
      },
    });
  });

  await writeAuditLog({
    tenantId: tenantId || listing.tenantId,
    actorId: adminId,
    action: "listing.edit_approve",
    entity: "ListingEditRequest",
    entityId: req.id,
    meta: { listingId: listing.id, title: p.title },
  });

  await notifyUser(req.sellerId, {
    title: "Düzenleme onaylandı",
    body: `"${listing.title}" için gönderdiğiniz düzenleme talebi onaylandı. İlan güncellendi.`,
    eventKey: "listing_edit_approved",
    link: `/ilan/${listing.id}`,
  });

  const oldPrice = Number(listing.askPrice);
  const newPrice = p.askPrice != null ? Number(p.askPrice) : oldPrice;
  await notifyListingFavoriters(
    listing.id,
    {
      title: "Favori ilanınız yeniden düzenlendi",
      body: `"${p.title || listing.title}" içeriği güncellendi.`,
      eventKey: "favorite_listing_edited",
      link: `/ilan/${listing.id}`,
    },
    { excludeUserIds: [listing.sellerId] }
  );
  if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && oldPrice !== newPrice) {
    const dropped = newPrice < oldPrice;
    await notifyListingFavoriters(
      listing.id,
      {
        title: dropped
          ? "Favori ilanınızın fiyatı düştü"
          : "Favori ilanınızın fiyatı yükseldi",
        body: `"${p.title || listing.title}" fiyatı ${formatTl(oldPrice)} → ${formatTl(newPrice)}.`,
        eventKey: dropped ? "favorite_price_dropped" : "favorite_price_rose",
        link: `/ilan/${listing.id}`,
      },
      { excludeUserIds: [listing.sellerId] }
    );
  }

  return req;
}

export async function rejectListingEditRequest(
  requestId: string,
  adminId: string,
  reason: string,
  tenantId?: string | null
) {
  const req = await prisma.listingEditRequest.findUnique({
    where: { id: requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== EditRequestStatus.PENDING) throw new Error("Talep zaten sonuçlanmış");

  const trimmed = String(reason || "").trim();
  if (!trimmed) throw new Error("Red sebebi gerekli");

  await prisma.listingEditRequest.update({
    where: { id: req.id },
    data: {
      status: EditRequestStatus.REJECTED,
      rejectionReason: trimmed,
      reviewedAt: new Date(),
      reviewedById: adminId,
    },
  });

  await writeAuditLog({
    tenantId: tenantId || req.listing.tenantId,
    actorId: adminId,
    action: "listing.edit_reject",
    entity: "ListingEditRequest",
    entityId: req.id,
    meta: { listingId: req.listingId, reason: trimmed },
  });

  await notifyUser(req.sellerId, {
    title: "Düzenleme reddedildi",
    body: `"${req.listing.title}" düzenleme talebi reddedildi. İlan eski haliyle yayında kalmaya devam ediyor. Sebep: ${trimmed}`,
    eventKey: "listing_edit_rejected",
    link: `/ilan/${req.listingId}`,
  });

  return req;
}
