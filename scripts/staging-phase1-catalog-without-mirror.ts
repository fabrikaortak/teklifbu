/**
 * Staging Aşama 1 — catalog_checkout_without_mirror kontrollü doğrulama
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING npm run staging:phase1
 * (localhost için: ALLOW_LOCAL_STAGING=1 STAGING_CONFIRMATION=I_CONFIRM_STAGING)
 *
 * Production DB / NODE_ENV=production → reddedilir.
 * Migration yok. Ticaret kodu değiştirilmez — yalnız test verisi + flag + senaryolar.
 */
import "dotenv/config";
import { PrismaClient, OrderStatus, PaymentStatus, CatalogProjectionJobStatus } from "@prisma/client";
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
} from "../src/core/services/escrowService";
import { cancelExpiredCatalogOrder } from "../src/core/services/catalog/catalogOrderLifecycleService";
import {
  processDueCatalogProjectionJobs,
  __setTestForceMirrorSyncFail,
} from "../src/core/services/catalog/catalogProjectionJobService";
import { auditCatalogCheckoutConsistency } from "./audit-catalog-checkout-consistency";
import type { SessionUser } from "../src/lib/auth";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type Row = { name: string; pass: boolean; detail?: string };
const results: Row[] = [];

function record(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function sessionOf(u: { id: string; phone?: string | null; name?: string | null }, role: "USER" | "ADMIN" = "USER"): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || "Staging",
    role,
    accountType: "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
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
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("STAGING_GUARD_OK", JSON.stringify(fp, null, 2));

  // Flag ON (staging only)
  await setSetting("catalog_checkout_without_mirror", true);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);
  const flag = await getSetting<boolean>("catalog_checkout_without_mirror", false);
  console.log("FLAG catalog_checkout_without_mirror=", flag);
  if (flag !== true) throw new Error("Failed to enable staging flag");

  const stamp = Date.now();
  const created = {
    users: 0,
    shops: 0,
    products: 0,
    variants: 0,
    offers: 0,
    offersMirrorless: 0,
  };

  // --- seed users ---
  const admin =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ||
    (await prisma.user.create({
      data: {
        phone: `0599${String(stamp).slice(-7)}`,
        name: "STG Admin",
        role: "ADMIN",
        accountType: "BIREYSEL_TICARI",
        isActive: true,
      },
    }));
  if (!(await prisma.user.findFirst({ where: { id: admin.id, role: "ADMIN" } }))) created.users++;

  async function ensureUser(phone: string, name: string) {
    const existing = await prisma.user.findFirst({ where: { phone } });
    if (existing) return existing;
    created.users++;
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

  const seller1 = await ensureUser(`0591${String(stamp).slice(-7)}`, "STG Seller 1");
  const seller2 = await ensureUser(`0592${String(stamp).slice(-7)}`, "STG Seller 2");
  const buyer = await ensureUser(`0593${String(stamp).slice(-7)}`, "STG Buyer");

  const tenant = await prisma.tenant.findFirst();
  const category =
    (await prisma.category.findFirst({
      where: { OR: [{ slug: { contains: "telefon" } }, { slug: { contains: "elektronik" } }] },
    })) || (await prisma.category.findFirst());
  if (!category) throw new Error("category yok");

  async function ensureShop(ownerId: string, name: string, slug: string) {
    let shop = await prisma.shop.findFirst({ where: { ownerId } });
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
      created.shops++;
    } else {
      await prisma.shop.update({
        where: { id: shop.id },
        data: { name, isActive: true },
      });
    }
    await ensureShopOwner(shop.id, ownerId);
    return shop;
  }

  const shop1 = await ensureShop(seller1.id, "STG Test Magaza 1", "stg-m1");
  const shop2 = await ensureShop(seller2.id, "STG Test Magaza 2", "stg-m2");

  // Free listing slots for sellers
  await prisma.listing.updateMany({
    where: {
      sellerId: { in: [seller1.id, seller2.id] },
      status: { in: ["ACTIVE", "PENDING_REVIEW", "DRAFT", "SELECTION"] },
    },
    data: { status: "EXPIRED" },
  });

  // Products / variants (reuse brand if any)
  const brand = await prisma.brand.findFirst();
  const products = [];
  for (let i = 0; i < 3; i++) {
    const p = await prisma.product.create({
      data: {
        name: `STG Product ${i + 1} ${stamp}`,
        slug: `stg-p-${stamp}-${i}`,
        categoryId: category.id,
        brandId: brand?.id,
        status: "ACTIVE",
        description: "Staging phase1 test product",
      },
    });
    created.products++;
    products.push(p);
    for (let v = 0; v < 2; v++) {
      if (i === 2 && v === 1) break; // 5 variants total: 2+2+1
      await prisma.productVariant.create({
        data: {
          productId: p.id,
          title: `Varyant ${v + 1}`,
          sku: `STG-${stamp}-${i}-${v}`,
          isActive: true,
          attributesHash: `stg-${stamp}-${i}-${v}`,
        },
      });
      created.variants++;
    }
  }

  const allVariants = await prisma.productVariant.findMany({
    where: { productId: { in: products.map((p) => p.id) }, deletedAt: null },
  });
  if (allVariants.length < 5) throw new Error(`expected >=5 variants got ${allVariants.length}`);

  // 5 offers: first 2 mirrorless on shop1, rest with/without mix on shop1/shop2
  const offers = [];
  for (let i = 0; i < 5; i++) {
    const variant = allVariants[i];
    const shop = i < 3 ? shop1 : shop2;
    const mirrorless = i < 2;
    const offer = await createSellerOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: variant.productId,
      variantId: variant.id,
      priceTl: 50 + i * 10,
      stockQty: 1 + (i % 3), // 1–3
      createListingMirror: !mirrorless,
      city: "İstanbul",
    });
    await approveCatalogOffer(offer.id, shop.ownerId);
    if (mirrorless) {
      await prisma.sellerOffer.update({ where: { id: offer.id }, data: { listingId: null } });
      created.offersMirrorless++;
    }
    created.offers++;
    offers.push(await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } }));
  }

  const seedSummary = {
    ...created,
    shopIds: [shop1.id, shop2.id],
    offerIds: offers.map((o) => o.id),
    mirrorlessOfferIds: offers.filter((o) => !o.listingId).map((o) => o.id),
    buyerId: buyer.id,
    adminId: admin.id,
  };
  console.log("SEED", JSON.stringify(seedSummary, null, 2));

  // ===== A Mirrorless checkout =====
  {
    const offer = offers.find((o) => !o.listingId)!;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `stg1-a-${stamp}`,
    });
    const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
    record(
      "A mirrorless checkout",
      Boolean(co.order.id && co.payment.id && deal?.orderId === co.order.id && deal.listingId == null),
      `orderId=${deal?.orderId?.slice(0, 8)} listingId=${deal?.listingId}`
    );
  }

  // ===== B Demo POS pay =====
  {
    const offer = offers.find((o) => !o.listingId && o.stockQty >= 1) || offers[0];
    // refresh stock
    await prisma.sellerOffer.update({ where: { id: offer.id }, data: { stockQty: 2, status: "ACTIVE" } });
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `stg1-b-${stamp}`,
    });
    const pay = await completeEscrowPayment(sessionOf(buyer), co.payment.id);
    const order = await prisma.order.findUnique({ where: { id: co.order.id }, include: { items: true } });
    const payment = await prisma.payment.findUnique({ where: { id: co.payment.id } });
    record(
      "B demo POS payment",
      Boolean(pay.ok) &&
        order?.status === OrderStatus.PAID &&
        payment?.status === PaymentStatus.PAID &&
        order.items.every((i) => !i.stockReleasedAt),
      `order=${order?.status} pay=${payment?.status}`
    );
  }

  // ===== C timeout =====
  {
    const offer = offers[2];
    await prisma.sellerOffer.update({
      where: { id: offer.id },
      data: { stockQty: 2, status: "ACTIVE", deletedAt: null },
    });
    const before = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `stg1-c-${stamp}`,
    });
    await prisma.order.update({
      where: { id: co.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const r = await cancelExpiredCatalogOrder(co.order.id);
    const after = (await prisma.sellerOffer.findUnique({ where: { id: offer.id } }))!.stockQty;
    const item = await prisma.orderItem.findFirst({ where: { orderId: co.order.id } });
    const order = await prisma.order.findUnique({ where: { id: co.order.id } });
    record(
      "C payment abandon timeout",
      r.ok && order?.status === OrderStatus.CANCELLED && after === before && Boolean(item?.stockReleasedAt),
      `stock ${before}→${after} released=${Boolean(item?.stockReleasedAt)}`
    );
  }

  // ===== D idempotency =====
  {
    const offer = offers[3];
    await prisma.sellerOffer.update({
      where: { id: offer.id },
      data: { stockQty: 3, status: "ACTIVE", deletedAt: null },
    });
    const key = `stg1-d-${stamp}`;
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
    record(
      "D idempotency replay",
      c1.order.id === c2.order.id && count === 1 && Boolean(c2.idempotentReplay),
      `orders=${count} replay=${c2.idempotentReplay}`
    );
  }

  // ===== E projection job =====
  {
    const offer = offers.find((o) => !o.listingId)!;
    await prisma.sellerOffer.update({
      where: { id: offer.id },
      data: { stockQty: 2, status: "ACTIVE" },
    });
    __setTestForceMirrorSyncFail(true);
    const co = await checkoutCatalogOffer({
      buyer: { id: buyer.id },
      sellerOfferId: offer.id,
      quantity: 1,
      shipDays: 7,
      idempotencyKey: `stg1-e-${stamp}`,
    });
    __setTestForceMirrorSyncFail(false);
    const job = await prisma.catalogProjectionJob.findFirst({
      where: { sellerOfferId: offer.id },
      orderBy: { createdAt: "desc" },
    });
    // Process without force-fail → COMPLETED (no listing = no-op complete)
    if (job) {
      await prisma.catalogProjectionJob.update({
        where: { id: job.id },
        data: {
          status: CatalogProjectionJobStatus.PENDING,
          nextAttemptAt: new Date(),
          attempts: 0,
          completedAt: null,
        },
      });
      await processDueCatalogProjectionJobs({ forceJobId: job.id, limit: 1 });
    }
    const after = job
      ? await prisma.catalogProjectionJob.findUnique({ where: { id: job.id } })
      : null;
    const orderStill = await prisma.order.findUnique({ where: { id: co.order.id } });
    record(
      "E projection job",
      Boolean(job) &&
        after?.status === CatalogProjectionJobStatus.COMPLETED &&
        orderStill?.status === OrderStatus.PENDING_PAYMENT,
      `job=${after?.status} order=${orderStill?.status}`
    );
  }

  // ===== F classic escrow =====
  {
    let listing = await prisma.listing.findFirst({
      where: {
        sellerOfferId: null,
        status: "ACTIVE",
        escrowEligible: true,
        sellerId: { not: buyer.id },
      },
    });
    if (!listing) {
      const cat =
        (await prisma.category.findFirst({
          where: { OR: [{ slug: { contains: "emlak" } }, { slug: { contains: "vasita" } }] },
        })) || category;
      listing = await prisma.listing.create({
        data: {
          listingNo: `STG-CL-${stamp}`,
          sellerId: seller1.id,
          categoryId: cat.id,
          title: "STG klasik escrow test",
          description: "staging classic",
          city: "Ankara",
          askPrice: BigInt(100),
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
    record(
      "F classic escrow",
      Boolean(r.ok) && Boolean(deal?.listingId) && deal?.orderId == null,
      `listingId=${Boolean(deal?.listingId)} orderId=${deal?.orderId}`
    );
  }

  // ===== G admin display data =====
  {
    const deal = await prisma.escrowDeal.findFirst({
      where: { orderId: { not: null }, listingId: null },
      include: {
        linkedOrder: { include: { items: { take: 1 } } },
        sellerOffer: { include: { product: true } },
      },
    });
    const title =
      deal?.linkedOrder?.items?.[0]?.productNameSnapshot ||
      deal?.sellerOffer?.product?.name ||
      null;
    record(
      "G admin null-listing display",
      Boolean(deal && title),
      `title=${title?.slice(0, 40)}`
    );
  }

  // ===== H audit =====
  const audit = await auditCatalogCheckoutConsistency();
  record(
    "H consistency audit critical=0",
    audit.summary.criticalCount === 0,
    `critical=${audit.summary.criticalCount} warnings=${audit.summary.warningCount}`
  );

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "staging-phase1-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        db: fp,
        flag: true,
        seed: seedSummary,
        results,
        auditSummary: audit.summary,
        critical: audit.critical,
        warnings: audit.warnings.slice(0, 50),
        warningCodeCounts: Object.fromEntries(
          [...audit.warnings.reduce((m, w) => {
            m.set(w.code, (m.get(w.code) || 0) + 1);
            return m;
          }, new Map<string, number>())]
        ),
      },
      null,
      2
    ),
    "utf8"
  );

  // Also refresh canonical audit report file
  fs.writeFileSync(
    path.join(outDir, "catalog-checkout-consistency-report.json"),
    JSON.stringify(audit, null, 2),
    "utf8"
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\nPhase1 ${results.filter((r) => r.pass).length}/${results.length} passed`);
  console.log("DB", fp.maskedUrl, "localhost=", fp.isLocalhost, "prodLook=", fp.looksProduction);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
