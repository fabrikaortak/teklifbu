/**
 * Mağaza paneli ACL testleri.
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npm run test:panel-acl
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient, AccountType } from "@prisma/client";
import { hash } from "bcryptjs";
import { assertStagingSafe } from "./lib/stagingGuard";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "http://localhost:3010").replace(/\/+$/, "");
const TAG = `pacl_${Date.now()}`;
const OUT = join(process.cwd(), "scripts/output/test-panel-acl.json");

type Row = { name: string; status: "PASS" | "FAIL"; detail?: string; expected?: number; got?: number };
const results: Row[] = [];
const cleanupIds: {
  users: string[];
  shops: string[];
  listings: string[];
  questions: string[];
  deals: string[];
} = { users: [], shops: [], listings: [], questions: [], deals: [] };

function record(name: string, pass: boolean, detail = "", expected?: number, got?: number) {
  results.push({
    name,
    status: pass ? "PASS" : "FAIL",
    detail,
    expected,
    got,
  });
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

async function loginCookie(phone: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", identifier: phone, password }),
  });
  const cookie = extractCookie(res);
  if (!res.ok || !cookie) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`login failed ${phone}: ${res.status} ${JSON.stringify(j)}`);
  }
  return cookie;
}

async function magazaGet(cookie: string, view = "overview") {
  const res = await fetch(`${BASE}/api/magaza/panel?view=${view}`, {
    headers: { Cookie: cookie },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function magazaPost(cookie: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/magaza/panel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function makeSeller(opts: {
  suffix: string;
  commercialStatus: string;
  subtypes: string[];
  shopFocusRoot: "alisveris" | "emlak" | "vasita";
  shopActive?: boolean;
  withShop?: boolean;
}) {
  const passwordHash = await hash("Test1234!", 8);
  const phone = `0598${String(Date.now()).slice(-6)}${opts.suffix}`.replace(/\D/g, "").slice(0, 11);
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("tenant yok");

  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      name: `PACL ${opts.suffix} ${TAG}`,
      accountType: AccountType.TICARI,
      commercialStatus: opts.commercialStatus,
      commercialSubtypes: opts.subtypes,
      isActive: true,
      role: "USER",
      phoneVerified: true,
      tenantId: tenant.id,
      profile: {
        companyName: `PACL ${opts.suffix}`,
        commercialTitle: `PACL ${opts.suffix}`,
        companyType: "LIMITED",
        taxOffice: "Test",
        taxNumber: "1234567890",
        tradeRegistryNo: "1",
        mersisNo: "0123456789012345",
        naceCode: "47.19",
        businessCity: "İstanbul",
        businessDistrict: "Kadıköy",
        businessAddress: "Test",
        authorizedTitle: "Sahip",
        authorizedPhone: phone,
        shopFocusRoot: opts.shopFocusRoot,
        shopFocusSub: opts.shopFocusRoot === "alisveris" ? "elektronik" : "",
        shopFocusOtherNote: "",
      },
    },
  });
  cleanupIds.users.push(user.id);

  let shop: { id: string; isActive: boolean } | null = null;
  if (opts.withShop !== false) {
    shop = await prisma.shop.create({
      data: {
        name: `PACL Shop ${opts.suffix} ${TAG}`,
        slug: `pacl-${opts.suffix}-${TAG}`.toLowerCase(),
        ownerId: user.id,
        tenantId: tenant.id,
        accountType: AccountType.TICARI,
        isActive: opts.shopActive !== false,
        city: "İstanbul",
        phone,
      },
    });
    cleanupIds.shops.push(shop.id);
  }

  return { user, shop, phone, password: "Test1234!" };
}

async function cleanup() {
  const leftover: string[] = [];
  try {
    if (cleanupIds.deals.length) {
      await prisma.escrowDeal.deleteMany({ where: { id: { in: cleanupIds.deals } } });
    }
    if (cleanupIds.questions.length) {
      await prisma.listingQuestion.deleteMany({ where: { id: { in: cleanupIds.questions } } });
    }
    if (cleanupIds.listings.length) {
      await prisma.listing.deleteMany({ where: { id: { in: cleanupIds.listings } } });
    }
    if (cleanupIds.shops.length) {
      await prisma.shopSubscription.deleteMany({ where: { shopId: { in: cleanupIds.shops } } }).catch(() => {});
      await prisma.shop.deleteMany({ where: { id: { in: cleanupIds.shops } } });
    }
    if (cleanupIds.users.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: cleanupIds.users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: cleanupIds.users } } });
    }
  } catch (e) {
    leftover.push(String(e));
  }
  // verify
  for (const id of cleanupIds.users) {
    if (await prisma.user.findUnique({ where: { id } })) leftover.push(`user:${id}`);
  }
  for (const id of cleanupIds.shops) {
    if (await prisma.shop.findUnique({ where: { id } })) leftover.push(`shop:${id}`);
  }
  return leftover;
}

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("ACL_GUARD", fp.maskedUrl);

  // stale leftovers from previous interrupted runs
  await prisma.user.deleteMany({ where: { name: { startsWith: "PACL " } } }).catch(() => {});
  await prisma.shop.deleteMany({ where: { name: { startsWith: "PACL Shop" } } }).catch(() => {});

  const pending = await makeSeller({
    suffix: "1",
    commercialStatus: "PENDING",
    subtypes: ["MAGAZA"],
    shopFocusRoot: "alisveris",
    shopActive: true,
  });
  const passive = await makeSeller({
    suffix: "2",
    commercialStatus: "APPROVED",
    subtypes: ["MAGAZA"],
    shopFocusRoot: "alisveris",
    shopActive: false,
  });
  const emlak = await makeSeller({
    suffix: "3",
    commercialStatus: "APPROVED",
    subtypes: ["EMLAK_OFISI"],
    shopFocusRoot: "emlak",
    shopActive: true,
  });
  const galeri = await makeSeller({
    suffix: "4",
    commercialStatus: "APPROVED",
    subtypes: ["GALERI"],
    shopFocusRoot: "vasita",
    shopActive: true,
  });
  const magaza = await makeSeller({
    suffix: "5",
    commercialStatus: "APPROVED",
    subtypes: ["MAGAZA"],
    shopFocusRoot: "alisveris",
    shopActive: true,
  });
  const other = await makeSeller({
    suffix: "6",
    commercialStatus: "APPROVED",
    subtypes: ["MAGAZA"],
    shopFocusRoot: "alisveris",
    shopActive: true,
  });

  // --- 403 cases ---
  {
    const c = await loginCookie(pending.phone, pending.password);
    const r = await magazaGet(c);
    record("onaysız ticari → 403", r.status === 403, r.body?.error, 403, r.status);
  }
  {
    const c = await loginCookie(passive.phone, passive.password);
    const r = await magazaGet(c);
    record("pasif shop → 403", r.status === 403, r.body?.error, 403, r.status);
  }
  {
    const c = await loginCookie(emlak.phone, emlak.password);
    const r = await magazaGet(c);
    record("EMLAK_OFISI → 403", r.status === 403, r.body?.error, 403, r.status);
  }
  {
    const c = await loginCookie(galeri.phone, galeri.password);
    const r = await magazaGet(c);
    record("GALERI → 403", r.status === 403, r.body?.error, 403, r.status);
  }
  {
    const c = await loginCookie(magaza.phone, magaza.password);
    const r = await magazaGet(c);
    record("MAGAZA + aktif/onaylı → 200", r.status === 200 && r.body?.ok !== false, r.body?.error, 200, r.status);
  }

  // --- cross-shop ---
  const cat = await prisma.category.findFirst({
    where: { deletedAt: null, slug: { contains: "ikinci-el" } },
  });
  if (!cat) throw new Error("alışveriş kategori yok");

  const otherListing = await prisma.listing.create({
    data: {
      title: `PACL other ${TAG}`,
      description: "acl test",
      askPrice: 1000,
      status: "ACTIVE",
      sellerId: other.user.id,
      categoryId: cat.id,
      city: "İstanbul",
      district: "Kadıköy",
      tenantId: other.user.tenantId!,
      durationDays: 30,
      endsAt: new Date(Date.now() + 30 * 86400000),
      listingNo: `PACL${Date.now().toString().slice(-8)}`,
    },
  });
  cleanupIds.listings.push(otherListing.id);

  const asker = await prisma.user.create({
    data: {
      phone: `0597${String(Date.now()).slice(-7)}`.slice(0, 11),
      passwordHash: await hash("Test1234!", 8),
      name: `PACL asker ${TAG}`,
      accountType: AccountType.BIREYSEL_TICARI,
      role: "USER",
      isActive: true,
      tenantId: other.user.tenantId!,
    },
  });
  cleanupIds.users.push(asker.id);

  const q = await prisma.listingQuestion.create({
    data: {
      listingId: otherListing.id,
      askerId: asker.id,
      body: "PACL soru başka mağaza?",
    },
  });
  cleanupIds.questions.push(q.id);

  const deal = await prisma.escrowDeal.create({
    data: {
      listingId: otherListing.id,
      buyerId: asker.id,
      sellerId: other.user.id,
      amountTl: 1000,
      commissionTl: 50,
      sellerPayoutTl: 950,
      shipDays: 3,
      status: "AWAITING_SHIPMENT",
    },
  });
  cleanupIds.deals.push(deal.id);

  {
    const c = await loginCookie(magaza.phone, magaza.password);
    const ans = await magazaPost(c, {
      action: "answer-question",
      questionId: q.id,
      answerBody: "yetkisiz deneme",
    });
    record(
      "başka shop soru yanıtı → 403/404",
      ans.status === 403 || ans.status === 404,
      `status=${ans.status} ${ans.body?.error || ""}`,
      403,
      ans.status
    );

    const cargo = await magazaPost(c, {
      action: "submit-cargo",
      dealId: deal.id,
      cargoTrackingNo: "TEST123",
      cargoCarrier: "Yurtiçi",
    });
    record(
      "başka shop kargo → 403",
      cargo.status === 403,
      `status=${cargo.status} ${cargo.body?.error || JSON.stringify(cargo.body).slice(0, 80)}`,
      403,
      cargo.status
    );
  }

  const leftover = await cleanup();
  const fail = results.filter((r) => r.status === "FAIL").length;
  const report = {
    at: new Date().toISOString(),
    tag: TAG,
    totals: { pass: results.filter((r) => r.status === "PASS").length, fail, total: results.length },
    results,
    leftoverTestData: leftover,
  };
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log("\n=== PANEL ACL SUMMARY ===");
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
      await cleanup();
    } catch {
      /* ignore */
    }
  })
  .finally(() => prisma.$disconnect());
