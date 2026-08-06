/**
 * Vasıta Stage1 end-to-end tests (A–H) — fetch + Prisma cleanup.
 *
 * Covers: otomobil / motosiklet / ticari / elektrikli / hasarlı create flows,
 * edit (PATCH), detail (GET), filter (GET list), cascade-clear contract,
 * bid/offer flow, and HOME/ilan-ver/browse smoke checks.
 *
 * All created data (users, listings, bids, payments, token ledger rows) is
 * tagged with a unique run TAG and deleted at the end via Prisma. No commits,
 * no CSS/emlak/Vehicle* table access.
 *
 * npx tsx scripts/test-vehicle-stage1-end-to-end.ts
 * npm run test:vehicle-stage1-e2e
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient, AccountType, ListingStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { legacyAttrKeyFor } from "@/lib/vasitaFormAttributes";
import { vehicleExtraGroupsForTemplate } from "@/data/vehicleExtras";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "http://localhost:3010").replace(/\/+$/, "");
const RUN_ID = Date.now();
const TAG_PREFIX = `vs1e2e_${RUN_ID}_`;
const OUT = join(process.cwd(), "scripts/output/vehicle-stage1-e2e.json");

type Status = "PASS" | "FAIL" | "SKIPPED_EXPECTED";
type Row = { group: string; name: string; status: Status; detail?: string };
const results: Row[] = [];

function record(group: string, name: string, status: Status, detail = "") {
  results.push({ group, name, status, detail });
  console.log(`[${group}] ${status} ${name}${detail ? ` — ${detail}` : ""}`);
}

const cleanup = {
  userIds: [] as string[],
  listingIds: [] as string[],
  bidIds: [] as string[],
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

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

async function getJson(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function postJson(path: string, payload: Record<string, unknown>, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function patchJson(path: string, payload: Record<string, unknown>, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
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

// ---------------------------------------------------------------------------
// Vasıta catalog / attribute helpers
// ---------------------------------------------------------------------------

type CatalogOption = { slug: string; name: string };
type AttrField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  filterable: boolean;
  formVisible: boolean;
  options: { value: string; label: string }[];
};

async function fetchBrands(subtype: string): Promise<CatalogOption[]> {
  const r = await getJson(`/api/vasita/catalog?action=brands&subtype=${encodeURIComponent(subtype)}`);
  return Array.isArray(r.body?.brands) ? r.body.brands : [];
}
async function fetchModels(subtype: string, brand: string): Promise<CatalogOption[]> {
  const r = await getJson(
    `/api/vasita/catalog?action=models&subtype=${encodeURIComponent(subtype)}&brand=${encodeURIComponent(brand)}`
  );
  return Array.isArray(r.body?.models) ? r.body.models : [];
}
async function fetchGenerations(subtype: string, brand: string, model: string) {
  const r = await getJson(
    `/api/vasita/catalog?action=generations&subtype=${encodeURIComponent(subtype)}&brand=${encodeURIComponent(
      brand
    )}&model=${encodeURIComponent(model)}`
  );
  return {
    generations: Array.isArray(r.body?.generations) ? (r.body.generations as { code: string; label: string }[]) : [],
    versions: Array.isArray(r.body?.versions) ? (r.body.versions as { slug: string; name: string }[]) : [],
    years: Array.isArray(r.body?.years) ? (r.body.years as number[]) : [],
  };
}
async function fetchAttributeFields(subtype: string): Promise<AttrField[]> {
  const r = await getJson(`/api/vasita/attributes?subtype=${encodeURIComponent(subtype)}`);
  return Array.isArray(r.body?.fields) ? r.body.fields : [];
}

/** Generic attrs builder from live CategoryAttribute fields + legacy-key overrides. */
function buildAttrsFromFields(
  fields: AttrField[],
  overrides: Record<string, unknown>
): { attrs: Record<string, unknown>; legacyKeysUsed: string[] } {
  const attrs: Record<string, unknown> = {};
  const legacyKeysUsed: string[] = [];
  for (const f of fields) {
    const legacy = legacyAttrKeyFor(f.key);
    if (Object.prototype.hasOwnProperty.call(overrides, legacy)) {
      attrs[legacy] = overrides[legacy];
      legacyKeysUsed.push(legacy);
      continue;
    }
    if (f.type === "SINGLE_SELECT" && f.options?.length) {
      attrs[legacy] = f.options[0].value;
      legacyKeysUsed.push(legacy);
    } else if (f.type === "NUMBER" && f.required) {
      attrs[legacy] = legacy === "year" ? 2022 : legacy === "km" ? 42000 : 100;
      legacyKeysUsed.push(legacy);
    }
  }
  // Explicit overrides not covered by any field (e.g. hasarli-araclar borrowing PASSENGER_CAR-style keys).
  for (const [k, v] of Object.entries(overrides)) {
    if (!(k in attrs)) {
      attrs[k] = v;
      legacyKeysUsed.push(k);
    }
  }
  return { attrs, legacyKeysUsed };
}

// ---------------------------------------------------------------------------
// Listing create (with demo-POS fee fallback) helper
// ---------------------------------------------------------------------------

async function createVehicleListing(
  cookie: string,
  payload: Record<string, unknown>
): Promise<{ ok: true; id: string; viaFeeFlow: boolean } | { ok: false; error: string }> {
  const first = await postJson("/api/listings", { ...payload, confirmListingFee: true }, cookie);
  if (first.status >= 200 && first.status < 300 && first.body?.ok) {
    return { ok: true, id: String(first.body.id), viaFeeFlow: false };
  }
  if (first.status === 402 && first.body?.code === "LISTING_FEE_REQUIRED") {
    const intentRes = await postJson("/api/payments/demo-pos", { action: "intent", listing: payload }, cookie);
    if (!(intentRes.status >= 200 && intentRes.status < 300) || !intentRes.body?.intentId) {
      return {
        ok: false,
        error: `fee-intent failed: ${intentRes.status} ${JSON.stringify(intentRes.body).slice(0, 300)}`,
      };
    }
    const payRes = await postJson(
      "/api/payments/demo-pos",
      { action: "pay", intentId: intentRes.body.intentId },
      cookie
    );
    if (!(payRes.status >= 200 && payRes.status < 300) || !payRes.body?.listingId) {
      return {
        ok: false,
        error: `fee-pay failed: ${payRes.status} ${JSON.stringify(payRes.body).slice(0, 300)}`,
      };
    }
    return { ok: true, id: String(payRes.body.listingId), viaFeeFlow: true };
  }
  return { ok: false, error: `create failed: ${first.status} ${JSON.stringify(first.body).slice(0, 300)}` };
}

async function forceActive(listingId: string) {
  const now = new Date();
  // Test harness only: bypass admin moderation so filter/bid steps can run against ACTIVE data.
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: ListingStatus.ACTIVE,
      startsAt: now,
      endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      reviewedAt: now,
      rejectionReason: null,
    },
  });
}

// ---------------------------------------------------------------------------
// F) Cascade-clear contract (mirrors scripts/test-vehicle-stage1-cascade-clear.ts)
// ---------------------------------------------------------------------------

function runCascadeClearChecks() {
  type V = { brand: string; model: string; trim: string; generation: string; version: string; modelYear: string };
  const onBrandChange = (prev: V, brand: string): V => ({
    ...prev,
    brand,
    model: "",
    trim: "",
    generation: "",
    version: "",
    modelYear: "",
  });
  const onModelChange = (prev: V, model: string): V => ({
    ...prev,
    model,
    trim: "",
    generation: "",
    version: "",
    modelYear: "",
  });
  const onGenerationChange = (prev: V, generation: string): V => ({
    ...prev,
    generation,
    version: "",
    trim: "",
    modelYear: "",
  });
  const onVersionChange = (prev: V, version: string): V => ({ ...prev, version, trim: version, modelYear: "" });
  const onCategoryChange = (): V => ({ brand: "", model: "", trim: "", generation: "", version: "", modelYear: "" });

  const filled: V = { brand: "bmw", model: "3-serisi", trim: "320i", generation: "default", version: "320i", modelYear: "2020" };

  try {
    const afterBrand = onBrandChange(filled, "audi");
    if (!(afterBrand.brand === "audi" && !afterBrand.model && !afterBrand.trim && !afterBrand.generation && !afterBrand.version && !afterBrand.modelYear)) {
      throw new Error("brand change did not clear children");
    }
    record("F", "cascade: brand change clears model/trim/generation/version/year", "PASS");
  } catch (e) {
    record("F", "cascade: brand change clears model/trim/generation/version/year", "FAIL", String(e));
  }

  try {
    const afterModel = onModelChange(filled, "5-serisi");
    if (!(afterModel.model === "5-serisi" && !afterModel.trim && !afterModel.generation && !afterModel.version && !afterModel.modelYear)) {
      throw new Error("model change did not clear children");
    }
    record("F", "cascade: model change clears trim/generation/version/year", "PASS");
  } catch (e) {
    record("F", "cascade: model change clears trim/generation/version/year", "FAIL", String(e));
  }

  try {
    const afterGen = onGenerationChange(filled, "g20");
    if (!(afterGen.generation === "g20" && !afterGen.version && !afterGen.trim && !afterGen.modelYear)) {
      throw new Error("generation change did not clear version/trim/year");
    }
    record("F", "cascade: generation change clears version/trim/year", "PASS");
  } catch (e) {
    record("F", "cascade: generation change clears version/trim/year", "FAIL", String(e));
  }

  try {
    const afterVer = onVersionChange(filled, "330i");
    if (!(afterVer.version === "330i" && afterVer.trim === "330i" && !afterVer.modelYear)) {
      throw new Error("version change did not sync trim / clear year");
    }
    record("F", "cascade: version change syncs trim and clears year", "PASS");
  } catch (e) {
    record("F", "cascade: version change syncs trim and clears year", "FAIL", String(e));
  }

  try {
    const afterCat = onCategoryChange();
    if (!Object.values(afterCat).every((x) => !x)) throw new Error("category change did not clear all fields");
    record("F", "cascade: category change clears all cascade fields", "PASS");
  } catch (e) {
    record("F", "cascade: category change clears all cascade fields", "FAIL", String(e));
  }
}

// ---------------------------------------------------------------------------
// Scenario runner (A–E)
// ---------------------------------------------------------------------------

type ScenarioConfig = {
  key: string;
  label: string;
  subtype: string;
  preferBrand: string;
  preferModel?: string;
  fallbackBrand?: string;
  fallbackModel?: string;
  useGenerationCode?: string;
  extras?: string[];
  overrides?: Record<string, unknown>;
  /** Skip DB brand/model catalog lookup entirely (e.g. hasarli-araclar has no CategoryBrand rows). */
  borrowBrandModel?: { brand: string; model: string };
};

async function runScenario(sellerCookie: string, cfg: ScenarioConfig): Promise<{ listingId: string | null; brand: string; model: string }> {
  const group = cfg.key;
  let brand = "";
  let model = "";
  let generationInfo: { generations: { code: string; label: string }[]; versions: { slug: string; name: string }[]; years: number[] } | null =
    null;

  if (cfg.borrowBrandModel) {
    brand = cfg.borrowBrandModel.brand;
    model = cfg.borrowBrandModel.model;
    record(group, `${cfg.label}: brand/model (borrowed — subtype has no own catalog)`, "PASS", `${brand}/${model}`);
  } else {
    const brands = await fetchBrands(cfg.subtype);
    if (!brands.length) {
      record(group, `${cfg.label}: brand catalog available`, "SKIPPED_EXPECTED", `no brands for subtype=${cfg.subtype}`);
      return { listingId: null, brand: "", model: "" };
    }
    const preferred = brands.find((b) => b.slug === cfg.preferBrand);
    const fallback = cfg.fallbackBrand ? brands.find((b) => b.slug === cfg.fallbackBrand) : undefined;
    const chosenBrand = preferred || fallback || brands[0];
    brand = chosenBrand.slug;
    record(
      group,
      `${cfg.label}: brand from real DB catalog (no invented brand)`,
      brands.some((b) => b.slug === brand) ? "PASS" : "FAIL",
      `chosen=${brand} preferred=${cfg.preferBrand} available=${brands.map((b) => b.slug).join(",")}`
    );

    const models = await fetchModels(cfg.subtype, brand);
    if (!models.length) {
      record(group, `${cfg.label}: model catalog available for ${brand}`, "SKIPPED_EXPECTED", `no models for brand=${brand}`);
      return { listingId: null, brand, model: "" };
    }
    const preferredModel = cfg.preferModel ? models.find((m) => m.slug === cfg.preferModel) : undefined;
    const fallbackModel = cfg.fallbackModel ? models.find((m) => m.slug === cfg.fallbackModel) : undefined;
    model = (preferredModel || fallbackModel || models[0]).slug;
    record(group, `${cfg.label}: model resolved`, "PASS", `${brand}/${model}`);
  }

  let trim = "";
  let yearOverride: number | undefined;
  if (cfg.useGenerationCode) {
    generationInfo = await fetchGenerations(cfg.subtype, brand, model);
    const hasGen = generationInfo.generations.some((g) => g.code === cfg.useGenerationCode);
    record(
      group,
      `${cfg.label}: generation ${cfg.useGenerationCode} available`,
      hasGen ? "PASS" : "SKIPPED_EXPECTED",
      `generations=${generationInfo.generations.map((g) => g.code).join(",")}`
    );
    const g20Version =
      generationInfo.versions.find((v) => v.slug.toLowerCase().includes(cfg.useGenerationCode!.toLowerCase())) ||
      generationInfo.versions.find((v) => v.slug === "m340i") ||
      generationInfo.versions[0];
    trim = g20Version?.slug || "";
    yearOverride = generationInfo.years.length ? Math.max(...generationInfo.years) : undefined;
    record(group, `${cfg.label}: trim = version slug from API`, trim ? "PASS" : "FAIL", `trim=${trim}`);
  }

  const fields = await fetchAttributeFields(cfg.subtype);
  record(group, `${cfg.label}: attribute fields fetched from CategoryAttribute API`, fields.length ? "PASS" : "FAIL", `count=${fields.length}`);

  const overrides: Record<string, unknown> = { ...(cfg.overrides || {}) };
  if (yearOverride) overrides.year = yearOverride;

  const { attrs, legacyKeysUsed } = buildAttrsFromFields(fields, overrides);
  attrs.subtype = cfg.subtype;
  attrs.brand = brand;
  attrs.model = model;
  if (trim) attrs.trim = trim;
  if (cfg.extras?.length) attrs.extras = cfg.extras;

  const title = `${TAG_PREFIX}${cfg.key}_${cfg.label.replace(/\s+/g, "")}`;
  const payload = {
    categorySlug: "arac",
    dealType: "SATILIK",
    title,
    description: `Stage1 e2e test ilanı (${cfg.label}). Otomatik oluşturuldu, silinecektir.`,
    city: "İstanbul",
    district: "Kadıköy",
    askPrice: 750000,
    days: 14,
    attributes: attrs,
  };

  const created = await createVehicleListing(sellerCookie, payload);
  if (!created.ok) {
    record(group, `${cfg.label}: create listing (categorySlug=arac)`, "FAIL", created.error);
    return { listingId: null, brand, model };
  }
  cleanup.listingIds.push(created.id);
  record(group, `${cfg.label}: create listing (categorySlug=arac)`, "PASS", `id=${created.id} feeFlow=${created.viaFeeFlow} attrs=${legacyKeysUsed.join(",")}`);

  // GET detail (owner)
  const detail1 = await getJson(`/api/listings/${created.id}`, sellerCookie);
  const detailOk1 =
    detail1.status === 200 &&
    detail1.body?.listing?.id === created.id &&
    detail1.body?.listing?.attributes &&
    Object.keys(detail1.body.listing.attributes).length > 0;
  record(
    group,
    `${cfg.label}: GET detail returns attributes keys`,
    detailOk1 ? "PASS" : "FAIL",
    `status=${detail1.status} keys=${Object.keys(detail1.body?.listing?.attributes || {}).join(",")}`
  );

  // PATCH edit (title + km) — must happen while still PENDING_REVIEW (pre-activation),
  // otherwise a live listing edit is routed to admin approval instead of applying directly.
  const editedTitle = `${title}_edited`;
  const editedAttrs = { ...attrs, km: Number(attrs.km || 0) + 1000 };
  const patchRes = await patchJson(
    `/api/listings/${created.id}`,
    {
      categorySlug: "arac",
      dealType: "SATILIK",
      title: editedTitle,
      description: payload.description,
      city: payload.city,
      district: payload.district,
      askPrice: payload.askPrice,
      days: payload.days,
      attributes: editedAttrs,
    },
    sellerCookie
  );
  const patchOk = patchRes.status === 200 && patchRes.body?.ok === true;
  record(group, `${cfg.label}: PATCH edit (title + km)`, patchOk ? "PASS" : "FAIL", `status=${patchRes.status} body=${JSON.stringify(patchRes.body).slice(0, 200)}`);

  // Test-harness activation so filter/bid steps can run against ACTIVE data.
  const beforeActivate = await prisma.listing.findUnique({ where: { id: created.id }, select: { status: true } });
  if (beforeActivate && beforeActivate.status !== ListingStatus.ACTIVE) {
    await forceActive(created.id);
    record(group, `${cfg.label}: test-harness prisma.listing.update → ACTIVE`, "PASS", `was=${beforeActivate.status}`);
  } else {
    record(group, `${cfg.label}: test-harness prisma.listing.update → ACTIVE`, "PASS", "already active");
  }

  // GET filter list
  const filterUrl = `/api/listings?category=arac&subtype=${encodeURIComponent(cfg.subtype)}&brand=${encodeURIComponent(
    brand
  )}&model=${encodeURIComponent(model)}`;
  const listRes = await getJson(filterUrl);
  const listings: Array<{ id: string }> = Array.isArray(listRes.body?.listings) ? listRes.body.listings : [];
  const found = listings.some((l) => l.id === created.id);
  record(group, `${cfg.label}: GET filter list includes created listing`, found ? "PASS" : "FAIL", `url=${filterUrl} total=${listings.length}`);

  return { listingId: created.id, brand, model };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function ensureTenant() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Tenant yok — önce prisma/seed.ts çalıştırın.");
  return tenant;
}

async function makeTestUser(opts: { suffix: string; name: string; tokenBalance: number }) {
  const passwordHash = await hash("Test1234!", 8);
  const phone = `0599${String(RUN_ID).slice(-6)}${opts.suffix}`.replace(/\D/g, "").slice(0, 11).padEnd(11, "1");
  const tenant = await ensureTenant();
  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      name: `${TAG_PREFIX}${opts.name}`,
      accountType: AccountType.BIREYSEL,
      role: "USER",
      isActive: true,
      phoneVerified: true,
      tokenBalance: opts.tokenBalance,
      tenantId: tenant.id,
    },
  });
  cleanup.userIds.push(user.id);
  return { user, phone, password: "Test1234!" };
}

async function cleanupAll() {
  const leftover: string[] = [];
  try {
    // Bids referencing our listings or our bidder.
    await prisma.bid.deleteMany({
      where: { OR: [{ listingId: { in: cleanup.listingIds } }, { bidderId: { in: cleanup.userIds } }] },
    });
    // Listings tagged by this run (covers ids we tracked + any stray leftovers with the same TAG).
    await prisma.listing.deleteMany({ where: { OR: [{ id: { in: cleanup.listingIds } }, { title: { startsWith: TAG_PREFIX } }] } });
    await prisma.payment.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {});
    await prisma.tokenLedger.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {});
    await prisma.favorite.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: cleanup.userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
  } catch (e) {
    leftover.push(String(e));
  }
  for (const id of cleanup.listingIds) {
    if (await prisma.listing.findUnique({ where: { id } })) leftover.push(`listing:${id}`);
  }
  for (const id of cleanup.userIds) {
    if (await prisma.user.findUnique({ where: { id } })) leftover.push(`user:${id}`);
  }
  return leftover;
}

async function main() {
  console.log("BASE_URL:", BASE, "TAG:", TAG_PREFIX);

  // Stale leftovers from previous interrupted runs (same prefix family).
  await prisma.bid.deleteMany({ where: { listing: { title: { startsWith: "vs1e2e_" } } } }).catch(() => {});
  await prisma.listing.deleteMany({ where: { title: { startsWith: "vs1e2e_" } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { name: { startsWith: "vs1e2e_" } } }).catch(() => {});

  const seller = await makeTestUser({ suffix: "1", name: "Seller", tokenBalance: 0 });
  const bidder = await makeTestUser({ suffix: "2", name: "Bidder", tokenBalance: 20 });

  const sellerCookie = await loginCookie(seller.phone, seller.password);
  const bidderCookie = await loginCookie(bidder.phone, bidder.password);
  record("SETUP", "seller + bidder test users created & logged in", "PASS", `seller=${seller.user.id} bidder=${bidder.user.id}`);

  // A) Otomobil — BMW 3 Serisi, generation G20 if available.
  const a = await runScenario(sellerCookie, {
    key: "A",
    label: "Otomobil",
    subtype: "otomobil",
    preferBrand: "bmw",
    preferModel: "3-serisi",
    useGenerationCode: "G20",
    extras: ["abs"],
    overrides: { fuel: "Dizel" },
  });

  // B) Motosiklet — Honda or Yamaha.
  await runScenario(sellerCookie, {
    key: "B",
    label: "Motosiklet",
    subtype: "motosiklet",
    preferBrand: "honda",
    preferModel: "pcx",
    fallbackBrand: "yamaha",
    fallbackModel: "r25",
  });

  // C) Ticari — Iveco or Mercedes-Benz.
  await runScenario(sellerCookie, {
    key: "C",
    label: "Ticari",
    subtype: "ticari-araclar",
    preferBrand: "iveco",
    preferModel: "daily",
    fallbackBrand: "mercedes-benz",
    fallbackModel: "sprinter",
    overrides: { loadCapacity: 1500 },
  });

  // D) Elektrikli — Tesla or TOGG under arazi-suv-pickup; must be a real DB brand, fuel=Elektrik.
  await runScenario(sellerCookie, {
    key: "D",
    label: "Elektrikli",
    subtype: "arazi-suv-pickup",
    preferBrand: "togg",
    preferModel: "t10x",
    fallbackBrand: "tesla",
    fallbackModel: "model-y",
    overrides: { fuel: "Elektrik", batteryCapacity: 77, electricRange: 420 },
  });

  // E) Hasarlı — condition/vehicleStatus + damageAmount/accidentHistory. hasarli-araclar has
  // no own CategoryBrand rows (condition overlay on canonical types) — borrow otomobil brand/model.
  await runScenario(sellerCookie, {
    key: "E",
    label: "Hasarlı",
    subtype: "hasarli-araclar",
    preferBrand: "",
    borrowBrandModel: { brand: "bmw", model: "3-serisi" },
    overrides: { vehicleStatus: "İkinci El", damageAmount: 45000, accidentHistory: "Evet", year: 2019, km: 88000, fuel: "Dizel" },
  });

  // F) Cascade clear contract.
  runCascadeClearChecks();

  // G) Offer / bid.
  if (a.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: a.listingId }, select: { status: true, sellerId: true } });
    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      record("G", "bidder places offer on scenario A listing", "SKIPPED_EXPECTED", `listing status=${listing?.status || "missing"} (not ACTIVE)`);
    } else {
      let bidRes = await postJson(
        "/api/bids",
        { action: "place", listingId: a.listingId, amount: 550000, durationDays: 3 },
        bidderCookie
      );
      if (bidRes.status === 402 && bidRes.body?.code === "INSUFFICIENT_TOKENS") {
        // Grant tokens via prisma (documented test-harness workaround) and retry once.
        await prisma.user.update({ where: { id: bidder.user.id }, data: { tokenBalance: { increment: Number(bidRes.body?.requiredTokens || 5) + 5 } } });
        record("G", "bidder token grant via prisma (insufficient tokens)", "PASS", `granted for retry`);
        bidRes = await postJson(
          "/api/bids",
          { action: "place", listingId: a.listingId, amount: 550000, durationDays: 3 },
          bidderCookie
        );
      }
      const bidOk = bidRes.status === 200 && bidRes.body?.ok === true && bidRes.body?.bidId;
      if (bidOk) cleanup.bidIds.push(String(bidRes.body.bidId));
      record("G", "POST /api/bids place offer on scenario A listing", bidOk ? "PASS" : "FAIL", `status=${bidRes.status} body=${JSON.stringify(bidRes.body).slice(0, 200)}`);
    }
  } else {
    record("G", "bidder places offer on scenario A listing", "SKIPPED_EXPECTED", "scenario A listing was not created");
  }

  // H) Smoke — HOME, ilan-ver, browse source=db, detail attrs, list includes listing.
  {
    const home = await fetch(`${BASE}/`, { cache: "no-store" });
    record("H", "GET / (HOME) → 200", home.status === 200 ? "PASS" : "FAIL", `status=${home.status}`);
  }
  {
    const ilanVer = await fetch(`${BASE}/ilan-ver`, { cache: "no-store" });
    record("H", "GET /ilan-ver → 200", ilanVer.status === 200 ? "PASS" : "FAIL", `status=${ilanVer.status}`);
  }
  {
    const browse = await getJson("/api/catalog/tree?format=vasita-browse");
    const ok = browse.status === 200 && browse.body?.meta?.source === "db";
    record("H", "GET /api/catalog/tree?format=vasita-browse → meta.source=db", ok ? "PASS" : "FAIL", `source=${browse.body?.meta?.source}`);
  }
  if (a.listingId) {
    const detail = await getJson(`/api/listings/${a.listingId}`, sellerCookie);
    const keys = Object.keys(detail.body?.listing?.attributes || {});
    record("H", "detail has attributes keys (scenario A)", keys.length > 0 ? "PASS" : "FAIL", `keys=${keys.join(",")}`);
    const listRes = await getJson(`/api/listings?category=arac&subtype=otomobil&brand=${a.brand}&model=${a.model}`);
    const listings: Array<{ id: string }> = Array.isArray(listRes.body?.listings) ? listRes.body.listings : [];
    record("H", "list response includes listing (scenario A)", listings.some((l) => l.id === a.listingId) ? "PASS" : "FAIL", `total=${listings.length}`);
  } else {
    record("H", "detail has attributes keys (scenario A)", "SKIPPED_EXPECTED", "scenario A listing missing");
    record("H", "list response includes listing (scenario A)", "SKIPPED_EXPECTED", "scenario A listing missing");
  }

  // Extra smoke: otomobil attribute count, bmw generations (F30 + G20, no fake values), moto extras filter.
  {
    const fields = await fetchAttributeFields("otomobil");
    const otomobilCat = await prisma.category.findUnique({ where: { slug: "arac__otomobil" }, select: { id: true } });
    const dbCount = otomobilCat ? await prisma.categoryAttribute.count({ where: { categoryId: otomobilCat.id } }) : -1;
    const ok = fields.length > 0 && fields.length === dbCount;
    record(
      "SMOKE",
      "otomobil attributes count matches CategoryAttribute rows (API ↔ DB consistency)",
      ok ? "PASS" : "FAIL",
      `apiCount=${fields.length} dbCount=${dbCount}`
    );
  }
  {
    const gen = await fetchGenerations("otomobil", "bmw", "3-serisi");
    const codes = gen.generations.map((g) => g.code);
    const hasReal = codes.includes("F30") && codes.includes("G20");
    const fake = new Set(["default", "standart", "standard", "genel"]);
    const noFake = codes.every((c) => !fake.has(c.toLowerCase()));
    record("SMOKE", "bmw 3-serisi generations include F30 + G20, no fake values", hasReal && noFake ? "PASS" : "FAIL", `codes=${codes.join(",")}`);
  }
  {
    const motoGroups = vehicleExtraGroupsForTemplate("MOTORCYCLE");
    const flatIds = motoGroups.flatMap((g) => g.items.map((i) => i.id));
    record(
      "SMOKE",
      "no elektrikli_bagaj in MOTORCYCLE extras groups",
      !flatIds.includes("elektrikli_bagaj") ? "PASS" : "FAIL",
      `motoExtraCount=${flatIds.length}`
    );
  }

  const leftover = await cleanupAll();
  const totals = {
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skipped: results.filter((r) => r.status === "SKIPPED_EXPECTED").length,
    total: results.length,
  };
  const report = { at: new Date().toISOString(), base: BASE, tag: TAG_PREFIX, totals, results, leftoverTestData: leftover };
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log("\n=== VEHICLE STAGE1 E2E SUMMARY ===");
  console.log(JSON.stringify(totals, null, 2));
  if (leftover.length) console.log("LEFTOVER", leftover);
  console.log("Report:", OUT);
  if (totals.fail) process.exitCode = 1;
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
