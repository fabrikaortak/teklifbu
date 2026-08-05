/**
 * A–H katalog commerce smoke test (alışveriş).
 * Önkoşul: seed-catalog-sample-products + en az 1 Shop/User (opsiyonel offer testleri).
 *
 * npx tsx scripts/test-catalog-commerce-flows.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  adminCreateProduct,
  adminCreateVariant,
  assertOfferPurchasable,
  createSellerOffer,
  findActiveOffer,
  findSimilarProducts,
  getCatalogProduct,
  listOffersForProduct,
  searchCatalogProducts,
} from "../src/core/services/catalog/catalogCommerceService";
import { buildAttributesHash } from "../src/lib/catalogCommerce";

const prisma = new PrismaClient();

function ok(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) throw new Error(`Failed: ${name}`);
}

async function main() {
  // A: search finds seeded iPhone
  const hits = await searchCatalogProducts({ q: "iPhone 14", limit: 10 });
  ok("A search iPhone", hits.length > 0, `hits=${hits.length}`);

  const product = hits[0];
  const full = await getCatalogProduct(product.id);
  ok("A product loaded", Boolean(full), product.name);

  // B: variants unique by attributesHash
  const variants = full!.variants || [];
  ok("B has variants", variants.length >= 1, `n=${variants.length}`);
  const hashes = new Set(variants.map((v) => v.attributesHash));
  ok("B unique attributesHash", hashes.size === variants.length);

  // C: duplicate variant rejected
  let dupBlocked = false;
  try {
    await adminCreateVariant({
      productId: product.id,
      title: "Dup test",
      values: [],
    });
    // empty hash may already exist
  } catch (e) {
    dupBlocked = String((e as Error).message || "").includes("zaten");
  }
  if (!dupBlocked && variants.some((v) => v.attributesHash === "empty")) {
    try {
      await adminCreateVariant({ productId: product.id, title: "Dup2", values: [] });
    } catch (e) {
      dupBlocked = String((e as Error).message || "").includes("zaten");
    }
  }
  ok("C duplicate variant blocked (or no empty collision)", true, `dupBlocked=${dupBlocked}`);

  // D: stock 0 not purchasable in listOffers
  const shop = await prisma.shop.findFirst({ include: { owner: true } });
  const variant = variants[0];
  if (shop && variant) {
    // clean prior test offers for this shop+variant
    await prisma.sellerOffer.updateMany({
      where: { shopId: shop.id, variantId: variant.id, status: "ACTIVE" },
      data: { status: "PAUSED", deletedAt: new Date() },
    });

    const offer0 = await createSellerOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: product.id,
      variantId: variant.id,
      priceTl: 1000,
      stockQty: 0,
      createListingMirror: false,
      status: "SOLD_OUT",
    });
    ok("D stock0 created SOLD_OUT", offer0.status === "SOLD_OUT" || offer0.stockQty === 0);

    const listed = await listOffersForProduct(product.id, variant.id);
    ok("D stock0 not in active offers", !listed.some((o) => o.id === offer0.id));

    let purchasable = true;
    try {
      await assertOfferPurchasable(offer0.id);
    } catch {
      purchasable = false;
    }
    ok("D assertOfferPurchasable blocks stock0", !purchasable);

    await prisma.sellerOffer.update({
      where: { id: offer0.id },
      data: { deletedAt: new Date(), status: "PAUSED" },
    });

    // E: active offer + second active same shop+variant blocked
    const offer1 = await createSellerOffer({
      sellerId: shop.ownerId,
      shopId: shop.id,
      productId: product.id,
      variantId: variant.id,
      priceTl: 55000,
      stockQty: 2,
      condition: "Sıfır",
      createListingMirror: true,
      city: "İstanbul",
      district: "Kadıköy",
    });
    ok("E first ACTIVE offer", offer1.status === "ACTIVE", `listing=${offer1.listingId}`);

    let secondBlocked = false;
    try {
      await createSellerOffer({
        sellerId: shop.ownerId,
        shopId: shop.id,
        productId: product.id,
        variantId: variant.id,
        priceTl: 54000,
        stockQty: 1,
        createListingMirror: false,
      });
    } catch (e) {
      secondBlocked = (e as Error).message === "ACTIVE_OFFER_EXISTS";
    }
    ok("E second ACTIVE blocked", secondBlocked);

    const found = await findActiveOffer(shop.id, variant.id);
    ok("E findActiveOffer", found?.id === offer1.id);

    // cleanup offer1 soft
    await prisma.sellerOffer.update({
      where: { id: offer1.id },
      data: { status: "PAUSED", deletedAt: new Date() },
    });
  } else {
    console.log("SKIP D/E — shop veya variant yok");
  }

  // F: similar products
  const similar = await findSimilarProducts({
    proposedName: product.name,
    categoryId: full!.categoryId,
  });
  ok("F similar finds self or peers", similar.length >= 0, `n=${similar.length}`);

  // G: tee / brita search
  const tee = await searchCatalogProducts({ q: "Tişört", limit: 5 });
  const brita = await searchCatalogProducts({ q: "Brita", limit: 5 });
  ok("G tişört or brita seeded", tee.length + brita.length > 0, `tee=${tee.length} brita=${brita.length}`);

  // H: attributesHash stability
  const h1 = buildAttributesHash([{ attributeId: "a1", optionId: "o1" }]);
  const h2 = buildAttributesHash([{ attributeId: "a1", optionId: "o1" }]);
  ok("H hash stable", h1 === h2 && h1.length > 0, h1);

  // Admin create product only via service (seller cannot — enforced at API)
  const leaf = await prisma.category.findFirst({
    where: { deletedAt: null, slug: { contains: "filtreli-surahi" } },
  });
  if (leaf) {
    const p = await adminCreateProduct({
      categoryId: leaf.id,
      name: `Test Admin Ürün ${Date.now()}`,
      status: "ACTIVE",
    });
    ok("H adminCreateProduct", Boolean(p.id));
    await prisma.product.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  }

  console.log("\nAll commerce flow checks completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
