import { NextResponse } from "next/server";
import { ListingStatus, DealType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSetting } from "@/core/settings";
import { guardListingEids } from "@/core/guards/eidsGuard";
import { writeAuditLog } from "@/core/services/tenantService";
import { parseDealType } from "@/lib/dealType";
import { canSellerEditListing, isLiveListingStatus, listingHasBids } from "@/lib/listingStatus";
import { serializeListing } from "@/lib/format";
import { requestListingExtension } from "@/core/services/listingExtensionService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!listing) return NextResponse.json({ error: "Yok" }, { status: 404 });
  if (listing.sellerId !== session.id && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  return NextResponse.json({ listing: serializeListing(listing) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
  if (listing.sellerId !== session.id) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const body = await req.json();

  // Katalog offer mirror: ticari alanlar Listing PATCH ile değiştirilemez
  if (listing.sellerOfferId) {
    const blocked: string[] = [];
    if (body.askPrice != null) blocked.push("askPrice");
    if (body.title != null) blocked.push("title");
    if (body.coverImage != null) blocked.push("coverImage");
    if (body.images != null) blocked.push("images");
    if (body.attributes && typeof body.attributes === "object") {
      const managed = [
        "stockQty",
        "condition",
        "sellerSku",
        "brand",
        "model",
        "variantTitle",
        "catalogOffer",
        "priceInKurus",
        "outOfStock",
      ];
      for (const k of managed) {
        if (Object.prototype.hasOwnProperty.call(body.attributes, k)) blocked.push(`attributes.${k}`);
      }
    }
    if (blocked.length) {
      return NextResponse.json(
        {
          error: "Katalog teklifine bağlı ilanda bu alanlar değiştirilemez",
          code: "CATALOG_MANAGED_FIELD",
          fields: blocked,
        },
        { status: 403 }
      );
    }
  }

  if (body.action === "unpublish") {
    if (!isLiveListingStatus(listing.status)) {
      return NextResponse.json({ error: "İlan zaten yayında değil" }, { status: 400 });
    }
    if (listing.status === ListingStatus.APPROVED) {
      return NextResponse.json(
        { error: "Sonuçlanan ilan bu yolla kaldırılamaz" },
        { status: 400 }
      );
    }
    const updated = await prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.ARCHIVED,
        endsAt: listing.endsAt && listing.endsAt > new Date() ? new Date() : listing.endsAt,
      },
    });
    const { markBidsListingGone } = await import(
      "@/core/services/sellerAdminRequestService"
    );
    await markBidsListingGone(id, listing.title);
    await writeAuditLog({
      tenantId: listing.tenantId,
      actorId: session.id,
      action: "listing.unpublish",
      entity: "Listing",
      entityId: listing.id,
      meta: { title: listing.title },
    });
    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  }

  if (body.action === "request-admin-edit-help") {
    try {
      const { submitSellerAdminEditHelp } = await import(
        "@/core/services/sellerAdminRequestService"
      );
      const req = await submitSellerAdminEditHelp({
        listingId: id,
        sellerId: session.id,
        message: String(body.message || ""),
        tenantId: listing.tenantId,
      });
      return NextResponse.json({
        ok: true,
        requestId: req.id,
        message: "Mesajınız yöneticiye iletildi.",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Talep gönderilemedi" },
        { status: 400 }
      );
    }
  }

  if (body.action === "request-extension") {
    try {
      const req = await requestListingExtension({
        listingId: id,
        sellerId: session.id,
        days: Number(body.days),
        tenantId: listing.tenantId,
      });
      return NextResponse.json({
        ok: true,
        requestId: req.id,
        days: req.days,
        message: "Ek süre talebiniz yönetici onayına gönderildi.",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Talep gönderilemedi" },
        { status: 400 }
      );
    }
  }

  const allowLiveEdit = await getSetting<boolean>("listing_edit_while_live", true);
  if (!canSellerEditListing(listing.status, { allowLiveEdit })) {
    return NextResponse.json(
      { error: "Yayındaki ilan bu ekrandan düzenlenemez. Önce ilandan kaldırın." },
      { status: 400 }
    );
  }

  if (listingHasBids(listing)) {
    return NextResponse.json(
      {
        error:
          "İlanınıza teklif geldiği için düzenleme yapılamaz. Değişiklik için yönetici ile iletişime geçin.",
        code: "EDIT_BLOCKED_HAS_BIDS",
      },
      { status: 403 }
    );
  }

  const keepLive = isLiveListingStatus(listing.status) && allowLiveEdit;

  const minDays = await getSetting<number>("listing_min_days", 3);
  const maxDays = await getSetting<number>("listing_max_days", 30);
  const daysRaw = Number(body.days);
  if (!Number.isFinite(daysRaw) || daysRaw <= 0) {
    return NextResponse.json(
      { error: "İlan süresi seçmelisiniz. Tüm ilanlarda süre zorunludur." },
      { status: 400 }
    );
  }
  if (daysRaw < minDays || daysRaw > maxDays) {
    return NextResponse.json(
      { error: `İlan süresi ${minDays}–${maxDays} gün arasında olmalıdır` },
      { status: 400 }
    );
  }
  const days = daysRaw;

  if (!body.categorySlug && !body.categoryId && !listing.categoryId) {
    return NextResponse.json(
      { error: "İlan kategorisi seçmelisiniz. Kategori seçilmeden ilan yayınlanamaz." },
      { status: 400 }
    );
  }

  const category = await prisma.category.findFirst({
    where: { OR: [{ id: body.categoryId }, { slug: body.categorySlug }, { id: listing.categoryId }] },
    include: { _count: { select: { children: true } } },
  });
  if (!category) {
    return NextResponse.json(
      { error: "İlan kategorisi seçmelisiniz. Kategori seçilmeden ilan yayınlanamaz." },
      { status: 400 }
    );
  }
  if (category._count.children > 0) {
    return NextResponse.json(
      { error: "Lütfen alt kategori seçin (ör. Cep Telefonu, Bilgisayar)." },
      { status: 400 }
    );
  }

  const mergedAttributes = (body.attributes ?? listing.attributes ?? {}) as Record<string, unknown>;
  const { validateListingCategorySelection } = await import("@/data/categoryBrowseTree");
  const catErr = validateListingCategorySelection({
    categorySlug: category.slug,
    dealType: String(body.dealType || listing.dealType || ""),
    attributes: mergedAttributes,
  });
  if (catErr) return NextResponse.json({ error: catErr }, { status: 400 });

  // Dikey ACL — kategori değişimi / taslak yeniden gönderim
  try {
    const { enforceListingVerticalAccess } = await import("@/core/guards/enforceVerticalAccess");
    const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
    const categoryChanged = category.id !== listing.categoryId;
    const isDraftPublish = listing.status === "DRAFT";
    await enforceListingVerticalAccess({
      session,
      categoryId: category.id,
      categorySlug: category.slug,
      attributes: mergedAttributes,
      listingKind: body.listingKind ? String(body.listingKind) : null,
      action: isDraftPublish
        ? "PUBLISH_DRAFT"
        : categoryChanged
          ? "UPDATE_LISTING_CATEGORY"
          : "UPDATE_LISTING_CATEGORY",
    });
  } catch (e) {
    const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
    if (e instanceof VerticalAccessError) {
      return NextResponse.json(e.toJSON(), { status: e.status });
    }
    throw e;
  }

  const dealType = parseDealType(String(body.dealType || listing.dealType), category.slug) as DealType;

  const eidsCheck = await guardListingEids({
    userId: session.id,
    categorySlug: category.slug,
    propertyId: body.eidsPropertyId || body.propertyId || null,
    vehiclePlate: body.eidsVehiclePlate || body.vehiclePlate || null,
  });
  if (!eidsCheck.allowed) {
    return NextResponse.json({ error: eidsCheck.error, code: eidsCheck.code }, { status: 403 });
  }

  const nextDescription = String(body.description ?? listing.description);
  const { validateListingDescription } = await import("@/lib/listingDescription");
  const descCheck = validateListingDescription(nextDescription);
  if (!descCheck.ok) {
    return NextResponse.json({ error: descCheck.error || "Açıklama geçersiz" }, { status: 400 });
  }

  const payloadFields = {
    categoryId: category.id,
    title: String(body.title || listing.title),
    description: nextDescription,
    city: String(body.city || listing.city),
    district: body.district !== undefined ? body.district || null : listing.district,
    neighborhood:
      body.neighborhood !== undefined ? body.neighborhood || null : listing.neighborhood,
    dealType,
    askPrice: body.askPrice != null ? Number(body.askPrice) : Number(listing.askPrice),
    durationDays: days,
    coverImage: body.coverImage || listing.coverImage,
    images: Array.isArray(body.images) ? body.images : listing.images,
    attributes: mergedAttributes,
    latitude:
      body.latitude != null && body.latitude !== ""
        ? Number(body.latitude)
        : listing.latitude,
    longitude:
      body.longitude != null && body.longitude !== ""
        ? Number(body.longitude)
        : listing.longitude,
    eidsVerified: eidsCheck.eidsVerified,
    eidsVerifiedAt: eidsCheck.eidsVerified ? new Date().toISOString() : null,
    eidsPropertyId: eidsCheck.eidsPropertyId,
    eidsVehiclePlate: eidsCheck.eidsVehiclePlate,
  };

  // Yayındaki ilan: canlı içerik değişmez; düzenleme talebi yönetici onayına düşer
  if (keepLive) {
    try {
      const { submitListingEditRequest } = await import(
        "@/core/services/listingEditRequestService"
      );
      const editReq = await submitListingEditRequest({
        listingId: id,
        sellerId: session.id,
        tenantId: listing.tenantId,
        payload: payloadFields,
      });
      return NextResponse.json({
        ok: true,
        id: listing.id,
        status: listing.status,
        editRequestId: editReq.id,
        pendingEdit: true,
        message:
          "Düzenleme talebiniz yönetici onayına gönderildi. Onaylanana kadar ilan eski haliyle yayında kalır.",
      });
    } catch (e) {
      const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
      if (e instanceof VerticalAccessError) {
        return NextResponse.json(e.toJSON(), { status: e.status });
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Düzenleme talebi gönderilemedi" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      categoryId: payloadFields.categoryId,
      title: payloadFields.title,
      description: payloadFields.description,
      city: payloadFields.city,
      district: payloadFields.district,
      neighborhood: payloadFields.neighborhood,
      dealType,
      askPrice: BigInt(Math.round(Number(payloadFields.askPrice) || 0)),
      durationDays: days,
      coverImage: payloadFields.coverImage,
      images: payloadFields.images,
      attributes: payloadFields.attributes,
      latitude: payloadFields.latitude,
      longitude: payloadFields.longitude,
      status: ListingStatus.PENDING_REVIEW,
      rejectionReason: null,
      reviewedAt: null,
      reviewedById: null,
      startsAt: null,
      endsAt: null,
      eidsVerified: eidsCheck.eidsVerified,
      eidsVerifiedAt: eidsCheck.eidsVerified ? new Date() : null,
      eidsPropertyId: eidsCheck.eidsPropertyId,
      eidsVehiclePlate: eidsCheck.eidsVehiclePlate,
    },
  });

  await writeAuditLog({
    tenantId: listing.tenantId,
    actorId: session.id,
    action: "listing.resubmit_review",
    entity: "Listing",
    entityId: listing.id,
    meta: { title: updated.title },
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    status: updated.status,
    message: "İlanınız tekrar yönetici onayına gönderildi. Onaylandıktan sonra yayınlanacaktır.",
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
  if (listing.sellerId !== session.id && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  if (listing.status === ListingStatus.APPROVED) {
    return NextResponse.json(
      { error: "Sonuçlanan ilanlar silinemez" },
      { status: 403 }
    );
  }

  const bidCount = await prisma.bid.count({ where: { listingId: id } });
  const { markBidsListingGone } = await import(
    "@/core/services/sellerAdminRequestService"
  );

  // Teklif varsa kalıcı silme yerine arşivle — teklif geçmişi "İlan kaldırıldı" olarak kalsın
  if (bidCount > 0 && session.role !== "ADMIN") {
    await prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.ARCHIVED,
        approvedBidId: null,
        endsAt: listing.endsAt && listing.endsAt > new Date() ? new Date() : listing.endsAt,
      },
    });
    await markBidsListingGone(id, listing.title);
    await writeAuditLog({
      tenantId: listing.tenantId,
      actorId: session.id,
      action: "listing.soft_delete",
      entity: "Listing",
      entityId: listing.id,
      meta: { title: listing.title, status: listing.status, bidCount },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  }

  await markBidsListingGone(id, listing.title);
  await prisma.listing.update({
    where: { id },
    data: { approvedBidId: null },
  });
  await prisma.listing.delete({ where: { id } });
  await writeAuditLog({
    tenantId: listing.tenantId,
    actorId: session.id,
    action: "listing.delete",
    entity: "Listing",
    entityId: listing.id,
    meta: { title: listing.title, status: listing.status },
  });

  return NextResponse.json({ ok: true });
}
