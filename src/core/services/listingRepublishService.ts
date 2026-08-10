import { ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting, getSettingsMap } from "@/core/settings";
import { writeAuditLog } from "@/core/services/tenantService";
import { notifyUser } from "@/core/notify";

export type RepublishReasonOption = {
  id: string;
  label: string;
  requiresNote?: boolean;
};

export const DEFAULT_REPUBLISH_REASONS: RepublishReasonOption[] = [
  { id: "no_deal", label: "Alıcı ile anlaşılamadı" },
  { id: "buyer_backed_out", label: "Alıcı caydı" },
  { id: "seller_cancelled", label: "Vazgeçtim" },
  { id: "other", label: "Diğer", requiresNote: true },
];

export const REPUBLISH_WINNER_RESPONSE = {
  CONFIRMED: "CONFIRMED",
  DISPUTED: "DISPUTED",
} as const;

export type RepublishWinnerResponse =
  (typeof REPUBLISH_WINNER_RESPONSE)[keyof typeof REPUBLISH_WINNER_RESPONSE];

export function normalizeRepublishReasons(raw: unknown): RepublishReasonOption[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_REPUBLISH_REASONS.map((r) => ({ ...r }));
  const out: RepublishReasonOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id || "").trim();
    const label = String(o.label || "").trim();
    if (!id || !label) continue;
    out.push({
      id,
      label,
      requiresNote: Boolean(o.requiresNote) || id === "other",
    });
  }
  return out.length ? out : DEFAULT_REPUBLISH_REASONS.map((r) => ({ ...r }));
}

export async function getRepublishReasonOptions(): Promise<RepublishReasonOption[]> {
  const raw = await getSetting<unknown>("listing_republish_reasons", DEFAULT_REPUBLISH_REASONS);
  return normalizeRepublishReasons(raw);
}

function fillRepublishNotifyTemplate(
  template: string,
  vars: { reason: string; listingTitle: string; listingNo: string }
) {
  return template
    .replaceAll("{{reason}}", vars.reason)
    .replaceAll("{{sebep}}", vars.reason)
    .replaceAll("{{listingTitle}}", vars.listingTitle)
    .replaceAll("{{ilanBaslik}}", vars.listingTitle)
    .replaceAll("{{listingNo}}", vars.listingNo);
}

/**
 * Sonuçlanan (APPROVED) ilanı satıcı yeniden yayınlamak ister:
 * sebep kaydedilir, kazanan alıcıya doğrulama bildirimi gider,
 * satış/teklif sıfırlanır, DRAFT’a alınır → ilan-ver düzenleme.
 * Yayınlayınca PENDING_REVIEW (yönetici onayı).
 */
export async function startApprovedListingRepublish(input: {
  listingId: string;
  sellerId: string;
  reasonCode: string;
  reasonNote?: string;
}) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: {
      approvedBid: { select: { id: true, bidderId: true, amount: true } },
    },
  });
  if (!listing || listing.sellerId !== input.sellerId) {
    return { ok: false as const, error: "Yetkisiz" };
  }
  if (listing.status !== ListingStatus.APPROVED) {
    return { ok: false as const, error: "Yalnızca sonuçlanan ilanlar yeniden yayınlanabilir" };
  }

  const reasons = await getRepublishReasonOptions();
  const reason = reasons.find((r) => r.id === input.reasonCode);
  if (!reason) {
    return { ok: false as const, error: "Geçersiz sebep seçimi" };
  }
  const note = String(input.reasonNote || "").trim();
  if (reason.requiresNote && note.length < 5) {
    return { ok: false as const, error: "«Diğer» için en az 5 karakter açıklama yazın" };
  }

  try {
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
      categoryId: listing.categoryId,
      attributes: (listing.attributes || {}) as Record<string, unknown>,
    });
    await assertUserMayPostVertical({
      user: seller || { id: input.sellerId },
      shop,
      vertical,
      action: "REPUBLISH",
      categoryId: listing.categoryId,
    });
  } catch (e) {
    const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
    if (e instanceof VerticalAccessError) {
      return {
        ok: false as const,
        error: e.message,
        code: e.code,
      };
    }
    throw e;
  }

  const settings = await getSettingsMap();
  const minDays = Math.max(1, Number(settings.listing_min_days ?? 3) || 3);
  const winnerUserId = listing.approvedBid?.bidderId || null;
  const winnerBidAmount = listing.approvedBid?.amount ?? null;
  const reasonLabel =
    reason.label + (note ? ` — ${note}` : "");

  await prisma.$transaction(async (tx) => {
    // FK: önce onaylı teklif bağını kopar
    await tx.listing.update({
      where: { id: listing.id },
      data: { approvedBidId: null },
    });
    await tx.bid.deleteMany({ where: { listingId: listing.id } });
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        status: ListingStatus.DRAFT,
        highestBid: BigInt(0),
        bidCount: 0,
        startsAt: null,
        endsAt: null,
        selectionEndsAt: null,
        durationDays: minDays,
        republishAvailableAt: null,
        republishReasonCode: reason.id,
        republishReasonNote: note || null,
        republishRequestedAt: new Date(),
        republishWinnerUserId: winnerUserId,
        republishWinnerBidAmount: winnerBidAmount,
        republishWinnerResponse: null,
        republishWinnerNote: null,
        republishWinnerRespondedAt: null,
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
        lastChangeDiff: Prisma.DbNull,
        lastChangeAt: null,
        lastChangeRequestId: null,
        bidderReviseUntil: null,
      },
    });
  });

  await writeAuditLog({
    actorUserId: input.sellerId,
    action: "listing.republish.start",
    entity: "Listing",
    entityId: listing.id,
    meta: {
      reasonCode: reason.id,
      reasonLabel: reason.label,
      reasonNote: note || null,
      winnerUserId,
    },
  });

  if (winnerUserId) {
    const title = String(
      settings.listing_republish_winner_notify_title || "Yeniden yayın gerekçesini doğrulayın"
    );
    const bodyTpl = String(
      settings.listing_republish_winner_notify_body ||
        "Satıcı «{{reason}}» gerekçesiyle ilanı yeniden yayınlamak istiyor. Bu gerekçeyi doğruluyor musunuz? Doğrulamazsanız satıcının puanı düşürülebilir ve yeniden yayınlama süresi uzatılabilir."
    );
    const body = fillRepublishNotifyTemplate(bodyTpl, {
      reason: reasonLabel,
      listingTitle: listing.title,
      listingNo: listing.listingNo,
    });
    await notifyUser(winnerUserId, {
      title,
      body,
      eventKey: "listing_republish_winner_verify",
      link: `/hesabim?s=bildirimler&republishVerify=${listing.id}`,
    });
  }

  return { ok: true as const, listingId: listing.id, editUrl: `/ilan-ver?edit=${listing.id}&republish=1` };
}

export async function getRepublishWinnerVerification(input: {
  listingId: string;
  userId: string;
}) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: {
      id: true,
      title: true,
      listingNo: true,
      coverImage: true,
      sellerId: true,
      republishReasonCode: true,
      republishReasonNote: true,
      republishRequestedAt: true,
      republishWinnerUserId: true,
      republishWinnerResponse: true,
      republishWinnerNote: true,
      republishWinnerRespondedAt: true,
      republishWinnerBidAmount: true,
    },
  });
  if (!listing || listing.republishWinnerUserId !== input.userId) {
    return { ok: false as const, error: "Kayıt bulunamadı veya yetkisiz" };
  }
  const reasons = await getRepublishReasonOptions();
  const reasonLabel =
    reasons.find((r) => r.id === listing.republishReasonCode)?.label ||
    listing.republishReasonCode ||
    null;
  return {
    ok: true as const,
    listing: {
      id: listing.id,
      title: listing.title,
      listingNo: listing.listingNo,
      coverImage: listing.coverImage,
      reasonCode: listing.republishReasonCode,
      reasonLabel,
      reasonNote: listing.republishReasonNote,
      requestedAt: listing.republishRequestedAt,
      response: listing.republishWinnerResponse,
      responseNote: listing.republishWinnerNote,
      respondedAt: listing.republishWinnerRespondedAt,
      bidAmount: listing.republishWinnerBidAmount != null ? Number(listing.republishWinnerBidAmount) : null,
      canRespond: !listing.republishWinnerResponse,
    },
  };
}

/**
 * Kazanan teklif sahibi: satıcının yeniden yayın sebebini onaylar veya itiraz eder.
 */
export async function respondRepublishWinnerVerification(input: {
  listingId: string;
  userId: string;
  confirmed: boolean;
  note?: string;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing || listing.republishWinnerUserId !== input.userId) {
    return { ok: false as const, error: "Yetkisiz veya kayıt yok" };
  }
  if (!listing.republishRequestedAt) {
    return { ok: false as const, error: "Yeniden yayın talebi yok" };
  }
  if (listing.republishWinnerResponse) {
    return { ok: false as const, error: "Bu talebe zaten yanıt verdiniz" };
  }

  const note = String(input.note || "").trim();
  if (!input.confirmed && note.length < 5) {
    return { ok: false as const, error: "Onaylamıyorsanız en az 5 karakter sebep yazın" };
  }

  const response = input.confirmed
    ? REPUBLISH_WINNER_RESPONSE.CONFIRMED
    : REPUBLISH_WINNER_RESPONSE.DISPUTED;

  await prisma.listing.update({
    where: { id: listing.id },
    data: {
      republishWinnerResponse: response,
      republishWinnerNote: input.confirmed ? null : note,
      republishWinnerRespondedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorUserId: input.userId,
    action: "listing.republish.winner_verify",
    entity: "Listing",
    entityId: listing.id,
    meta: { response, note: input.confirmed ? null : note },
  });

  try {
    const {
      applyTrustScoreEvent,
      applyListingCooldown,
      getTrustScoreEngineConfig,
    } = await import("@/core/services/trustScoreService");
    if (input.confirmed) {
      await applyTrustScoreEvent({
        userId: listing.sellerId,
        eventKey: "republish_winner_confirmed",
        listingId: listing.id,
        actorUserId: input.userId,
        note: "Alıcı yeniden yayın gerekçesini onayladı",
      });
      if (listing.republishReasonCode === "buyer_backed_out") {
        await applyTrustScoreEvent({
          userId: input.userId,
          eventKey: "buyer_backed_out_confirmed",
          listingId: listing.id,
          actorUserId: input.userId,
          note: "Alıcı cayma gerekçesini doğruladı",
        });
      }
    } else {
      await applyTrustScoreEvent({
        userId: listing.sellerId,
        eventKey: "republish_winner_disputed",
        listingId: listing.id,
        actorUserId: input.userId,
        note: note || "Alıcı yeniden yayın gerekçesini onaylamadı",
        meta: { winnerNote: note },
      });
      const cfg = await getTrustScoreEngineConfig();
      await applyListingCooldown(listing.sellerId, cfg.republishDelayHoursOnDispute);
    }
  } catch {
    // Puanlama hatası doğrulama cevabını bozmasın
  }

  return { ok: true as const, response };
}
