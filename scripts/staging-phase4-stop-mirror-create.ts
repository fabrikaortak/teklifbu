/**
 * Aşama 4 — yeni SellerOffer default mirror OFF doğrulama
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npm run staging:phase4
 */
import "dotenv/config";
import { PrismaClient, OrderStatus, PaymentStatus } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import { setSetting, getSetting } from "../src/core/settings";
import {
  approveCatalogOffer,
  createSellerOffer,
} from "../src/core/services/catalog/catalogCommerceService";
import { checkoutCatalogOffer } from "../src/core/services/catalog/catalogOrderService";
import { completeEscrowPayment, createEscrowCheckout } from "../src/core/services/escrowService";
import type { SessionUser } from "../src/lib/auth";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function sessionOf(u: { id: string; phone?: string | null; name?: string | null }): SessionUser {
  return {
    id: u.id,
    phone: u.phone || "05000000000",
    name: u.name || "STG P4",
    role: "USER",
    accountType: "BIREYSEL_TICARI",
    tokenBalance: 0,
  };
}

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("STAGING_GUARD_OK", fp.maskedUrl, "prodLook=", fp.looksProduction);

  await setSetting("catalog_checkout_without_mirror", true);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  const flag = await getSetting<boolean>("catalog_checkout_without_mirror", false);
  if (flag !== true) throw new Error("flag must be ON for phase4 catalog path");

  const stamp = Date.now();
  const results: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const record = (name: string, pass: boolean, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("admin yok");

  const seller = await prisma.user.create({
    data: {
      phone: `0596${String(stamp).slice(-7)}`,
      name: "STG P4 Seller",
      role: "USER",
      accountType: "TICARI",
      commercialSubtypes: ["MAGAZA"],
      commercialStatus: "APPROVED",
      isActive: true,
    },
  });
  const buyer = await prisma.user.create({
    data: {
      phone: `0595${String(stamp).slice(-7)}`,
      name: "STG P4 Buyer",
      role: "USER",
      accountType: "BIREYSEL_TICARI",
      isActive: true,
    },
  });

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("tenant yok");
  const shop = await prisma.shop.create({
    data: {
      ownerId: seller.id,
      tenantId: tenant.id,
      name: `STG P4 Magaza ${stamp}`,
      slug: `stg-p4-${stamp}`.slice(0, 60),
      accountType: "TICARI",
      isActive: true,
    },
  });
  const pkg = await prisma.shopPackage.findFirst({ where: { isActive: true } });
  if (pkg) {
    await prisma.shopSubscription.upsert({
      where: { userId: seller.id },
      create: {
        userId: seller.id,
        shopId: shop.id,
        packageId: pkg.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 90 * 86400000),
        isActive: true,
      },
      update: {
        shopId: shop.id,
        packageId: pkg.id,
        endsAt: new Date(Date.now() + 90 * 86400000),
        isActive: true,
      },
    });
  }

  const category = await prisma.category.findFirst({
    where: {
      deletedAt: null,
      OR: [{ slug: { contains: "telefon" } }, { slug: { startsWith: "ikinci-el" } }],
    },
    orderBy: { level: "desc" },
  });
  if (!category) throw new Error("category yok");

  const product = await prisma.product.create({
    data: {
      name: `STG P4 Product ${stamp}`,
      slug: `stg-p4-p-${stamp}`,
      categoryId: category.id,
      status: "ACTIVE",
      description: "Phase4 no-mirror create test",
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Varyant 1",
      sku: `STG-P4-${stamp}`,
      attributesHash: `p4-${stamp}`,
      isActive: true,
    },
  });

  // A) Default create → listingId null
  const offerDefault = await createSellerOffer({
    sellerId: seller.id,
    shopId: shop.id,
    productId: product.id,
    variantId: variant.id,
    priceTl: 120,
    stockQty: 3,
    city: "İstanbul",
    // createListingMirror omitted → must be OFF
  });
  await approveCatalogOffer(offerDefault.id, admin.id);
  const offerA = await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offerDefault.id } });
  record(
    "A default create listingId null",
    offerA.listingId == null,
    `listingId=${offerA.listingId}`
  );

  // B) Explicit true still creates mirror (opt-in escape hatch)
  const v2 = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Varyant 2",
      sku: `STG-P4-${stamp}-2`,
      attributesHash: `p4-${stamp}-2`,
      isActive: true,
    },
  });
  const offerMirror = await createSellerOffer({
    sellerId: seller.id,
    shopId: shop.id,
    productId: product.id,
    variantId: v2.id,
    priceTl: 130,
    stockQty: 2,
    city: "İstanbul",
    createListingMirror: true,
  });
  record(
    "B opt-in createListingMirror=true keeps listing",
    Boolean(offerMirror.listingId),
    `listingId=${offerMirror.listingId}`
  );

  // C) Mirrorless checkout + pay
  await prisma.sellerOffer.update({
    where: { id: offerA.id },
    data: { stockQty: 3, status: "ACTIVE", deletedAt: null, listingId: null },
  });
  const co = await checkoutCatalogOffer({
    buyer: { id: buyer.id },
    sellerOfferId: offerA.id,
    quantity: 1,
    shipDays: 7,
    idempotencyKey: `p4-co-${stamp}`,
  });
  const deal = await prisma.escrowDeal.findUnique({ where: { id: co.deal.id } });
  await completeEscrowPayment(sessionOf(buyer), co.payment.id);
  const order = await prisma.order.findUnique({ where: { id: co.order.id } });
  const payment = await prisma.payment.findUnique({ where: { id: co.payment.id } });
  record(
    "C mirrorless checkout+pay",
    order?.status === OrderStatus.PAID &&
      payment?.status === PaymentStatus.PAID &&
      deal?.listingId == null &&
      Boolean(deal?.orderId),
    `order=${order?.status} listingId=${deal?.listingId}`
  );

  // D) Classic listing escrow still works
  const classicListing = await prisma.listing.findFirst({
    where: {
      status: { in: ["ACTIVE", "SELECTION"] },
      sellerOfferId: null,
      productId: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!classicListing) {
    record("D classic escrow", false, "no classic listing found");
  } else {
    const buyer2 = await prisma.user.findFirst({
      where: { id: { notIn: [classicListing.sellerId, buyer.id, seller.id] }, role: "USER" },
    });
    if (!buyer2) {
      record("D classic escrow", false, "no classic buyer");
    } else {
      const classic = await createEscrowCheckout(sessionOf(buyer2), classicListing.id, 7);
      const cDeal = await prisma.escrowDeal.findUnique({ where: { id: classic.dealId } });
      record(
        "D classic escrow",
        Boolean(cDeal?.listingId) && cDeal?.orderId == null,
        `listingId=${Boolean(cDeal?.listingId)} orderId=${cDeal?.orderId}`
      );
    }
  }

  // E) Listing count did not grow from default create (only opt-in B)
  const listingsForProduct = await prisma.listing.count({
    where: { productId: product.id },
  });
  record(
    "E only opt-in listing for product",
    listingsForProduct === 1,
    `listings=${listingsForProduct}`
  );

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    db: fp,
    flag,
    results,
    offerDefaultId: offerA.id,
    offerOptInId: offerMirror.id,
    productId: product.id,
  };
  fs.writeFileSync(path.join(outDir, "staging-phase4-report.json"), JSON.stringify(report, null, 2));

  const failed = results.filter((r) => !r.pass);
  console.log(`\nPhase4 scenarios ${results.filter((r) => r.pass).length}/${results.length}`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("PHASE4 PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
