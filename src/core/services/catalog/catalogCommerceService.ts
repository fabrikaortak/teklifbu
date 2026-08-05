import type { Prisma, SellerOfferStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { catalogSlugify, isShoppingCategorySlug } from "@/lib/catalogSlug";
import {
  buildAttributesHash,
  normalizeCatalogText,
  tlToMinor,
  assertValidOfferPrices,
  CatalogCommerceError,
} from "@/lib/catalogCommerce";
import { getCategoryBreadcrumb } from "@/core/services/catalog/categoryTreeService";
import { generateListingNo } from "@/lib/listingNo";
import {
  assertSellerStatusTransition,
  resolveStatusAfterStockChange,
} from "@/core/services/catalog/sellerOfferStateMachine";
import { syncListingMirrorFromOffer } from "@/core/services/catalog/sellerOfferSyncService";

export async function searchCatalogProducts(opts: {
  q?: string;
  categoryId?: string;
  brandId?: string;
  modelId?: string;
  barcode?: string;
  limit?: number;
}) {
  const limit = Math.min(50, Math.max(1, Number(opts.limit || 20)));
  const q = String(opts.q || "").trim();
  const barcode = String(opts.barcode || "").trim();

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    status: { in: ["ACTIVE", "DRAFT"] },
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.brandId ? { brandId: opts.brandId } : {}),
    ...(opts.modelId ? { modelId: opts.modelId } : {}),
    ...(barcode
      ? {
          OR: [{ barcode }, { variants: { some: { barcode, deletedAt: null } } }],
        }
      : {}),
  };

  if (q) {
    where.AND = [
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
          { model: { name: { contains: q, mode: "insensitive" } } },
          { variants: { some: { sku: { contains: q, mode: "insensitive" }, deletedAt: null } } },
          { variants: { some: { barcode: { contains: q, mode: "insensitive" }, deletedAt: null } } },
          { variants: { some: { title: { contains: q, mode: "insensitive" }, deletedAt: null } } },
        ],
      },
    ];
  }

  const rows = await prisma.product.findMany({
    where,
    take: limit,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      model: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true, path: true } },
      _count: { select: { variants: { where: { deletedAt: null, isActive: true } } } },
    },
  });

  const out = [];
  for (const p of rows) {
    const pathCrumbs = await getCategoryBreadcrumb({ categoryId: p.categoryId });
    out.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      mainImage: p.mainImage,
      barcode: p.barcode,
      status: p.status,
      brand: p.brand,
      model: p.model,
      category: p.category,
      categoryPath: pathCrumbs.map((c) => c.name).join(" › "),
      variantCount: p._count.variants,
    });
  }
  return out;
}

export async function getCatalogProduct(id: string) {
  return prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      brand: true,
      model: true,
      category: true,
      variants: {
        where: { deletedAt: null },
        orderBy: { title: "asc" },
        include: {
          values: {
            include: {
              attribute: { select: { id: true, name: true, slug: true, type: true } },
              option: { select: { id: true, label: true, value: true, colorCode: true } },
            },
          },
          _count: {
            select: { offers: { where: { status: "ACTIVE", deletedAt: null, stockQty: { gt: 0 } } } },
          },
        },
      },
    },
  });
}

export async function listProductVariants(productId: string) {
  return prisma.productVariant.findMany({
    where: { productId, deletedAt: null, isActive: true },
    orderBy: { title: "asc" },
    include: {
      values: {
        include: {
          attribute: { select: { id: true, name: true, slug: true } },
          option: { select: { id: true, label: true, value: true, colorCode: true } },
        },
      },
    },
  });
}

export async function findSimilarProducts(opts: {
  proposedName: string;
  categoryId?: string;
  brandId?: string;
  modelId?: string;
  barcode?: string;
  limit?: number;
}) {
  const norm = normalizeCatalogText(opts.proposedName);
  const tokens = norm.split(" ").filter((t) => t.length > 1).slice(0, 6);
  const barcode = String(opts.barcode || "").trim();

  const or: Prisma.ProductWhereInput[] = [];
  if (barcode) or.push({ barcode });
  if (opts.brandId && opts.modelId) {
    or.push({ brandId: opts.brandId, modelId: opts.modelId, deletedAt: null });
  }
  for (const t of tokens) {
    or.push({ name: { contains: t, mode: "insensitive" } });
  }

  if (!or.length) return [];

  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      OR: or,
    },
    take: Math.min(20, opts.limit || 10),
    include: {
      brand: { select: { name: true } },
      model: { select: { name: true } },
      category: { select: { name: true, slug: true } },
    },
  });

  return rows.map((p) => {
    const score =
      (barcode && p.barcode === barcode ? 100 : 0) +
      (opts.brandId && p.brandId === opts.brandId ? 30 : 0) +
      (opts.modelId && p.modelId === opts.modelId ? 30 : 0) +
      (normalizeCatalogText(p.name) === norm ? 40 : 0) +
      tokens.filter((t) => normalizeCatalogText(p.name).includes(t)).length * 5;
    return {
      id: p.id,
      name: p.name,
      brand: p.brand?.name || null,
      model: p.model?.name || null,
      category: p.category?.name || null,
      barcode: p.barcode,
      score,
    };
  }).sort((a, b) => b.score - a.score);
}

export async function createProductRequest(input: {
  requesterUserId: string;
  shopId?: string | null;
  categoryId: string;
  brandId?: string | null;
  modelId?: string | null;
  proposedName: string;
  barcode?: string | null;
  description?: string | null;
  attributesJson?: unknown;
  imageUrls?: string[];
}) {
  const cat = await prisma.category.findFirst({
    where: { id: input.categoryId, deletedAt: null },
  });
  if (!cat || !isShoppingCategorySlug(cat.slug)) {
    throw new Error("Yalnızca alışveriş kategorilerine ürün talebi açılabilir");
  }
  const name = String(input.proposedName || "").trim();
  if (!name) throw new Error("Ürün adı zorunlu");

  const { resolveListingVerticalFromDb } = await import("@/lib/listingVertical");
  const { assertUserMayPostVertical, VerticalAccessError } = await import(
    "@/core/guards/verticalAccessGuard"
  );
  const vertical = await resolveListingVerticalFromDb({
    categoryId: cat.id,
    categorySlug: cat.slug,
  });
  const fullUser = await prisma.user.findUnique({
    where: { id: input.requesterUserId },
    select: {
      id: true,
      accountType: true,
      commercialSubtypes: true,
      commercialStatus: true,
      profile: true,
      role: true,
    },
  });
  const shop = input.shopId
    ? await prisma.shop.findFirst({
        where: { id: input.shopId },
        select: { id: true, ownerId: true, isActive: true },
      })
    : await prisma.shop.findFirst({
        where: { ownerId: input.requesterUserId },
        select: { id: true, ownerId: true, isActive: true },
      });
  try {
    await assertUserMayPostVertical({
      user: fullUser || { id: input.requesterUserId },
      shop,
      vertical,
      action: "CREATE_PRODUCT_REQUEST",
      categoryId: cat.id,
    });
  } catch (e) {
    if (e instanceof VerticalAccessError) throw e;
    throw e;
  }

  return prisma.catalogProductRequest.create({
    data: {
      requesterUserId: input.requesterUserId,
      shopId: input.shopId || null,
      categoryId: input.categoryId,
      brandId: input.brandId || null,
      modelId: input.modelId || null,
      proposedName: name,
      barcode: input.barcode ? String(input.barcode).trim() : null,
      description: input.description ? String(input.description) : null,
      attributesJson: (input.attributesJson as Prisma.InputJsonValue) ?? undefined,
      imageUrls: input.imageUrls || [],
      status: "PENDING",
    },
  });
}

export async function listProductRequests(opts?: { status?: string }) {
  return prisma.catalogProductRequest.findMany({
    where: opts?.status ? { status: opts.status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      requester: { select: { id: true, name: true, phone: true } },
      mergedProduct: { select: { id: true, name: true } },
    },
  });
}

export async function approveProductRequest(
  requestId: string,
  adminId: string,
  opts?: {
    name?: string;
    description?: string | null;
    barcode?: string | null;
    mainImage?: string | null;
    variants?: Array<{
      title: string;
      sku?: string;
      barcode?: string | null;
      values: Array<{ attributeId: string; optionId?: string | null; textValue?: string | null }>;
    }>;
  }
) {
  const req = await prisma.catalogProductRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("Talep bulunamadı");
  if (req.status !== "PENDING" && req.status !== "DRAFT") {
    throw new Error("Talep onaylanamaz durumda");
  }

  const name = String(opts?.name || req.proposedName).trim();
  const slugBase = catalogSlugify(name) || `urun-${Date.now()}`;
  let slug = slugBase;
  let i = 1;
  while (await prisma.product.findFirst({ where: { categoryId: req.categoryId, slug } })) {
    slug = `${slugBase}-${++i}`;
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        categoryId: req.categoryId,
        brandId: req.brandId,
        modelId: req.modelId,
        name,
        slug,
        description: opts?.description ?? req.description,
        barcode: opts?.barcode ?? req.barcode,
        mainImage: opts?.mainImage || req.imageUrls?.[0] || null,
        status: "ACTIVE",
        managedByAdmin: true,
      },
    });

    const variants = opts?.variants || [];
    for (const v of variants) {
      const hash = buildAttributesHash(v.values || []);
      const sku =
        String(v.sku || "").trim() ||
        `${slug}-${catalogSlugify(v.title) || "var"}-${hash.slice(0, 8)}`;
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku,
          title: v.title,
          barcode: v.barcode || null,
          attributesHash: hash,
          isActive: true,
        },
      });
      for (const val of v.values || []) {
        await tx.productVariantValue.create({
          data: {
            variantId: variant.id,
            attributeId: val.attributeId,
            optionId: val.optionId || null,
            textValue: val.textValue || null,
          },
        });
      }
    }

    await tx.catalogProductRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        mergedProductId: product.id,
      },
    });

    return product;
  });
}

export async function rejectProductRequest(requestId: string, adminId: string, reason: string) {
  const req = await prisma.catalogProductRequest.findUnique({ where: { id: requestId } });
  if (!req || (req.status !== "PENDING" && req.status !== "DRAFT")) {
    throw new Error("Talep reddedilemez");
  }
  return prisma.catalogProductRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: String(reason || "").trim() || "Reddedildi",
    },
  });
}

export async function mergeProductRequest(requestId: string, adminId: string, productId: string) {
  const [req, product] = await Promise.all([
    prisma.catalogProductRequest.findUnique({ where: { id: requestId } }),
    prisma.product.findFirst({ where: { id: productId, deletedAt: null } }),
  ]);
  if (!req || req.status !== "PENDING") throw new Error("Talep birleştirilemez");
  if (!product) throw new Error("Hedef ürün yok");
  return prisma.catalogProductRequest.update({
    where: { id: requestId },
    data: {
      status: "MERGED",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      mergedProductId: product.id,
    },
  });
}

export async function findActiveOffer(shopId: string, variantId: string) {
  return prisma.sellerOffer.findFirst({
    where: {
      shopId,
      variantId,
      status: "ACTIVE",
      deletedAt: null,
    },
  });
}

export async function createSellerOffer(input: {
  sellerId: string;
  shopId: string;
  productId: string;
  variantId: string;
  priceTl: number;
  discountedPriceTl?: number | null;
  stockQty: number;
  shippingTimeDays?: number | null;
  shippingPriceTl?: number | null;
  warrantyType?: string | null;
  warrantyMonths?: number | null;
  invoiceAvailable?: boolean;
  condition?: string | null;
  sellerSku?: string | null;
  sellerNote?: string | null;
  /** Satıcı create'te ACTIVE gönderemez; yok sayılır */
  status?: SellerOfferStatus;
  createListingMirror?: boolean;
  city?: string;
  district?: string;
}) {
  const [product, variant, shop] = await Promise.all([
    prisma.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      include: { category: true, brand: true, model: true },
    }),
    prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId, deletedAt: null, isActive: true },
    }),
    prisma.shop.findFirst({ where: { id: input.shopId } }),
  ]);
  if (!product) throw new Error("Ürün bulunamadı");
  if (product.status !== "ACTIVE") throw new Error("Ürün aktif değil");
  if (!variant) throw new Error("Varyant bulunamadı");
  if (!shop || shop.ownerId !== input.sellerId) throw new Error("Mağaza yetkisi yok");
  if (!isShoppingCategorySlug(product.category.slug)) {
    throw new Error("Yalnızca alışveriş ürünlerine teklif bağlanır");
  }

  const { enforceSellerOfferVerticalAccess } = await import("@/core/guards/enforceVerticalAccess");
  const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
  try {
    await enforceSellerOfferVerticalAccess({
      userId: input.sellerId,
      shopId: shop.id,
      productCategoryId: product.categoryId,
      productCategorySlug: product.category.slug,
    });
  } catch (e) {
    if (e instanceof VerticalAccessError) throw e;
    throw e;
  }

  const existing = await findActiveOffer(input.shopId, input.variantId);
  if (existing) {
    const err = new Error("ACTIVE_OFFER_EXISTS") as Error & { offerId?: string };
    err.offerId = existing.id;
    throw err;
  }

  const price = tlToMinor(input.priceTl);
  const discountedPrice =
    input.discountedPriceTl != null ? tlToMinor(input.discountedPriceTl) : null;
  assertValidOfferPrices(price, discountedPrice);
  const stockQty = Math.max(0, Math.floor(Number(input.stockQty) || 0));
  // Moderasyon: her zaman PENDING_REVIEW (satıcı ACTIVE bypass edemez)
  const status: SellerOfferStatus = "PENDING_REVIEW";

  return prisma.$transaction(async (tx) => {
    let listingId: string | null = null;
    if (input.createListingMirror !== false) {
      const title = `${product.brand?.name ? product.brand.name + " " : ""}${product.name}${variant.title ? " · " + variant.title : ""}`.trim();
      const listingNo = await generateListingNo();
      const listing = await tx.listing.create({
        data: {
          listingNo,
          sellerId: input.sellerId,
          shopId: input.shopId,
          categoryId: product.categoryId,
          title: title.slice(0, 180),
          description: input.sellerNote || product.description || title,
          city: input.city || "Türkiye",
          district: input.district || null,
          askPrice: price,
          dealType: "SATILIK",
          status: "PENDING_REVIEW",
          coverImage: product.mainImage,
          images: product.mainImage ? [product.mainImage] : [],
          productId: product.id,
          variantId: variant.id,
          attributes: {
            brand: product.brand?.name || "",
            model: product.model?.name || "",
            condition: input.condition || "",
            catalogOffer: true,
            variantTitle: variant.title,
            sellerSku: input.sellerSku || "",
            stockQty,
            priceInKurus: true,
            outOfStock: stockQty <= 0,
          },
        },
      });
      listingId = listing.id;
    }

    const offer = await tx.sellerOffer.create({
      data: {
        productId: product.id,
        variantId: variant.id,
        sellerId: input.sellerId,
        shopId: input.shopId,
        listingId,
        sellerSku: input.sellerSku || null,
        sellerNote: input.sellerNote || null,
        price,
        discountedPrice,
        stockQty,
        shippingTimeDays: input.shippingTimeDays ?? null,
        shippingPrice:
          input.shippingPriceTl != null ? tlToMinor(input.shippingPriceTl) : null,
        warrantyType: input.warrantyType || null,
        warrantyMonths: input.warrantyMonths ?? null,
        invoiceAvailable: Boolean(input.invoiceAvailable),
        condition: input.condition || null,
        status,
      },
    });

    if (listingId) {
      await tx.listing.update({
        where: { id: listingId },
        data: { sellerOfferId: offer.id },
      });
      await syncListingMirrorFromOffer(tx, offer.id);
    }

    return offer;
  });
}

export async function updateSellerOffer(
  offerId: string,
  sellerId: string,
  input: Partial<{
    priceTl: number;
    discountedPriceTl: number | null;
    stockQty: number;
    shippingTimeDays: number | null;
    shippingPriceTl: number | null;
    warrantyType: string | null;
    warrantyMonths: number | null;
    invoiceAvailable: boolean;
    condition: string | null;
    sellerSku: string | null;
    sellerNote: string | null;
    status: SellerOfferStatus;
  }>
) {
  const offer = await prisma.sellerOffer.findFirst({
    where: { id: offerId, deletedAt: null },
  });
  if (!offer) throw new Error("Teklif bulunamadı");
  if (offer.sellerId !== sellerId) throw new Error("Yetkisiz");

  if (input.status != null) {
    assertSellerStatusTransition(offer.status, input.status);
  }

  const nextStock =
    input.stockQty != null ? Math.max(0, Math.floor(input.stockQty)) : offer.stockQty;

  let nextStatus = resolveStatusAfterStockChange({
    current: offer.status,
    nextStock,
    approvedAt: offer.approvedAt,
    explicitStatus: input.status,
  });

  // Stokla ACTIVE yalnızca SOLD_OUT+approvedAt yolundan
  if (input.status === "ACTIVE") {
    throw new CatalogCommerceError("FORBIDDEN_STATUS", "Satıcı ACTIVE yapamaz");
  }

  if (nextStatus === "ACTIVE") {
    const clash = await prisma.sellerOffer.findFirst({
      where: {
        shopId: offer.shopId,
        variantId: offer.variantId,
        status: "ACTIVE",
        deletedAt: null,
        NOT: { id: offerId },
      },
    });
    if (clash) throw new Error("Bu varyant için aktif teklifiniz zaten var");
  }

  const data: Prisma.SellerOfferUpdateInput = {};
  if (input.priceTl != null || input.discountedPriceTl !== undefined) {
    const price = input.priceTl != null ? tlToMinor(input.priceTl) : offer.price;
    const discounted =
      input.discountedPriceTl === undefined
        ? offer.discountedPrice
        : input.discountedPriceTl == null
          ? null
          : tlToMinor(input.discountedPriceTl);
    assertValidOfferPrices(price, discounted);
    if (input.priceTl != null) data.price = price;
    if (input.discountedPriceTl !== undefined) data.discountedPrice = discounted;
  }
  if (input.stockQty != null) data.stockQty = nextStock;
  if (input.shippingTimeDays !== undefined) data.shippingTimeDays = input.shippingTimeDays;
  if (input.shippingPriceTl !== undefined) {
    data.shippingPrice =
      input.shippingPriceTl == null ? null : tlToMinor(input.shippingPriceTl);
  }
  if (input.warrantyType !== undefined) data.warrantyType = input.warrantyType;
  if (input.warrantyMonths !== undefined) data.warrantyMonths = input.warrantyMonths;
  if (input.invoiceAvailable !== undefined) data.invoiceAvailable = input.invoiceAvailable;
  if (input.condition !== undefined) data.condition = input.condition;
  if (input.sellerSku !== undefined) data.sellerSku = input.sellerSku;
  if (input.sellerNote !== undefined) data.sellerNote = input.sellerNote;
  data.status = nextStatus;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sellerOffer.update({ where: { id: offerId }, data });
    await syncListingMirrorFromOffer(tx, offerId);
    return updated;
  });
}

/** Admin: Listing veya Offer onayı */
export async function approveCatalogOffer(offerId: string, adminId: string) {
  const offer = await prisma.sellerOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    include: { product: true, variant: true },
  });
  if (!offer) throw new Error("Teklif yok");
  if (offer.product.status !== "ACTIVE" || offer.product.deletedAt) {
    throw new Error("Ürün aktif değil");
  }
  if (!offer.variant.isActive || offer.variant.deletedAt) {
    throw new Error("Varyant aktif değil");
  }

  const nextStatus: SellerOfferStatus = offer.stockQty > 0 ? "ACTIVE" : "SOLD_OUT";
  if (nextStatus === "ACTIVE") {
    const clash = await findActiveOffer(offer.shopId, offer.variantId);
    if (clash && clash.id !== offer.id) throw new Error("Bu varyant için aktif teklif var");
  }

  return prisma.$transaction(async (tx) => {
    await tx.sellerOffer.update({
      where: { id: offerId },
      data: {
        status: nextStatus,
        approvedAt: new Date(),
        approvedBy: adminId,
      },
    });
    await syncListingMirrorFromOffer(tx, offerId);
    return tx.sellerOffer.findUniqueOrThrow({ where: { id: offerId } });
  });
}

export async function rejectCatalogOffer(offerId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.sellerOffer.update({
      where: { id: offerId },
      data: { status: "REJECTED", approvedBy: adminId },
    });
    await syncListingMirrorFromOffer(tx, offerId);
  });
}

export async function pauseOffersForProduct(productId: string) {
  const offers = await prisma.sellerOffer.findMany({
    where: { productId, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const o of offers) {
      await tx.sellerOffer.update({
        where: { id: o.id },
        data: { status: "PAUSED" },
      });
      await syncListingMirrorFromOffer(tx, o.id);
    }
  });
}

export async function pauseOffersForVariant(variantId: string) {
  const offers = await prisma.sellerOffer.findMany({
    where: { variantId, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const o of offers) {
      await tx.sellerOffer.update({
        where: { id: o.id },
        data: { status: "PAUSED" },
      });
      await syncListingMirrorFromOffer(tx, o.id);
    }
  });
}

export async function listOffersForProduct(productId: string, variantId?: string) {
  return prisma.sellerOffer.findMany({
    where: {
      productId,
      deletedAt: null,
      status: "ACTIVE",
      stockQty: { gt: 0 },
      ...(variantId ? { variantId } : {}),
    },
    orderBy: [{ discountedPrice: "asc" }, { price: "asc" }],
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      seller: { select: { id: true, name: true } },
      variant: { select: { id: true, title: true, sku: true } },
    },
  });
}

export async function assertOfferPurchasable(offerId: string) {
  const offer = await prisma.sellerOffer.findFirst({
    where: { id: offerId, deletedAt: null },
  });
  if (!offer) throw new Error("Teklif yok");
  if (offer.status !== "ACTIVE") throw new Error("Teklif aktif değil");
  if (offer.stockQty <= 0) throw new Error("Stok yok");
  return offer;
}

export async function adminCreateProduct(input: {
  categoryId: string;
  brandId?: string | null;
  modelId?: string | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
  mainImage?: string | null;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
}) {
  const cat = await prisma.category.findFirst({ where: { id: input.categoryId } });
  if (!cat || !isShoppingCategorySlug(cat.slug)) {
    throw new Error("Alışveriş kategorisi gerekli");
  }
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Ürün adı zorunlu");
  const slugBase = catalogSlugify(name) || `urun-${Date.now()}`;
  let slug = slugBase;
  let n = 1;
  while (await prisma.product.findFirst({ where: { categoryId: input.categoryId, slug } })) {
    slug = `${slugBase}-${++n}`;
  }
  return prisma.product.create({
    data: {
      categoryId: input.categoryId,
      brandId: input.brandId || null,
      modelId: input.modelId || null,
      name,
      slug,
      description: input.description || null,
      barcode: input.barcode || null,
      mainImage: input.mainImage || null,
      status: input.status || "ACTIVE",
      managedByAdmin: true,
    },
  });
}

export async function adminCreateVariant(input: {
  productId: string;
  title: string;
  sku?: string;
  barcode?: string | null;
  values: Array<{ attributeId: string; optionId?: string | null; textValue?: string | null }>;
}) {
  const product = await prisma.product.findFirst({ where: { id: input.productId, deletedAt: null } });
  if (!product) throw new Error("Ürün yok");
  const hash = buildAttributesHash(input.values || []);
  const exists = await prisma.productVariant.findFirst({
    where: { productId: product.id, attributesHash: hash, deletedAt: null },
  });
  if (exists) throw new Error("Bu özellik kombinasyonu zaten var");
  const sku =
    String(input.sku || "").trim() ||
    `${product.slug}-${catalogSlugify(input.title) || "v"}-${hash.slice(0, 8)}`;

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        title: input.title,
        sku,
        barcode: input.barcode || null,
        attributesHash: hash,
        isActive: true,
      },
    });
    for (const val of input.values || []) {
      await tx.productVariantValue.create({
        data: {
          variantId: variant.id,
          attributeId: val.attributeId,
          optionId: val.optionId || null,
          textValue: val.textValue || null,
        },
      });
    }
    return variant;
  });
}
