import { ExtensionRequestStatus, ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";
import {
  canRequestListingExtension,
  EXTENSION_DAY_OPTIONS,
  isExtensionDayOption,
} from "@/lib/listingExtension";

export { canRequestListingExtension, EXTENSION_DAY_OPTIONS };

export async function requestListingExtension(input: {
  listingId: string;
  sellerId: string;
  days: number;
  tenantId?: string | null;
}) {
  const days = Number(input.days);
  if (!isExtensionDayOption(days)) {
    throw new Error("Ek süre 1, 3, 7 veya 14 gün olmalıdır");
  }

  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) throw new Error("İlan bulunamadı");
  if (listing.sellerId !== input.sellerId) throw new Error("Yetkisiz");
  if (
    !canRequestListingExtension(listing.status, {
      endsAt: listing.endsAt,
      approvedBidId: listing.approvedBidId,
    })
  ) {
    throw new Error(
      "Ek süre yalnızca yayın süresi dolup sonuçlanmayan (teklif yok veya kabul edilmeyen) ilanlar için istenebilir"
    );
  }

  const pending = await prisma.listingExtensionRequest.findFirst({
    where: { listingId: listing.id, status: ExtensionRequestStatus.PENDING },
  });
  if (pending) throw new Error("Bu ilan için zaten bekleyen bir ek süre talebi var");

  const req = await prisma.listingExtensionRequest.create({
    data: {
      listingId: listing.id,
      sellerId: input.sellerId,
      days,
      status: ExtensionRequestStatus.PENDING,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId || listing.tenantId,
    actorId: input.sellerId,
    action: "listing.extension_request",
    entity: "ListingExtensionRequest",
    entityId: req.id,
    meta: { listingId: listing.id, days, title: listing.title },
  });

  return req;
}

export async function approveListingExtension(
  requestId: string,
  adminId: string,
  tenantId?: string | null
) {
  const req = await prisma.listingExtensionRequest.findUnique({
    where: { id: requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== ExtensionRequestStatus.PENDING) throw new Error("Talep zaten sonuçlanmış");

  const listing = req.listing;
  if (
    !canRequestListingExtension(listing.status, {
      endsAt: listing.endsAt,
      approvedBidId: listing.approvedBidId,
    })
  ) {
    throw new Error("İlan artık ek süreye uygun değil");
  }

  const base = listing.endsAt && listing.endsAt.getTime() > Date.now() ? listing.endsAt : new Date();
  const endsAt = new Date(base.getTime() + req.days * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.listingExtensionRequest.update({
      where: { id: req.id },
      data: {
        status: ExtensionRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: null,
      },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        status: ListingStatus.ACTIVE,
        endsAt,
        selectionEndsAt: null,
        republishAvailableAt: null,
        durationDays: (listing.durationDays || 0) + req.days,
      },
    });
  });

  await writeAuditLog({
    tenantId: tenantId || listing.tenantId,
    actorId: adminId,
    action: "listing.extension_approve",
    entity: "ListingExtensionRequest",
    entityId: req.id,
    meta: { listingId: listing.id, days: req.days, endsAt },
  });

  await notifyUser(req.sellerId, {
    title: "Ek süre onaylandı",
    body: `"${listing.title}" ilanınıza +${req.days} gün eklendi.`,
    eventKey: "listing_extension_approved",
    link: `/ilan/${listing.id}`,
  });

  return { endsAt, days: req.days };
}

export async function rejectListingExtension(
  requestId: string,
  adminId: string,
  reason: string,
  tenantId?: string | null
) {
  const req = await prisma.listingExtensionRequest.findUnique({
    where: { id: requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== ExtensionRequestStatus.PENDING) throw new Error("Talep zaten sonuçlanmış");

  const trimmed = String(reason || "").trim();
  if (!trimmed) throw new Error("Red sebebi gerekli");

  await prisma.listingExtensionRequest.update({
    where: { id: req.id },
    data: {
      status: ExtensionRequestStatus.REJECTED,
      rejectionReason: trimmed,
      reviewedAt: new Date(),
      reviewedById: adminId,
    },
  });

  await writeAuditLog({
    tenantId: tenantId || req.listing.tenantId,
    actorId: adminId,
    action: "listing.extension_reject",
    entity: "ListingExtensionRequest",
    entityId: req.id,
    meta: { listingId: req.listingId, days: req.days, reason: trimmed },
  });

  await notifyUser(req.sellerId, {
    title: "Ek süre reddedildi",
    body: `"${req.listing.title}" ek süre talebi reddedildi. Sebep: ${trimmed}`,
    eventKey: "listing_extension_rejected",
    link: `/hesabim?s=ilanlarim`,
  });

  return req;
}
