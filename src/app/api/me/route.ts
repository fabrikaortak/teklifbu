import { NextResponse } from "next/server";
import { AccountType, EditRequestStatus, ExtensionRequestStatus, ListingStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { serializeListing } from "@/lib/format";
import { getSetting } from "@/core/settings";
import { processExpiredListings } from "@/core/services/bidService";
import {
  mergeNotificationPrefs,
  NOTIFICATION_EVENT_OPTIONS,
} from "@/lib/notificationPrefs";
import {
  buildDisplayName,
  getEnabledProfileFields,
  getUserProfileFieldsConfig,
  parseProfileJson,
  splitDisplayName,
  validateProfilePayload,
} from "@/core/userProfileFields";
import { isCorporateAccount, normalizeAccountType, parseCommercialSubtypes } from "@/lib/accountTypes";
import { getPendingCommercialFromProfile } from "@/data/commercialProfile";
import {
  COMMERCIAL_BUSINESS_TYPES_SETTING_KEY,
  allowedBusinessTypeKeys,
} from "@/lib/commercialBusinessTypes";

async function parseAllowedCommercialSubtypes(raw: unknown) {
  const bizRaw = await getSetting(COMMERCIAL_BUSINESS_TYPES_SETTING_KEY, null);
  const allowed = allowedBusinessTypeKeys(bizRaw, true);
  return parseCommercialSubtypes(raw, allowed);
}

function userProfilePayload(user: {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  accountType: AccountType;
  commercialSubtypes?: string[];
  commercialStatus?: string | null;
  commercialReviewNote?: string | null;
  tokenBalance: number;
  avatarUrl: string | null;
  logoUrl?: string | null;
  storeCoverUrl?: string | null;
  isPremiumSeller?: boolean;
  memberSince: Date;
  profile: unknown;
  iban?: string | null;
}) {
  const profile = parseProfileJson(user.profile);
  const split = splitDisplayName(user.name);
  const accountType = normalizeAccountType(user.accountType);
  const pending = getPendingCommercialFromProfile(user.profile);
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    accountType,
    commercialSubtypes: user.commercialSubtypes || [],
    commercialStatus: user.commercialStatus || null,
    commercialReviewNote: user.commercialReviewNote || null,
    hasPendingCommercialUpdate: Boolean(pending.profile),
    pendingCommercialProfile: pending.profile,
    pendingCommercialSubtypes: pending.subtypes,
    tokenBalance: user.tokenBalance,
    avatarUrl: user.avatarUrl,
    logoUrl: user.logoUrl || null,
    storeCoverUrl: user.storeCoverUrl || null,
    isPremiumSeller: Boolean(user.isPremiumSeller),
    memberSince: user.memberSince,
    iban: user.iban || "",
    profile: {
      firstName: profile.firstName || split.firstName,
      lastName: profile.lastName || split.lastName,
      tcKimlik: profile.tcKimlik || "",
      birthDate: profile.birthDate || "",
      address: profile.address || "",
      city: profile.city || "",
      district: profile.district || "",
      postalCode: profile.postalCode || "",
      companyName: profile.companyName || profile.commercialTitle || "",
      taxOffice: profile.taxOffice || "",
      taxNumber: profile.taxNumber || "",
      commercialTitle: profile.commercialTitle || profile.companyName || "",
      companyType: profile.companyType || "",
      tradeRegistryNo: profile.tradeRegistryNo || "",
      mersisNo: profile.mersisNo || "",
      yetkiBelgeNo: profile.yetkiBelgeNo || "",
      businessCity: profile.businessCity || "",
      businessDistrict: profile.businessDistrict || "",
      businessAddress: profile.businessAddress || "",
      authorizedTitle: profile.authorizedTitle || "",
      authorizedPhone: profile.authorizedPhone || "",
      naceCode: profile.naceCode || "",
      shopFocusRoot: profile.shopFocusRoot || "",
      shopFocusSub: profile.shopFocusSub || "",
      shopFocusOtherNote: profile.shopFocusOtherNote || "",
      email: user.email || "",
      phone: user.phone || "",
      accountType,
    },
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  await processExpiredListings();

  const [listings, bids, receivedBids, favorites, notifications, user, listingEditWhileLive, profileFieldsConfig, shopSub, payments, listingFavorites, unreadMessages, reviewAgg] =
    await Promise.all([
      prisma.listing.findMany({
        where: { sellerId: session.id },
        include: {
          category: true,
          extensionRequests: {
            where: { status: ExtensionRequestStatus.PENDING },
            select: { id: true, days: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          editRequests: {
            where: { status: EditRequestStatus.PENDING },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.bid.findMany({
        where: { bidderId: session.id },
        include: { listing: { include: { category: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.bid.findMany({
        where: { listing: { sellerId: session.id } },
        include: {
          listing: { select: { id: true, title: true, status: true, listingNo: true, coverImage: true } },
          bidder: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.favorite.count({ where: { userId: session.id } }),
      prisma.notification.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.user.findUnique({ where: { id: session.id } }),
      getSetting<boolean>("listing_edit_while_live", true),
      getUserProfileFieldsConfig(),
      prisma.shopSubscription.findUnique({
        where: { userId: session.id },
        include: { package: true, shop: { select: { id: true, name: true } } },
      }),
      prisma.payment.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.favorite.count({ where: { listing: { sellerId: session.id } } }),
      prisma.message.count({
        where: { receiverId: session.id, isRead: false },
      }).catch(() => 0),
      prisma.sellerReview.aggregate({
        where: { sellerId: session.id, status: EditRequestStatus.APPROVED },
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ]);

  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const enabledFields = getEnabledProfileFields(profileFieldsConfig).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    group: f.group,
    groupLabel: f.groupLabel,
    placeholder: f.placeholder || "",
    readOnly: Boolean(f.readOnly),
    required: Boolean(profileFieldsConfig[f.key]?.required),
    hint: f.hint || "",
    maxLength: f.maxLength || null,
  }));

  const subActive =
    Boolean(shopSub) &&
    shopSub!.isActive &&
    shopSub!.endsAt > new Date() &&
    Boolean(shopSub!.package);

  let listingUsed = 0;
  let listingLimit: number | null = null;
  if (subActive && shopSub?.shopId) {
    listingLimit = Number(shopSub.package.listingLimit) || 0;
    listingUsed = await prisma.listing.count({
      where: {
        shopId: shopSub.shopId,
        status: {
          in: [
            ListingStatus.ACTIVE,
            ListingStatus.SELECTION,
            ListingStatus.DRAFT,
            ListingStatus.PENDING_REVIEW,
            ListingStatus.REJECTED,
          ],
        },
      },
    });
  } else if (subActive) {
    listingLimit = Number(shopSub!.package.listingLimit) || 0;
    listingUsed = listings.filter((l) =>
      ["ACTIVE", "SELECTION", "DRAFT", "PENDING_REVIEW", "REJECTED"].includes(l.status)
    ).length;
  }

  const shopPackage = subActive
    ? {
        id: shopSub!.package.id,
        name: shopSub!.package.name,
        billingType: String(shopSub!.package.billingType || "MONTHLY"),
        monthlyPrice: Number(shopSub!.package.monthlyPrice) || 0,
        listingLimit: listingLimit ?? 0,
        listingUsed,
        listingRemaining: Math.max(0, (listingLimit ?? 0) - listingUsed),
        premiumDiscountPercent: Number(shopSub!.package.premiumDiscountPercent) || 0,
        startsAt: shopSub!.startsAt.toISOString(),
        endsAt: shopSub!.endsAt.toISOString(),
        shopName: shopSub!.shop?.name || null,
        isActive: true,
      }
    : null;

  const { isShopPackageBuyEnabledForAccount } = await import(
    "@/core/services/shopPackagePurchaseService"
  );
  const buyPopupEnabled = await isShopPackageBuyEnabledForAccount(user.accountType);

  const isCorp = isCorporateAccount(user.accountType);
  const paymentsVisible = isCorp
    ? (await getSetting<boolean>("account_payments_visible_ticari", true)) !== false
    : (await getSetting<boolean>("account_payments_visible_bireysel", true)) !== false;

  const { resolveMagazaPanelAccess } = await import("@/lib/magazaPanelAccess");
  const sellerPanel = await resolveMagazaPanelAccess(user);

  return NextResponse.json({
    user: userProfilePayload(user),
    profileFields: enabledFields,
    profileFieldsConfig,
    stats: {
      activeListings: listings.filter((l) => l.status === "ACTIVE").length,
      bidsGiven: bids.length,
      bidsAccepted: bids.filter((b) => b.status === "APPROVED").length,
      bidsReceived: receivedBids.length,
      bidsReceivedActive: receivedBids.filter((b) => b.status === "ACTIVE").length,
      favorites,
      listingFavorites,
      unreadMessages,
      totalViews: listings.reduce((sum, l) => sum + (l.viewCount || 0), 0),
      tokenBalance: user.tokenBalance ?? 0,
      avgRating:
        reviewAgg._avg.rating != null ? Math.round(Number(reviewAgg._avg.rating) * 10) / 10 : null,
      reviewCount: reviewAgg._count._all || 0,
      satisfactionPct:
        reviewAgg._avg.rating != null
          ? Math.round((Number(reviewAgg._avg.rating) / 5) * 100)
          : null,
    },
    shopPackage,
    shopPackageBuyEnabled: buyPopupEnabled,
    sellerPanel: {
      allowed: sellerPanel.allowed,
      buttonLabel: sellerPanel.buttonLabel,
      reason: sellerPanel.reason || null,
    },
    paymentsVisible,
    payments: paymentsVisible
      ? payments.map((p) => {
          const meta = (p.meta || {}) as Record<string, unknown>;
          return {
            id: p.id,
            amountTl: Number(p.amountTl) || 0,
            purpose: p.purpose,
            status: p.status,
            createdAt: p.createdAt,
            packageId: meta.packageId ? String(meta.packageId) : null,
            months: meta.months != null ? Number(meta.months) : null,
            days: meta.days != null ? Number(meta.days) : null,
            channel: meta.channel ? String(meta.channel) : null,
          };
        })
      : [],
    listingEditWhileLive: listingEditWhileLive !== false,
    notificationPrefs: mergeNotificationPrefs(user.notificationPrefs),
    notificationEvents: NOTIFICATION_EVENT_OPTIONS,
    listings: listings.map((l) => {
      const { extensionRequests, editRequests, ...rest } = l;
      const pendingExt = extensionRequests[0] || null;
      const pendingEdit = editRequests[0] || null;
      return {
        ...serializeListing(rest),
        pendingExtension: pendingExt
          ? { id: pendingExt.id, days: pendingExt.days, createdAt: pendingExt.createdAt }
          : null,
        pendingEdit: pendingEdit
          ? { id: pendingEdit.id, createdAt: pendingEdit.createdAt }
          : null,
      };
    }),
    bids: bids.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      status: b.status,
      createdAt: b.createdAt,
      expiresAt: b.expiresAt,
      listingGone: Boolean(b.listingGone),
      listingRemoved: Boolean(b.listingGone) || b.listing.status === "ARCHIVED",
      listingTitle: b.listingTitleSnapshot || b.listing.title,
      listing: serializeListing(b.listing),
    })),
    receivedBids: receivedBids.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      status: b.status,
      createdAt: b.createdAt,
      expiresAt: b.expiresAt,
      listingId: b.listing.id,
      listingTitle: b.listing.title,
      listingStatus: b.listing.status,
      listingCoverImage: b.listing.coverImage || null,
      bidderName: b.bidder?.name || null,
      bidderPhone: b.bidder?.phone || null,
    })),
    notifications,
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const body = await req.json();

  if (body.action === "read-all") {
    await prisma.notification.updateMany({
      where: { userId: session.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "save-notification-prefs") {
    const prefs = mergeNotificationPrefs(body.prefs);
    await prisma.user.update({
      where: { id: session.id },
      data: { notificationPrefs: prefs },
    });
    return NextResponse.json({ ok: true, notificationPrefs: prefs });
  }

  if (body.action === "save-iban") {
    const raw = String(body.iban || "").toUpperCase().replace(/\s+/g, "");
    if (raw && !/^TR\d{24}$/.test(raw)) {
      return NextResponse.json(
        { error: "Geçerli bir IBAN girin (TR ile başlayan 26 haneli)" },
        { status: 400 }
      );
    }
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { iban: raw || null },
    });
    return NextResponse.json({
      ok: true,
      message: raw ? "IBAN kaydedildi" : "IBAN kaldırıldı",
      user: userProfilePayload(updated),
    });
  }

  if (body.action === "change-password") {
    try {
      const config = await getUserProfileFieldsConfig();
      if (config.password?.enabled === false) {
        return NextResponse.json({ error: "Şifre değiştirme kapalı" }, { status: 403 });
      }
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      const confirmPassword = String(body.confirmPassword || "");
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: "Mevcut ve yeni şifre gerekli" }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Yeni şifre en az 6 karakter olmalı" }, { status: 400 });
      }
      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: "Yeni şifreler eşleşmiyor" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { passwordHash: true },
      });
      if (!user?.passwordHash) {
        return NextResponse.json({ error: "Bu hesapta şifre tanımlı değil" }, { status: 400 });
      }
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "Mevcut şifre hatalı" }, { status: 400 });
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: session.id },
        data: { passwordHash },
      });
      return NextResponse.json({ ok: true, message: "Şifreniz değiştirildi" });
    } catch (e) {
      console.error("change-password failed", e);
      return NextResponse.json({ error: "Şifre güncellenemedi — tekrar deneyin" }, { status: 500 });
    }
  }

  if (body.action === "set-commercial-logo") {
    const { setCommercialLogo } = await import("@/core/services/sellerReviewService");
    const result = await setCommercialLogo({
      userId: session.id,
      logoUrl: body.logoUrl === null || body.logoUrl === "" ? null : String(body.logoUrl || ""),
    });
    if (!result.ok) {
      const insufficient = "code" in result && result.code === "INSUFFICIENT_TOKENS";
      return NextResponse.json(
        {
          error: result.error,
          code: insufficient ? "INSUFFICIENT_TOKENS" : undefined,
          requiredTokens: insufficient ? result.requiredTokens : undefined,
          balance: insufficient ? result.balance : undefined,
        },
        { status: insufficient ? 402 : 400 }
      );
    }
    return NextResponse.json({ ok: true, logoUrl: result.logoUrl, message: "Logo güncellendi" });
  }

  if (body.action === "set-commercial-store-cover") {
    const { setCommercialStoreCover } = await import("@/core/services/sellerReviewService");
    const result = await setCommercialStoreCover({
      userId: session.id,
      storeCoverUrl:
        body.storeCoverUrl === null || body.storeCoverUrl === ""
          ? null
          : String(body.storeCoverUrl || ""),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      storeCoverUrl: result.storeCoverUrl,
      message: "Mağaza kapağı güncellendi",
    });
  }

  if (body.action === "request-commercial-update") {
    const existing = await prisma.user.findUnique({ where: { id: session.id } });
    if (!existing) return NextResponse.json({ error: "Kullanıcı yok" }, { status: 404 });
    if (normalizeAccountType(existing.accountType) !== "TICARI") {
      return NextResponse.json({ error: "Yalnızca ticari üyeler bu formu kullanabilir" }, { status: 400 });
    }
    const {
      parseCommercialProfile,
      validateCommercialProfile,
      mergeCommercialIntoProfile,
      attachPendingCommercial,
      getPendingCommercialFromProfile,
    } = await import("@/data/commercialProfile");
    const subs = await parseAllowedCommercialSubtypes(body.commercialSubtypes);
    if (!subs.length) {
      return NextResponse.json({ error: "En az bir faaliyet alanı seçin" }, { status: 400 });
    }
    const commercial = parseCommercialProfile(body.commercialProfile || {});
    const cerr = validateCommercialProfile(commercial);
    if (cerr) return NextResponse.json({ error: cerr }, { status: 400 });

    const { getSetting } = await import("@/core/settings");
    const approvalRequired =
      (await getSetting<boolean>("commercial_approval_required", true)) !== false;
    const st = String(existing.commercialStatus || "").toUpperCase();
    const prev =
      existing.profile && typeof existing.profile === "object" && !Array.isArray(existing.profile)
        ? { ...(existing.profile as Record<string, unknown>) }
        : {};
    const asStringMap = () =>
      Object.fromEntries(
        Object.entries(prev)
          .filter(([k]) => k !== "_pendingCommercial" && k !== "_pendingSubtypes")
          .map(([k, v]) => [k, v == null ? "" : String(v)])
      );

    if (!approvalRequired) {
      const merged = mergeCommercialIntoProfile(asStringMap(), commercial);
      const updated = await prisma.user.update({
        where: { id: session.id },
        data: {
          commercialSubtypes: subs,
          commercialStatus: "APPROVED",
          isActive: true,
          profile: merged as Prisma.InputJsonValue,
        },
      });
      const { syncShopNameFromUserProfile } = await import("@/core/services/tenantService");
      await syncShopNameFromUserProfile(session.id);
      return NextResponse.json({
        ok: true,
        message: "İşletme bilgileri güncellendi",
        user: userProfilePayload(updated),
      });
    }

    // Daha önce onaylanmış üye (veya güncelleme bekleyen) → canlı veri korunur
    const wasApproved =
      st === "APPROVED" ||
      Boolean(existing.commercialReviewedAt) ||
      Boolean(getPendingCommercialFromProfile(existing.profile).profile);

    if (wasApproved && st !== "REJECTED") {
      const next = attachPendingCommercial(prev, commercial, subs);
      const updated = await prisma.user.update({
        where: { id: session.id },
        data: {
          commercialStatus: "PENDING",
          isActive: true,
          profile: next as Prisma.InputJsonValue,
        },
      });
      return NextResponse.json({
        ok: true,
        message: "Değişiklikler yönetici onayına gönderildi",
        user: userProfilePayload(updated),
      });
    }

    // İlk başvuru / reddedilmiş yeniden başvuru
    const merged = mergeCommercialIntoProfile(asStringMap(), commercial);
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: {
        commercialSubtypes: subs,
        commercialStatus: "PENDING",
        isActive: false,
        profile: merged as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({
      ok: true,
      message: "Başvuru kaydedildi — yönetici onayı bekleniyor",
      user: userProfilePayload(updated),
    });
  }

  if (body.action === "save-profile" || body.profile || body.values) {
    const config = await getUserProfileFieldsConfig();
    const valuesIn = (body.values || body.profile || {}) as Record<string, string>;
    const validated = validateProfilePayload({
      values: Object.fromEntries(
        Object.entries(valuesIn).map(([k, v]) => [k, String(v ?? "")])
      ),
      config,
      skipPassword: true,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const values = validated.values;
    if (values.email) {
      const email = values.email.trim().toLowerCase();
      const taken = await prisma.user.findFirst({
        where: { email, NOT: { id: session.id } },
      });
      if (taken) return NextResponse.json({ error: "Bu e-posta kullanımda" }, { status: 409 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: session.id },
      select: { profile: true, name: true },
    });
    const prevProfile = parseProfileJson(existing?.profile);
    const nextProfile: Record<string, string> = { ...prevProfile };

    for (const [key, val] of Object.entries(values)) {
      if (key === "email" || key === "accountType" || key === "phone") continue;
      nextProfile[key] = val;
    }

    const firstName = values.firstName ?? nextProfile.firstName ?? "";
    const lastName = values.lastName ?? nextProfile.lastName ?? "";
    const displayName = buildDisplayName(firstName, lastName, existing?.name || "");

    const data: Prisma.UserUpdateInput = {
      profile: nextProfile as Prisma.InputJsonValue,
    };
    if (config.firstName?.enabled || config.lastName?.enabled) {
      data.name = displayName || null;
    }
    if (config.email?.enabled && values.email !== undefined) {
      data.email = values.email ? values.email.trim().toLowerCase() : null;
    }
    if (config.accountType?.enabled && values.accountType) {
      const nextType = normalizeAccountType(values.accountType);
      data.accountType = nextType as AccountType;
      if (nextType === "TICARI") {
        const subs = await parseAllowedCommercialSubtypes(body.commercialSubtypes);
        if (!subs.length) {
          return NextResponse.json(
            { error: "Ticari üyelikte en az bir faaliyet alanı seçmelisiniz." },
            { status: 400 }
          );
        }
        data.commercialSubtypes = subs;
        const { parseCommercialProfile, validateCommercialProfile, mergeCommercialIntoProfile } =
          await import("@/data/commercialProfile");
        const commercial = parseCommercialProfile(body.commercialProfile || values);
        const cerr = validateCommercialProfile(commercial);
        if (cerr) return NextResponse.json({ error: cerr }, { status: 400 });
        const merged = mergeCommercialIntoProfile(nextProfile, commercial);
        Object.assign(nextProfile, merged);
        data.profile = nextProfile as Prisma.InputJsonValue;
        const existingUser = await prisma.user.findUnique({
          where: { id: session.id },
          select: { commercialStatus: true },
        });
        const st = String(existingUser?.commercialStatus || "").toUpperCase();
        if (!st || st === "REJECTED") {
          const { getSetting } = await import("@/core/settings");
          const approvalRequired =
            (await getSetting<boolean>("commercial_approval_required", true)) !== false;
          data.commercialStatus = approvalRequired ? "PENDING" : "APPROVED";
          data.isActive = approvalRequired ? false : true;
        } else if (st === "APPROVED") {
          // Hesap ayarlarından ticari alan değişirse onay akışına düşürülmemeli —
          // ticari form ayrı action ile gider. Burada yalnızca subtypes/profile merge.
        }
      } else {
        data.commercialSubtypes = [];
        data.commercialStatus = null;
      }
    } else if (body.commercialSubtypes !== undefined) {
      data.commercialSubtypes = await parseAllowedCommercialSubtypes(body.commercialSubtypes);
    }

    const prevUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { commercialSubtypes: true, accountType: true, profile: true },
    });
    const prevSubtypes = Array.isArray(prevUser?.commercialSubtypes)
      ? [...prevUser!.commercialSubtypes]
      : [];

    const updated = await prisma.user.update({
      where: { id: session.id },
      data,
    });

    if (
      body.commercialSubtypes !== undefined ||
      (config.accountType?.enabled && values.accountType)
    ) {
      try {
        const { reportSellerOffersAfterSubtypeChange } = await import(
          "@/core/services/verticalSubtypeChangeReport"
        );
        await reportSellerOffersAfterSubtypeChange({
          userId: session.id,
          actorId: session.id,
          previousSubtypes: prevSubtypes,
          nextSubtypes: updated.commercialSubtypes || [],
          accountType: updated.accountType,
          profile: updated.profile,
        });
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({ ok: true, user: userProfilePayload(updated) });
  }

  // Geriye dönük: eski name/email/accountType kaydı
  if (body.name !== undefined || body.email !== undefined || body.accountType !== undefined) {
    if (body.email !== undefined && body.email) {
      const email = String(body.email).trim().toLowerCase();
      const taken = await prisma.user.findFirst({
        where: { email, NOT: { id: session.id } },
      });
      if (taken) return NextResponse.json({ error: "Bu e-posta kullanımda" }, { status: 409 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined
          ? { email: body.email ? String(body.email).trim().toLowerCase() : null }
          : {}),
        ...(body.accountType !== undefined ? { accountType: body.accountType } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz" }, { status: 400 });
}
