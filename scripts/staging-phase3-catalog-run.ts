/**
 * Staging Aşama 3 — allowlist YOK, tüm katalog mağazaları kapsamında hacim testi.
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npm run staging:phase3
 *
 * Production DB / NODE_ENV=production → reddedilir. Migration yok.
 * Ticaret kodu değiştirilmez — yalnız test verisi + flag + senaryolar.
 */
import "dotenv/config";
import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  EscrowStatus,
  CatalogProjectionJobStatus,
} from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import { setSetting, getSetting } from "../src/core/settings";
import {
  approveCatalogOffer,
  createSellerOffer,
} from "../src/core/services/catalog/catalogCommerceService";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import {
  completeEscrowPayment,
  createEscrowCheckout,
  adminRefund,
  adminRelease,
} from "../src/core/services/escrowService";
import { cancelExpiredCatalogOrder } from "../src/core/services/catalog/catalogOrderLifecycleService";
import {
  enqueueMirrorSyncJob,
  processDueCatalogProjectionJobs,
  __setTestForceMirrorSyncFail,
} from "../src/core/services/catalog/catalogProjectionJobService";
import { auditCatalogCheckoutConsistency } from "./audit-catalog-checkout-consistency";
import { CatalogCommerceError } from "../src/lib/catalogCommerce";
import { catalogSlugify } from "../src/lib/catalogSlug";
import type { SessionUser } from "../src/lib/auth";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TxRecord = {
  scenario: string;
  categoryLabel?: string;
  variantTags?: string[];
  shopId?: string;
  buyerId?: string;
  sellerOfferId?: string;
  orderId?: string;
  orderNo?: string;
  escrowDealId?: string;
  paymentId?: string;
  idempotencyKey?: string;
  orderStatus?: string;
  paymentStatus?: string;
  escrowStatus?: string;
  stockBefore?: number;
  stockAfter?: number;
  stockReleasedAt?: string | null;
  listingIdNull?: boolean;
  projectionJobStatus?: string | null;
  ok: boolean;
  detail?: string;
};

type CategoryLabel = "telefon" | "moda" | "beyaz-esya" | "mutfak" | "spor";

type OfferSeed = {
  id: string;
  categoryLabel: CategoryLabel;
  variantTags: string[];
  shopId: string;
};

// ---------------------------------------------------------------------------
// Helpers (pattern reused from phase1/phase2)
// ---------------------------------------------------------------------------

function sessionOf(
  u: { id: string; phone?: string | null; name?: string | null },
  role: "USER" | "ADMIN" = "USER"
): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || "STG",
    role,
    accountType: "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
}

async function snapshotTx(partial: TxRecord): Promise<TxRecord> {
  if (!partial.orderId) return partial;
  const order = await prisma.order.findUnique({
    where: { id: partial.orderId },
    include: { items: true, escrowDeal: true },
  });
  const payment = partial.paymentId
    ? await prisma.payment.findUnique({ where: { id: partial.paymentId } })
    : null;
  const deal = order?.escrowDeal;
  const item = order?.items[0];
  const offer = item
    ? await prisma.sellerOffer.findUnique({ where: { id: item.sellerOfferId } })
    : null;
  return {
    ...partial,
    orderNo: order?.orderNo || partial.orderNo,
    orderStatus: order?.status,
    paymentStatus: payment?.status,
    escrowStatus: deal?.status,
    stockAfter: offer?.stockQty,
    stockReleasedAt: item?.stockReleasedAt?.toISOString() || null,
    listingIdNull: deal ? deal.listingId == null : partial.listingIdNull,
  };
}

/** Aynı offer2phase2 helper: her seferinde stoğu ve durumu deterministik hale getirir. */
async function ensureOfferStock(offerId: string, qty: number) {
  await prisma.sellerOffer.update({
    where: { id: offerId },
    data: {
      stockQty: qty,
      status: "ACTIVE",
      deletedAt: null,
      listingId: null, // mirrorless
    },
  });
}

async function ensureShopOwner(shopId: string, ownerId: string) {
  await prisma.user.update({
    where: { id: ownerId },
    data: {
      accountType: "TICARI",
      commercialSubtypes: ["MAGAZA"],
      commercialStatus: "APPROVED",
      isActive: true,
    },
  });
  const pkg = await prisma.shopPackage.findFirst({ where: { isActive: true } });
  if (pkg) {
    await prisma.shopSubscription.upsert({
      where: { userId: ownerId },
      create: {
        userId: ownerId,
        shopId,
        packageId: pkg.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 90 * 86400000),
        isActive: true,
      },
      update: {
        shopId,
        packageId: pkg.id,
        endsAt: new Date(Date.now() + 90 * 86400000),
        isActive: true,
      },
    });
  }
}

async function main() {
  // ---- 1) Staging guard ----
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("STAGING_GUARD_OK", fp.maskedUrl, "prodLook=", fp.looksProduction);

  // ---- 2) Fresh baseline — Phase2 records must NOT count ----
  const phase3Since = new Date().toISOString();
  console.log("PHASE3_SINCE", phase3Since);

  // ---- 3) Flags ON (staging DB only; production DEFAULT_SETTINGS stays false) ----
  await setSetting("catalog_checkout_without_mirror", true);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);
  const flag = await getSetting<boolean>("catalog_checkout_without_mirror", false);
  console.log("FLAG catalog_checkout_without_mirror=", flag);
  if (flag !== true) throw new Error("staging flag not ON");

  const stamp = Date.now();
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("admin yok");
  const adminId: string = admin.id;

  const txs: TxRecord[] = [];
  const scenarioResults: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const recordScenario = (name: string, pass: boolean, detail = "") => {
    scenarioResults.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const categoryDistribution: Record<string, number> = {};
  const variantTagDistribution: Record<string, number> = {};
  function recordOfferUsage(offer: OfferSeed) {
    categoryDistribution[offer.categoryLabel] = (categoryDistribution[offer.categoryLabel] || 0) + 1;
    for (const tag of offer.variantTags) {
      variantTagDistribution[tag] = (variantTagDistribution[tag] || 0) + 1;
    }
  }

  // =========================================================================
  // 4) Seed diverse catalog for Phase3
  // =========================================================================

  async function ensureUser(phone: string, name: string) {
    const existing = await prisma.user.findFirst({ where: { phone } });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        phone,
        name,
        role: "USER",
        accountType: "BIREYSEL_TICARI",
        isActive: true,
      },
    });
  }

  function p3Phone(seq: number) {
    // 0597 + 7 haneli — stamp bazlı benzersiz
    return `0597${String(stamp + seq).slice(-7)}`;
  }

  async function ensureShop(ownerId: string, name: string, slug: string) {
    let shop = await prisma.shop.findFirst({ where: { ownerId } });
    const tenant = await prisma.tenant.findFirst();
    if (!shop) {
      if (!tenant) throw new Error("tenant yok — shop oluşturulamaz");
      shop = await prisma.shop.create({
        data: {
          ownerId,
          name,
          slug: `${slug}-${stamp}`.slice(0, 60),
          isActive: true,
          tenantId: tenant.id,
          accountType: "TICARI",
        },
      });
    } else {
      await prisma.shop.update({ where: { id: shop.id }, data: { name, isActive: true } });
    }
    await ensureShopOwner(shop.id, ownerId);
    return shop;
  }

  /** Var olan alışveriş kategorisini bulur (slug/isim içerir), yoksa shopping root altında yeni leaf oluşturur. */
  async function ensureShoppingCategory(keyword: string, name: string) {
    const shoppingRootFilter = {
      OR: [{ slug: { startsWith: "ikinci-el" } }, { slug: { startsWith: "sifir-urun" } }],
    };
    const byKeyword = await prisma.category.findFirst({
      where: {
        deletedAt: null,
        AND: [
          shoppingRootFilter,
          {
            OR: [
              { slug: { contains: keyword, mode: "insensitive" } },
              { name: { contains: name, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { level: "desc" },
    });
    if (byKeyword) return byKeyword;

    const anyShopping = await prisma.category.findFirst({
      where: { deletedAt: null, ...shoppingRootFilter },
    });
    if (anyShopping) return anyShopping;

    // Fallback: shopping root altında yeni leaf (migration gerekmez)
    const slug = `sifir-urun-p3-${catalogSlugify(keyword)}-${stamp}`;
    return prisma.category.create({ data: { slug, name, level: 1, path: slug } });
  }

  async function makeProductWithVariants(opts: {
    categoryId: string;
    brandId?: string | null;
    name: string;
    variantTitles: string[];
  }) {
    const slugBase = catalogSlugify(opts.name) || `stg-p3-${stamp}`;
    const product = await prisma.product.create({
      data: {
        name: opts.name,
        slug: `${slugBase}-${stamp}-${Math.random().toString(36).slice(2, 7)}`,
        categoryId: opts.categoryId,
        brandId: opts.brandId || undefined,
        status: "ACTIVE",
        description: "Staging phase3 test product",
      },
    });
    const variants = [];
    for (let i = 0; i < opts.variantTitles.length; i++) {
      const v = await prisma.productVariant.create({
        data: {
          productId: product.id,
          title: opts.variantTitles[i],
          sku: `STGP3-${stamp}-${product.id.slice(-6)}-${i}`,
          isActive: true,
          attributesHash: `stg-p3-${stamp}-${product.id.slice(-6)}-${i}`,
        },
      });
      variants.push(v);
    }
    return { product, variants };
  }

  async function makeMirrorlessOffer(opts: {
    sellerId: string;
    shopId: string;
    productId: string;
    variantId: string;
    priceTl: number;
    discountedPriceTl?: number | null;
    stockQty: number;
    shippingPriceTl?: number | null;
  }) {
    const offer = await createSellerOffer({
      sellerId: opts.sellerId,
      shopId: opts.shopId,
      productId: opts.productId,
      variantId: opts.variantId,
      priceTl: opts.priceTl,
      discountedPriceTl: opts.discountedPriceTl ?? null,
      stockQty: opts.stockQty,
      shippingPriceTl: opts.shippingPriceTl ?? null,
      createListingMirror: false,
      city: "İstanbul",
    });
    await approveCatalogOffer(offer.id, adminId);
    return prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } });
  }

  // --- Users: sellers (5, one per category shop) + buyers (10) — all STG P3 / 0597* ---
  const brand = await prisma.brand.findFirst();

  const categorySpecs: Array<{ label: CategoryLabel; keyword: string; name: string }> = [
    { label: "telefon", keyword: "telefon", name: "Telefon" },
    { label: "moda", keyword: "moda", name: "Moda" },
    { label: "beyaz-esya", keyword: "beyaz-esya", name: "Beyaz Eşya" },
    { label: "mutfak", keyword: "mutfak", name: "Mutfak" },
    { label: "spor", keyword: "spor", name: "Spor" },
  ];

  const categories = {} as Record<CategoryLabel, { id: string; slug: string; name: string }>;
  const shops = {} as Record<CategoryLabel, { id: string; ownerId: string; name: string }>;
  let sellerSeq = 0;
  for (const spec of categorySpecs) {
    categories[spec.label] = await ensureShoppingCategory(spec.keyword, spec.name);
    sellerSeq++;
    const seller = await ensureUser(p3Phone(sellerSeq), `STG P3 Seller ${spec.name}`);
    const shop = await ensureShop(seller.id, `STG P3 Mağaza ${spec.name}`, `stg-p3-${spec.label}`);
    shops[spec.label] = { id: shop.id, ownerId: seller.id, name: shop.name };
  }

  const buyers: Array<{ id: string; phone: string | null; name: string | null }> = [];
  for (let i = 1; i <= 10; i++) {
    buyers.push(await ensureUser(p3Phone(100 + i), `STG P3 Buyer ${i}`));
  }

  // Free listing slots for phase3 sellers so classic escrow listings don't clash
  await prisma.listing.updateMany({
    where: {
      sellerId: { in: Object.values(shops).map((s) => s.ownerId) },
      status: { in: ["ACTIVE", "PENDING_REVIEW", "DRAFT", "SELECTION"] },
    },
    data: { status: "EXPIRED" },
  });

  // --- Products / variants / offers (all mirrorless: listingId null) ---
  const offerSeeds: OfferSeed[] = [];
  const seedCounts = { products: 0, variants: 0, offers: 0, offersMirrorless: 0 };

  async function seedOffer(
    categoryLabel: CategoryLabel,
    productName: string,
    variantTitle: string,
    priceTl: number,
    stockQty: number,
    opts: { discountedPriceTl?: number | null; shippingPriceTl?: number | null; extraVariantTitles?: string[] },
    variantTags: string[]
  ): Promise<OfferSeed> {
    const shop = shops[categoryLabel];
    const titles = [variantTitle, ...(opts.extraVariantTitles || [])];
    const { product, variants } = await makeProductWithVariants({
      categoryId: categories[categoryLabel].id,
      brandId: brand?.id,
      name: productName,
      variantTitles: titles,
    });
    seedCounts.products++;
    seedCounts.variants += titles.length;
    const offer = await makeMirrorlessOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: product.id,
      variantId: variants[0].id,
      priceTl,
      discountedPriceTl: opts.discountedPriceTl ?? null,
      stockQty,
      shippingPriceTl: opts.shippingPriceTl ?? null,
    });
    seedCounts.offers++;
    if (!offer.listingId) seedCounts.offersMirrorless++;
    const seed: OfferSeed = { id: offer.id, categoryLabel, variantTags, shopId: shop.id };
    offerSeeds.push(seed);
    return seed;
  }

  // Telefon — storage+color (2 variants → 2 offers on same product)
  {
    const shop = shops.telefon;
    const { product, variants } = await makeProductWithVariants({
      categoryId: categories.telefon.id,
      brandId: brand?.id,
      name: `STG P3 Telefon Model ${stamp}`,
      variantTitles: ["128GB Siyah", "256GB Mavi"],
    });
    seedCounts.products++;
    seedCounts.variants += 2;
    for (let i = 0; i < variants.length; i++) {
      const offer = await makeMirrorlessOffer({
        sellerId: shop.ownerId,
        shopId: shop.id,
        productId: product.id,
        variantId: variants[i].id,
        priceTl: 15000 + i * 3000,
        stockQty: 20,
      });
      seedCounts.offers++;
      if (!offer.listingId) seedCounts.offersMirrorless++;
      offerSeeds.push({ id: offer.id, categoryLabel: "telefon", variantTags: ["storage+color"], shopId: shop.id });
    }
  }

  // Moda — size+color (3 variants → 3 offers; free shipping / paid shipping / low stock)
  {
    const shop = shops.moda;
    const { product, variants } = await makeProductWithVariants({
      categoryId: categories.moda.id,
      brandId: brand?.id,
      name: `STG P3 Tişört ${stamp}`,
      variantTitles: ["S Kırmızı", "M Mavi", "L Yeşil"],
    });
    seedCounts.products++;
    seedCounts.variants += 3;

    const o1 = await makeMirrorlessOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: product.id,
      variantId: variants[0].id,
      priceTl: 250,
      stockQty: 30,
      shippingPriceTl: 0,
    });
    seedCounts.offers++;
    if (!o1.listingId) seedCounts.offersMirrorless++;
    offerSeeds.push({ id: o1.id, categoryLabel: "moda", variantTags: ["size+color", "free-shipping"], shopId: shop.id });

    const o2 = await makeMirrorlessOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: product.id,
      variantId: variants[1].id,
      priceTl: 260,
      stockQty: 25,
      shippingPriceTl: 20,
    });
    seedCounts.offers++;
    if (!o2.listingId) seedCounts.offersMirrorless++;
    offerSeeds.push({ id: o2.id, categoryLabel: "moda", variantTags: ["size+color", "paid-shipping"], shopId: shop.id });

    const o3 = await makeMirrorlessOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: product.id,
      variantId: variants[2].id,
      priceTl: 270,
      stockQty: 1,
    });
    seedCounts.offers++;
    if (!o3.listingId) seedCounts.offersMirrorless++;
    offerSeeds.push({ id: o3.id, categoryLabel: "moda", variantTags: ["size+color", "low-stock"], shopId: shop.id });
  }

  // Beyaz eşya — single no-variant-extra + discounted price
  await seedOffer(
    "beyaz-esya",
    `STG P3 Buzdolabı ${stamp}`,
    "Standart",
    12000,
    15,
    {},
    ["single"]
  );
  await seedOffer(
    "beyaz-esya",
    `STG P3 Çamaşır Makinesi ${stamp}`,
    "Standart",
    9000,
    10,
    { discountedPriceTl: 7500 },
    ["single", "discounted"]
  );

  // Mutfak — stock 0 (seed-only, never checked out) + paid shipping
  const mutfakStockZero = await seedOffer(
    "mutfak",
    `STG P3 Tencere Seti ${stamp}`,
    "6 Parça",
    500,
    0,
    {},
    ["single", "stock-zero"]
  );
  await seedOffer(
    "mutfak",
    `STG P3 Blender ${stamp}`,
    "Standart",
    600,
    20,
    { shippingPriceTl: 15 },
    ["single", "paid-shipping"]
  );

  // Spor — free shipping + discounted price + low stock
  await seedOffer(
    "spor",
    `STG P3 Bisiklet ${stamp}`,
    "Standart",
    3000,
    20,
    { shippingPriceTl: 0 },
    ["single", "free-shipping"]
  );
  await seedOffer(
    "spor",
    `STG P3 Koşu Bandı ${stamp}`,
    "Pro",
    8000,
    15,
    { discountedPriceTl: 6500 },
    ["single", "discounted"]
  );
  await seedOffer(
    "spor",
    `STG P3 Dambıl Seti ${stamp}`,
    "Mini",
    1200,
    2,
    {},
    ["single", "low-stock"]
  );

  // Rotation pool excludes the deliberate stock-0 offer (kept untouched as a real example)
  const rotationOffers = offerSeeds.filter((o) => o.id !== mutfakStockZero.id);
  if (rotationOffers.length < 10) {
    throw new Error(`expected >=10 usable offers, got ${rotationOffers.length}`);
  }

  const seedSummary = {
    ...seedCounts,
    categoryIds: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.id])),
    shopIds: Object.values(shops).map((s) => s.id),
    offerIds: offerSeeds.map((o) => o.id),
    mirrorlessOfferCount: offerSeeds.length, // all offers are mirrorless in phase3
    buyerIds: buyers.map((b) => b.id),
    adminId,
  };
  console.log("SEED", JSON.stringify(seedSummary, null, 2));
  recordScenario(
    "SEED >=10 mirrorless offers",
    offerSeeds.length >= 10,
    `offers=${offerSeeds.length}`
  );

  // Rotation cursors
  let offerCursor = 0;
  function nextOffer(): OfferSeed {
    const o = rotationOffers[offerCursor % rotationOffers.length];
    offerCursor++;
    recordOfferUsage(o);
    return o;
  }
  let buyerCursor = 0;
  function nextBuyer() {
    const b = buyers[buyerCursor % buyers.length];
    buyerCursor++;
    return b;
  }

  // =========================================================================
  // 5) Volume scenarios
  // =========================================================================

  let successCount = 0;
  let timeoutCount = 0;
  let replayCount = 0;
  let refundCount = 0;
  let releaseCount = 0;
  let priceChangedCount = 0;
  let raceOkCount = 0;
  let projectionRetryOkCount = 0;

  // --- A: 50 successful checkouts ---
  for (let i = 0; i < 50; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 5);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const key = `p3-ok-${stamp}-${i}`;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    let row: TxRecord = {
      scenario: "A_success",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      orderNo: co.order.orderNo,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      idempotencyKey: key,
      stockBefore,
      listingIdNull: true,
      ok: true,
    };
    row = await snapshotTx(row);
    row.ok = row.orderStatus === OrderStatus.PAID && row.paymentStatus === PaymentStatus.PAID;
    txs.push(row);
    if (row.ok) successCount++;
  }
  recordScenario("A success >=50", successCount >= 50, `success=${successCount}`);

  // --- B: 10 timeout + stock restore ---
  for (let i = 0; i < 10; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 3);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const key = `p3-to-${stamp}-${i}`;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const r = await cancelExpiredCatalogOrder(co.order.id);
    let row: TxRecord = {
      scenario: "B_timeout",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      idempotencyKey: key,
      stockBefore,
      ok: r.ok,
    };
    row = await snapshotTx(row);
    row.ok =
      row.orderStatus === OrderStatus.CANCELLED &&
      Boolean(row.stockReleasedAt) &&
      row.stockAfter === stockBefore;
    txs.push(row);
    if (row.ok) timeoutCount++;
  }
  recordScenario("B timeout+restore >=10", timeoutCount >= 10, `timeout=${timeoutCount}`);

  // --- C: 10 idempotency replay ---
  for (let i = 0; i < 10; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 4);
    const key = `p3-idemp-${stamp}-${i}`;
    const c1 = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    const c2 = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    const count = await prisma.order.count({ where: { buyerId: buyer.id, idempotencyKey: key } });
    let row: TxRecord = {
      scenario: "C_idempotency",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: c1.order.id,
      escrowDealId: c1.deal.id,
      paymentId: c1.payment.id,
      idempotencyKey: key,
      ok: c1.order.id === c2.order.id && count === 1 && Boolean(c2.idempotentReplay),
      detail: `replay=${c2.idempotentReplay} count=${count}`,
    };
    row = await snapshotTx(row);
    txs.push(row);
    if (row.ok) replayCount++;
  }
  recordScenario("C idempotency replay >=10", replayCount >= 10, `replay=${replayCount}`);

  // --- D: 3 refunds ---
  for (let i = 0; i < 3; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 2);
    const key = `p3-refund-${stamp}-${i}`;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    await adminRefund(co.deal.id, adminId, "phase3 refund test");
    let row: TxRecord = {
      scenario: "D_refund",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      idempotencyKey: key,
      ok: false,
    };
    row = await snapshotTx(row);
    row.ok = row.escrowStatus === EscrowStatus.REFUNDED;
    txs.push(row);
    if (row.ok) refundCount++;
  }
  recordScenario("D refund >=3", refundCount >= 3, `refund=${refundCount}`);

  // --- E: 3 releases ---
  for (let i = 0; i < 3; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 2);
    const key = `p3-release-${stamp}-${i}`;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: key,
    });
    await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    await adminRelease(co.deal.id, adminId, "phase3 release test");
    let row: TxRecord = {
      scenario: "E_release",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      idempotencyKey: key,
      ok: false,
    };
    row = await snapshotTx(row);
    row.ok = row.escrowStatus === EscrowStatus.RELEASED;
    txs.push(row);
    if (row.ok) releaseCount++;
  }
  recordScenario("E release >=3", releaseCount >= 3, `release=${releaseCount}`);

  // --- F: 5 PRICE_CHANGED ---
  for (let i = 0; i < 5; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 2);
    const stockBefore = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    let code = "";
    try {
      await checkoutCatalogOffer({
        buyer: { id: buyer.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        expectedEffectiveUnitPriceMinor: BigInt(1), // deliberately wrong
        idempotencyKey: `p3-price-${stamp}-${i}`,
      });
    } catch (e) {
      code = e instanceof CatalogCommerceError ? e.code : "OTHER";
    }
    const stockAfter = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const ok = code === "PRICE_CHANGED" && stockAfter === stockBefore;
    txs.push({
      scenario: "F_price_changed",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      stockBefore,
      stockAfter,
      ok,
      detail: `code=${code}`,
    });
    if (ok) priceChangedCount++;
  }
  recordScenario("F PRICE_CHANGED >=5", priceChangedCount >= 5, `priceChanged=${priceChangedCount}`);

  // --- G: 5 concurrent last-stock races (stock=1, 2 parallel checkouts → 1 win 1 fail) ---
  for (let i = 0; i < 5; i++) {
    const offer = nextOffer();
    await ensureOfferStock(offer.id, 1);
    const b1 = nextBuyer();
    let b2 = nextBuyer();
    if (b2.id === b1.id) b2 = nextBuyer();
    const results = await Promise.allSettled([
      checkoutCatalogOffer({
        buyer: { id: b1.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: `p3-race-a-${stamp}-${i}`,
      }).then((co) => ({ co, buyer: b1 })),
      checkoutCatalogOffer({
        buyer: { id: b2.id },
        sellerOfferId: offer.id,
        quantity: 1,
        shipDays: 7,
        idempotencyKey: `p3-race-b-${stamp}-${i}`,
      }).then((co) => ({ co, buyer: b2 })),
    ]);
    const okOnes = results.filter((r) => r.status === "fulfilled").length;
    const failOnes = results.filter((r) => r.status === "rejected").length;
    const stock = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const ok = okOnes === 1 && failOnes === 1 && stock === 0;
    txs.push({
      scenario: "G_race",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      sellerOfferId: offer.id,
      stockAfter: stock,
      ok,
      detail: `ok=${okOnes} fail=${failOnes} stock=${stock}`,
    });
    if (ok) raceOkCount++;
    for (const r of results) {
      if (r.status === "fulfilled") {
        await completeEscrowPayment(sessionOf(r.value.buyer), r.value.co.payment.id);
      }
    }
  }
  recordScenario("G concurrent races >=5 (1 win/1 fail)", raceOkCount >= 5, `races=${raceOkCount}`);

  // --- H: 5 projection retry (force fail then processDue until COMPLETED) ---
  for (let i = 0; i < 5; i++) {
    const offer = nextOffer();
    const buyer = nextBuyer();
    await ensureOfferStock(offer.id, 2);
    __setTestForceMirrorSyncFail(true);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `p3-proj-${stamp}-${i}`,
    });
    __setTestForceMirrorSyncFail(false);
    const job =
      (await prisma.catalogProjectionJob.findFirst({
        where: { sellerOfferId: offer.id },
        orderBy: { createdAt: "desc" },
      })) || (await enqueueMirrorSyncJob({ sellerOfferId: offer.id, reason: "phase3" }));
    await prisma.catalogProjectionJob.update({
      where: { id: job.id },
      data: {
        status: CatalogProjectionJobStatus.PENDING,
        nextAttemptAt: new Date(),
        attempts: 0,
        completedAt: null,
        lastError: null,
      },
    });
    await processDueCatalogProjectionJobs({ forceJobId: job.id, limit: 1 });
    const after = await prisma.catalogProjectionJob.findUnique({ where: { id: job.id } });
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    const ok =
      after?.status === CatalogProjectionJobStatus.COMPLETED &&
      order?.status === OrderStatus.PENDING_PAYMENT;
    txs.push({
      scenario: "H_projection_retry",
      categoryLabel: offer.categoryLabel,
      variantTags: offer.variantTags,
      shopId: offer.shopId,
      buyerId: buyer.id,
      sellerOfferId: offer.id,
      orderId: co.order.id,
      escrowDealId: co.deal.id,
      paymentId: co.payment.id,
      projectionJobStatus: after?.status || null,
      ok,
    });
    if (ok) projectionRetryOkCount++;
  }
  recordScenario(
    "H projection retry >=5",
    projectionRetryOkCount >= 5,
    `retry=${projectionRetryOkCount}`
  );

  // --- I: Classic escrow — 1 emlak + 1 vasita (listingId set, orderId null) ---
  async function classicEscrowScenario(name: string, keyword: string) {
    const buyer = nextBuyer();
    const sellerShop = Object.values(shops)[0];
    let listing = await prisma.listing.findFirst({
      where: {
        sellerOfferId: null,
        status: "ACTIVE",
        escrowEligible: true,
        sellerId: { not: buyer.id },
        category: { slug: { contains: keyword } },
      },
    });
    if (!listing) {
      const cat =
        (await prisma.category.findFirst({ where: { slug: { contains: keyword } } })) ||
        (await prisma.category.findFirst());
      listing = await prisma.listing.create({
        data: {
          listingNo: `P3-${name.toUpperCase()}-${stamp}`,
          sellerId: sellerShop.ownerId,
          categoryId: cat!.id,
          title: `STG P3 klasik escrow — ${name}`,
          description: `staging phase3 classic ${name}`,
          city: "Ankara",
          askPrice: BigInt(500),
          status: "ACTIVE",
          durationDays: 7,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 7 * 86400000),
          escrowEligible: true,
        },
      });
    }
    const r = await createEscrowCheckout(sessionOf(buyer), listing.id, 7);
    const deal = r.ok ? await prisma.escrowDeal.findUnique({ where: { id: r.dealId } }) : null;
    const ok = Boolean(r.ok) && Boolean(deal?.listingId) && deal?.orderId == null;
    txs.push({
      scenario: `I_classic_${name}`,
      buyerId: buyer.id,
      ok,
      detail: `listingId=${Boolean(deal?.listingId)} orderId=${deal?.orderId}`,
    });
    recordScenario(`I classic escrow (${name})`, ok, `listingId=${Boolean(deal?.listingId)}`);
  }
  await classicEscrowScenario("emlak", "emlak");
  await classicEscrowScenario("vasita", "vasita");

  // =========================================================================
  // 6/7/8) Drain projection queue + compute stats since baseline
  // =========================================================================
  for (let round = 0; round < 10; round++) {
    const r = await processDueCatalogProjectionJobs({ limit: 100 });
    if (r.scanned === 0) break;
  }

  const projectionJobsSince = await prisma.catalogProjectionJob.findMany({
    where: { createdAt: { gte: new Date(phase3Since) } },
  });
  const projectionStats = {
    total: projectionJobsSince.length,
    completed: projectionJobsSince.filter((j) => j.status === CatalogProjectionJobStatus.COMPLETED)
      .length,
    pendingOrRetry: projectionJobsSince.filter(
      (j) =>
        j.status === CatalogProjectionJobStatus.PENDING ||
        j.status === CatalogProjectionJobStatus.PROCESSING
    ).length,
    failed: projectionJobsSince.filter((j) => j.status === CatalogProjectionJobStatus.FAILED).length,
    avgAttempts: projectionJobsSince.length
      ? Number(
          (
            projectionJobsSince.reduce((s, j) => s + j.attempts, 0) / projectionJobsSince.length
          ).toFixed(2)
        )
      : 0,
    maxWaitMs: projectionJobsSince.reduce((max, j) => {
      if (!j.completedAt) return max;
      return Math.max(max, j.completedAt.getTime() - j.createdAt.getTime());
    }, 0),
  };
  console.log("PROJECTION_STATS", JSON.stringify(projectionStats));

  // =========================================================================
  // 9) Audit — phase3 scope (since-only, no allowlist)
  // =========================================================================
  const audit = await auditCatalogCheckoutConsistency({ scope: "phase3", since: phase3Since });

  const failedJobs = await prisma.catalogProjectionJob.count({
    where: { status: CatalogProjectionJobStatus.FAILED, createdAt: { gte: new Date(phase3Since) } },
  });
  const negStock = await prisma.sellerOffer.count({ where: { stockQty: { lt: 0 } } });

  // =========================================================================
  // 10) Exit criteria
  // =========================================================================
  recordScenario("AUDIT critical=0", audit.summary.criticalCount === 0, `c=${audit.summary.criticalCount}`);
  recordScenario("FAILED jobs=0 (since baseline)", failedJobs === 0, `failed=${failedJobs}`);
  recordScenario("neg stock=0", negStock === 0, `neg=${negStock}`);
  recordScenario(
    "TOTAL success>=50",
    successCount >= 50,
    `success=${successCount}`
  );
  recordScenario("TOTAL timeout>=10", timeoutCount >= 10, `timeout=${timeoutCount}`);
  recordScenario("TOTAL replay>=10", replayCount >= 10, `replay=${replayCount}`);
  recordScenario("TOTAL refund>=3", refundCount >= 3, `refund=${refundCount}`);
  recordScenario("TOTAL release>=3", releaseCount >= 3, `release=${releaseCount}`);
  recordScenario("TOTAL priceChanged>=5", priceChangedCount >= 5, `priceChanged=${priceChangedCount}`);
  recordScenario("TOTAL races>=5", raceOkCount >= 5, `races=${raceOkCount}`);
  recordScenario(
    "TOTAL projectionRetry>=5",
    projectionRetryOkCount >= 5,
    `retry=${projectionRetryOkCount}`
  );

  // =========================================================================
  // 11) Write reports
  // =========================================================================
  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    db: fp,
    phase3Since,
    flag: true,
    seed: seedSummary,
    totals: {
      successCount,
      timeoutCount,
      replayCount,
      refundCount,
      releaseCount,
      priceChangedCount,
      raceOkCount,
      projectionRetryOkCount,
    },
    categoryDistribution,
    variantTagDistribution,
    projectionStats,
    scenarioResults,
    transactions: txs,
    audit,
    failedJobs,
    negStock,
  };
  fs.writeFileSync(
    path.join(outDir, "staging-phase3-report.json"),
    JSON.stringify(report, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );
  fs.writeFileSync(
    path.join(outDir, "catalog-checkout-consistency-phase3.json"),
    JSON.stringify(audit, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );

  // =========================================================================
  // 12) Console PASS/FAIL
  // =========================================================================
  const failedScenarios = scenarioResults.filter((s) => !s.pass);
  console.log(
    `\nPhase3 scenarios ${scenarioResults.filter((s) => s.pass).length}/${scenarioResults.length}`
  );
  console.log("TOTALS", report.totals);
  console.log("CATEGORY_DISTRIBUTION", categoryDistribution);
  console.log("VARIANT_TAG_DISTRIBUTION", variantTagDistribution);
  if (failedScenarios.length) {
    console.error("Failed scenarios:", failedScenarios.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("\nPHASE3 PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
