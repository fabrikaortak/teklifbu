/**
 * Subtype değişince mevcut SellerOffer’ları otomatik kapatmaz;
 * admin incelemesi için audit rapor üretir.
 */
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/core/services/tenantService";
import { allowedVerticalsForUser } from "@/lib/verticalAccessPolicy";

export async function reportSellerOffersAfterSubtypeChange(opts: {
  userId: string;
  actorId?: string | null;
  previousSubtypes: string[];
  nextSubtypes: string[];
  accountType?: string | null;
  profile?: unknown;
}) {
  const nextAllowed = allowedVerticalsForUser({
    id: opts.userId,
    accountType: opts.accountType,
    commercialSubtypes: opts.nextSubtypes,
    profile: opts.profile,
  });
  const lostAlisveris = !nextAllowed.has("alisveris");
  if (!lostAlisveris) return { reported: false, offerIds: [] as string[] };

  const offers = await prisma.sellerOffer.findMany({
    where: {
      sellerId: opts.userId,
      deletedAt: null,
      status: { notIn: ["ARCHIVED", "REJECTED"] },
    },
    select: { id: true, status: true, shopId: true, productId: true },
    take: 500,
  });
  if (!offers.length) return { reported: false, offerIds: [] as string[] };

  const offerIds = offers.map((o) => o.id);
  await writeAuditLog({
    actorId: opts.actorId || opts.userId,
    action: "vertical.subtype_change.offer_review",
    entity: "User",
    entityId: opts.userId,
    meta: {
      previousSubtypes: opts.previousSubtypes,
      nextSubtypes: opts.nextSubtypes,
      lostVertical: "alisveris",
      offerCount: offers.length,
      offers: offers.map((o) => ({
        id: o.id,
        status: o.status,
        shopId: o.shopId,
        productId: o.productId,
      })),
      note: "Cascade kapatma yok — admin inceleme listesi",
      timestamp: new Date().toISOString(),
    },
  });

  return { reported: true, offerIds };
}
