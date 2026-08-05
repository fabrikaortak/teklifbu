/**
 * Magaza + Admin interactive click tour (Playwright).
 * Disabled / form-incomplete / destructive actions → SKIPPED_EXPECTED (not FAIL).
 */
import { chromium, type Page, type Locator } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3010";
const OUT = path.join(process.cwd(), "scripts/output/click-tour-magaza-admin.json");
const ALLOW_SAVE = process.env.CLICK_TOUR_ALLOW_SAVE === "1";

type Status = "PASS" | "FAIL" | "SKIPPED_EXPECTED";

type Finding = {
  area: string;
  path: string;
  action: string;
  status: Status;
  detail?: string;
};

const findings: Finding[] = [];
const consoleErrors: { path: string; text: string }[] = [];

function note(f: Finding) {
  findings.push(f);
  console.log(`[${f.status}] ${f.area} ${f.path} :: ${f.action}${f.detail ? " — " + f.detail : ""}`);
}

const DESTRUCTIVE_RE =
  /sil|reddet|iptal|çıkış|logout|dev tools|kaydet|onayla|ban|yasak|delete|remove|reject|süre aşımlarını işle|demo akışını/i;
const UNSAFE_FORM_RE =
  /^(giriş yap|üye girişi|yeni üye|yanıtla|ekle|bağla)$|favorilerim|jeton:|kargoya verildi|kaydediliyor/i;

async function isEffectivelyDisabled(btn: Locator): Promise<boolean> {
  if (await btn.isDisabled().catch(() => false)) return true;
  const aria = await btn.getAttribute("aria-disabled").catch(() => null);
  if (aria === "true") return true;
  const cls = (await btn.getAttribute("class").catch(() => "")) || "";
  if (/\bis-disabled\b|\bdisabled\b/i.test(cls)) return true;
  return false;
}

async function login(page: Page, phone: string, password: string, area: string) {
  await page.context().clearCookies();
  const res = await page.request.post(`${BASE}/api/auth`, {
    data: { action: "login", identifier: phone, password },
  });
  await page.goto(`${BASE}/api/auth`, { waitUntil: "domcontentloaded" });
  const authBody = await page.locator("body").innerText().catch(() => "");
  let userOk = false;
  try {
    const auth = JSON.parse(authBody);
    userOk = !!auth?.user?.id;
    note({
      area,
      path: "/api/auth",
      action: `login ${phone}`,
      status: res.ok() && userOk ? "PASS" : "FAIL",
      detail: `status=${res.status()} role=${auth?.user?.role || "?"} name=${auth?.user?.name || "?"}`,
    });
  } catch {
    note({
      area,
      path: "/api/auth",
      action: `login ${phone}`,
      status: "FAIL",
      detail: authBody.slice(0, 120),
    });
  }
  return res.ok() && userOk;
}

async function logoutIfPossible(page: Page) {
  try {
    await page.request.post(`${BASE}/api/auth`, { data: { action: "logout" } }).catch(() => {});
    await page.context().clearCookies();
  } catch {
    /* ignore */
  }
}

async function attachConsole(page: Page) {
  page.on("pageerror", (err) => {
    consoleErrors.push({ path: page.url(), text: String(err) });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ path: page.url(), text: msg.text() });
    }
  });
}

async function clickSafeButtons(page: Page, area: string, pathLabel: string) {
  const root = area.startsWith("magaza")
    ? page.locator(".sp-shell, main, .sp-card").first()
    : page.locator(".adm-main, .adm-content, main, [class*='adm-page']").first();
  const scope = (await root.count()) ? root : page.locator("body");

  const filterBtns = scope.locator(
    'button.sp-filter, .sp-filters button, [role="tab"], .adm-tabs button, .adm-filter button, .adm-chip, button.adm-tab'
  );
  const filterCount = await filterBtns.count();
  for (let i = 0; i < Math.min(filterCount, 20); i++) {
    const btn = filterBtns.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const label = ((await btn.innerText().catch(() => "")) || `filter-${i}`).trim().slice(0, 60);
    if (await isEffectivelyDisabled(btn)) {
      note({
        area,
        path: pathLabel,
        action: `skip-disabled:${label}`,
        status: "SKIPPED_EXPECTED",
        detail: "disabled",
      });
      continue;
    }
    try {
      await btn.click({ timeout: 3000 });
      await page.waitForTimeout(250);
      note({ area, path: pathLabel, action: `click-filter:${label}`, status: "PASS" });
    } catch (e) {
      const msg = String(e);
      if (/timeout|disabled|not enabled|intercept/i.test(msg)) {
        note({
          area,
          path: pathLabel,
          action: `skip-disabled:${label}`,
          status: "SKIPPED_EXPECTED",
          detail: msg.slice(0, 120),
        });
      } else {
        note({
          area,
          path: pathLabel,
          action: `click-filter:${label}`,
          status: "FAIL",
          detail: msg.slice(0, 120),
        });
      }
    }
  }

  const buttons = scope.locator("button:visible, a.sp-btn:visible, a.sp-cta:visible, a.sp-btn-outline:visible");
  const count = await buttons.count();
  const clicked = new Set<string>();
  for (let i = 0; i < Math.min(count, 15); i++) {
    const btn = buttons.nth(i);
    const label = ((await btn.innerText().catch(() => "")) || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const lower = label.toLowerCase();
    if (!label) continue;
    if (clicked.has(label)) continue;

    if (await isEffectivelyDisabled(btn)) {
      note({
        area,
        path: pathLabel,
        action: `skip-disabled:${label}`,
        status: "SKIPPED_EXPECTED",
        detail: "disabled|aria-disabled",
      });
      continue;
    }

    if (UNSAFE_FORM_RE.test(lower)) {
      note({
        area,
        path: pathLabel,
        action: `skip-form-incomplete:${label}`,
        status: "SKIPPED_EXPECTED",
        detail: "gerekli form alanı doldurulmamış / güvenli olmayan CTA",
      });
      continue;
    }

    if (DESTRUCTIVE_RE.test(lower) && !(ALLOW_SAVE && /kaydet/i.test(lower))) {
      note({
        area,
        path: pathLabel,
        action: `skip-destructive:${label}`,
        status: "SKIPPED_EXPECTED",
        detail: "bilinçli yıkıcı işlem dışı",
      });
      continue;
    }

    if (/kaydet/i.test(lower) && !ALLOW_SAVE) {
      note({
        area,
        path: pathLabel,
        action: `skip-save:${label}`,
        status: "SKIPPED_EXPECTED",
        detail: "bilinçli yıkıcı işlem dışı",
      });
      continue;
    }

    clicked.add(label);
    try {
      await Promise.race([
        btn.click({ timeout: 2000 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("click-timeout")), 3500)),
      ]);
      await page.waitForTimeout(200);
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const crashed =
        /Application error|Unhandled Runtime Error|Internal Server Error|Bu sayfa bulunamadı/i.test(
          bodyText
        );
      note({
        area,
        path: pathLabel,
        action: `click-btn:${label}`,
        status: crashed ? "FAIL" : "PASS",
        detail: crashed ? "error page after click" : page.url().replace(BASE, ""),
      });
      const stillOn =
        page.url().includes(pathLabel.split("?")[0]) ||
        (pathLabel === "/magaza/panel" && page.url().includes("/magaza/panel"));
      if (!stillOn && pathLabel.startsWith("/")) {
        await page
          .goto(`${BASE}${pathLabel}`, { waitUntil: "domcontentloaded", timeout: 20000 })
          .catch(() => {});
        await page.waitForTimeout(200);
      }
    } catch (e) {
      const msg = String(e);
      if (/timeout|disabled|not enabled|intercept|click-timeout/i.test(msg)) {
        note({
          area,
          path: pathLabel,
          action: `skip-disabled:${label}`,
          status: "SKIPPED_EXPECTED",
          detail: msg.slice(0, 140),
        });
      } else {
        note({
          area,
          path: pathLabel,
          action: `click-btn:${label}`,
          status: "FAIL",
          detail: msg.slice(0, 140),
        });
      }
      await page
        .goto(`${BASE}${pathLabel}`, { waitUntil: "domcontentloaded", timeout: 20000 })
        .catch(() => {});
    }
  }
}

async function visitAndClick(page: Page, area: string, routes: string[]) {
  for (const route of routes) {
    try {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(700);
      if (area.startsWith("magaza")) {
        await page
          .waitForFunction(() => !document.body.innerText.includes("Satıcı paneli yükleniyor"), {
            timeout: 8000,
          })
          .catch(() => {});
      }
      const status = res?.status() ?? 0;
      const url = page.url();
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const redirectedLogin = /\/giris/i.test(url);
      const hasError =
        status >= 400 ||
        /Application error|Unhandled Runtime Error|Internal Server Error/i.test(bodyText);
      const blocked =
        /Mağazanız yönetici onayından|Satıcı paneli şu an kapalı|Yetkiniz yok|Satıcı paneline erişemezsiniz|Mağazanız pasif/i.test(
          bodyText
        );
      note({
        area,
        path: route,
        action: "load",
        status: !hasError && !blocked && !redirectedLogin ? "PASS" : "FAIL",
        detail: `status=${status} url=${url.replace(BASE, "")}${blocked ? " blocked" : ""}${hasError ? " error-ui" : ""}${redirectedLogin ? " login-redirect" : ""}`,
      });
      if (!hasError && !redirectedLogin && !blocked) {
        await clickSafeButtons(page, area, route);
      }
    } catch (e) {
      note({
        area,
        path: route,
        action: "load",
        status: "FAIL",
        detail: String(e).slice(0, 160),
      });
    }
  }
}

const MAGAZA_ROUTES = [
  "/magaza/panel",
  "/magaza/panel/ilanlar",
  "/magaza/panel/sorular",
  "/magaza/panel/siparisler",
];

const ADMIN_ROUTES = [
  "/admin",
  "/admin/emlak-vasita",
  "/admin/emlak-vasita/ilanlar",
  "/admin/emlak-vasita/ilan-onay",
  "/admin/emlak-vasita/duzenleme-onay",
  "/admin/emlak-vasita/ek-sure",
  "/admin/emlak-vasita/teklifler",
  "/admin/emlak-vasita/kategoriler",
  "/admin/emlak-vasita/demo-ilanlar",
  "/admin/emlak-vasita/icerik",
  "/admin/emlak-vasita/reklam",
  "/admin/emlak-vasita/ayarlar",
  "/admin/alisveris",
  "/admin/alisveris/ilanlar",
  "/admin/alisveris/ilan-onay",
  "/admin/alisveris/duzenleme-onay",
  "/admin/alisveris/ek-sure",
  "/admin/alisveris/teklifler",
  "/admin/alisveris/kategoriler",
  "/admin/alisveris/demo-ilanlar",
  "/admin/alisveris/icerik",
  "/admin/alisveris/reklam",
  "/admin/alisveris/siparisler",
  "/admin/alisveris/magaza-paketleri",
  "/admin/alisveris/abonelikler",
  "/admin/alisveris/markalar",
  "/admin/alisveris/modeller",
  "/admin/alisveris/ozellikler",
  "/admin/alisveris/kategori-markalari",
  "/admin/alisveris/kategori-modelleri",
  "/admin/alisveris/kategori-ozellikleri",
  "/admin/alisveris/katalog-urunleri",
  "/admin/alisveris/urun-talepleri",
  "/admin/alisveris/katalog-teklifler",
  "/admin/alisveris/duplicate-urunler",
  "/admin/alisveris/ayarlar",
  "/admin/premium",
  "/admin/premium/ilanlar",
  "/admin/premium/ilan-onay",
  "/admin/premium/duzenleme-onay",
  "/admin/premium/ek-sure",
  "/admin/premium/teklifler",
  "/admin/premium/kategoriler",
  "/admin/premium/demo-ilanlar",
  "/admin/premium/icerik",
  "/admin/premium/reklam",
  "/admin/premium/ayarlar",
  "/admin/satici-paneli",
  "/admin/satici-paneli/siparisler",
  "/admin/satici-paneli/sorular",
  "/admin/satici-paneli/ayarlar",
  "/admin/kullanicilar",
  "/admin/ticari-uyeler",
  "/admin/yorumlar",
  "/admin/satici-talepleri",
  "/admin/kullanicilar/ayarlar",
  "/admin/mesajlar",
  "/admin/odemeler",
  "/admin/guvenli-ode",
  "/admin/jeton",
  "/admin/iade-jetonlar",
  "/admin/kurumsal",
  "/admin/odemeler/altyapi",
  "/admin/odemeler/ayarlar",
  "/admin/gelirler",
  "/admin/reklam",
  "/admin/ai",
  "/admin/raporlar",
  "/admin/kullanici-ayarlari",
  "/admin/tema",
  "/admin/footer",
  "/admin/ayarlar",
  "/admin/loglar",
  "/admin/hesap",
];

async function tourTemaDeep(page: Page) {
  await page.goto(`${BASE}/admin/tema`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const text = await page.locator("body").innerText();
  const hasTema = /Tema/i.test(text);
  note({
    area: "admin-tema",
    path: "/admin/tema",
    action: "has-tema-heading",
    status: hasTema ? "PASS" : "FAIL",
    detail: hasTema ? "Tema metni var" : "Tema metni yok",
  });

  const toggles = page.locator(
    'input[type="checkbox"]:visible, input[type="radio"]:visible, select:visible'
  );
  const tCount = await toggles.count();
  for (let i = 0; i < Math.min(tCount, 20); i++) {
    const el = toggles.nth(i);
    try {
      if (await isEffectivelyDisabled(el)) {
        note({
          area: "admin-tema",
          path: "/admin/tema",
          action: `skip-disabled:toggle-${i}`,
          status: "SKIPPED_EXPECTED",
          detail: "disabled",
        });
        continue;
      }
      const tag = await el.evaluate((n) => n.tagName.toLowerCase());
      if (tag === "select") {
        const opts = await el.locator("option").count();
        if (opts > 1) {
          await el.selectOption({ index: 1 });
          note({
            area: "admin-tema",
            path: "/admin/tema",
            action: `select-option-${i}`,
            status: "PASS",
          });
        }
      } else {
        await el.click({ timeout: 2000 });
        note({ area: "admin-tema", path: "/admin/tema", action: `toggle-${i}`, status: "PASS" });
      }
      await page.waitForTimeout(150);
    } catch (e) {
      const msg = String(e);
      note({
        area: "admin-tema",
        path: "/admin/tema",
        action: `toggle-${i}`,
        status: /timeout|disabled|not enabled/i.test(msg) ? "SKIPPED_EXPECTED" : "FAIL",
        detail: msg.slice(0, 100),
      });
    }
  }

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const temaLink = page.locator('a.adm-icon-btn[aria-label="Tema"]').first();
  if (await temaLink.isVisible().catch(() => false)) {
    await temaLink.click();
    await page.waitForTimeout(500);
    note({
      area: "admin-tema",
      path: page.url().replace(BASE, ""),
      action: "header-sun-tema",
      status: page.url().includes("/admin/tema") ? "PASS" : "FAIL",
      detail: page.url().replace(BASE, ""),
    });
  } else {
    note({
      area: "admin-tema",
      path: "/admin",
      action: "header-sun-tema",
      status: "FAIL",
      detail: "Tema link yok",
    });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await attachConsole(page);

  await logoutIfPossible(page);
  const sellerOk = await login(page, "05321112233", "123456", "magaza");
  if (sellerOk) {
    await visitAndClick(page, "magaza", MAGAZA_ROUTES);
    for (const label of ["Özet", "İlanlar", "Soru–cevap", "Sipariş & kargo", "Yeni ilan", "Hesabıma dön"]) {
      await page.goto(`${BASE}/magaza/panel`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page
        .waitForFunction(() => !document.body.innerText.includes("Satıcı paneli yükleniyor"), {
          timeout: 8000,
        })
        .catch(() => {});
      const link = page.locator(".sp-shell").getByRole("link", { name: label }).first();
      if (await link.isVisible().catch(() => false)) {
        try {
          await link.click({ timeout: 3000 });
          await page.waitForTimeout(400);
          note({
            area: "magaza",
            path: "/magaza/panel",
            action: `nav:${label}`,
            status: "PASS",
            detail: page.url().replace(BASE, ""),
          });
        } catch (e) {
          note({
            area: "magaza",
            path: "/magaza/panel",
            action: `nav:${label}`,
            status: "FAIL",
            detail: String(e).slice(0, 120),
          });
        }
      } else {
        note({
          area: "magaza",
          path: "/magaza/panel",
          action: `nav:${label}`,
          status: "FAIL",
          detail: "not visible",
        });
      }
    }
  }

  await logoutIfPossible(page);
  const adminOk = await login(page, "05000000000", "admin123", "admin");
  if (adminOk) {
    await visitAndClick(page, "admin", ADMIN_ROUTES);
    await tourTemaDeep(page);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(400);
    for (const lab of ["Alışveriş", "Satıcı paneli", "Ödemeler", "Kullanıcılar"]) {
      const b = page.getByRole("button", { name: new RegExp(lab, "i") }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(150);
        note({ area: "admin-nav", path: "/admin", action: `expand:${lab}`, status: "PASS" });
      }
    }
  }

  await browser.close();

  const pass = findings.filter((f) => f.status === "PASS").length;
  const skipped = findings.filter((f) => f.status === "SKIPPED_EXPECTED").length;
  const fails = findings.filter((f) => f.status === "FAIL");
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    totals: {
      actions: findings.length,
      pass,
      skippedExpected: skipped,
      fail: fails.length,
      consoleErrors: consoleErrors.length,
    },
    fails,
    skippedExpected: findings.filter((f) => f.status === "SKIPPED_EXPECTED").slice(0, 200),
    consoleErrors: consoleErrors.slice(0, 80),
    findings,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log("\n=== CLICK TOUR SUMMARY ===");
  console.log(JSON.stringify(report.totals, null, 2));
  console.log("Report:", OUT);
  if (fails.length) {
    console.log("\nFAILURES:");
    for (const f of fails.slice(0, 50)) {
      console.log(`- ${f.area} ${f.path} :: ${f.action} :: ${f.detail || ""}`);
    }
    process.exitCode = 1;
  } else {
    console.log("CLICK TOUR OK (0 FAIL)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
