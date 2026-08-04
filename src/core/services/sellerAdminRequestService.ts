import { BidStatus, Prisma, SellerAdminRequestStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";
import { notifyListingFavoriters } from "@/core/services/favoriteNotify";
import { formatTl } from "@/lib/format";
import {
  buildChangedFields,
  fieldLabel,
  parseAllowedFields,
  snapshotListingFields,
  isAttrField,
  attrKeyFromField,
} from "@/lib/listingEditFields";

const BIDDER_REVISE_HOURS = 48;

export async function markBidsListingGone(listingId: string, title: string) {
  await prisma.bid.updateMany({
    where: { listingId },
    data: {
      listingGone: true,
      listingTitleSnapshot: title,
    },
  });
}

export async function submitSellerAdminEditHelp(input: {
  listingId: string;
  sellerId: string;
  message: string;
  tenantId?: string | null;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) throw new Error("İlan bulunamadı");
  if (listing.sellerId !== input.sellerId) throw new Error("Yetkisiz");
  if (Number(listing.bidCount) <= 0) {
    throw new Error("Bu ilanda henüz teklif yok; düzenleme ekranından güncelleyebilirsiniz");
  }

  const message = String(input.message || "").trim();
  if (message.length < 10) throw new Error("Mesajınız en az 10 karakter olmalıdır");
  if (message.length > 2000) throw new Error("Mesaj çok uzun");

  const existing = await prisma.sellerAdminRequest.findFirst({
    where: {
      listingId: listing.id,
      sellerId: input.sellerId,
      kind: "EDIT_HELP",
      status: {
        in: [
          SellerAdminRequestStatus.PENDING,
          SellerAdminRequestStatus.GRANTED,
          SellerAdminRequestStatus.PENDING_APPROVAL,
        ],
      },
    },
  });
  if (existing) {
    throw new Error("Bu ilan için zaten açık bir yönetici talebiniz var");
  }

  const req = await prisma.sellerAdminRequest.create({
    data: {
      listingId: listing.id,
      sellerId: input.sellerId,
      kind: "EDIT_HELP",
      message,
      status: SellerAdminRequestStatus.PENDING,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId || listing.tenantId,
    actorId: input.sellerId,
    action: "listing.admin_edit_help",
    entity: "SellerAdminRequest",
    entityId: req.id,
    meta: { listingId: listing.id, title: listing.title },
  });

  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      notifyUser(a.id, {
        title: "Satıcı düzenleme talebi",
        body: `"${listing.title}" ilanı için satıcı yöneticiyle iletişime geçmek istiyor.`,
        eventKey: "admin_seller_edit_help",
        link: "/admin/satici-talepleri",
      })
    )
  );

  return req;
}

/** Admin: düzenlenecek alanları seçip satıcıya iletir */
export async function grantSellerEditFields(input: {
  requestId: string;
  adminId: string;
  fields: string[];
  adminNote?: string;
  tenantId?: string | null;
}) {
  const req = await prisma.sellerAdminRequest.findUnique({
    where: { id: input.requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== SellerAdminRequestStatus.PENDING) {
    throw new Error("Bu talep için alan izni verilemez");
  }

  const fields = parseAllowedFields(input.fields);
  if (!fields.length) throw new Error("En az bir alan seçmelisiniz");

  const note = String(input.adminNote || "").trim();
  const updated = await prisma.sellerAdminRequest.update({
    where: { id: req.id },
    data: {
      status: SellerAdminRequestStatus.GRANTED,
      allowedFields: fields,
      adminNote: note || null,
      grantedAt: new Date(),
      resolvedById: input.adminId,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId || req.listing.tenantId,
    actorId: input.adminId,
    action: "listing.admin_edit_grant",
    entity: "SellerAdminRequest",
    entityId: req.id,
    meta: { listingId: req.listingId, fields },
  });

  const fieldNames = fields.map(fieldLabel).join(", ");
  await notifyUser(req.sellerId, {
    title: "Düzenleme izni verildi",
    body: `"${req.listing.title}" için şu alanları güncelleyebilirsiniz: ${fieldNames}.${
      note ? ` Not: ${note}` : ""
    }`,
    eventKey: "seller_edit_fields_granted",
    link: `/hesabim?s=bildirimler&grant=${req.id}`,
  });

  return updated;
}

/** Satıcı: izinli alanlarla düzenleme gönderir */
export async function submitGrantedListingEdit(input: {
  requestId: string;
  sellerId: string;
  payload: Record<string, unknown>;
  tenantId?: string | null;
}) {
  const req = await prisma.sellerAdminRequest.findUnique({
    where: { id: input.requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.sellerId !== input.sellerId) throw new Error("Yetkisiz");
  if (req.status !== SellerAdminRequestStatus.GRANTED) {
    throw new Error("Bu talep için düzenleme gönderilemez");
  }

  const fields = parseAllowedFields(req.allowedFields);
  if (!fields.length) throw new Error("İzinli alan bulunamadı");

  const listing = req.listing;
  const before = snapshotListingFields(listing);
  const beforeAttrs =
    before.attributes && typeof before.attributes === "object" && !Array.isArray(before.attributes)
      ? { ...(before.attributes as Record<string, unknown>) }
      : {};
  const partial: Record<string, unknown> = {};
  const attrPatch: Record<string, unknown> = { ...beforeAttrs };
  let touchedAttrs = false;
  const flatBefore: Record<string, unknown> = { ...before };
  const flatAfter: Record<string, unknown> = { ...before };

  for (const key of fields) {
    if (isAttrField(key)) {
      const ak = attrKeyFromField(key)!;
      if (!(key in input.payload) && !(ak in input.payload)) continue;
      const val = key in input.payload ? input.payload[key] : input.payload[ak];
      flatBefore[key] = beforeAttrs[ak];
      attrPatch[ak] = val;
      flatAfter[key] = val;
      touchedAttrs = true;
      continue;
    }
    if (!(key in input.payload)) continue;
    const val = input.payload[key];
    switch (key) {
      case "title":
        partial.title = String(val || "").trim();
        if (!partial.title) throw new Error("Başlık boş olamaz");
        flatAfter.title = partial.title;
        break;
      case "description":
        partial.description = String(val ?? "");
        flatAfter.description = partial.description;
        break;
      case "askPrice": {
        const n = Number(val);
        if (!Number.isFinite(n) || n <= 0) throw new Error("Geçerli bir fiyat girin");
        partial.askPrice = n;
        flatAfter.askPrice = n;
        break;
      }
      case "city":
        partial.city = String(val || "").trim();
        flatAfter.city = partial.city;
        break;
      case "district":
        partial.district = val ? String(val) : null;
        flatAfter.district = partial.district;
        break;
      case "neighborhood":
        partial.neighborhood = val ? String(val) : null;
        flatAfter.neighborhood = partial.neighborhood;
        break;
      case "dealType":
        partial.dealType = String(val || listing.dealType);
        flatAfter.dealType = partial.dealType;
        break;
      case "images": {
        const imgs = Array.isArray(val) ? val.map(String) : [];
        partial.images = imgs;
        partial.coverImage = imgs[0] || listing.coverImage;
        flatAfter.images = imgs;
        break;
      }
      case "attributes":
        partial.attributes = val && typeof val === "object" ? val : {};
        flatAfter.attributes = partial.attributes;
        break;
      default:
        break;
    }
  }

  if (touchedAttrs) {
    partial.attributes = attrPatch;
    flatAfter.attributes = attrPatch;
  }

  if (!Object.keys(partial).length) throw new Error("Değişiklik yapılmadı");

  const changedKeys = [
    ...Object.keys(partial).filter((k) => k !== "attributes" && k !== "coverImage"),
    ...fields.filter((f) => isAttrField(f)),
    ...(partial.attributes && fields.includes("attributes") ? ["attributes"] : []),
  ];
  const changed = buildChangedFields(flatBefore, flatAfter, [...new Set(changedKeys)]);
  if (!Object.keys(changed).length) throw new Error("Değişiklik yapılmadı");

  const updated = await prisma.sellerAdminRequest.update({
    where: { id: req.id },
    data: {
      status: SellerAdminRequestStatus.PENDING_APPROVAL,
      editPayload: partial as Prisma.InputJsonValue,
      beforeSnapshot: before as Prisma.InputJsonValue,
      changedFields: changed as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId || listing.tenantId,
    actorId: input.sellerId,
    action: "listing.admin_edit_submit",
    entity: "SellerAdminRequest",
    entityId: req.id,
    meta: { listingId: listing.id, fields: Object.keys(changed) },
  });

  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      notifyUser(a.id, {
        title: "Düzenleme onayı bekliyor",
        body: `"${listing.title}" için satıcı izinli alanları güncelledi. Onayınız gerekiyor.`,
        eventKey: "admin_seller_edit_pending",
        link: "/admin/satici-talepleri",
      })
    )
  );

  return updated;
}

/** Admin: satıcı düzenlemesini onayla → ilana uygula, teklif verenleri bilgilendir */
export async function approveGrantedListingEdit(input: {
  requestId: string;
  adminId: string;
  tenantId?: string | null;
}) {
  const req = await prisma.sellerAdminRequest.findUnique({
    where: { id: input.requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== SellerAdminRequestStatus.PENDING_APPROVAL) {
    throw new Error("Onaylanacak düzenleme yok");
  }

  const payload = (req.editPayload || {}) as Record<string, unknown>;
  const changed = (req.changedFields || {}) as Record<string, { from: unknown; to: unknown }>;
  const reviseUntil = new Date(Date.now() + BIDDER_REVISE_HOURS * 60 * 60 * 1000);

  const data: Prisma.ListingUpdateInput = {
    lastChangeDiff: changed as Prisma.InputJsonValue,
    lastChangeAt: new Date(),
    lastChangeRequestId: req.id,
    bidderReviseUntil: reviseUntil,
  };
  if (payload.title != null) data.title = String(payload.title);
  if (payload.description != null) data.description = String(payload.description);
  if (payload.askPrice != null) data.askPrice = BigInt(Number(payload.askPrice));
  if (payload.city != null) data.city = String(payload.city);
  if (payload.district !== undefined) data.district = payload.district as string | null;
  if (payload.neighborhood !== undefined) data.neighborhood = payload.neighborhood as string | null;
  if (payload.dealType != null) data.dealType = payload.dealType as typeof req.listing.dealType;
  if (payload.coverImage !== undefined) data.coverImage = payload.coverImage as string | null;
  if (Array.isArray(payload.images)) data.images = payload.images as string[];
  if (payload.attributes !== undefined) {
    data.attributes = payload.attributes as Prisma.InputJsonValue;
  }

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: req.listingId }, data });
    await tx.sellerAdminRequest.update({
      where: { id: req.id },
      data: {
        status: SellerAdminRequestStatus.APPROVED,
        approvedAt: new Date(),
        resolvedAt: new Date(),
        resolvedById: input.adminId,
      },
    });
  });

  await writeAuditLog({
    tenantId: input.tenantId || req.listing.tenantId,
    actorId: input.adminId,
    action: "listing.admin_edit_approve",
    entity: "SellerAdminRequest",
    entityId: req.id,
    meta: { listingId: req.listingId, fields: Object.keys(changed) },
  });

  await notifyUser(req.sellerId, {
    title: "Düzenleme onaylandı",
    body: `"${req.listing.title}" için yaptığınız değişiklikler yayınlandı.`,
    eventKey: "seller_edit_approved",
    link: `/ilan/${req.listingId}`,
  });

  const changedLabels = Object.keys(changed).map(fieldLabel).join(", ");
  await notifyListingFavoriters(
    req.listingId,
    {
      title: "Favori ilanınız yeniden düzenlendi",
      body: `"${req.listing.title}" güncellendi${changedLabels ? ` (${changedLabels})` : ""}.`,
      eventKey: "favorite_listing_edited",
      link: `/ilan/${req.listingId}`,
    },
    { excludeUserIds: [req.sellerId] }
  );

  if (changed.askPrice) {
    const from = Number(changed.askPrice.from);
    const to = Number(changed.askPrice.to);
    if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
      const dropped = to < from;
      await notifyListingFavoriters(
        req.listingId,
        {
          title: dropped
            ? "Favori ilanınızın fiyatı düştü"
            : "Favori ilanınızın fiyatı yükseldi",
          body: `"${req.listing.title}" fiyatı ${formatTl(from)} → ${formatTl(to)}.`,
          eventKey: dropped ? "favorite_price_dropped" : "favorite_price_rose",
          link: `/ilan/${req.listingId}`,
        },
        { excludeUserIds: [req.sellerId] }
      );
    }
  }

  const bidders = await prisma.bid.findMany({
    where: { listingId: req.listingId, status: BidStatus.ACTIVE },
    select: { bidderId: true },
    distinct: ["bidderId"],
  });

  await Promise.all(
    bidders.map((b) =>
      notifyUser(b.bidderId, {
        title: "Teklif verdiğiniz ilanda değişiklik",
        body: `"${req.listing.title}" ilanında düzenleme yapıldı (${changedLabels}). Değişen bölümler kırmızı gösterilir. Teklifinizi güncelleyebilir veya silebilirsiniz; jetonunuz iade edilir.`,
        eventKey: "listing_changed_after_bid",
        link: `/ilan/${req.listingId}?revise=1`,
      })
    )
  );

  return req;
}

export async function rejectGrantedListingEdit(input: {
  requestId: string;
  adminId: string;
  reason: string;
  tenantId?: string | null;
}) {
  const req = await prisma.sellerAdminRequest.findUnique({
    where: { id: input.requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (
    req.status !== SellerAdminRequestStatus.PENDING_APPROVAL &&
    req.status !== SellerAdminRequestStatus.PENDING &&
    req.status !== SellerAdminRequestStatus.GRANTED
  ) {
    throw new Error("Talep reddedilemez");
  }
  const reason = String(input.reason || "").trim();
  if (!reason) throw new Error("Red sebebi gerekli");

  await prisma.sellerAdminRequest.update({
    where: { id: req.id },
    data: {
      status: SellerAdminRequestStatus.REJECTED,
      rejectionReason: reason,
      resolvedAt: new Date(),
      resolvedById: input.adminId,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId || req.listing.tenantId,
    actorId: input.adminId,
    action: "listing.admin_edit_reject",
    entity: "SellerAdminRequest",
    entityId: req.id,
    meta: { listingId: req.listingId, reason },
  });

  await notifyUser(req.sellerId, {
    title: "Düzenleme talebi reddedildi",
    body: `"${req.listing.title}" — ${reason}`,
    eventKey: "seller_edit_rejected",
    link: `/ilan/${req.listingId}`,
  });

  return req;
}

/** Eski "incelendi" — işlem yapmadan kapat */
export async function resolveSellerAdminRequest(
  requestId: string,
  adminId: string,
  tenantId?: string | null
) {
  const req = await prisma.sellerAdminRequest.findUnique({
    where: { id: requestId },
    include: { listing: true },
  });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== SellerAdminRequestStatus.PENDING) {
    throw new Error("Talep zaten sonuçlanmış");
  }

  await prisma.sellerAdminRequest.update({
    where: { id: req.id },
    data: {
      status: SellerAdminRequestStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedById: adminId,
    },
  });

  await writeAuditLog({
    tenantId: tenantId || req.listing.tenantId,
    actorId: adminId,
    action: "listing.admin_edit_help_resolve",
    entity: "SellerAdminRequest",
    entityId: req.id,
    meta: { listingId: req.listingId },
  });

  await notifyUser(req.sellerId, {
    title: "Talebiniz incelendi",
    body: `"${req.listing.title}" için yöneticiye ilettiğiniz mesaj kapatıldı.`,
    eventKey: "seller_admin_request_resolved",
    link: `/ilan/${req.listingId}`,
  });

  return req;
}

export async function getSellerEditGrant(requestId: string, sellerId: string) {
  const req = await prisma.sellerAdminRequest.findUnique({
    where: { id: requestId },
    include: {
      listing: {
        include: { category: true },
      },
    },
  });
  if (!req || req.sellerId !== sellerId) return null;
  return req;
}
