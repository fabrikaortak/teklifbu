/**
 * Mağaza paneli (satıcı) + Admin panel smoke testi.
 *
 * Gerçek HTTP istekleriyle (fetch) satıcı ve admin panel rotalarını gezer,
 * her rota için status kodu, "Yükleniyor" tek başına mı, 404 mü, hata metni
 * var mı gibi sinyalleri kaydeder ve JSON rapor üretir.
 *
 * NOT: Sayfa HTML'i düz `fetch` ile alınır — tarayıcı JS'i (React hydration,
 * useEffect ile veri çekme) ÇALIŞMAZ. Bu yüzden "use client" sayfalar için
 * gördüğümüz HTML, sunucunun ürettiği ilk (pre-hydration) durumdur. Satıcı
 * paneli (`MagazaPanelGate`) `ready=false` ile başladığından bu ilk HTML'de
 * her zaman "Satıcı paneli yükleniyor…" tek başına görünür — bu beklenen bir
 * SSR anlık görüntüsüdür, canlı tarayıcıda JS çalıştıktan sonra içerik dolar.
 *
 * npx tsx scripts/smoke-magaza-admin-panels.ts
 * npm run smoke:panels
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3010").replace(/\/+$/, "");
const SESSION_COOKIE = "teklifbu_session";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteResult = {
  path: string;
  label: string;
  kind: "page" | "api";
  status: number | null;
  ok: boolean;
  ms: number;
  hasYukleniyorAlone: boolean;
  has404: boolean;
  hasErrorText: boolean;
  expected404: boolean;
  textSample: string;
  keywords?: Record<string, boolean>;
  error?: string;
};

type LoginResult = {
  identifier: string;
  ok: boolean;
  status: number;
  hasCookie: boolean;
  userId?: string;
  userRole?: string;
  ms: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// HTML / body analysis helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function analyzeBody(body: string, status: number, contentType: string) {
  const isHtml = contentType.includes("text/html");
  const text = isHtml ? stripHtml(body) : body.trim();

  // "Yükleniyor" tek başına: görünür metnin neredeyse tamamı bu kelimeden
  // ibaret (şablon/menü render olmamış, sadece bir yükleniyor kartı var).
  const hasYukleniyorAlone =
    isHtml && /y[uü]kleniyor/i.test(text) && text.replace(/[.…\s]/g, "").length < 80;

  const has404 =
    status === 404 || /this page could not be found|sayfa bulunamad[ıi]|404[:.\s-]/i.test(text);

  const hasErrorText =
    /sunucu hatas[ıi]|bir hata olu[şs]tu|uygulama hatas[ıi]|application error|internal server error|unhandled runtime error|beklenmeyen bir hata/i.test(
      text
    );

  return { hasYukleniyorAlone, has404, hasErrorText, textSample: text.slice(0, 220) };
}

function extractSessionCookie(res: Response): string | null {
  const withGetSetCookie = res.headers as unknown as { getSetCookie?: () => string[] };
  const rawCookies =
    typeof withGetSetCookie.getSetCookie === "function"
      ? withGetSetCookie.getSetCookie()
      : (res.headers.get("set-cookie") || "").split(/,(?=[^;]+?=)/);
  for (const c of rawCookies) {
    const m = c.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (m) return `${SESSION_COOKIE}=${m[1]}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function loginAndGetCookie(identifier: string, password: string): Promise<{ cookie: string | null; login: LoginResult }> {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", identifier, password }),
  });
  const cookie = extractSessionCookie(res);
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  return {
    cookie,
    login: {
      identifier,
      ok: res.ok && !!cookie,
      status: res.status,
      hasCookie: !!cookie,
      userId: (json as { user?: { id?: string } }).user?.id,
      userRole: (json as { user?: { role?: string } }).user?.role,
      ms: Date.now() - started,
      error: !res.ok ? String((json as { error?: string }).error || "login failed") : undefined,
    } as LoginResult,
  };
}

async function visit(
  path: string,
  label: string,
  kind: "page" | "api",
  cookie: string | null,
  opts?: { expected404?: boolean; keywordCheck?: Record<string, string[]> }
): Promise<RouteResult> {
  const started = Date.now();
  const expected404 = opts?.expected404 || false;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: "manual",
    });
    const ms = Date.now() - started;
    const contentType = res.headers.get("content-type") || "";
    const body = await res.text().catch(() => "");
    const analysis = analyzeBody(body, res.status, contentType);

    let keywords: Record<string, boolean> | undefined;
    if (opts?.keywordCheck) {
      keywords = {};
      for (const [name, variants] of Object.entries(opts.keywordCheck)) {
        keywords[name] = variants.some((v) => body.includes(v));
      }
    }

    const ok = expected404
      ? res.status === 404 || analysis.has404
      : res.status < 400 && !analysis.hasErrorText;

    return {
      path,
      label,
      kind,
      status: res.status,
      ok,
      ms,
      expected404,
      ...analysis,
      keywords,
    };
  } catch (e) {
    return {
      path,
      label,
      kind,
      status: null,
      ok: false,
      ms: Date.now() - started,
      hasYukleniyorAlone: false,
      has404: false,
      hasErrorText: false,
      expected404,
      textSample: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Route inventories
// ---------------------------------------------------------------------------

// Kaynak: src/components/magaza/MagazaPanelShell.tsx -> NAV sabiti (tam liste)
const SELLER_PAGES: Array<{ path: string; label: string }> = [
  { path: "/magaza/panel", label: "Özet" },
  { path: "/magaza/panel/ilanlar", label: "İlanlar" },
  { path: "/magaza/panel/siparisler", label: "Sipariş & kargo" },
  { path: "/magaza/panel/sorular", label: "Soru–cevap" },
];

// Kaynak: src/app/api/magaza/panel/route.ts (view= parametreleri) + /api/escrow
const SELLER_APIS: Array<{ path: string; label: string }> = [
  { path: "/api/magaza/panel?view=overview", label: "Panel özeti" },
  { path: "/api/magaza/panel?view=listings", label: "İlan listesi" },
  { path: "/api/magaza/panel?view=orders", label: "Sipariş listesi" },
  { path: "/api/magaza/panel?view=questions", label: "Soru–cevap listesi" },
  { path: "/api/escrow", label: "Güvenli Öde işlemleri" },
];

// Kaynak: src/components/admin/AdminShell.tsx -> nav dizisi (children dahil,
// verticalChildren() ile üretilen emlak-vasita / alisveris / premium alt
// sayfaları + satici-paneli / kullanicilar / odemeler / gelirler / raporlar /
// ayarlar alt menüleri) + kullanıcı menüsündeki /admin/hesap.
const ADMIN_PAGES: Array<{ path: string; label: string }> = [
  { path: "/admin", label: "Genel Bakış" },

  // Vasıta & Emlak (verticalChildren, extras yok)
  { path: "/admin/emlak-vasita", label: "Vasıta & Emlak — Özet" },
  { path: "/admin/emlak-vasita/ilanlar", label: "Vasıta & Emlak — İlanlar" },
  { path: "/admin/emlak-vasita/ilan-onay", label: "Vasıta & Emlak — İlan onayları" },
  { path: "/admin/emlak-vasita/duzenleme-onay", label: "Vasıta & Emlak — Düzenleme talepleri" },
  { path: "/admin/emlak-vasita/ek-sure", label: "Vasıta & Emlak — Ek süre" },
  { path: "/admin/emlak-vasita/teklifler", label: "Vasıta & Emlak — Teklifler" },
  { path: "/admin/emlak-vasita/kategoriler", label: "Vasıta & Emlak — Kategoriler" },
  { path: "/admin/emlak-vasita/demo-ilanlar", label: "Vasıta & Emlak — Demo ilanlar" },
  { path: "/admin/emlak-vasita/icerik", label: "Vasıta & Emlak — İçerik" },
  { path: "/admin/emlak-vasita/reklam", label: "Vasıta & Emlak — Reklam alanları" },
  { path: "/admin/emlak-vasita/ayarlar", label: "Vasıta & Emlak — Ayarlar" },

  // Alışveriş (verticalChildren + extras)
  { path: "/admin/alisveris", label: "Alışveriş — Özet" },
  { path: "/admin/alisveris/ilanlar", label: "Alışveriş — İlanlar" },
  { path: "/admin/alisveris/ilan-onay", label: "Alışveriş — İlan onayları (doğru yol)" },
  { path: "/admin/alisveris/duzenleme-onay", label: "Alışveriş — Düzenleme talepleri" },
  { path: "/admin/alisveris/ek-sure", label: "Alışveriş — Ek süre" },
  { path: "/admin/alisveris/teklifler", label: "Alışveriş — Teklifler" },
  { path: "/admin/alisveris/kategoriler", label: "Alışveriş — Kategoriler" },
  { path: "/admin/alisveris/demo-ilanlar", label: "Alışveriş — Demo ilanlar" },
  { path: "/admin/alisveris/icerik", label: "Alışveriş — İçerik" },
  { path: "/admin/alisveris/reklam", label: "Alışveriş — Reklam alanları" },
  { path: "/admin/alisveris/siparisler", label: "Alışveriş — Siparişler" },
  { path: "/admin/alisveris/magaza-paketleri", label: "Alışveriş — Mağaza paketleri" },
  { path: "/admin/alisveris/abonelikler", label: "Alışveriş — Abonelikler" },
  { path: "/admin/alisveris/markalar", label: "Alışveriş — Markalar" },
  { path: "/admin/alisveris/modeller", label: "Alışveriş — Modeller" },
  { path: "/admin/alisveris/ozellikler", label: "Alışveriş — Özellikler" },
  { path: "/admin/alisveris/kategori-markalari", label: "Alışveriş — Kategori markaları" },
  { path: "/admin/alisveris/kategori-modelleri", label: "Alışveriş — Kategori modelleri" },
  { path: "/admin/alisveris/kategori-ozellikleri", label: "Alışveriş — Kategori özellikleri" },
  { path: "/admin/alisveris/katalog-urunleri", label: "Alışveriş — Katalog ürünleri" },
  { path: "/admin/alisveris/urun-talepleri", label: "Alışveriş — Ürün talepleri" },
  { path: "/admin/alisveris/katalog-teklifler", label: "Alışveriş — SellerOffer listesi" },
  { path: "/admin/alisveris/duplicate-urunler", label: "Alışveriş — Duplicate / barkod" },
  { path: "/admin/alisveris/ayarlar", label: "Alışveriş — Ayarlar" },

  // Premium (verticalChildren, extras yok)
  { path: "/admin/premium", label: "Premium — Özet" },
  { path: "/admin/premium/ilanlar", label: "Premium — İlanlar" },
  { path: "/admin/premium/ilan-onay", label: "Premium — İlan onayları" },
  { path: "/admin/premium/duzenleme-onay", label: "Premium — Düzenleme talepleri" },
  { path: "/admin/premium/ek-sure", label: "Premium — Ek süre" },
  { path: "/admin/premium/teklifler", label: "Premium — Teklifler" },
  { path: "/admin/premium/kategoriler", label: "Premium — Kategoriler" },
  { path: "/admin/premium/demo-ilanlar", label: "Premium — Demo ilanlar" },
  { path: "/admin/premium/icerik", label: "Premium — İçerik" },
  { path: "/admin/premium/reklam", label: "Premium — Reklam alanları" },
  { path: "/admin/premium/ayarlar", label: "Premium — Ayarlar" },

  // Satıcı paneli (admin tarafı)
  { path: "/admin/satici-paneli", label: "Satıcı paneli — Özet" },
  { path: "/admin/satici-paneli/siparisler", label: "Satıcı paneli — Sipariş & kargo" },
  { path: "/admin/satici-paneli/sorular", label: "Satıcı paneli — Soru–cevap" },
  { path: "/admin/satici-paneli/ayarlar", label: "Satıcı paneli — Ayarlar" },

  // Kullanıcılar
  { path: "/admin/kullanicilar", label: "Kullanıcılar — Tüm Kullanıcılar" },
  { path: "/admin/ticari-uyeler", label: "Kullanıcılar — Kurumsal Onay" },
  { path: "/admin/yorumlar", label: "Kullanıcılar — Satıcı Yorumları" },
  { path: "/admin/satici-talepleri", label: "Kullanıcılar — Satıcı Talepleri" },
  { path: "/admin/kullanicilar/ayarlar", label: "Kullanıcılar — Ayarlar" },

  { path: "/admin/mesajlar", label: "Mesajlar" },

  // Ödemeler
  { path: "/admin/odemeler", label: "Ödemeler — Ödeme Kayıtları" },
  { path: "/admin/guvenli-ode", label: "Ödemeler — Güvenli Öde / GET Havuzu" },
  { path: "/admin/jeton", label: "Ödemeler — Jeton Paketleri" },
  { path: "/admin/iade-jetonlar", label: "Ödemeler — İade Jetonlar" },
  { path: "/admin/kurumsal", label: "Ödemeler — Kurumsal Paketler" },
  { path: "/admin/odemeler/altyapi", label: "Ödemeler — Altyapı" },
  { path: "/admin/odemeler/ayarlar", label: "Ödemeler — Ayarlar" },

  { path: "/admin/gelirler", label: "Gelirler — Gelir Özeti" },
  { path: "/admin/reklam", label: "Reklam" },
  { path: "/admin/ai", label: "AI" },
  { path: "/admin/raporlar", label: "Raporlar — Özet Rapor" },
  { path: "/admin/kullanici-ayarlari", label: "Kullanıcı ayarları" },
  { path: "/admin/tema", label: "Tema" },
  { path: "/admin/footer", label: "Footer" },
  { path: "/admin/ayarlar", label: "Sistem ayarları — Genel" },
  { path: "/admin/loglar", label: "Log" },

  // Kullanıcı menüsü
  { path: "/admin/hesap", label: "Hesabım (kullanıcı menüsü)" },
];

const TEMA_KEYWORD_CHECK: Record<string, string[]> = {
  Tema: ["Tema", "tema"],
  koyu: ["koyu", "Koyu"],
  açık: ["açık", "Açık", "AÇIK"],
  v2: ["v2", "V2"],
};

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

function printRoute(r: RouteResult) {
  const verdict = r.ok ? "PASS" : "FAIL";
  const flags = [
    r.expected404 ? "expected404" : null,
    r.has404 ? "404-text" : null,
    r.hasErrorText ? "error-text" : null,
    r.hasYukleniyorAlone ? "loading-only" : null,
  ]
    .filter(Boolean)
    .join(",");
  console.log(
    `[${verdict}] ${r.kind.toUpperCase().padEnd(4)} ${String(r.status ?? "ERR").padStart(3)}  ${r.path}${
      flags ? `  (${flags})` : ""
    }${r.error ? `  ERROR: ${r.error}` : ""}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("STAGING_GUARD_OK", fp.maskedUrl, "prodLook=", fp.looksProduction);
  console.log("BASE_URL:", BASE_URL);

  // Prisma ile seed kullanıcılarının varlığını doğrula (erken/açık hata için).
  const sellerPhone = "05321112233";
  const adminPhone = "05000000000";
  const [sellerUser, adminUser] = await Promise.all([
    prisma.user.findUnique({ where: { phone: sellerPhone }, select: { id: true, role: true, name: true } }),
    prisma.user.findUnique({ where: { phone: adminPhone }, select: { id: true, role: true, name: true } }),
  ]);
  console.log(
    "DB check — seller:",
    sellerUser ? `${sellerUser.id} (${sellerUser.name})` : "BULUNAMADI",
    "| admin:",
    adminUser ? `${adminUser.id} (${adminUser.name})` : "BULUNAMADI"
  );

  // ---------------- A) Seller tour ----------------
  console.log("\n=== A) SATICI (MAĞAZA PANELİ) TURU ===");
  const sellerLoginRes = await loginAndGetCookie(sellerPhone, "123456");
  console.log(
    `LOGIN seller (${sellerPhone}):`,
    sellerLoginRes.login.ok ? "OK" : `FAIL (${sellerLoginRes.login.error || sellerLoginRes.login.status})`
  );

  const sellerPageResults: RouteResult[] = [];
  for (const p of SELLER_PAGES) {
    const r = await visit(p.path, p.label, "page", sellerLoginRes.cookie);
    sellerPageResults.push(r);
    printRoute(r);
  }

  const sellerApiResults: RouteResult[] = [];
  for (const a of SELLER_APIS) {
    const r = await visit(a.path, a.label, "api", sellerLoginRes.cookie);
    sellerApiResults.push(r);
    printRoute(r);
  }

  // ---------------- B) Admin tour ----------------
  console.log("\n=== B) ADMIN PANELİ TURU ===");
  const adminLoginRes = await loginAndGetCookie(adminPhone, "admin123");
  console.log(
    `LOGIN admin (${adminPhone}):`,
    adminLoginRes.login.ok ? "OK" : `FAIL (${adminLoginRes.login.error || adminLoginRes.login.status})`
  );

  const adminPageResults: RouteResult[] = [];
  for (const p of ADMIN_PAGES) {
    const isTema = p.path === "/admin/tema";
    const r = await visit(p.path, p.label, "page", adminLoginRes.cookie, {
      keywordCheck: isTema ? TEMA_KEYWORD_CHECK : undefined,
    });
    adminPageResults.push(r);
    printRoute(r);
  }

  // Yanlış yol testi: /admin/alisveris/ilan-onaylari 404 beklenir.
  console.log("\n=== C) YANLIŞ / DOĞRU YOL TESTİ ===");
  const wrongPathResult = await visit(
    "/admin/alisveris/ilan-onaylari",
    "Alışveriş — İlan onayları (YANLIŞ yol, 404 beklenir)",
    "page",
    adminLoginRes.cookie,
    { expected404: true }
  );
  printRoute(wrongPathResult);

  const correctPathResult =
    adminPageResults.find((r) => r.path === "/admin/alisveris/ilan-onay") ||
    (await visit("/admin/alisveris/ilan-onay", "Alışveriş — İlan onayları (doğru yol)", "page", adminLoginRes.cookie));
  console.log(
    `Doğru yol /admin/alisveris/ilan-onay: status=${correctPathResult.status} ok=${correctPathResult.ok}`
  );

  const temaResult = adminPageResults.find((r) => r.path === "/admin/tema");
  if (temaResult?.keywords) {
    console.log(
      "Tema sayfası anahtar kelime kontrolü (pre-hydration HTML):",
      JSON.stringify(temaResult.keywords)
    );
  }

  // ---------------- Report assembly ----------------
  const allNonExempt: RouteResult[] = [
    ...sellerPageResults,
    ...sellerApiResults,
    ...adminPageResults,
  ];
  const unexpectedFailures = allNonExempt.filter(
    (r) => !r.expected404 && (r.status === 404 || (r.status !== null && r.status >= 500))
  );
  const otherFailures = allNonExempt.filter((r) => !r.ok && !unexpectedFailures.includes(r));

  const wrongPathBehavesAsExpected = wrongPathResult.ok;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    methodology:
      "Rotalar düz HTTP fetch ile ziyaret edildi (tarayıcı JS/React hydration çalışmadı). " +
      "'use client' sayfalar için gösterilen HTML, sunucunun ürettiği ilk (pre-hydration) durumdur.",
    dbCheck: {
      seller: sellerUser ? { id: sellerUser.id, role: sellerUser.role, name: sellerUser.name } : null,
      admin: adminUser ? { id: adminUser.id, role: adminUser.role, name: adminUser.name } : null,
    },
    seller: {
      login: sellerLoginRes.login,
      pages: sellerPageResults,
      apis: sellerApiResults,
    },
    admin: {
      login: adminLoginRes.login,
      pages: adminPageResults,
      wrongPathTest: {
        path: wrongPathResult.path,
        expected: "404",
        actualStatus: wrongPathResult.status,
        behavesAsExpected: wrongPathBehavesAsExpected,
        result: wrongPathResult,
      },
      correctPathTest: {
        path: "/admin/alisveris/ilan-onay",
        actualStatus: correctPathResult.status,
        ok: correctPathResult.ok,
      },
      temaKeywordCheck: temaResult?.keywords || null,
    },
    summary: {
      totalRoutesChecked: allNonExempt.length + 1 /* wrong-path test */,
      sellerPagesOk: sellerPageResults.filter((r) => r.ok).length,
      sellerPagesTotal: sellerPageResults.length,
      sellerApisOk: sellerApiResults.filter((r) => r.ok).length,
      sellerApisTotal: sellerApiResults.length,
      adminPagesOk: adminPageResults.filter((r) => r.ok).length,
      adminPagesTotal: adminPageResults.length,
      unexpectedFailures: unexpectedFailures.map((r) => ({ path: r.path, status: r.status, kind: r.kind })),
      otherFailures: otherFailures.map((r) => ({ path: r.path, status: r.status, kind: r.kind, error: r.error })),
      loginOk: sellerLoginRes.login.ok && adminLoginRes.login.ok,
      wrongPathBehavesAsExpected,
    },
  };

  const outDir = join(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "smoke-magaza-admin-panels.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== ÖZET ===");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Rapor yazıldı: ${outPath}`);

  const shouldFail =
    !sellerLoginRes.login.ok ||
    !adminLoginRes.login.ok ||
    unexpectedFailures.length > 0;

  if (shouldFail) {
    console.error(
      `\nSMOKE FAIL: loginOk=${sellerLoginRes.login.ok && adminLoginRes.login.ok} unexpectedFailures=${unexpectedFailures.length}`
    );
    process.exitCode = 1;
  } else {
    console.log("\nSMOKE OK: tüm bilinen rotalar beklenen şekilde yanıt verdi.");
  }
}

main()
  .catch((e) => {
    console.error("SMOKE FAIL (exception)", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
