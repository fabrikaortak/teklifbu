/**
 * Staging: set catalog_checkout_without_mirror=true (staging only).
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING ALLOW_LOCAL_STAGING=1 npx tsx scripts/staging-set-mirrorless-flag.ts
 */
import "dotenv/config";
import { assertStagingSafe } from "./lib/stagingGuard";
import { setSetting, getSetting } from "../src/core/settings";

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });
  console.log("DB", fp.maskedUrl, "prodLook=", fp.looksProduction);
  if (fp.looksProduction) throw new Error("refuse prod");

  await setSetting("catalog_checkout_without_mirror", true);
  await setSetting("payment_demo_pos_enabled", true);
  await setSetting("escrow_enabled", true);
  await setSetting("catalog_order_payment_lifecycle_v2", true);
  await setSetting("catalog_checkout_idempotency", true);
  await setSetting("catalog_expired_order_reconcile", true);

  const flag = await getSetting<boolean>("catalog_checkout_without_mirror", false);
  console.log("catalog_checkout_without_mirror=", flag);
  if (flag !== true) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
