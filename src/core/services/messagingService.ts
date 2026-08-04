import { BidStatus } from "@prisma/client";
import { getSetting } from "@/core/settings";
import { prisma } from "@/lib/db";
import {
  accessAllows,
  getCategoryAccessRule,
  resolveTopCategorySlug,
  type CategoryAccessMode,
} from "@/lib/categoryAccess";

export type MessagingAccess = "approved" | "everyone" | CategoryAccessMode;

export async function getMessagingAccess(): Promise<"approved" | "everyone"> {
  const { isClassifiedMode } = await import("@/core/services/marketplaceModeService");
  if (await isClassifiedMode()) return "everyone";
  const v = String((await getSetting<string>("messaging_access", "approved")) || "approved");
  return v === "everyone" ? "everyone" : "approved";
}

/** Bu ilanda teklifi onaylanmış mı? */
export async function userHasApprovedBidOnListing(userId: string, listingId: string) {
  const bid = await prisma.bid.findFirst({
    where: {
      listingId,
      bidderId: userId,
      status: BidStatus.APPROVED,
    },
    select: { id: true },
  });
  return Boolean(bid);
}

async function resolveListingMessagingMode(listingId: string): Promise<CategoryAccessMode> {
  const { isClassifiedMode } = await import("@/core/services/marketplaceModeService");
  if (await isClassifiedMode()) return "logged_in";
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      category: { include: { parent: { select: { slug: true } } } },
    },
  });
  const topSlug = resolveTopCategorySlug(listing?.category);
  const map = await getSetting<Record<string, unknown>>("seller_visibility_by_category", {});
  const rule = getCategoryAccessRule(map, topSlug);
  return rule.messaging;
}

export async function assertCanSendMessage(
  userId: string,
  opts?: { listingId?: string | null }
): Promise<
  | { ok: true; access: MessagingAccess; approved: boolean }
  | { ok: false; status: number; error: string; code: string; access: MessagingAccess; approved: boolean }
> {
  const globalAccess = await getMessagingAccess();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, role: true },
  });
  if (!user || !user.isActive) {
    return {
      ok: false,
      status: 403,
      error: "Hesabınız aktif değil.",
      code: "INACTIVE",
      access: globalAccess,
      approved: false,
    };
  }

  if (user.role === "ADMIN") {
    return { ok: true, access: globalAccess, approved: true };
  }

  const listingId = opts?.listingId ? String(opts.listingId) : "";
  if (!listingId) {
    // listing'siz mesaj: yalnızca global everyone
    if (globalAccess === "everyone") {
      return { ok: true, access: globalAccess, approved: true };
    }
    return {
      ok: false,
      status: 403,
      error: "Mesaj göndermek için ilgili ilan üzerinden devam edin.",
      code: "MESSAGING_NEEDS_LISTING",
      access: globalAccess,
      approved: false,
    };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true },
  });
  if (!listing) {
    return {
      ok: false,
      status: 404,
      error: "İlan bulunamadı.",
      code: "LISTING_NOT_FOUND",
      access: globalAccess,
      approved: false,
    };
  }

  if (userId === listing.sellerId) {
    return { ok: true, access: globalAccess, approved: true };
  }

  const messagingMode = await resolveListingMessagingMode(listingId);
  const approved = await userHasApprovedBidOnListing(userId, listingId);
  const allowed = accessAllows(messagingMode, {
    loggedIn: true,
    hasApprovedDeal: approved,
    isSellerOrAdmin: false,
  });

  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error:
        messagingMode === "approved"
          ? "İlan sahibine mesaj göndermek için bu ilandaki teklifinizin onaylanmış olması gerekir."
          : "Mesaj göndermek için giriş yapmanız gerekir.",
      code: "MESSAGING_BID_APPROVED_ONLY",
      access: messagingMode,
      approved,
    };
  }

  return { ok: true, access: messagingMode, approved };
}

export async function createListingMessage(input: {
  senderId: string;
  receiverId: string;
  listingId?: string | null;
  body: string;
}) {
  const text = String(input.body || "").trim();
  if (text.length < 1) {
    return { ok: false as const, status: 400, body: { error: "Mesaj boş olamaz." } };
  }
  if (text.length > 2000) {
    return { ok: false as const, status: 400, body: { error: "Mesaj en fazla 2000 karakter olabilir." } };
  }
  if (!input.receiverId) {
    return { ok: false as const, status: 400, body: { error: "Alıcı gerekli." } };
  }
  if (input.receiverId === input.senderId) {
    return { ok: false as const, status: 400, body: { error: "Kendinize mesaj gönderemezsiniz." } };
  }

  const listingId = input.listingId ? String(input.listingId) : null;
  const gate = await assertCanSendMessage(input.senderId, { listingId });
  if (!gate.ok) {
    return { ok: false as const, status: gate.status, body: { error: gate.error, code: gate.code } };
  }

  const receiver = await prisma.user.findUnique({
    where: { id: input.receiverId },
    select: { id: true, isActive: true },
  });
  if (!receiver || !receiver.isActive) {
    return { ok: false as const, status: 404, body: { error: "Alıcı bulunamadı." } };
  }

  if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, title: true },
    });
    if (!listing) {
      return { ok: false as const, status: 404, body: { error: "İlan bulunamadı." } };
    }
    const isParty =
      input.senderId === listing.sellerId || input.receiverId === listing.sellerId;
    if (!isParty) {
      return {
        ok: false as const,
        status: 403,
        body: { error: "Bu ilan için yalnızca ilan sahibi ile mesajlaşabilirsiniz." },
      };
    }
  }

  const msg = await prisma.message.create({
    data: {
      senderId: input.senderId,
      receiverId: input.receiverId,
      listingId,
      body: text,
    },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
      listing: { select: { id: true, title: true } },
    },
  });

  return { ok: true as const, message: msg };
}
