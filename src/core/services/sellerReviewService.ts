import { EditRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";
import { isCorporateAccount } from "@/lib/accountTypes";
import { SELLER_REVIEW_RULES_TEXT } from "@/lib/sellerBadges";

export { SELLER_REVIEW_RULES_TEXT, memberYearsLabel, isPremiumSellerActive } from "@/lib/sellerBadges";

export async function getSellerReviewSettings() {
  const [enabled, autoApprove, minLength] = await Promise.all([
    getSetting<boolean>("seller_reviews_enabled", false),
    getSetting<boolean>("seller_reviews_auto_approve", false),
    getSetting<number>("seller_reviews_min_length", 20),
  ]);
  return {
    enabled: Boolean(enabled),
    autoApprove: Boolean(autoApprove),
    minLength: Math.max(10, Math.min(500, Number(minLength) || 20)),
  };
}

export async function listApprovedSellerReviews(sellerId: string, take = 40) {
  const rows = await prisma.sellerReview.findMany({
    where: { sellerId, status: EditRequestStatus.APPROVED },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      author: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    rating: r.rating,
    createdAt: r.createdAt,
    authorName: r.author.name || "Üye",
  }));
}

export async function submitSellerReview(input: {
  authorId: string;
  sellerId: string;
  listingId?: string | null;
  body: string;
  rating?: number | null;
  rulesAccepted: boolean;
}) {
  const settings = await getSellerReviewSettings();
  if (!settings.enabled) {
    return { ok: false as const, status: 403, error: "Yorumlar henüz açık değil." };
  }
  if (!input.rulesAccepted) {
    return { ok: false as const, status: 400, error: "Yorum yazmadan önce kuralları kabul etmelisiniz." };
  }

  const body = String(input.body || "").trim();
  if (body.length < settings.minLength) {
    return {
      ok: false as const,
      status: 400,
      error: `Yorum en az ${settings.minLength} karakter olmalı.`,
    };
  }
  if (body.length > 2000) {
    return { ok: false as const, status: 400, error: "Yorum en fazla 2000 karakter olabilir." };
  }
  if (input.authorId === input.sellerId) {
    return { ok: false as const, status: 400, error: "Kendi hesabınıza yorum yazamazsınız." };
  }

  const seller = await prisma.user.findUnique({
    where: { id: input.sellerId },
    select: { id: true, accountType: true, isActive: true },
  });
  if (!seller || !seller.isActive) {
    return { ok: false as const, status: 404, error: "Satıcı bulunamadı." };
  }
  if (!isCorporateAccount(seller.accountType)) {
    return { ok: false as const, status: 400, error: "Yorumlar yalnızca ticari satıcılar içindir." };
  }

  let listingId: string | null = input.listingId ? String(input.listingId) : null;
  if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true },
    });
    if (!listing || listing.sellerId !== input.sellerId) {
      listingId = null;
    }
  }

  const ratingRaw = input.rating == null ? null : Number(input.rating);
  const rating =
    ratingRaw != null && Number.isFinite(ratingRaw)
      ? Math.max(1, Math.min(5, Math.round(ratingRaw)))
      : null;

  const status = settings.autoApprove ? EditRequestStatus.APPROVED : EditRequestStatus.PENDING;

  const review = await prisma.sellerReview.create({
    data: {
      sellerId: input.sellerId,
      authorId: input.authorId,
      listingId,
      body,
      rating,
      status,
      reviewedAt: settings.autoApprove ? new Date() : null,
      reviewedById: settings.autoApprove ? input.authorId : null,
    },
  });

  if (!settings.autoApprove) {
    await notifyUser(input.authorId, {
      title: "Yorumunuz incelemeye alındı",
      body: "Yorumunuz yönetici onayından sonra yayınlanacak.",
      eventKey: "message_received",
      link: listingId ? `/ilan/${listingId}?tab=yorumlar` : "/hesabim",
    });
  } else {
    await notifyUser(input.sellerId, {
      title: "Yeni yorum",
      body: "Hesabınıza yeni bir kullanıcı yorumu geldi.",
      eventKey: "message_received",
      link: listingId ? `/ilan/${listingId}?tab=yorumlar` : "/hesabim",
    });
  }

  return {
    ok: true as const,
    review: { id: review.id, status: review.status },
    message: settings.autoApprove
      ? "Yorumunuz yayınlandı."
      : "Yorumunuz yönetici onayına gönderildi.",
  };
}

export async function listPendingSellerReviews(take = 80) {
  return prisma.sellerReview.findMany({
    where: { status: EditRequestStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take,
    include: {
      author: { select: { id: true, name: true, phone: true } },
      seller: { select: { id: true, name: true, phone: true, accountType: true } },
      listing: { select: { id: true, title: true, listingNo: true } },
    },
  });
}

export async function moderateSellerReview(input: {
  reviewId: string;
  adminId: string;
  approve: boolean;
  reason?: string | null;
  tenantId?: string | null;
}) {
  const review = await prisma.sellerReview.findUnique({ where: { id: input.reviewId } });
  if (!review) throw new Error("Yorum bulunamadı");
  if (review.status !== EditRequestStatus.PENDING) throw new Error("Yorum zaten işlenmiş");

  const updated = await prisma.sellerReview.update({
    where: { id: input.reviewId },
    data: {
      status: input.approve ? EditRequestStatus.APPROVED : EditRequestStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: input.adminId,
      rejectReason: input.approve ? null : String(input.reason || "").trim() || "Kurallara aykırı",
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorId: input.adminId,
    action: input.approve ? "sellerReview.approve" : "sellerReview.reject",
    entity: "SellerReview",
    entityId: review.id,
    meta: { sellerId: review.sellerId, authorId: review.authorId },
  });

  await notifyUser(review.authorId, {
    title: input.approve ? "Yorumunuz onaylandı" : "Yorumunuz reddedildi",
    body: input.approve
      ? "Yorumunuz yayınlandı."
      : `Yorumunuz yayınlanmadı. ${updated.rejectReason || ""}`.trim(),
    eventKey: "message_received",
    link: review.listingId ? `/ilan/${review.listingId}?tab=yorumlar` : "/hesabim",
  });

  if (input.approve) {
    await notifyUser(review.sellerId, {
      title: "Yeni onaylı yorum",
      body: "Hesabınıza yeni bir kullanıcı yorumu eklendi.",
      eventKey: "message_received",
      link: review.listingId ? `/ilan/${review.listingId}?tab=yorumlar` : "/hesabim",
    });
  }

  return updated;
}

export async function setCommercialLogo(input: {
  userId: string;
  logoUrl: string | null;
}) {
  const [logoEnabled, logoPaid, fee] = await Promise.all([
    getSetting<boolean>("commercial_logo_enabled", true),
    getSetting<boolean>("commercial_logo_paid", false),
    getSetting<number>("commercial_logo_fee_tokens", 10),
  ]);
  if (!logoEnabled) {
    return { ok: false as const, error: "Logo yükleme kapalı." };
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false as const, error: "Kullanıcı yok" };
  if (!isCorporateAccount(user.accountType)) {
    return { ok: false as const, error: "Yalnızca ticari üyeler logo yükleyebilir." };
  }

  const nextUrl = input.logoUrl ? String(input.logoUrl).trim() : null;
  const changing = (user.logoUrl || null) !== nextUrl;
  const isNewLogo = Boolean(nextUrl) && changing;

  if (isNewLogo && logoPaid) {
    const amount = Math.max(0, Number(fee) || 0);
    if (amount > 0) {
      const { spendTokens } = await import("@/core/services/tokenSpendService");
      const spent = await spendTokens({
        userId: input.userId,
        amount,
        reason: "commercial_logo",
        meta: { logoUrl: nextUrl },
      });
      if (!spent.ok) {
        return {
          ok: false as const,
          error: `Yetersiz jeton (gerekli: ${amount}, bakiyeniz: ${spent.balance ?? 0})`,
          code: "INSUFFICIENT_TOKENS" as const,
          requiredTokens: amount,
          balance: spent.balance ?? 0,
        };
      }
    }
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { logoUrl: nextUrl },
  });

  return { ok: true as const, logoUrl: nextUrl };
}

export async function setCommercialStoreCover(input: {
  userId: string;
  storeCoverUrl: string | null;
}) {
  const logoEnabled = await getSetting<boolean>("commercial_logo_enabled", true);
  if (!logoEnabled) {
    return { ok: false as const, error: "Mağaza görselleri kapalı." };
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false as const, error: "Kullanıcı yok" };
  if (!isCorporateAccount(user.accountType)) {
    return { ok: false as const, error: "Yalnızca ticari üyeler mağaza kapağı yükleyebilir." };
  }

  const nextUrl = input.storeCoverUrl ? String(input.storeCoverUrl).trim() : null;

  await prisma.user.update({
    where: { id: input.userId },
    data: { storeCoverUrl: nextUrl },
  });

  return { ok: true as const, storeCoverUrl: nextUrl };
}
