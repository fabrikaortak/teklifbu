/**
 * Operasyonel Aşama 2 shop allowlist seçici (salt okuma + JSON çıktı).
 * Kod / ticaret akışı değişmez.
 *
 * STAGING_CONFIRMATION=I_CONFIRM_STAGING npx tsx scripts/select-staging-phase2-allowlist.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertStagingSafe } from "./lib/stagingGuard";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const fp = assertStagingSafe({ requireConfirmation: true, allowLocalhostWithoutConfirm: true });

  // Yalnız staging test shop'ları — gerçek kullanıcı mağazası seçilmez
  const stgShops = await prisma.shop.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { startsWith: "STG" } },
        { slug: { startsWith: "stg-" } },
        { owner: { phone: { startsWith: "059" } } },
      ],
    },
    include: {
      owner: { select: { id: true, phone: true, name: true, commercialSubtypes: true, accountType: true } },
      subscription: { include: { package: true } },
      _count: { select: { sellerOffers: true } },
    },
    take: 20,
  });

  const candidates = stgShops;
  const allowlist = [];

  for (const shop of candidates) {
    const activeOffers = await prisma.sellerOffer.count({
      where: { shopId: shop.id, deletedAt: null, status: "ACTIVE", stockQty: { gt: 0 } },
    });
    const products = await prisma.sellerOffer.findMany({
      where: { shopId: shop.id, deletedAt: null },
      distinct: ["productId"],
      select: { productId: true },
    });
    const variants = await prisma.sellerOffer.findMany({
      where: { shopId: shop.id, deletedAt: null },
      distinct: ["variantId"],
      select: { variantId: true },
    });
    const subOk = Boolean(shop.subscription?.isActive);
    const magaza = shop.owner.commercialSubtypes?.includes("MAGAZA");
    // Test shop: STG ad/slug veya 059 test telefon
    const isTest =
      shop.name.startsWith("STG") ||
      Boolean(shop.slug?.startsWith("stg-")) ||
      Boolean(shop.owner.phone?.startsWith("059"));
    if (!isTest || !magaza || activeOffers < 1) continue;

    allowlist.push({
      shopId: shop.id,
      name: shop.name,
      slug: shop.slug,
      ownerId: shop.ownerId,
      ownerPhone: shop.owner.phone,
      ownerName: shop.owner.name,
      magazaYetkisi: magaza,
      subscriptionActive: subOk,
      packageName: shop.subscription?.package?.name || null,
      activeOfferCount: activeOffers,
      productCount: products.length,
      variantCount: variants.length,
      targets: {
        successfulCheckouts: 5,
        timeoutScenario: 1,
        refundOrReleaseScenario: 1,
      },
      isStgSeed: true,
    });
    if (allowlist.length >= 5) break;
  }

  // Ensure at least 3 — if short, note
  const phase2Since = new Date().toISOString();
  const out = {
    generatedAt: new Date().toISOString(),
    db: fp,
    phase2Since,
    selectedCount: allowlist.length,
    shopIds: allowlist.map((a) => a.shopId),
    buyerHint: "Use STG Buyer phones 0593* or dedicated phase2 buyer — not production users",
    shops: allowlist,
    auditCommandExample:
      allowlist.length >= 1
        ? `npx tsx scripts/audit-catalog-checkout-consistency.ts --scope=phase2 --since=${phase2Since} --shopIds=${allowlist.map((s) => s.shopId).join(",")}`
        : null,
    ready: allowlist.length >= 3,
  };

  const outFile = path.join(process.cwd(), "scripts", "output", "staging-phase2-allowlist.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.error("Wrote", outFile);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
