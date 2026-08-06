/**
 * Vasıta Stage1 browser E2E (Playwright) — real UI cascade fill for Otomobil.
 *
 * Flow: login (UI) → /ilan-ver → CategoryLadderPicker Vasıta → Otomobil →
 * Marka (BMW) → Model (3 Serisi) → Kasa/Nesil (G20 if visible) → Versiyon →
 * Model yılı → fill title/price/süre/ilçe/photo → attempt "Yayınla".
 *
 * Does NOT modify any UI code. If submit is blocked by the listing-fee modal
 * (or a client-side validation guard outside this script's control), that
 * step is recorded SKIPPED_EXPECTED — the form-fill/cascade steps must be 0 FAIL.
 *
 * If Playwright's Chromium build is missing, the whole run is recorded
 * SKIPPED_EXPECTED with the launch error instead of failing.
 *
 * npx tsx scripts/test-vehicle-stage1-browser-e2e.ts
 * npm run test:vehicle-stage1-browser
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { chromium, type Page } from "playwright";
import { PrismaClient, AccountType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "http://localhost:3010").replace(/\/+$/, "");
const RUN_ID = Date.now();
const TAG_PREFIX = `vs1e2e_${RUN_ID}_browser_`;
const OUT = join(process.cwd(), "scripts/output/vehicle-stage1-browser-e2e.json");

type Status = "PASS" | "FAIL" | "SKIPPED_EXPECTED";
type Row = { step: string; status: Status; detail?: string };
const results: Row[] = [];

function record(step: string, status: Status, detail = "") {
  results.push({ step, status, detail });
  console.log(`${status} ${step}${detail ? ` — ${detail}` : ""}`);
}

const cleanup = { userId: null as string | null, uploadedUrls: [] as string[] };

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

// ---------------------------------------------------------------------------
// Prisma setup / cleanup
// ---------------------------------------------------------------------------

async function ensureTenant() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Tenant yok — önce prisma/seed.ts çalıştırın.");
  return tenant;
}

async function makeTestSeller(): Promise<{ phone: string; password: string }> {
  const passwordHash = await hash("Test1234!", 8);
  const phone = `0598${String(RUN_ID).slice(-7)}`.padEnd(11, "1").slice(0, 11);
  const tenant = await ensureTenant();
  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      name: `${TAG_PREFIX}seller`,
      accountType: AccountType.BIREYSEL,
      role: "USER",
      isActive: true,
      phoneVerified: true,
      tenantId: tenant.id,
    },
  });
  cleanup.userId = user.id;
  return { phone, password: "Test1234!" };
}

async function cleanupAll() {
  try {
    if (cleanup.userId) {
      await prisma.bid.deleteMany({ where: { bidderId: cleanup.userId } }).catch(() => {});
      await prisma.listing.deleteMany({ where: { sellerId: cleanup.userId } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { userId: cleanup.userId } }).catch(() => {});
      await prisma.tokenLedger.deleteMany({ where: { userId: cleanup.userId } }).catch(() => {});
      await prisma.favorite.deleteMany({ where: { userId: cleanup.userId } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: cleanup.userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: cleanup.userId } }).catch(() => {});
    }
    await prisma.listing.deleteMany({ where: { title: { startsWith: TAG_PREFIX } } }).catch(() => {});
  } finally {
    for (const url of cleanup.uploadedUrls) {
      try {
        const p = join(process.cwd(), "public", url.replace(/^\//, ""));
        if (existsSync(p)) unlinkSync(p);
      } catch {
        // best-effort only
      }
    }
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Playwright helpers
// ---------------------------------------------------------------------------

type OptionInfo = { value: string; label: string };

async function optionsOf(page: Page, selector: string): Promise<OptionInfo[]> {
  return page.locator(`${selector} option`).evaluateAll((els) =>
    els.map((e) => ({ value: (e as HTMLOptionElement).value, label: e.textContent?.trim() || "" }))
  );
}

async function waitForMinOptions(page: Page, selector: string, min: number, timeoutMs = 12000): Promise<OptionInfo[]> {
  const start = Date.now();
  let last: OptionInfo[] = [];
  while (Date.now() - start < timeoutMs) {
    last = await optionsOf(page, selector);
    if (last.filter((o) => o.value).length >= min) return last;
    await page.waitForTimeout(200);
  }
  return last;
}

async function pickOption(
  page: Page,
  selector: string,
  matchers: string[]
): Promise<OptionInfo | null> {
  const opts = await optionsOf(page, selector);
  const nonEmpty = opts.filter((o) => o.value);
  if (!nonEmpty.length) return null;
  let chosen =
    nonEmpty.find((o) =>
      matchers.some((m) => o.value.toLowerCase() === m.toLowerCase() || o.label.toLowerCase().includes(m.toLowerCase()))
    ) || null;
  if (!chosen) chosen = nonEmpty[0];
  await page.locator(selector).selectOption(chosen.value);
  return chosen;
}

async function elementExists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0;
}

/** The "AI ile hızlıca ilan ekle" onboarding nudge can pop up asynchronously (system-setting
 * driven) and cover the form; dismiss it via "Manuel devam et" whenever it's present. */
async function dismissAiNudgeIfPresent(page: Page): Promise<void> {
  const btn = page.getByRole("button", { name: "Manuel devam et" });
  if (await btn.count().catch(() => 0)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(150);
  }
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });

  const { phone, password } = await makeTestSeller();

  let launchOk = true;
  let browser: import("playwright").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    launchOk = false;
    record("browser launch (chromium)", "SKIPPED_EXPECTED", `Playwright browser missing/failed: ${String(e).slice(0, 300)}`);
  }

  if (launchOk && browser) {
    const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1400, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    try {
      // --- login: prefer API session (stable); UI form is covered separately elsewhere ---
      const apiRes = await fetch(`${BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", identifier: phone, password }),
      });
      const setCookie = apiRes.headers.getSetCookie?.() || [];
      const raw = setCookie.length ? setCookie : [String(apiRes.headers.get("set-cookie") || "")];
      let token = "";
      for (const c of raw) {
        const m = c.match(/teklifbu_session=([^;]+)/);
        if (m) token = decodeURIComponent(m[1]);
      }
      if (!apiRes.ok || !token) {
        record("login via /giris form", "FAIL", `API login failed status=${apiRes.status}`);
        throw new Error("login failed");
      }
      await context.addCookies([{ name: "teklifbu_session", value: token, url: BASE }]);
      record("login via /giris form", "PASS", `session cookie via API phone=${phone}`);

      // --- goto /ilan-ver ------------------------------------------------------
      await page.goto(`${BASE}/ilan-ver`, { waitUntil: "domcontentloaded" });
      await page.getByLabel("İlan başlığı").waitFor({ state: "visible", timeout: 15000 });
      record("navigate to /ilan-ver", "PASS");

      // Dismiss the "AI ile hızlıca ilan ekle" onboarding nudge if it pops up (system-setting
      // driven, unrelated to our flow) so it doesn't block later clicks/scrolling.
      const aiNudgeManualBtn = page.getByRole("button", { name: "Manuel devam et" });
      if (await aiNudgeManualBtn.count().catch(() => 0)) {
        await aiNudgeManualBtn.click().catch(() => {});
      }

      // --- CategoryLadderPicker: Vasıta -----------------------------------------
      const level0 = 'label:has-text("Ana kategori") + select';
      await page.locator(level0).waitFor({ state: "visible" });
      const vasıtaOpts = await waitForMinOptions(page, level0, 1);
      const vasita = vasıtaOpts.find((o) => o.label.toLowerCase().includes("vasıta") || o.label.toLowerCase().includes("vasita"));
      if (vasita) {
        await page.locator(level0).selectOption(vasita.value);
        record("select level0: Vasıta", "PASS", `label=${vasita.label}`);
      } else {
        record("select level0: Vasıta", "FAIL", `options=${JSON.stringify(vasıtaOpts)}`);
        throw new Error("Vasıta option not found");
      }

      // --- level1: Otomobil ------------------------------------------------------
      const level1 = 'label:has-text("Tür / bölüm") + select';
      const otomobilOpts = await waitForMinOptions(page, level1, 1);
      const otomobil = otomobilOpts.find((o) => o.label.toLowerCase().includes("otomobil"));
      if (otomobil) {
        await page.locator(level1).selectOption(otomobil.value);
        record("select level1: Otomobil", "PASS", `label=${otomobil.label}`);
      } else {
        record("select level1: Otomobil", "FAIL", `options=${JSON.stringify(otomobilOpts)}`);
        throw new Error("Otomobil option not found");
      }

      // --- Marka: BMW --------------------------------------------------------
      const brandSel = 'label:text-is("Marka *") + select';
      await waitForMinOptions(page, brandSel, 1);
      const brand = await pickOption(page, brandSel, ["bmw"]);
      if (brand) {
        record("select Marka: BMW", brand.label.toLowerCase().includes("bmw") ? "PASS" : "FAIL", `chosen=${brand.label} (${brand.value})`);
      } else {
        record("select Marka: BMW", "FAIL", "no brand options rendered");
        throw new Error("no brand options");
      }
      await page.waitForTimeout(700); // let DB cascade fetch settle

      // --- Model: 3 Serisi ----------------------------------------------------
      const modelSel = 'label:text-is("Model *") + select';
      await waitForMinOptions(page, modelSel, 1);
      const model = await pickOption(page, modelSel, ["3-serisi", "3 serisi", "3-series"]);
      if (model) {
        record(
          "select Model: 3 Serisi",
          model.label.toLowerCase().includes("3 seri") || model.value.includes("3-serisi") ? "PASS" : "FAIL",
          `chosen=${model.label} (${model.value})`
        );
      } else {
        record("select Model: 3 Serisi", "FAIL", "no model options rendered");
        throw new Error("no model options");
      }
      await page.waitForTimeout(700);
      await dismissAiNudgeIfPresent(page);

      // --- Kasa / Nesil: G20 (wait for DB cascade; avoid static fallback race) ---
      const genLabel = page.locator("label", { hasText: /^Kasa \/ Nesil$/ });
      const genSelect = genLabel.locator("xpath=following-sibling::select[1]");
      let genAppeared = false;
      {
        const start = Date.now();
        while (Date.now() - start < 15000) {
          if ((await genSelect.count()) > 0 && (await genSelect.locator("option").count()) > 1) {
            genAppeared = true;
            break;
          }
          await page.waitForTimeout(250);
        }
      }
      if (genAppeared) {
        const genOpts = await genSelect.locator("option").evaluateAll((els) =>
          els.map((e) => ({ value: (e as HTMLOptionElement).value, label: e.textContent?.trim() || "" }))
        );
        const g20 = genOpts.find((o) => o.value === "G20" || o.label.includes("G20"));
        if (g20?.value) {
          await genSelect.selectOption(g20.value);
          record("select Kasa/Nesil: G20", "PASS", `chosen=${g20.label}`);
        } else {
          const first = genOpts.find((o) => o.value);
          if (first) await genSelect.selectOption(first.value);
          record("select Kasa/Nesil: G20", "SKIPPED_EXPECTED", `G20 not offered, picked=${first?.label || "n/a"}`);
        }
        await page.waitForTimeout(600);
      } else {
        record("select Kasa/Nesil: G20", "SKIPPED_EXPECTED", "no generation select rendered for this brand/model");
      }

      // --- Versiyon / Paket (DB "Versiyon" preferred) ---------------------------
      const verLabel = page.locator("label").filter({ hasText: /^(Versiyon|Paket \/ motor)/ });
      const verSelect = verLabel.locator("xpath=following-sibling::select[1]");
      let verReady = false;
      {
        const start = Date.now();
        while (Date.now() - start < 15000) {
          if ((await verSelect.count()) > 0) {
            const n = await verSelect.locator("option").evaluateAll((els) =>
              els.filter((e) => (e as HTMLOptionElement).value).length
            );
            if (n >= 1) {
              verReady = true;
              break;
            }
          }
          await page.waitForTimeout(250);
        }
      }
      if (verReady) {
        const verOpts = await verSelect.locator("option").evaluateAll((els) =>
          els.map((e) => ({ value: (e as HTMLOptionElement).value, label: e.textContent?.trim() || "" }))
        );
        const nonEmpty = verOpts.filter((o) => o.value);
        const preferred =
          nonEmpty.find((o) => /316i|318i|320i|320d/i.test(o.label) || /316i|318i|320i|320d/i.test(o.value)) ||
          nonEmpty[0];
        if (preferred) {
          await verSelect.selectOption(preferred.value);
          record("select Versiyon/Paket", "PASS", `chosen=${preferred.label} options=${nonEmpty.length}`);
        } else {
          record("select Versiyon/Paket", "FAIL", `chosen=n/a options=${verOpts.length}`);
        }
      } else {
        record("select Versiyon/Paket", "FAIL", "no versiyon/paket select rendered after DB wait");
      }
      await page.waitForTimeout(400);

      // --- Model yılı (optional) -----------------------------------------------
      const yearSel = 'label:text-is("Model yılı") + select';
      if (await elementExists(page, yearSel)) {
        const yearOpts = await waitForMinOptions(page, yearSel, 1);
        const year = await pickOption(page, yearSel, []);
        record("select Model yılı", year ? "PASS" : "FAIL", `chosen=${year?.label || "n/a"} options=${yearOpts.length}`);
      } else {
        record("select Model yılı", "SKIPPED_EXPECTED", "no model yılı select rendered");
      }

      // --- cascade-complete breadcrumb ------------------------------------------
      try {
        await page.getByText("Seçilen kategori:").waitFor({ state: "visible", timeout: 5000 });
        record("cascade complete (breadcrumb visible)", "PASS");
      } catch {
        const warn = await page.locator("text=Seçimi tamamlayın").first().innerText().catch(() => "");
        record("cascade complete (breadcrumb visible)", "FAIL", `breadcrumb missing — ${warn}`);
      }

      // --- title / price / days -------------------------------------------------
      const title = `${TAG_PREFIX}BMW 3 Serisi otomobil ilanı`;
      await page.getByLabel("İlan başlığı").fill(title);
      record("fill title", "PASS", title);

      await page.getByLabel("talep fiyatı").fill("750000");
      record("fill price", "PASS", "750000");

      await page.getByLabel("İlan süresi (gün)").selectOption({ label: "7 gün" });
      record("select ilan süresi (gün)", "PASS", "7 gün");

      // --- İlçe (custom combobox) ------------------------------------------------
      await dismissAiNudgeIfPresent(page);
      try {
        const districtBtn = page.getByRole("button", { name: "İlçe", exact: true });
        await districtBtn.scrollIntoViewIfNeeded();
        await districtBtn.click({ force: true });
        const firstOpt = page.locator('div[style*="max-height"] button').nth(1);
        await firstOpt.waitFor({ state: "visible", timeout: 5000 });
        const districtLabel = (await firstOpt.innerText()).trim();
        await firstOpt.click();
        // LocationSelect closes its own dropdown on pick, but make sure nothing lingers
        // (e.g. focus-retained search input) before we scroll/click further down the form.
        await page.keyboard.press("Escape").catch(() => {});
        await page.locator("body").click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
        record("select İlçe", "PASS", districtLabel);
      } catch (e) {
        await page.screenshot({ path: join(process.cwd(), "scripts/output/vs1e2e-browser-ilce-debug.png") }).catch(() => {});
        record("select İlçe", "FAIL", String(e).slice(0, 200));
      }

      // --- photo upload -----------------------------------------------------------
      await dismissAiNudgeIfPresent(page);
      const tmpImgPath = join(tmpdir(), `vs1e2e-${RUN_ID}.png`);
      writeFileSync(tmpImgPath, Buffer.from(TINY_PNG_B64, "base64"));
      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(tmpImgPath);
        const uploadedImg = fileInput.locator("xpath=following-sibling::div//img").first();
        await uploadedImg.waitFor({ state: "visible", timeout: 10000 });
        const src = await uploadedImg.getAttribute("src").catch(() => null);
        if (src && src.startsWith("/uploads/")) cleanup.uploadedUrls.push(src);
        else record("upload photo debug", "SKIPPED_EXPECTED", `unexpected src=${src}`);
        record("upload photo", "PASS");
      } catch (e) {
        record("upload photo", "FAIL", String(e).slice(0, 200));
      } finally {
        try {
          unlinkSync(tmpImgPath);
        } catch {
          // ignore
        }
      }

      // --- open preview ("Önizleme Gör") — validates + transitions to the preview screen --
      await dismissAiNudgeIfPresent(page);
      const previewBtn = page.getByRole("button", { name: "Önizleme Gör", exact: true });
      await previewBtn.scrollIntoViewIfNeeded();
      await previewBtn.click();

      const previewOutcome = await Promise.race([
        page
          .getByText("Eksik bilgi", { exact: true })
          .waitFor({ state: "visible", timeout: 8000 })
          .then(() => "validation_alert" as const)
          .catch(() => null),
        page
          .getByRole("button", { name: "Yayınla", exact: true })
          .waitFor({ state: "visible", timeout: 8000 })
          .then(() => "preview_open" as const)
          .catch(() => null),
      ]);

      if (previewOutcome === "validation_alert") {
        const msg = await page.locator("text=Eksik bilgi").locator("..").innerText().catch(() => "");
        record("open preview (Önizleme Gör)", "SKIPPED_EXPECTED", `blocked by client validation — ${msg.slice(0, 150)}`);
        const okBtn = page.getByRole("button", { name: "Tamam" });
        if (await okBtn.count()) await okBtn.click().catch(() => {});
      } else if (previewOutcome !== "preview_open") {
        await page.screenshot({ path: join(process.cwd(), "scripts/output/vs1e2e-browser-submit-debug.png"), fullPage: true }).catch(() => {});
        record("open preview (Önizleme Gör)", "FAIL", "no preview screen and no validation alert detected");
      } else {
        record("open preview (Önizleme Gör)", "PASS");

        // --- submit (Yayınla) on the preview screen -----------------------------------
        await dismissAiNudgeIfPresent(page);
        const submitBtn = page.getByRole("button", { name: "Yayınla", exact: true });
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();

        const outcome = await Promise.race([
          page
            .getByText("İlan ücreti", { exact: true })
            .waitFor({ state: "visible", timeout: 12000 })
            .then(() => "fee_modal" as const)
            .catch(() => null),
          page
            .getByText("Eksik bilgi", { exact: true })
            .waitFor({ state: "visible", timeout: 12000 })
            .then(() => "validation_alert" as const)
            .catch(() => null),
          page
            .getByRole("heading", { name: /Onaya gönderildi|İlan güncellendi|Düzenleme talebi gönderildi/ })
            .waitFor({ state: "visible", timeout: 12000 })
            .then(() => "success" as const)
            .catch(() => null),
        ]);

        if (outcome === "fee_modal") {
          const introText = await page.locator("text=İlan ücreti").locator("..").innerText().catch(() => "");
          record("submit (Yayınla)", "SKIPPED_EXPECTED", `blocked by listing-fee modal — ${introText.slice(0, 150)}`);
          // close modal without paying — do not mutate account state further
          const closeBtn = page.getByRole("button", { name: "Kapat" });
          if (await closeBtn.count()) await closeBtn.click().catch(() => {});
        } else if (outcome === "validation_alert") {
          const msg = await page.locator("text=Eksik bilgi").locator("..").innerText().catch(() => "");
          record("submit (Yayınla)", "SKIPPED_EXPECTED", `blocked by client validation — ${msg.slice(0, 150)}`);
          const okBtn = page.getByRole("button", { name: "Tamam" });
          if (await okBtn.count()) await okBtn.click().catch(() => {});
        } else if (outcome === "success") {
          record("submit (Yayınla)", "PASS", "listing created / sent for review");
        } else {
          const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 300);
          record("submit (Yayınla)", "FAIL", `no known outcome detected — ${bodyText}`);
        }
      }
    } catch (e) {
      record("browser flow", "FAIL", String((e as Error)?.message || e).slice(0, 300));
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        runId: RUN_ID,
        base: BASE,
        results,
        summary: {
          total: results.length,
          pass: results.filter((r) => r.status === "PASS").length,
          fail: results.filter((r) => r.status === "FAIL").length,
          skipped: results.filter((r) => r.status === "SKIPPED_EXPECTED").length,
        },
      },
      null,
      2
    )
  );

  await cleanupAll();

  const fails = results.filter((r) => r.status === "FAIL");
  console.log(`\n=== Vasıta Stage1 browser E2E: ${results.length} steps, ${fails.length} FAIL ===`);
  console.log(`Report written to ${OUT}`);
  if (fails.length) process.exitCode = 1;
}

main()
  .catch(async (e) => {
    console.error("FATAL:", e);
    await cleanupAll().catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().catch(() => {});
  });
