import type { Prisma, PrismaClient } from "@prisma/client";
import { listingStatusForOffer } from "@/core/services/catalog/sellerOfferStateMachine";
import { getCategoryBreadcrumb } from "@/core/services/catalog/categoryTreeService";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * SellerOffer → Listing mirror tek yön senkron.
 * SOLD_OUT listing'i arşivlemez; attributes.outOfStock işaretler.
 */
export async function syncListingMirrorFromOffer(
  tx: Tx,
  offerId: string
): Promise<void> {
  const offer = await tx.sellerOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    include: {
      product: { include: { brand: true, model: true } },
      variant: true,
      shop: { select: { name: true } },
      listing: true,
    },
  });
  if (!offer?.listingId || !offer.listing) return;

  const product = offer.product;
  const variant = offer.variant;
  const title =
    `${product.brand?.name ? product.brand.name + " " : ""}${product.name}${
      variant.title ? " · " + variant.title : ""
    }`.trim().slice(0, 180);

  const description =
    [product.description, offer.sellerNote].filter(Boolean).join("\n\n") || title;

  const prevAttrs =
    offer.listing.attributes && typeof offer.listing.attributes === "object"
      ? (offer.listing.attributes as Record<string, unknown>)
      : {};

  const outOfStock = offer.status === "SOLD_OUT" || offer.stockQty <= 0;
  const attributes: Record<string, unknown> = {
    ...prevAttrs,
    brand: product.brand?.name || "",
    model: product.model?.name || "",
    condition: offer.condition || "",
    catalogOffer: true,
    variantTitle: variant.title,
    sellerSku: offer.sellerSku || "",
    stockQty: offer.stockQty,
    priceInKurus: true,
    outOfStock,
  };

  const mapped = listingStatusForOffer(offer.status, offer.listing.status);
  const data: Prisma.ListingUpdateInput = {
    title,
    description,
    askPrice: offer.price,
    coverImage: product.mainImage,
    images: product.mainImage ? [product.mainImage] : [],
    productId: product.id,
    variantId: variant.id,
    sellerOfferId: offer.id,
    attributes,
  };
  if (mapped) {
    data.status = mapped;
    if (mapped === "ACTIVE" && offer.listing.status !== "ACTIVE") {
      const days = Math.max(1, offer.listing.durationDays || 30);
      const startsAt = new Date();
      data.startsAt = startsAt;
      data.endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
      data.rejectionReason = null;
    }
  }

  await tx.listing.update({
    where: { id: offer.listingId },
    data,
  });
}

export async function buildCategoryPathSnapshot(categoryId: string): Promise<string> {
  const crumbs = await getCategoryBreadcrumb({ categoryId });
  return crumbs.map((c) => c.name).join(" › ");
}

export function offerTitleParts(offer: {
  product: { name: string; brand?: { name: string } | null };
  variant: { title: string };
}) {
  return {
    productName: offer.product.name,
    variantTitle: offer.variant.title,
    full: `${offer.product.brand?.name ? offer.product.brand.name + " " : ""}${offer.product.name}${
      offer.variant.title ? " · " + offer.variant.title : ""
    }`.trim(),
  };
}

export type OfferForSync = SellerOffer & {
  product: {
    id: string;
    name: string;
    mainImage: string | null;
    description: string | null;
    barcode: string | null;
    brand?: { name: string } | null;
    model?: { name: string } | null;
  };
  variant: { id: string; title: string; barcode: string | null };
};
