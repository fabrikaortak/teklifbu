import { DealType, ListingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { guardListingCreate } from "@/core/guards/listingGuard";
import { guardListingEids } from "@/core/guards/eidsGuard";
import { writeAuditLog } from "@/core/services/tenantService";
import { parseDealType } from "@/lib/dealType";
import { generateListingNo } from "@/lib/listingNo";
import { resolveListingTotalFee } from "@/core/services/listingPremiumService";
import {
  normalizePremium,
  quoteListingFeeTokensForUser,
  quotePremiumTokensForUser,
  resolveListingBaseFeeOnly,
} from "@/core/services/listingPremiumService";
import { isDemoPosEnabled, isPaymentTokensOnly } from "@/core/services/paymentModeService";
import { spendTokens } from "@/core/services/tokenSpendService";
import type { SessionUser } from "@/lib/auth";
import { validateListingDescription } from "@/lib/listingDescription";
import { deleteLocalUploadUrls } from "@/lib/uploadFiles";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";

function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function paymentCoversFee(paidTl: number, dueTl: number) {
  // Kuruş bazında karşılaştır (205 vs 205.20 gibi Int kesmesini de tolere eder)
  return Math.round(Number(paidTl) * 100) + 1 >= Math.round(Number(dueTl) * 100);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type ListingCreateBody = Record<string, unknown>;

export type ListingCreateFail = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

export type ListingCreateOk = {
  ok: true;
  listingId: string;
  status: ListingStatus;
  message: string;
};

export type ListingCreateResult = ListingCreateFail | ListingCreateOk;

/** İlan gövdesini doğrula ve oluştur. Ücret gerekiyorsa paidIntentId veya (demo kapalıyken) confirm gerekir. */
export async function createListingForSeller(
  session: SessionUser,
  body: ListingCreateBody
): Promise<ListingCreateResult> {
  const minDays = await getSetting<number>("listing_min_days", 3);
  const maxDays = await getSetting<number>("listing_max_days", 30);
  const daysRaw = Number(body.days);
  if (!Number.isFinite(daysRaw) || daysRaw <= 0) {
    return {
      ok: false,
      status: 400,
      body: { error: "İlan süresi seçmelisiniz. Tüm ilanlarda süre zorunludur." },
    };
  }
  if (daysRaw < minDays || daysRaw > maxDays) {
    return {
      ok: false,
      status: 400,
      body: { error: `İlan süresi ${minDays}–${maxDays} gün arasında olmalıdır` },
    };
  }
  const days = daysRaw;

  const descCheck = validateListingDescription(String(body.description || ""));
  if (!descCheck.ok) {
    return {
      ok: false,
      status: 400,
      body: { error: descCheck.error || "Açıklama geçersiz" },
    };
  }

  if (!body.categorySlug && !body.categoryId) {
    return {
      ok: false,
      status: 400,
      body: { error: "İlan kategorisi seçmelisiniz. Kategori seçilmeden ilan yayınlanamaz." },
    };
  }

  const category = await prisma.category.findFirst({
    where: { OR: [{ id: String(body.categoryId || "") }, { slug: String(body.categorySlug || "") }] },
    include: { _count: { select: { children: true } } },
  });
  if (!category) {
    return {
      ok: false,
      status: 400,
      body: { error: "İlan kategorisi seçmelisiniz. Kategori seçilmeden ilan yayınlanamaz." },
    };
  }
  // Vasıta: Stage1 browse taxonomy children live under `arac`, but listings remain on
  // root categorySlug=arac + attributes.subtype (not a leaf Category row).
  const isVasitaListingRoot =
    category.slug === "arac" || category.path === "arac";
  if (category._count.children > 0 && !isVasitaListingRoot) {
    return {
      ok: false,
      status: 400,
      body: { error: "Lütfen alt kategori seçin (ör. Cep Telefonu, Bilgisayar)." },
    };
  }

  const { validateListingCategorySelection } = await import("@/data/categoryBrowseTree");
  const catErr = validateListingCategorySelection({
    categorySlug: category.slug,
    dealType: String(body.dealType || ""),
    attributes: (body.attributes || {}) as Record<string, unknown>,
  });
  if (catErr) return { ok: false, status: 400, body: { error: catErr } };

  const dealType = parseDealType(String(body.dealType || ""), category.slug) as DealType;
  if (!body.city) return { ok: false, status: 400, body: { error: "İl gerekli" } };

  const limitCheck = await guardListingCreate(session.id);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      status: 403,
      body: {
        error: limitCheck.error,
        code: limitCheck.code || "LISTING_BLOCKED",
        buyPopupEnabled: Boolean(limitCheck.buyPopupEnabled),
        limit: limitCheck.limit,
        used: limitCheck.used,
      },
    };
  }

  // Dikey ACL
  try {
    const { resolveListingVerticalFromDb } = await import("@/lib/listingVertical");
    const { assertUserMayPostVertical, VerticalAccessError } = await import(
      "@/core/guards/verticalAccessGuard"
    );
    const vertical = await resolveListingVerticalFromDb({
      categoryId: category.id,
      categorySlug: category.slug,
      attributes: (body.attributes || {}) as Record<string, unknown>,
      listingKind: body.listingKind ? String(body.listingKind) : null,
    });
    const fullUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        accountType: true,
        commercialSubtypes: true,
        commercialStatus: true,
        profile: true,
        role: true,
      },
    });
    const shopRow = limitCheck.shopId
      ? await prisma.shop.findUnique({
          where: { id: limitCheck.shopId },
          select: { id: true, ownerId: true, isActive: true },
        })
      : null;
    await assertUserMayPostVertical({
      user: fullUser || { id: session.id, accountType: session.accountType },
      shop: shopRow,
      vertical,
      action: "CREATE_LISTING",
      categoryId: category.id,
      adminBypass: Boolean(body.adminBypass) && session.role === "ADMIN",
      adminId: session.role === "ADMIN" ? session.id : null,
    });
  } catch (e) {
    const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
    if (e instanceof VerticalAccessError) {
      return { ok: false, status: e.status, body: e.toJSON() };
    }
    throw e;
  }

  const eidsCheck = await guardListingEids({
    userId: session.id,
    categorySlug: category.slug,
    propertyId: (body.eidsPropertyId || body.propertyId || null) as string | null,
    vehiclePlate: (body.eidsVehiclePlate || body.vehiclePlate || null) as string | null,
  });
  if (!eidsCheck.allowed) {
    return {
      ok: false,
      status: 403,
      body: { error: eidsCheck.error, code: eidsCheck.code },
    };
  }

  const premium = normalizePremium({
    titleBold: Boolean(body.titleBold),
    titleLarge: Boolean(body.titleLarge),
    isColored: Boolean(body.isColored),
    featuredDays: Number(body.featuredDays || 0),
  });
  const fee = await resolveListingTotalFee(session.id, premium);
  const paidIntentId = body.paidIntentId ? String(body.paidIntentId) : "";
  const confirmListingFee = Boolean(body.confirmListingFee);
  const payWithTokens = Boolean(body.payWithTokens);
  const [demoEnabled, tokensOnly, listingTokenQuote] = await Promise.all([
    isDemoPosEnabled(),
    isPaymentTokensOnly(),
    quoteListingFeeTokensForUser(session.id, premium),
  ]);
  const premiumTokenQuote = await quotePremiumTokensForUser(session.id, premium);

  let verifiedPaymentId: string | null = null;
  let tokensToSpend = 0;

  const feePayload = {
    feeTl: fee.totalFeeTl,
    baseFeeTl: fee.baseFeeTl,
    premiumFeeTl: fee.premiumFeeTl,
    premiumBreakdown: fee.premiumBreakdown,
    invoice: fee.invoice,
    used: fee.used,
    quota: fee.quota,
    mode: fee.mode,
    accountType: fee.accountType,
    demoPosEnabled: demoEnabled,
    requirePos: demoEnabled && !tokensOnly,
    tokensOnly,
    payWithTokensEnabled: listingTokenQuote.enabled || premiumTokenQuote.enabled,
    premiumFeeTokens: premiumTokenQuote.premiumFeeTokens,
    premiumTokenBreakdown: premiumTokenQuote.premiumTokenBreakdown,
    totalFeeTokens: listingTokenQuote.totalFeeTokens,
  };

  // Yalnızca jeton: tüm ücret jetonla; POS yok.
  if (tokensOnly && fee.requiresFee) {
    const needed = listingTokenQuote.totalFeeTokens;
    if (needed <= 0) {
      return {
        ok: false,
        status: 403,
        body: {
          error:
            "Yalnızca jeton ödemesi açık ancak jeton tutarı hesaplanamadı. Hızlı jeton birim fiyatını veya ilan ücretini kontrol edin.",
          code: "TOKENS_ONLY_NO_RATE",
          ...feePayload,
        },
      };
    }
    if (!payWithTokens && !confirmListingFee && !paidIntentId) {
      return {
        ok: false,
        status: 402,
        body: {
          error: `Bu ilan ${needed} jeton ile ödenir (POS kapalı).`,
          code: "LISTING_FEE_REQUIRED",
          ...feePayload,
          feeTl: 0,
          requirePos: false,
        },
      };
    }
    if (!payWithTokens && !body.dryRun) {
      return {
        ok: false,
        status: 403,
        body: {
          error: "POS kapalı. Bu ilanı yalnızca jeton ile yayınlayabilirsiniz.",
          code: "TOKENS_ONLY",
          ...feePayload,
        },
      };
    }
    tokensToSpend = needed;
  } else {
    // Karma: jetonla yalnızca premium; kalan TL/POS
    const baseOnly = payWithTokens ? await resolveListingBaseFeeOnly(session.id) : null;
    const dueAfterTokens =
      payWithTokens && premiumTokenQuote.enabled && premiumTokenQuote.premiumFeeTokens > 0
        ? baseOnly!
        : fee;

    if (payWithTokens) {
      if (!premiumTokenQuote.enabled || premiumTokenQuote.premiumFeeTokens <= 0) {
        return {
          ok: false,
          status: 400,
          body: {
            error: premiumTokenQuote.enabled
              ? "Jetonla ödenecek premium özellik seçilmedi veya jeton fiyatı tanımlı değil."
              : "Premium jeton ödemesi kapalı. Admin ayarlarından açabilirsiniz.",
            code: "PREMIUM_TOKENS_DISABLED",
            ...feePayload,
          },
        };
      }
      tokensToSpend = premiumTokenQuote.premiumFeeTokens;
    }

    if (dueAfterTokens.requiresFee) {
      const quotaText =
        dueAfterTokens.mode === "freemium" && dueAfterTokens.quota != null && dueAfterTokens.baseFeeTl > 0
          ? ` Ücretsiz kotanız ${dueAfterTokens.quota} ilan; şu ana kadar ${dueAfterTokens.used} ilan verdiniz.`
          : "";
      const premiumText =
        fee.premiumFeeTl > 0 && !payWithTokens
          ? ` Premium: ${fee.premiumBreakdown.map((x) => `${x.label} ${x.amountTl} TL`).join(", ")}.`
          : payWithTokens
            ? ` Premium ${tokensToSpend} jeton ile ödenecek.`
            : "";

      if (!paidIntentId && !confirmListingFee) {
        return {
          ok: false,
          status: 402,
          body: {
            error: `Bu ilan ücretlidir (${dueAfterTokens.totalFeeTl} TL).${quotaText}${premiumText}`,
            code: "LISTING_FEE_REQUIRED",
            ...feePayload,
            feeTl: dueAfterTokens.totalFeeTl,
            baseFeeTl: dueAfterTokens.baseFeeTl,
            requirePos: demoEnabled,
          },
        };
      }

      if (payWithTokens && !paidIntentId && dueAfterTokens.totalFeeTl > 0) {
        if (!demoEnabled) {
          return {
            ok: false,
            status: 403,
            body: {
              error:
                "Premium jetonla ödenebilir; kalan ilan ücreti için POS kapalı. «Yalnızca jeton» modunu açın veya POS’u etkinleştirin.",
              code: "DEMO_POS_DISABLED",
            },
          };
        }
        return {
          ok: false,
          status: 402,
          body: {
            error: `Premium jetonla ödenecek; kalan ${dueAfterTokens.totalFeeTl} TL için POS gerekli.`,
            code: "LISTING_FEE_REQUIRED",
            ...feePayload,
            feeTl: dueAfterTokens.totalFeeTl,
            baseFeeTl: dueAfterTokens.baseFeeTl,
            premiumPaidWithTokensPending: true,
            requirePos: true,
          },
        };
      }

      if (!paidIntentId && demoEnabled && !payWithTokens) {
        return {
          ok: false,
          status: 402,
          body: {
            error: `Ödeme için sanal POS’a yönlendirileceksiniz (${dueAfterTokens.totalFeeTl} TL).${quotaText}${premiumText}`,
            code: "LISTING_FEE_REQUIRED",
            ...feePayload,
            requirePos: true,
          },
        };
      }

      if (!paidIntentId && !demoEnabled && !payWithTokens) {
        return {
          ok: false,
          status: 403,
          body: {
            error:
              "İlan ücreti için POS kapalı. Admin → Ödemeler’den POS açın veya «Yalnızca jeton ödemesi»ni etkinleştirin.",
            code: "DEMO_POS_DISABLED",
          },
        };
      }

      if (paidIntentId) {
        const payment = await prisma.payment.findUnique({ where: { id: paidIntentId } });
        const meta = (payment?.meta || {}) as Record<string, unknown>;
        const finalizeDemo = Boolean(body.finalizeDemoPosIntent);
        const statusOk =
          payment?.status === PaymentStatus.PAID ||
          (finalizeDemo &&
            payment?.status === PaymentStatus.PENDING &&
            meta.kind === "listing_fee_intent");
        if (
          !payment ||
          payment.userId !== session.id ||
          payment.purpose !== "listing_fee" ||
          !statusOk ||
          meta.consumed === true ||
          !paymentCoversFee(Number(payment.amountTl), dueAfterTokens.totalFeeTl)
        ) {
          if (meta.listingId && payment?.userId === session.id) {
            const existing = await prisma.listing.findUnique({
              where: { id: String(meta.listingId) },
              select: { status: true },
            });
            const existingStatus = existing?.status || ListingStatus.PENDING_REVIEW;
            const alreadyLive = existingStatus === ListingStatus.ACTIVE;
            return {
              ok: true,
              listingId: String(meta.listingId),
              status: existingStatus,
              message: alreadyLive
                ? "İlanınız yayınlandı."
                : "İlanınız yönetici onayına gönderildi. Onaylandıktan sonra yayınlanacaktır.",
            };
          }
          return {
            ok: false,
            status: 402,
            body: {
              error: "Ödeme doğrulanamadı. Lütfen demo POS üzerinden tekrar ödeyin.",
              code: "LISTING_FEE_REQUIRED",
              ...feePayload,
              feeTl: dueAfterTokens.totalFeeTl,
              demoPosEnabled: demoEnabled,
              requirePos: demoEnabled,
            },
          };
        }
        verifiedPaymentId = payment.id;
      }
    }
  }

  // Jeton düşümü: ilan oluşturulmadan hemen önce
  if (tokensToSpend > 0 && !body.dryRun) {
    const spent = await spendTokens({
      userId: session.id,
      amount: tokensToSpend,
      reason: tokensOnly ? "listing_fee_tokens" : "listing_premium",
      meta: {
        tokensOnly,
        premium: {
          titleBold: premium.titleBold,
          titleLarge: premium.titleLarge,
          isColored: premium.isColored,
          featuredDays: premium.featuredDays,
        },
        totalFeeTl: fee.totalFeeTl,
        tokens: tokensToSpend,
      },
    });
    if (!spent.ok) {
      return {
        ok: false,
        status: 402,
        body: {
          error: spent.error,
          code: "INSUFFICIENT_TOKENS",
          ...feePayload,
          balance: spent.balance,
          requiredTokens: tokensToSpend,
        },
      };
    }
  }

  if (body.dryRun) {
    return {
      ok: true,
      listingId: "",
      status: ListingStatus.PENDING_REVIEW,
      message: "dry-run",
    };
  }

  const autoApprove = (await getSetting<boolean>("listing_auto_approve", false)) === true;
  const now = new Date();
  const startsAt = autoApprove ? now : null;
  const endsAt =
    autoApprove ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;
  const featuredUntil =
    autoApprove && premium.featuredDays > 0
      ? new Date(now.getTime() + premium.featuredDays * 24 * 60 * 60 * 1000)
      : null;

  const listingNo = await generateListingNo();
  let listing;
  try {
    listing = await prisma.listing.create({
      data: {
        listingNo,
        tenantId: limitCheck.tenantId,
        shopId: limitCheck.shopId,
        sellerId: session.id,
        categoryId: category.id,
        title: String(body.title),
        description: String(body.description || ""),
        city: String(body.city),
        district: (body.district as string) || null,
        neighborhood: (body.neighborhood as string) || null,
        dealType,
        askPrice: BigInt(Math.round(Number(body.askPrice) || 0)),
        status: autoApprove ? ListingStatus.ACTIVE : ListingStatus.PENDING_REVIEW,
        durationDays: days,
        startsAt,
        endsAt,
        coverImage:
          (body.coverImage as string) ||
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
        images: (body.images as string[]) || [],
        contactPhone: session.phone,
        attributes: asJson(body.attributes || {}),
        isFeatured: premium.featuredDays > 0,
        featuredDays: premium.featuredDays,
        featuredUntil,
        titleBold: premium.titleBold,
        titleLarge: premium.titleLarge,
        isColored: premium.isColored,
        escrowEligible: Boolean(body.escrowEligible) || isAlisverisCategorySlug(category.slug),
        rejectionReason: null,
        reviewedAt: autoApprove ? now : null,
        reviewedById: null,
        eidsVerified: eidsCheck.eidsVerified,
        eidsVerifiedAt: eidsCheck.eidsVerified ? new Date() : null,
        eidsPropertyId: eidsCheck.eidsPropertyId,
        eidsVehiclePlate: eidsCheck.eidsVehiclePlate,
        latitude: body.latitude != null && body.latitude !== "" ? Number(body.latitude) : null,
        longitude: body.longitude != null && body.longitude !== "" ? Number(body.longitude) : null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "İlan kaydı oluşturulamadı";
    console.error("[createListingForSeller]", msg);
    return {
      ok: false,
      status: 500,
      body: {
        error: msg.includes("Unknown argument")
          ? "Veritabanı şeması güncel değil. Sunucu yeniden başlatılmalı (prisma generate)."
          : "İlan kaydı oluşturulamadı. Lütfen tekrar deneyin.",
      },
    };
  }

  if (verifiedPaymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: verifiedPaymentId } });
    const meta = (payment?.meta || {}) as Record<string, unknown>;
    await prisma.payment.update({
      where: { id: verifiedPaymentId },
      data: { meta: asJson({ ...meta, consumed: true, listingId: listing.id }) },
    });
  }

  const { invalidateFacetCache } = await import("@/lib/facetCounts");
  invalidateFacetCache();

  await writeAuditLog({
    tenantId: limitCheck.tenantId,
    actorId: session.id,
    action: autoApprove ? "listing.auto_approve" : "listing.submit_review",
    entity: "Listing",
    entityId: listing.id,
    meta: {
      title: listing.title,
      shopId: limitCheck.shopId,
      autoApprove,
      eids: {
        mode: eidsCheck.mode,
        applicable: eidsCheck.applicable,
        verified: eidsCheck.eidsVerified,
      },
    },
  });

  // AI okuma SS’si ilana eklenmez; kayıt sonrası geçici dosyayı sil
  try {
    await deleteLocalUploadUrls(body.aiSourceImages);
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    listingId: listing.id,
    status: listing.status,
    message: autoApprove
      ? "İlanınız yayınlandı."
      : "İlanınız yönetici onayına gönderildi. Onaylandıktan sonra yayınlanacaktır.",
  };
}

/** Demo POS için bekleyen ödeme + ilan taslağı oluştur. */
export async function createListingFeeIntent(session: SessionUser, listing: ListingCreateBody) {
  const premium = normalizePremium({
    titleBold: Boolean(listing.titleBold),
    titleLarge: Boolean(listing.titleLarge),
    isColored: Boolean(listing.isColored),
    featuredDays: Number(listing.featuredDays || 0),
  });
  const payWithTokens = Boolean(listing.payWithTokens);
  const tokenQuote = payWithTokens ? await quotePremiumTokensForUser(session.id, premium) : null;
  const fee = await resolveListingTotalFee(session.id, premium);
  const dueFee =
    payWithTokens && tokenQuote?.enabled && (tokenQuote.premiumFeeTokens || 0) > 0
      ? await resolveListingBaseFeeOnly(session.id)
      : fee;
  const demoEnabled = await isDemoPosEnabled();
  if (await isPaymentTokensOnly()) {
    return {
      ok: false as const,
      status: 403,
      body: {
        error: "Yalnızca jeton ödemesi açık. POS kullanılamaz.",
        code: "TOKENS_ONLY",
      },
    };
  }

  if (!dueFee.requiresFee) {
    return { ok: false as const, status: 400, body: { error: "Bu ilan için ücret gerekmiyor.", code: "NO_FEE" } };
  }
  if (!demoEnabled) {
    return {
      ok: false as const,
      status: 403,
      body: {
        error: "Demo sanal POS kapalı. Admin → Ödemeler / Sistem Ayarları’ndan açabilirsiniz.",
        code: "DEMO_POS_DISABLED",
      },
    };
  }

  const probe = await createListingForSeller(session, {
    ...listing,
    dryRun: true,
    confirmListingFee: false,
    payWithTokens: false,
  });
  if (probe.ok) {
    return {
      ok: false as const,
      status: 400,
      body: { error: "Bu ilan için ücret gerekmiyor.", code: "NO_FEE" },
    };
  }
  if (probe.status !== 402 || probe.body.code !== "LISTING_FEE_REQUIRED") {
    return { ok: false as const, status: probe.status, body: probe.body };
  }

  const dueTl = roundMoney(dueFee.totalFeeTl);
  const limitCheck = await guardListingCreate(session.id);
  const payment = await prisma.payment.create({
    data: {
      userId: session.id,
      tenantId: limitCheck.allowed ? limitCheck.tenantId : null,
      amountTl: dueTl,
      purpose: "listing_fee",
      status: PaymentStatus.PENDING,
      meta: asJson({
        channel: "demo_pos",
        kind: "listing_fee_intent",
        listing: { ...listing, payWithTokens: payWithTokens || undefined },
        vatPercent: dueFee.invoice?.vatPercent ?? 0,
        vatTl: dueFee.invoice?.vatTl ?? 0,
        netTl: dueFee.invoice?.afterDiscountExVatTl ?? dueTl,
        grossTl: dueFee.invoice?.payableTl ?? dueTl,
        pricesIncludeVat: dueFee.invoice?.pricesIncludeVat !== false,
        fee: {
          mode: dueFee.mode,
          used: dueFee.used,
          quota: dueFee.quota,
          feeTl: dueTl,
          baseFeeTl: dueFee.baseFeeTl,
          premiumFeeTl: fee.premiumFeeTl,
          premiumBreakdown: fee.premiumBreakdown,
          invoice: dueFee.invoice,
          payWithTokens,
          premiumFeeTokens: tokenQuote?.premiumFeeTokens || 0,
        },
        consumed: false,
      }),
    },
  });

  return {
    ok: true as const,
    intentId: payment.id,
    amountTl: dueTl,
    fee: dueFee,
    payUrl: `/odeme/demo-pos?intent=${payment.id}`,
  };
}

export async function completeDemoPosPayment(session: SessionUser, intentId: string) {
  const demoEnabled = await isDemoPosEnabled();
  if (!demoEnabled) {
    return {
      ok: false as const,
      status: 403,
      body: { error: "Demo POS kapalı.", code: "DEMO_POS_DISABLED" },
    };
  }

  const payment = await prisma.payment.findUnique({ where: { id: intentId } });
  if (!payment || payment.userId !== session.id || payment.purpose !== "listing_fee") {
    return { ok: false as const, status: 404, body: { error: "Ödeme oturumu bulunamadı." } };
  }

  const meta = (payment.meta || {}) as Record<string, unknown>;
  if (meta.kind !== "listing_fee_intent") {
    return { ok: false as const, status: 400, body: { error: "Geçersiz ödeme oturumu." } };
  }

  if (meta.listingId) {
    if (payment.status !== PaymentStatus.PAID) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID },
      });
    }
    return {
      ok: true as const,
      listingId: String(meta.listingId),
      message: "Ödeme zaten tamamlanmış.",
      alreadyPaid: true,
    };
  }

  if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.PAID) {
    return {
      ok: false as const,
      status: 409,
      body: { error: `Ödeme durumu uygun değil: ${payment.status}` },
    };
  }

  const listingPayload = (meta.listing || {}) as ListingCreateBody;

  // Önce ilanı oluştur (PENDING intent de kabul edilir); sonra ödemeyi PAID işaretle.
  // Böylece "PAID ama ilan yok" kilit durumu oluşmaz.
  const created = await createListingForSeller(session, {
    ...listingPayload,
    paidIntentId: payment.id,
    finalizeDemoPosIntent: true,
  });

  if (!created.ok) {
    return { ok: false as const, status: created.status, body: created.body };
  }

  const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
  const freshMeta = (fresh?.meta || {}) as Record<string, unknown>;
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PAID,
      meta: asJson({
        ...freshMeta,
        channel: "demo_pos",
        paidAt: freshMeta.paidAt || new Date().toISOString(),
        simulated: true,
        listingId: created.listingId,
        consumed: true,
      }),
    },
  });

  return {
    ok: true as const,
    listingId: created.listingId,
    message: created.message,
    alreadyPaid: Boolean(meta.listingId),
  };
}
