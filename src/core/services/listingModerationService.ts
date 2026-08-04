import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";

export async function approveListing(listingId: string, adminId: string, tenantId?: string | null) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("İlan bulunamadı");
  if (listing.status !== ListingStatus.PENDING_REVIEW && listing.status !== ListingStatus.REJECTED) {
    throw new Error("Bu ilan onay kuyruğunda değil");
  }

  const days = Math.max(1, listing.durationDays || 7);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  const featuredDays = Math.max(0, listing.featuredDays || 0);
  const featuredUntil =
    featuredDays > 0 ? new Date(startsAt.getTime() + featuredDays * 24 * 60 * 60 * 1000) : null;

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: ListingStatus.ACTIVE,
      startsAt,
      endsAt,
      rejectionReason: null,
      reviewedAt: new Date(),
      reviewedById: adminId,
      isFeatured: featuredDays > 0 || listing.isFeatured,
      featuredUntil,
    },
  });

  await writeAuditLog({
    tenantId: tenantId || listing.tenantId,
    actorId: adminId,
    action: "listing.approve",
    entity: "Listing",
    entityId: listing.id,
    meta: { title: listing.title, durationDays: days },
  });

  await notifyUser(listing.sellerId, {
    title: "İlanınız yayınlandı",
    body: `"${listing.title}" adlı ilanınız yönetici tarafından onaylandı ve yayına alındı.`,
    eventKey: "listing_approved",
    link: `/ilan/${listing.id}`,
  });

  return updated;
}

export async function rejectListing(
  listingId: string,
  adminId: string,
  reason: string,
  tenantId?: string | null
) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("İlan bulunamadı");
  if (listing.status !== ListingStatus.PENDING_REVIEW) {
    throw new Error("Sadece onay bekleyen ilanlar reddedilebilir");
  }

  const trimmed = String(reason || "").trim();
  if (!trimmed) throw new Error("Red sebebi gerekli");

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: ListingStatus.REJECTED,
      rejectionReason: trimmed,
      reviewedAt: new Date(),
      reviewedById: adminId,
      startsAt: null,
      endsAt: null,
    },
  });

  await writeAuditLog({
    tenantId: tenantId || listing.tenantId,
    actorId: adminId,
    action: "listing.reject",
    entity: "Listing",
    entityId: listing.id,
    meta: { title: listing.title, reason: trimmed },
  });

  await notifyUser(listing.sellerId, {
    title: "İlanınız reddedildi",
    body: `"${listing.title}" reddedildi. Sebep: ${trimmed}. Düzenleyip tekrar gönderebilirsiniz.`,
    eventKey: "listing_rejected",
    link: `/ilan-ver?edit=${listing.id}`,
  });

  return updated;
}
