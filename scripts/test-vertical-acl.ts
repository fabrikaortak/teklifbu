/**
 * Dikey ACL testleri A–O
 * npx tsx scripts/test-vertical-acl.ts
 */
import { PrismaClient, AccountType } from "@prisma/client";
import { hash } from "bcryptjs";
import { resolveListingVerticalFromDb } from "../src/lib/listingVertical";
import {
  assertUserMayPostVertical,
  VerticalAccessError,
} from "../src/core/guards/verticalAccessGuard";
import { createSellerOffer, createProductRequest } from "../src/core/services/catalog/catalogCommerceService";
import { createListingForSeller } from "../src/core/services/listingCreateService";
import type { SessionUser } from "../src/lib/auth";

const prisma = new PrismaClient();
const TAG = `vacl_${Date.now()}`;

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function expectDenied(
  name: string,
  fn: () => Promise<unknown>,
  code: string
) {
  try {
    await fn();
    record(name, false, `expected ${code}, got success`);
  } catch (e) {
    if (e instanceof VerticalAccessError) {
      record(name, e.code === code, `code=${e.code} vertical=${e.vertical || "-"}`);
      return;
    }
    const err = e as Error & { code?: string };
    const got = err.code || err.message;
    record(name, String(got).includes(code) || err.message.includes(code), `got=${got}`);
  }
}

async function expectOk(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    record(name, true);
  } catch (e) {
    const err = e as Error & { code?: string };
    record(name, false, `${err.code || ""} ${err.message}`.trim());
  }
}

async function leafCategory(slugLike: string) {
  const rows = await prisma.$queryRawUnsafe<{ id: string; slug: string }[]>(
    `SELECT c.id, c.slug FROM "Category" c
     WHERE c."deletedAt" IS NULL AND c.slug LIKE $1
       AND NOT EXISTS (SELECT 1 FROM "Category" ch WHERE ch."parentId"=c.id AND ch."deletedAt" IS NULL)
     LIMIT 1`,
    slugLike
  );
  if (!rows[0]) throw new Error(`No leaf for ${slugLike}`);
  return rows[0];
}

async function makeUser(opts: {
  accountType: AccountType;
  subtypes: string[];
  withShop?: boolean;
  shopActive?: boolean;
  withPackage?: boolean;
  suffix: string;
}) {
  const phone = `05${String(Date.now()).slice(-9)}${opts.suffix}`.slice(0, 11);
  const passwordHash = await hash("Test1234!", 8);
  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      name: `ACL ${opts.suffix} ${TAG}`,
      accountType: opts.accountType,
      commercialSubtypes: opts.subtypes,
      commercialStatus: "APPROVED",
      isActive: true,
      role: "USER",
    },
  });

  let shop: { id: string; ownerId: string; isActive: boolean } | null = null;
  if (opts.withShop) {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("Tenant yok");
    shop = await prisma.shop.create({
      data: {
        name: `Shop ${opts.suffix} ${TAG}`,
        slug: `acl-${opts.suffix}-${TAG}`.toLowerCase(),
        ownerId: user.id,
        tenantId: tenant.id,
        accountType: "TICARI",
        isActive: opts.shopActive !== false,
      },
    });
  }

  if (opts.withPackage && shop) {
    const pkg = await prisma.shopPackage.findFirst({ where: { isActive: true } });
    if (pkg) {
      await prisma.shopSubscription.create({
        data: {
          userId: user.id,
          shopId: shop.id,
          packageId: pkg.id,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 86400000),
          isActive: true,
        },
      });
    }
  }

  return { user, shop };
}

function sessionOf(user: { id: string; phone: string; name: string | null; accountType: string }): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: "USER",
    accountType: user.accountType,
    tokenBalance: 0,
  };
}

async function main() {
  const emlakCat = await leafCategory("konut%");
  const vasitaCat = await leafCategory("arac%");
  const shopCat = await leafCategory("ikinci-el%");

  const vEmlak = await resolveListingVerticalFromDb({ categoryId: emlakCat.id, categorySlug: emlakCat.slug });
  const vVasita = await resolveListingVerticalFromDb({ categoryId: vasitaCat.id, categorySlug: vasitaCat.slug });
  const vAlis = await resolveListingVerticalFromDb({ categoryId: shopCat.id, categorySlug: shopCat.slug });
  console.log("verticals", { vEmlak, vVasita, vAlis, emlakCat: emlakCat.slug, vasitaCat: vasitaCat.slug, shopCat: shopCat.slug });

  const emlak = await makeUser({
    accountType: "TICARI",
    subtypes: ["EMLAK_OFISI"],
    withShop: true,
    withPackage: true,
    suffix: "e",
  });
  const galeri = await makeUser({
    accountType: "TICARI",
    subtypes: ["GALERI"],
    withShop: true,
    withPackage: true,
    suffix: "g",
  });
  const magaza = await makeUser({
    accountType: "TICARI",
    subtypes: ["MAGAZA"],
    withShop: true,
    withPackage: true,
    suffix: "m",
  });
  const multi = await makeUser({
    accountType: "TICARI",
    subtypes: ["EMLAK_OFISI", "GALERI"],
    withShop: true,
    withPackage: true,
    suffix: "x",
  });
  const bireysel = await makeUser({
    accountType: "BIREYSEL_TICARI",
    subtypes: [],
    withShop: false,
    suffix: "b",
  });
  const inactiveShop = await makeUser({
    accountType: "TICARI",
    subtypes: ["MAGAZA"],
    withShop: true,
    shopActive: false,
    withPackage: true,
    suffix: "i",
  });

  const product = await prisma.product.findFirst({
    where: { status: "ACTIVE", deletedAt: null },
    include: {
      category: true,
      variants: { where: { isActive: true, deletedAt: null }, take: 1 },
    },
  });

  // A
  await expectOk("A EMLAK_OFISI→emlak", () =>
    assertUserMayPostVertical({
      user: emlak.user,
      shop: emlak.shop,
      vertical: vEmlak,
      action: "CREATE_LISTING",
      categoryId: emlakCat.id,
    })
  );

  // B
  await expectDenied(
    "B EMLAK_OFISI→vasita",
    () =>
      assertUserMayPostVertical({
        user: emlak.user,
        shop: emlak.shop,
        vertical: vVasita,
        action: "CREATE_LISTING",
        categoryId: vasitaCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // C
  if (product && product.variants[0] && emlak.shop) {
    await expectDenied(
      "C EMLAK_OFISI→SellerOffer",
      () =>
        createSellerOffer({
          sellerId: emlak.user.id,
          shopId: emlak.shop!.id,
          productId: product.id,
          variantId: product.variants[0].id,
          priceTl: 100,
          stockQty: 1,
          createListingMirror: false,
        }),
      "VERTICAL_ACCESS_DENIED"
    );
  } else {
    record("C EMLAK_OFISI→SellerOffer", false, "product/variant yok");
  }

  // D
  await expectOk("D GALERI→vasita", () =>
    assertUserMayPostVertical({
      user: galeri.user,
      shop: galeri.shop,
      vertical: vVasita,
      action: "CREATE_LISTING",
      categoryId: vasitaCat.id,
    })
  );

  // E
  await expectDenied(
    "E GALERI→emlak",
    () =>
      assertUserMayPostVertical({
        user: galeri.user,
        shop: galeri.shop,
        vertical: vEmlak,
        action: "CREATE_LISTING",
        categoryId: emlakCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // F
  if (product && product.variants[0] && galeri.shop) {
    await expectDenied(
      "F GALERI→SellerOffer",
      () =>
        createSellerOffer({
          sellerId: galeri.user.id,
          shopId: galeri.shop!.id,
          productId: product.id,
          variantId: product.variants[0].id,
          priceTl: 100,
          stockQty: 1,
          createListingMirror: false,
        }),
      "VERTICAL_ACCESS_DENIED"
    );
  } else {
    record("F GALERI→SellerOffer", false, "product/variant yok");
  }

  // G
  if (product && product.variants[0] && magaza.shop) {
    await expectOk("G MAGAZA→SellerOffer", async () => {
      const offer = await createSellerOffer({
        sellerId: magaza.user.id,
        shopId: magaza.shop!.id,
        productId: product.id,
        variantId: product.variants[0].id,
        priceTl: 2500,
        stockQty: 2,
        createListingMirror: false,
      });
      await prisma.sellerOffer.update({
        where: { id: offer.id },
        data: { deletedAt: new Date(), status: "ARCHIVED" },
      });
    });
  } else {
    record("G MAGAZA→SellerOffer", false, "product/variant yok");
  }

  // H
  await expectDenied(
    "H MAGAZA→emlak",
    () =>
      assertUserMayPostVertical({
        user: magaza.user,
        shop: magaza.shop,
        vertical: vEmlak,
        action: "CREATE_LISTING",
        categoryId: emlakCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );
  await expectDenied(
    "H2 MAGAZA→vasita",
    () =>
      assertUserMayPostVertical({
        user: magaza.user,
        shop: magaza.shop,
        vertical: vVasita,
        action: "CREATE_LISTING",
        categoryId: vasitaCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // I bireysel emlak/vasıta
  await expectOk("I BIREYSEL→emlak", () =>
    assertUserMayPostVertical({
      user: bireysel.user,
      vertical: "emlak",
      action: "CREATE_LISTING",
      categoryId: emlakCat.id,
    })
  );
  await expectOk("I2 BIREYSEL→vasita", () =>
    assertUserMayPostVertical({
      user: bireysel.user,
      vertical: "vasita",
      action: "CREATE_LISTING",
      categoryId: vasitaCat.id,
    })
  );

  // J shopsuz bireysel SellerOffer
  await expectDenied(
    "J BIREYSEL shopsuz→SellerOffer",
    () =>
      assertUserMayPostVertical({
        user: bireysel.user,
        shop: null,
        vertical: "alisveris",
        action: "CREATE_SELLER_OFFER",
        categoryId: shopCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // K EMLAK ProductRequest
  await expectDenied(
    "K EMLAK_OFISI→ProductRequest",
    () =>
      createProductRequest({
        requesterUserId: emlak.user.id,
        shopId: emlak.shop?.id || null,
        categoryId: shopCat.id,
        proposedName: `ACL test urun ${TAG}`,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // L PATCH cross-vertical (assert UPDATE_LISTING_CATEGORY)
  await expectDenied(
    "L PATCH cross-vertical category",
    () =>
      assertUserMayPostVertical({
        user: emlak.user,
        shop: emlak.shop,
        vertical: vVasita,
        action: "UPDATE_LISTING_CATEGORY",
        categoryId: vasitaCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // M Draft publish wrong vertical
  await expectDenied(
    "M draft publish wrong vertical",
    () =>
      assertUserMayPostVertical({
        user: emlak.user,
        shop: emlak.shop,
        vertical: vVasita,
        action: "PUBLISH_DRAFT",
        categoryId: vasitaCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // N multi subtype
  await expectOk("N multi→emlak", () =>
    assertUserMayPostVertical({
      user: multi.user,
      shop: multi.shop,
      vertical: vEmlak,
      action: "CREATE_LISTING",
      categoryId: emlakCat.id,
    })
  );
  await expectOk("N2 multi→vasita", () =>
    assertUserMayPostVertical({
      user: multi.user,
      shop: multi.shop,
      vertical: vVasita,
      action: "CREATE_LISTING",
      categoryId: vasitaCat.id,
    })
  );
  await expectDenied(
    "N3 multi→alisveris deny",
    () =>
      assertUserMayPostVertical({
        user: multi.user,
        shop: multi.shop,
        vertical: vAlis,
        action: "CREATE_LISTING",
        categoryId: shopCat.id,
      }),
    "VERTICAL_ACCESS_DENIED"
  );

  // O inactive shop SellerOffer
  if (product && product.variants[0] && inactiveShop.shop) {
    await expectDenied(
      "O pasif shop→SellerOffer",
      () =>
        createSellerOffer({
          sellerId: inactiveShop.user.id,
          shopId: inactiveShop.shop!.id,
          productId: product.id,
          variantId: product.variants[0].id,
          priceTl: 100,
          stockQty: 1,
          createListingMirror: false,
        }),
      "SHOP_INACTIVE"
    );
  } else {
    record("O pasif shop→SellerOffer", false, "product yok");
  }

  // Bonus: createListingForSeller vertical body (MAGAZA→emlak)
  const listingRes = await createListingForSeller(sessionOf(magaza.user), {
    categoryId: emlakCat.id,
    categorySlug: emlakCat.slug,
    title: `ACL deny ${TAG}`,
    description: "ACL test description long enough for validation rules.",
    city: "İstanbul",
    dealType: "SATILIK",
    askPrice: 100000,
    days: 7,
    attributes: { subtype: "daire" },
  } as never);
  record(
    "B2 createListing MAGAZA→emlak API",
    !listingRes.ok && (listingRes.body as { code?: string })?.code === "VERTICAL_ACCESS_DENIED",
    JSON.stringify(listingRes.body || listingRes)
  );

  // cleanup
  const userIds = [
    emlak.user.id,
    galeri.user.id,
    magaza.user.id,
    multi.user.id,
    bireysel.user.id,
    inactiveShop.user.id,
  ];
  await prisma.sellerOffer.deleteMany({ where: { sellerId: { in: userIds } } });
  await prisma.catalogProductRequest.deleteMany({ where: { requesterUserId: { in: userIds } } });
  await prisma.listing.deleteMany({ where: { sellerId: { in: userIds } } });
  await prisma.shopSubscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.shop.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
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
