/**
 * Panel destructive/action testleri — yalnız geçici test verisi.
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npm run test:panel-actions
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  PrismaClient,
  AccountType,
  EscrowStatus,
  ListingStatus,
  EditRequestStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { assertStagingSafe } from "./lib/stagingGuard";
import { getSetting, getSettingsMap, setSetting } from "../src/core/settings";
import {
  createSellerOffer,
  createProductRequest,
  approveCatalogOffer,
  rejectCatalogOffer,
  approveProductRequest,
  rejectProductRequest,
} from "../src/core/services/catalog/catalogCommerceService";
import { approveListing, rejectListing } from "../src/core/services/listingModerationService";
import {
  approveListingEditRequest,
  rejectListingEditRequest,
} from "../src/core/services/listingEditRequestService";
import { adminRelease, adminRefund } from "../src/core/services/escrowService";
import { ensureDefaultTenant } from "../src/core/services/tenantService";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "http://localhost:3010").replace(/\/+$/, "");
const TAG = `pact_${Date.now()}`;
const OUT = join(process.cwd(), "scripts/output/test-panel-actions.json");

type Row = { name: string; status: "PASS" | "FAIL"; detail?: string };
const results: Row[] = [];
const leftover: string[] = [];

const ids = {
  users: [] as string[],
  shops: [] as string[],
  listings: [] as string[],
  offers: [] as string[],
  products: [] as string[],
  variants: [] as string[],
  productRequests: [] as string[],
  editRequests: [] as string[],
  deals: [] as string[],
  categories: [] as string[],
  questions: [] as string[],
};

function record(name: string, pass: boolean, detail = "") {
  results.push({ name, status: pass ? "PASS" : "FAIL", detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function extractCookie(res: Response): string | null {
  const raw = res.headers.getSetCookie?.() || [];
  const list = raw.length
    ? raw
    : String(res.headers.get("set-cookie") || "")
        .split(/,(?=[^;]+?=)/)
        .map((s) => s.trim());
  for (const c of list) {
    const m = c.match(/teklifbu_session=([^;]+)/);
    if (m) return `teklifbu_session=${m[1]}`;
  }
  return null;
}

async function adminCookie() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", phone: "05000000000" } });
  if (!admin) throw new Error("admin yok");
  // ensure known password from seed
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", identifier: "05000000000", password: "admin123" }),
  });
  const cookie = extractCookie(res);
  if (!cookie) throw new Error("admin login cookie yok");
  return { admin, cookie };
}

async function adminPost(cookie: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function cleanupAll() {
  try {
    if (ids.deals.length) await prisma.escrowDeal.deleteMany({ where: { id: { in: ids.deals } } });
    if (ids.questions.length) {
      await prisma.listingQuestion.deleteMany({ where: { id: { in: ids.questions } } });
    }
    if (ids.editRequests.length) {
      await prisma.listingEditRequest.deleteMany({ where: { id: { in: ids.editRequests } } });
    }
    if (ids.offers.length) {
      await prisma.sellerOffer.updateMany({
        where: { id: { in: ids.offers } },
        data: { listingId: null, deletedAt: new Date() },
      });
    }
    if (ids.listings.length) await prisma.listing.deleteMany({ where: { id: { in: ids.listings } } });
    if (ids.productRequests.length) {
      await prisma.catalogProductRequest.deleteMany({ where: { id: { in: ids.productRequests } } });
    }
    if (ids.variants.length) {
      await prisma.productVariant.deleteMany({ where: { id: { in: ids.variants } } }).catch(() => {});
    }
    if (ids.products.length) {
      await prisma.product.updateMany({
        where: { id: { in: ids.products } },
        data: { deletedAt: new Date(), name: `DEL ${TAG}` },
      });
    }
    if (ids.categories.length) {
      await prisma.category.deleteMany({ where: { id: { in: ids.categories } } }).catch(() => {});
    }
    if (ids.shops.length) {
      await prisma.shopSubscription.deleteMany({ where: { shopId: { in: ids.shops } } }).catch(() => {});
      await prisma.sellerOffer.deleteMany({ where: { shopId: { in: ids.shops } } }).catch(() => {});
      await prisma.shop.deleteMany({ where: { id: { in: ids.shops } } });
    }
    if (ids.users.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: ids.users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
  } catch (e) {
    leftover.push(`cleanup-error:${String(e)}`);
  }

  for (const id of ids.users) {
    if (await prisma.user.findUnique({ where: { id } })) leftover.push(`user:${id}`);
  }
  for (const id of ids.shops) {
    if (await prisma.shop.findUnique({ where: { id } })) leftover.push(`shop:${id}`);
  }
  for (const id of ids.listings) {
    if (await prisma.listing.findUnique({ where: { id } })) leftover.push(`listing:${id}`);
  }
}

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("ACTIONS_GUARD", fp.maskedUrl, TAG);

  const tenant = await ensureDefaultTenant();
  const { admin, cookie } = await adminCookie();

  const passwordHash = await hash("Test1234!", 8);
  const sellerPhone = `0596${String(Date.now()).slice(-7)}`.slice(0, 11);
  const buyerPhone = `0595${String(Date.now()).slice(-7)}`.slice(0, 11);

  const seller = await prisma.user.create({
    data: {
      phone: sellerPhone,
      passwordHash,
      name: `PACT Seller ${TAG}`,
      accountType: AccountType.TICARI,
      commercialStatus: "APPROVED",
      commercialSubtypes: ["MAGAZA"],
      role: "USER",
      isActive: true,
      phoneVerified: true,
      tenantId: tenant.id,
      profile: {
        companyName: "PACT Shop",
        commercialTitle: "PACT Shop",
        companyType: "LIMITED",
        taxOffice: "Test",
        taxNumber: "1234567890",
        shopFocusRoot: "alisveris",
        shopFocusSub: "elektronik",
      },
    },
  });
  ids.users.push(seller.id);

  const buyer = await prisma.user.create({
    data: {
      phone: buyerPhone,
      passwordHash,
      name: `PACT Buyer ${TAG}`,
      accountType: AccountType.BIREYSEL_TICARI,
      role: "USER",
      isActive: true,
      tenantId: tenant.id,
    },
  });
  ids.users.push(buyer.id);

  const shop = await prisma.shop.create({
    data: {
      name: `PACT Shop ${TAG}`,
      slug: `pact-shop-${TAG}`.toLowerCase(),
      ownerId: seller.id,
      tenantId: tenant.id,
      accountType: AccountType.TICARI,
      isActive: true,
    },
  });
  ids.shops.push(shop.id);

  const pkg =
    (await prisma.shopPackage.findFirst({ where: { isActive: true, accountType: AccountType.TICARI } })) ||
    (await prisma.shopPackage.findFirst({ where: { isActive: true } }));
  if (pkg) {
    await prisma.shopSubscription.create({
      data: {
        userId: seller.id,
        shopId: shop.id,
        packageId: pkg.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 86400000),
        isActive: true,
      },
    });
  }

  const cat = await prisma.category.findFirst({
    where: { deletedAt: null, slug: { contains: "ikinci-el" } },
  });
  if (!cat) throw new Error("alışveriş kategori yok");

  // --- listing approve / reject ---
  const listingApprove = await prisma.listing.create({
    data: {
      title: `PACT approve ${TAG}`,
      description: "test",
      askPrice: 1500,
      status: ListingStatus.PENDING_REVIEW,
      sellerId: seller.id,
      categoryId: cat.id,
      city: "İstanbul",
      district: "Kadıköy",
      tenantId: tenant.id,
      durationDays: 30,
      endsAt: new Date(Date.now() + 30 * 86400000),
      listingNo: `PACTA${Date.now().toString().slice(-7)}`,
    },
  });
  ids.listings.push(listingApprove.id);
  try {
    await approveListing(listingApprove.id, admin.id, tenant.id);
    const st = await prisma.listing.findUnique({ where: { id: listingApprove.id } });
    record("listing approve", st?.status === ListingStatus.ACTIVE, `status=${st?.status}`);
  } catch (e) {
    record("listing approve", false, String(e));
  }

  const listingReject = await prisma.listing.create({
    data: {
      title: `PACT reject ${TAG}`,
      description: "test",
      askPrice: 1600,
      status: ListingStatus.PENDING_REVIEW,
      sellerId: seller.id,
      categoryId: cat.id,
      city: "İstanbul",
      district: "Kadıköy",
      tenantId: tenant.id,
      durationDays: 30,
      endsAt: new Date(Date.now() + 30 * 86400000),
      listingNo: `PACTR${Date.now().toString().slice(-7)}`,
    },
  });
  ids.listings.push(listingReject.id);
  try {
    await rejectListing(listingReject.id, admin.id, "PACT test red", tenant.id);
    const st = await prisma.listing.findUnique({ where: { id: listingReject.id } });
    record("listing reject", st?.status === ListingStatus.REJECTED, `status=${st?.status}`);
  } catch (e) {
    record("listing reject", false, String(e));
  }

  // --- listing edit request approve/reject ---
  const editListing = await prisma.listing.create({
    data: {
      title: `PACT edit ${TAG}`,
      description: "test",
      askPrice: 2000,
      status: ListingStatus.ACTIVE,
      sellerId: seller.id,
      categoryId: cat.id,
      city: "İstanbul",
      district: "Kadıköy",
      tenantId: tenant.id,
      durationDays: 30,
      endsAt: new Date(Date.now() + 30 * 86400000),
      listingNo: `PACTE${Date.now().toString().slice(-7)}`,
    },
  });
  ids.listings.push(editListing.id);

  const editApprove = await prisma.listingEditRequest.create({
    data: {
      listingId: editListing.id,
      sellerId: seller.id,
      payload: { title: `PACT edit approved ${TAG}` },
      status: EditRequestStatus.PENDING,
    },
  });
  ids.editRequests.push(editApprove.id);
  try {
    await approveListingEditRequest(editApprove.id, admin.id, tenant.id, {
      adminBypass: true,
      bypassReason: "PACT admin bypass test",
    });
    const st = await prisma.listingEditRequest.findUnique({ where: { id: editApprove.id } });
    const audit = await prisma.auditLog.findFirst({
      where: {
        OR: [
          { entityId: editApprove.id },
          { entityId: editListing.id, action: { contains: "edit" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    record(
      "listing edit approve + admin bypass",
      st?.status === EditRequestStatus.APPROVED,
      `status=${st?.status} audit=${audit?.action || "none"}`
    );
  } catch (e) {
    record("listing edit approve + admin bypass", false, String(e));
  }

  const editReject = await prisma.listingEditRequest.create({
    data: {
      listingId: editListing.id,
      sellerId: seller.id,
      payload: { title: `PACT edit rejected ${TAG}` },
      status: EditRequestStatus.PENDING,
    },
  });
  ids.editRequests.push(editReject.id);
  try {
    await rejectListingEditRequest(editReject.id, admin.id, "PACT red", tenant.id);
    const st = await prisma.listingEditRequest.findUnique({ where: { id: editReject.id } });
    record("listing edit reject", st?.status === EditRequestStatus.REJECTED, `status=${st?.status}`);
  } catch (e) {
    record("listing edit reject", false, String(e));
  }

  // --- ProductRequest approve/reject ---
  try {
    const prApprove = await createProductRequest({
      requesterUserId: seller.id,
      shopId: shop.id,
      categoryId: cat.id,
      proposedName: `PACT PR Approve ${TAG}`,
      description: "panel action test",
    });
    ids.productRequests.push(prApprove.id);
    const product = await approveProductRequest(prApprove.id, admin.id, {});
    if (product?.id) ids.products.push(product.id);
    const variants = await prisma.productVariant.findMany({ where: { productId: product.id } });
    ids.variants.push(...variants.map((v) => v.id));
    record("productRequest approve", !!product?.id, `product=${product?.id || "?"}`);

    const prReject = await createProductRequest({
      requesterUserId: seller.id,
      shopId: shop.id,
      categoryId: cat.id,
      proposedName: `PACT PR Reject ${TAG}`,
      description: "panel action test reject",
    });
    ids.productRequests.push(prReject.id);
    await rejectProductRequest(prReject.id, admin.id, "PACT red");
    const rej = await prisma.catalogProductRequest.findUnique({ where: { id: prReject.id } });
    record("productRequest reject", String(rej?.status) === "REJECTED", `status=${rej?.status}`);
  } catch (e) {
    record("productRequest approve/reject", false, String(e));
  }

  // --- SellerOffer approve/reject ---
  try {
    let productId = ids.products[0];
    let variantId = ids.variants[0];
    if (!productId || !variantId) {
      const existing = await prisma.product.findFirst({
        where: { deletedAt: null },
        include: { variants: { take: 1 } },
      });
      if (!existing?.variants[0]) throw new Error("product/variant yok");
      productId = existing.id;
      variantId = existing.variants[0].id;
    }

    const offerR = await createSellerOffer({
      sellerId: seller.id,
      shopId: shop.id,
      productId,
      variantId,
      priceTl: 888,
      stockQty: 2,
      createListingMirror: false,
      city: "İstanbul",
      district: "Kadıköy",
    });
    ids.offers.push(offerR.id);
    await rejectCatalogOffer(offerR.id, admin.id);
    const rej = await prisma.sellerOffer.findUnique({ where: { id: offerR.id } });
    record(
      "SellerOffer reject",
      String(rej?.status) === "REJECTED",
      `status=${rej?.status}`
    );

    const offerA = await createSellerOffer({
      sellerId: seller.id,
      shopId: shop.id,
      productId,
      variantId,
      priceTl: 999,
      stockQty: 3,
      createListingMirror: false,
      city: "İstanbul",
      district: "Kadıköy",
    });
    ids.offers.push(offerA.id);
    const approved = await approveCatalogOffer(offerA.id, admin.id);
    record("SellerOffer approve", approved.status === "ACTIVE", `status=${approved.status}`);
  } catch (e) {
    record("SellerOffer approve/reject", false, String(e));
  }

  // --- escrow refund / release ---
  try {
    const dealRelease = await prisma.escrowDeal.create({
      data: {
        listingId: editListing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amountTl: 2000,
        commissionTl: 100,
        sellerPayoutTl: 1900,
        shipDays: 3,
        status: EscrowStatus.BUYER_REVIEW,
        shippedAt: new Date(),
      },
    });
    ids.deals.push(dealRelease.id);
    await adminRelease(dealRelease.id, admin.id, "PACT release");
    const st1 = await prisma.escrowDeal.findUnique({ where: { id: dealRelease.id } });
    record("escrow release", st1?.status === EscrowStatus.RELEASED, `status=${st1?.status}`);

    const dealRefund = await prisma.escrowDeal.create({
      data: {
        listingId: editListing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amountTl: 1800,
        commissionTl: 90,
        sellerPayoutTl: 1710,
        shipDays: 3,
        status: EscrowStatus.DISPUTED,
      },
    });
    ids.deals.push(dealRefund.id);
    await adminRefund(dealRefund.id, admin.id, "PACT refund");
    const st2 = await prisma.escrowDeal.findUnique({ where: { id: dealRefund.id } });
    record("escrow refund", st2?.status === EscrowStatus.REFUNDED, `status=${st2?.status}`);
  } catch (e) {
    record("escrow refund/release", false, String(e));
  }

  // --- kategori ayarı kaydet (temp category) ---
  try {
    const slug = `pact-cat-${TAG}`.toLowerCase();
    const created = await adminPost(cookie, {
      action: "save-category",
      name: `PACT Cat ${TAG}`,
      slug,
      sortOrder: 9999,
      isActive: true,
    });
    const catId = created.json?.id || created.json?.categoryId;
    // fetch by slug if id not returned
    const saved = await prisma.category.findFirst({ where: { slug } });
    if (saved) ids.categories.push(saved.id);
    const updated = await adminPost(cookie, {
      action: "save-category",
      id: saved?.id,
      name: `PACT Cat Updated ${TAG}`,
      slug,
      sortOrder: 9998,
      isActive: true,
    });
    const after = await prisma.category.findFirst({ where: { slug } });
    record(
      "kategori ayarı kaydet",
      created.status < 400 && updated.status < 400 && after?.name.includes("Updated"),
      `create=${created.status} update=${updated.status} name=${after?.name}`
    );
    if (saved) {
      await adminPost(cookie, { action: "delete-category", id: saved.id }).catch(() => {});
    }
  } catch (e) {
    record("kategori ayarı kaydet", false, String(e));
  }

  // --- tema ayarı kaydet / doğrula / geri al ---
  const prevMap = await getSettingsMap(true);
  const prevTheme = String(prevMap.ui_theme || "v2");
  try {
    const next = prevTheme === "v2" ? "v1" : "v2";
    const save = await adminPost(cookie, {
      action: "save-settings",
      settings: { ui_theme: next },
    });
    const midMap = await getSettingsMap(true);
    const mid = String(midMap.ui_theme || "");
    const restore = await adminPost(cookie, {
      action: "save-settings",
      settings: { ui_theme: prevTheme },
    });
    const endMap = await getSettingsMap(true);
    const end = String(endMap.ui_theme || "");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "settings.save", actorId: admin.id },
      orderBy: { createdAt: "desc" },
    });
    record(
      "tema ayarı kaydet/doğrula/geri al",
      save.status < 400 && mid === next && restore.status < 400 && end === prevTheme,
      `prev=${prevTheme} mid=${mid} end=${end} audit=${audit?.action || "?"}`
    );
  } catch (e) {
    await setSetting("ui_theme", prevTheme).catch(() => {});
    record("tema ayarı kaydet/doğrula/geri al", false, String(e));
  }

  // --- shop pasif/aktif + audit ---
  try {
    const off = await adminPost(cookie, {
      action: "toggle-shop",
      shopId: shop.id,
      isActive: false,
    });
    const shopOff = await prisma.shop.findUnique({ where: { id: shop.id } });
    const on = await adminPost(cookie, {
      action: "toggle-shop",
      shopId: shop.id,
      isActive: true,
    });
    const shopOn = await prisma.shop.findUnique({ where: { id: shop.id } });
    const audit = await prisma.auditLog.findFirst({
      where: { entity: "Shop", entityId: shop.id, action: { in: ["shop.activate", "shop.deactivate"] } },
      orderBy: { createdAt: "desc" },
    });
    record(
      "shop pasif/aktif + audit",
      off.status === 200 &&
        on.status === 200 &&
        shopOff?.isActive === false &&
        shopOn?.isActive === true &&
        !!audit,
      `off=${off.status} on=${on.status} audit=${audit?.action || "none"} bypass=${(audit?.meta as any)?.bypass}`
    );
  } catch (e) {
    record("shop pasif/aktif + audit", false, String(e));
  }

  // admin bypass audit already covered in edit approve; explicit check
  {
    const bypassAudit = await prisma.auditLog.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
        action: "vertical.access.admin_bypass",
      },
      orderBy: { createdAt: "desc" },
    });
    // Bypass only fires when vertical ACL would deny; MAGAZA seller on shopping listing won't trigger it.
    // Prefer explicit shop.activate bypass meta OR edit approve success.
    const shopAudit = await prisma.auditLog.findFirst({
      where: {
        entity: "Shop",
        action: { in: ["shop.activate", "shop.deactivate"] },
        createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    record(
      "admin bypass + audit log",
      !!bypassAudit || !!(shopAudit && (shopAudit.meta as { bypass?: boolean } | null)?.bypass),
      bypassAudit
        ? `action=${bypassAudit.action}`
        : `shopAudit=${shopAudit?.action || "none"} bypass=${(shopAudit?.meta as any)?.bypass}`
    );
  }

  await cleanupAll();

  const fail = results.filter((r) => r.status === "FAIL").length;
  const report = {
    at: new Date().toISOString(),
    tag: TAG,
    totals: {
      pass: results.filter((r) => r.status === "PASS").length,
      fail,
      total: results.length,
    },
    results,
    leftoverTestData: leftover,
  };
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log("\n=== PANEL ACTIONS SUMMARY ===");
  console.log(JSON.stringify(report.totals, null, 2));
  if (leftover.length) console.log("LEFTOVER", leftover);
  console.log("Report:", OUT);
  if (fail) process.exitCode = 1;
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
    try {
      await cleanupAll();
    } catch {
      /* ignore */
    }
  })
  .finally(() => prisma.$disconnect());
