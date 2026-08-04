import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { ensureUserShop } from "@/core/services/tenantService";
import { isCorporateAccount, normalizeAccountType } from "@/lib/accountTypes";
import type { SessionUser } from "@/lib/auth";
import {
  calcPackagePurchase,
  normalizeBillingType,
  type ShopBillingType,
} from "@/lib/shopPackageBilling";
import { spendTokens } from "@/core/services/tokenSpendService";
import {
  convertTlToTokens,
  isDemoPosEnabled,
} from "@/core/services/paymentModeService";

/** Bireysel / Ticari için ayrı: paket satın alma popup ve Hesabım «Paket al» butonu. */
export async function isShopPackageBuyEnabledForAccount(
  accountType?: string | null
): Promise<boolean> {
  const key = isCorporateAccount(accountType)
    ? "shop_package_buy_popup_ticari"
    : "shop_package_buy_popup_bireysel";
  return (await getSetting<boolean>(key, true)) !== false;
}

export type ShopPackagePublic = {
  id: string;
  name: string;
  accountType: string;
  billingType: ShopBillingType;
  monthlyPrice: number;
  tokenPrice: number | null;
  listingLimit: number;
  minDays: number;
  maxDays: number;
  description: string | null;
  premiumDiscountPercent: number;
};

/** Paket jeton birim fiyatı: tanımlıysa o, yoksa TL → jeton çevirisi. */
export async function resolvePackageTokenUnit(pkg: {
  tokenPrice?: number | null;
  monthlyPrice?: number | null;
}): Promise<number> {
  const explicit =
    pkg.tokenPrice != null && Number(pkg.tokenPrice) > 0 ? Math.floor(Number(pkg.tokenPrice)) : 0;
  if (explicit > 0) return explicit;
  const tl = Number(pkg.monthlyPrice) || 0;
  if (tl <= 0) return 0;
  return convertTlToTokens(tl);
}

/**
 * Demo POS kapalıysa paketler yalnızca jeton.
 * Demo POS açıksa paketler TL.
 */
export async function isShopPackageTokensOnlyMode(): Promise<boolean> {
  return !(await isDemoPosEnabled());
}

export async function listShopPackagesForUser(session: SessionUser): Promise<{
  ok: true;
  packages: ShopPackagePublic[];
  buyPopupEnabled: boolean;
  /** Geriye dönük: jetonla ödeme mümkün mü */
  payWithTokensEnabled: boolean;
  /** Demo POS kapalı — yalnızca jeton listesi / ödeme */
  tokensOnly: boolean;
  demoPosEnabled: boolean;
  tokenBalance: number;
  current: {
    packageId: string | null;
    packageName: string | null;
    endsAt: string | null;
    listingLimit: number | null;
    billingType: ShopBillingType | null;
  } | null;
}> {
  const [buyPopupEnabled, tokensOnly, user] = await Promise.all([
    isShopPackageBuyEnabledForAccount(session.accountType),
    isShopPackageTokensOnlyMode(),
    prisma.user.findUnique({
      where: { id: session.id },
      select: { tokenBalance: true },
    }),
  ]);
  const demoPosEnabled = !tokensOnly;

  const accountType = normalizeAccountType(session.accountType);
  const packages = await prisma.shopPackage.findMany({
    where: { isActive: true },
    orderBy: [{ monthlyPrice: "asc" }, { createdAt: "asc" }],
    take: 40,
  });

  const filtered = packages.filter((p) => {
    const pkgType = String(p.accountType);
    if (isCorporateAccount(session.accountType)) {
      return pkgType === "TICARI" || pkgType === "EMLAKCI" || pkgType === "GALERICI";
    }
    return pkgType === "BIREYSEL_TICARI" || pkgType === accountType;
  });

  const mapped: ShopPackagePublic[] = [];
  for (const p of filtered) {
    const tokenUnit = tokensOnly ? await resolvePackageTokenUnit(p) : 0;
    mapped.push({
      id: p.id,
      name: p.name,
      accountType: String(p.accountType),
      billingType: normalizeBillingType(p.billingType),
      monthlyPrice: Number(p.monthlyPrice) || 0,
      tokenPrice: tokensOnly && tokenUnit > 0 ? tokenUnit : null,
      listingLimit: Number(p.listingLimit) || 0,
      minDays: Math.max(1, Number(p.minDays) || 1),
      maxDays: Math.max(1, Number(p.maxDays) || 30),
      description: p.description,
      premiumDiscountPercent: Number(p.premiumDiscountPercent) || 0,
    });
  }

  const sub = await prisma.shopSubscription.findUnique({
    where: { userId: session.id },
    include: { package: true },
  });
  const active =
    sub && sub.isActive && sub.endsAt > new Date()
      ? {
          packageId: sub.packageId,
          packageName: sub.package?.name || null,
          endsAt: sub.endsAt.toISOString(),
          listingLimit: sub.package?.listingLimit ?? null,
          billingType: normalizeBillingType(sub.package?.billingType),
        }
      : null;

  return {
    ok: true,
    buyPopupEnabled: buyPopupEnabled !== false,
    payWithTokensEnabled: tokensOnly,
    tokensOnly,
    demoPosEnabled,
    tokenBalance: user?.tokenBalance ?? 0,
    packages: mapped,
    current: active,
  };
}

/** Kullanıcı paket satın alır (aylık veya günlük). POS açık → TL; POS kapalı → jeton. */
export async function purchaseShopPackageForUser(
  session: SessionUser,
  packageId: string,
  opts?: { months?: number; days?: number; years?: number; payWithTokens?: boolean }
): Promise<
  | {
      ok: true;
      subscriptionId: string;
      endsAt: string;
      amountTl: number;
      tokensSpent: number;
      packageName: string;
      paidWithTokens: boolean;
    }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const buyPopupEnabled = await isShopPackageBuyEnabledForAccount(session.accountType);
  if (!buyPopupEnabled) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "Paket satın alma kapalı. Yöneticiyle iletişime geçin.",
        code: "SHOP_PACKAGE_BUY_DISABLED",
      },
    };
  }

  if (
    !isCorporateAccount(session.accountType) &&
    normalizeAccountType(session.accountType) !== "BIREYSEL_TICARI"
  ) {
    return {
      ok: false,
      status: 403,
      body: { error: "Bu hesap tipi için paket alınamaz.", code: "NOT_ELIGIBLE" },
    };
  }

  const pkg = await prisma.shopPackage.findFirst({
    where: { id: packageId, isActive: true },
  });
  if (!pkg) {
    return { ok: false, status: 404, body: { error: "Paket bulunamadı.", code: "PACKAGE_NOT_FOUND" } };
  }

  const tokensOnly = await isShopPackageTokensOnlyMode();
  const payWithTokens = tokensOnly ? true : false;
  const unitToken = tokensOnly ? await resolvePackageTokenUnit(pkg) : 0;

  if (tokensOnly && unitToken <= 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Bu paket için jeton fiyatı hesaplanamadı.",
        code: "SHOP_PACKAGE_NO_TOKEN_PRICE",
      },
    };
  }

  if (!tokensOnly && opts?.payWithTokens) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Demo POS açıkken paketler TL ile alınır.",
        code: "TL_ONLY",
      },
    };
  }

  const { shop, tenant, user } = await ensureUserShop(session.id);
  const shopId = shop?.id || null;

  const now = new Date();
  const existing = await prisma.shopSubscription.findUnique({ where: { userId: session.id } });
  const base =
    existing && existing.isActive && existing.endsAt > now ? existing.endsAt : now;

  const calc = calcPackagePurchase({
    billingType: pkg.billingType,
    unitPriceTl: payWithTokens ? unitToken : Number(pkg.monthlyPrice) || 0,
    months: opts?.months,
    days: opts?.days,
    years: opts?.years,
    minDays: pkg.minDays,
    maxDays: pkg.maxDays,
    from: base,
  });

  const tokensNeeded = payWithTokens ? Math.floor(calc.amountTl) : 0;
  if (payWithTokens && tokensNeeded > 0) {
    const spent = await spendTokens({
      userId: session.id,
      amount: tokensNeeded,
      reason: "shop_package",
      meta: {
        packageId: pkg.id,
        billingType: calc.billingType,
        months: calc.months || null,
        days: calc.days || null,
        years: calc.years || null,
      },
    });
    if (!spent.ok) {
      return {
        ok: false,
        status: 402,
        body: {
          error: spent.error || "Yetersiz jeton",
          code: "INSUFFICIENT_TOKENS",
          balance: spent.balance,
          requiredTokens: tokensNeeded,
        },
      };
    }
  }

  const subscription = await prisma.shopSubscription.upsert({
    where: { userId: session.id },
    create: {
      userId: session.id,
      shopId,
      packageId: pkg.id,
      startsAt: now,
      endsAt: calc.endsAt,
      isActive: true,
    },
    update: {
      shopId,
      packageId: pkg.id,
      startsAt: existing && existing.isActive && existing.endsAt > now ? existing.startsAt : now,
      endsAt: calc.endsAt,
      isActive: true,
    },
    include: { package: true },
  });

  let paidGrossTl = 0;
  if (!payWithTokens && calc.amountTl > 0) {
    const { calcVatBreakdown, vatMetaFromBreakdown } = await import("@/lib/vat");
    const vatRows = await prisma.$queryRaw<
      Array<{ pricesIncludeVat: boolean; vatPercent: number }>
    >`SELECT "pricesIncludeVat", "vatPercent" FROM "ShopPackage" WHERE id = ${pkg.id}`;
    const pricesIncludeVat = vatRows[0]?.pricesIncludeVat !== false;
    const vatPercent = Number(vatRows[0]?.vatPercent ?? 20);
    const vat = calcVatBreakdown(calc.amountTl, vatPercent, pricesIncludeVat);
    paidGrossTl = vat.grossTl;
    await prisma.payment.create({
      data: {
        userId: session.id,
        tenantId: tenant.id,
        amountTl: vat.grossTl,
        purpose: "shop_subscription",
        status: PaymentStatus.PAID,
        meta: {
          packageId: pkg.id,
          packageName: pkg.name,
          billingType: calc.billingType,
          months: calc.months || null,
          days: calc.days || null,
          years: calc.years || null,
          subscriptionId: subscription.id,
          accountType: String(user.accountType),
          channel: "user_purchase",
          kind: "shop_package_purchase",
          ...vatMetaFromBreakdown(vat),
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    ok: true,
    subscriptionId: subscription.id,
    endsAt: calc.endsAt.toISOString(),
    amountTl: payWithTokens ? 0 : paidGrossTl,
    tokensSpent: tokensNeeded,
    packageName: pkg.name,
    paidWithTokens: payWithTokens,
  };
}
