import { EditRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";
import { isLiveListingStatus, listingHasBids } from "@/lib/listingStatus";
import { isCorporateAccount } from "@/lib/accountTypes";
import { formatTl } from "@/lib/format";

export type BulkListingFields = {
  title: string;
  askPrice: number;
  durationDays: number;
};

export type BulkListingUpdateItem = {
  listingId: string;
  listingNo?: string | null;
  before: BulkListingFields;
  after: BulkListingFields;
};

function dayMs() {
  return 24 * 60 * 60 * 1000;
}

function computeEndsAt(startsAt: Date | null | undefined, durationDays: number) {
  const start = startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : new Date();
  return new Date(start.getTime() + Math.max(1, durationDays) * dayMs());
}

export async function submitBulkListingUpdate(input: {
  sellerId: string;
  items: Array<{ listingId: string; title?: string; askPrice?: number; durationDays?: number }>;
  tenantId?: string | null;
}) {
  const seller = await prisma.user.findUnique({ where: { id: input.sellerId } });
  if (!seller) throw new Error("Kullanıcı bulunamadı");
  if (!isCorporateAccount(seller.accountType)) {
    throw new Error("Toplu güncelleme yalnızca ticari üyeler içindir");
  }
  if (!input.items?.length) throw new Error("En az bir ilan seçin");

  const existingPending = await prisma.bulkListingUpdateRequest.findFirst({
    where: { sellerId: input.sellerId, status: EditRequestStatus.PENDING },
  });
  if (existingPending) {
    throw new Error("Zaten onay bekleyen bir toplu güncelleme talebiniz var");
  }

  const prepared: BulkListingUpdateItem[] = [];

  for (const row of input.items) {
    const listing = await prisma.listing.findUnique({ where: { id: row.listingId } });
    if (!listing) throw new Error(`İlan bulunamadı: ${row.listingId}`);
    if (listing.sellerId !== input.sellerId) throw new Error("Yetkisiz ilan");
    if (!isLiveListingStatus(listing.status)) {
      throw new Error(`"${listing.title}" yayında değil — toplu güncellemeye dahil edilemez`);
    }
    if (listingHasBids(listing)) {
      throw new Error(`"${listing.title}" teklif aldığı için güncellenemez`);
    }

    const title = String(row.title ?? listing.title).trim();
    const askPrice = Number(row.askPrice ?? listing.askPrice);
    const durationDays = Math.max(1, Math.min(90, Number(row.durationDays ?? listing.durationDays) || 7));
    if (!title || title.length < 3) throw new Error("İlan adı en az 3 karakter olmalı");
    if (!Number.isFinite(askPrice) || askPrice < 0) throw new Error("Geçersiz fiyat");

    const before: BulkListingFields = {
      title: listing.title,
      askPrice: Number(listing.askPrice),
      durationDays: listing.durationDays || 7,
    };
    const after: BulkListingFields = { title, askPrice, durationDays };
    if (
      before.title === after.title &&
      before.askPrice === after.askPrice &&
      before.durationDays === after.durationDays
    ) {
      continue;
    }
    prepared.push({
      listingId: listing.id,
      listingNo: listing.listingNo,
      before,
      after,
    });
  }

  if (!prepared.length) throw new Error("Değişiklik yok — en az bir alanı güncelleyin");

  const req = await prisma.bulkListingUpdateRequest.create({
    data: {
      sellerId: input.sellerId,
      items: prepared as unknown as Prisma.InputJsonValue,
      status: EditRequestStatus.PENDING,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId || null,
    actorId: input.sellerId,
    action: "listing.bulk_edit_request",
    entity: "BulkListingUpdateRequest",
    entityId: req.id,
    meta: { count: prepared.length },
  });

  return { request: req, count: prepared.length };
}

export async function approveBulkListingUpdate(
  requestId: string,
  adminId: string,
  tenantId?: string | null
) {
  const req = await prisma.bulkListingUpdateRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== EditRequestStatus.PENDING) throw new Error("Talep zaten sonuçlanmış");

  const items = (Array.isArray(req.items) ? req.items : []) as BulkListingUpdateItem[];

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const listing = await tx.listing.findUnique({ where: { id: item.listingId } });
      if (!listing || listing.sellerId !== req.sellerId) continue;
      if (!isLiveListingStatus(listing.status)) continue;
      const durationDays = Math.max(1, Number(item.after.durationDays) || listing.durationDays);
      await tx.listing.update({
        where: { id: listing.id },
        data: {
          title: String(item.after.title || listing.title),
          askPrice: BigInt(Math.round(Number(item.after.askPrice))),
          durationDays,
          endsAt: computeEndsAt(listing.startsAt, durationDays),
        },
      });
    }
    await tx.bulkListingUpdateRequest.update({
      where: { id: req.id },
      data: {
        status: EditRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: null,
      },
    });
  });

  await writeAuditLog({
    tenantId: tenantId || null,
    actorId: adminId,
    action: "listing.bulk_edit_approve",
    entity: "BulkListingUpdateRequest",
    entityId: req.id,
    meta: { count: items.length },
  });

  await notifyUser(req.sellerId, {
    title: "Toplu güncelleme onaylandı",
    body: `${items.length} ilan için gönderdiğiniz toplu güncelleme onaylandı.`,
    eventKey: "listing_bulk_edit_approved",
    link: "/hesabim?s=ilanlarim",
  });

  return req;
}

export async function rejectBulkListingUpdate(
  requestId: string,
  adminId: string,
  reason: string,
  tenantId?: string | null
) {
  const req = await prisma.bulkListingUpdateRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== EditRequestStatus.PENDING) throw new Error("Talep zaten sonuçlanmış");
  const trimmed = String(reason || "").trim();
  if (!trimmed) throw new Error("Red sebebi gerekli");

  const items = (Array.isArray(req.items) ? req.items : []) as BulkListingUpdateItem[];

  await prisma.bulkListingUpdateRequest.update({
    where: { id: req.id },
    data: {
      status: EditRequestStatus.REJECTED,
      rejectionReason: trimmed,
      reviewedAt: new Date(),
      reviewedById: adminId,
    },
  });

  await writeAuditLog({
    tenantId: tenantId || null,
    actorId: adminId,
    action: "listing.bulk_edit_reject",
    entity: "BulkListingUpdateRequest",
    entityId: req.id,
    meta: { reason: trimmed, count: items.length },
  });

  await notifyUser(req.sellerId, {
    title: "Toplu güncelleme reddedildi",
    body: `Toplu ilan güncelleme talebiniz reddedildi. Sebep: ${trimmed}`,
    eventKey: "listing_bulk_edit_rejected",
    link: "/hesabim?s=ilanlarim",
  });

  return req;
}

export function summarizeBulkItem(item: BulkListingUpdateItem) {
  const changes: string[] = [];
  if (item.before.title !== item.after.title) {
    changes.push(`Ad: ${item.before.title} → ${item.after.title}`);
  }
  if (item.before.askPrice !== item.after.askPrice) {
    changes.push(`Fiyat: ${formatTl(item.before.askPrice)} → ${formatTl(item.after.askPrice)}`);
  }
  if (item.before.durationDays !== item.after.durationDays) {
    changes.push(`Süre: ${item.before.durationDays}g → ${item.after.durationDays}g`);
  }
  return changes;
}
