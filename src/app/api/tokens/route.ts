import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSetting } from "@/core/settings";
import { calcVatBreakdown, vatMetaFromBreakdown } from "@/lib/vat";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const packages = await prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { tokenBalance: true },
  });
  const ledger = await prisma.tokenLedger.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const quickEnabled = await getSetting<boolean>("quick_token_enabled", true);
  const quickPresets = await getSetting<number[]>("quick_token_presets", [1, 5, 10, 25, 50, 100]);
  const quickMax = await getSetting<number>("quick_token_max", 10000);
  const quickPricePerToken = await getSetting<number>("quick_token_price_per_token_tl", 0);

  return NextResponse.json({
    balance: user?.tokenBalance ?? 0,
    packages,
    ledger,
    quickToken: {
      enabled: Boolean(quickEnabled),
      presets: Array.isArray(quickPresets) ? quickPresets : [1, 5, 10, 25, 50, 100],
      max: Number(quickMax) || 10000,
      pricePerTokenTl: Number(quickPricePerToken) || 0,
    },
  });
}

async function creditTokens(
  userId: string,
  amount: number,
  reason: string,
  meta?: object,
  amountTl = 0
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        userId,
        amountTl,
        purpose: "token_package",
        status: "SIMULATED",
        meta: { ...(meta || {}), demo: true, tokenAmount: amount },
      },
    });
    const user = await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: amount } },
    });
    await tx.tokenLedger.create({
      data: {
        userId,
        delta: amount,
        balanceAfter: user.tokenBalance,
        reason,
        meta: { ...(meta || {}), demo: true, paymentId: payment.id },
      },
    });
    return user.tokenBalance;
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const body = await req.json();

  if (body.action === "demo_claim" || (body.amount != null && !body.packageId)) {
    const quickEnabled = await getSetting<boolean>("quick_token_enabled", true);
    if (!quickEnabled) {
      return NextResponse.json(
        { error: "Hızlı jeton alımı kapalı. Lütfen bir paket seçin." },
        { status: 403 }
      );
    }
    const quickMax = await getSetting<number>("quick_token_max", 10000);
    const amount = Math.floor(Number(body.amount || body.tokenAmount || 0));
    const max = Number(quickMax) || 10000;
    if (!Number.isFinite(amount) || amount < 1 || amount > max) {
      return NextResponse.json({ error: `1–${max} arası jeton seçin` }, { status: 400 });
    }
    const pricePer = await getSetting<number>("quick_token_price_per_token_tl", 0);
    const totalTl = Number(pricePer) * amount;
    const vat = calcVatBreakdown(totalTl, 20, true);
    const balance = await creditTokens(
      session.id,
      amount,
      "demo_claim",
      {
        amount,
        pricePerTokenTl: pricePer,
        totalTl,
        ...vatMetaFromBreakdown(vat),
      },
      vat.grossTl
    );
    return NextResponse.json({ ok: true, balance, simulated: true, demo: true, added: amount });
  }

  const pkg = await prisma.tokenPackage.findUnique({ where: { id: body.packageId } });
  if (!pkg || !pkg.isActive) return NextResponse.json({ error: "Paket yok" }, { status: 404 });

  const vatRows = await prisma.$queryRaw<
    Array<{ pricesIncludeVat: boolean; vatPercent: number }>
  >`SELECT "pricesIncludeVat", "vatPercent" FROM "TokenPackage" WHERE id = ${pkg.id}`;
  const pricesIncludeVat = vatRows[0]?.pricesIncludeVat !== false;
  const vatPercent = Number(vatRows[0]?.vatPercent ?? 20);
  const vat = calcVatBreakdown(pkg.priceTl, vatPercent, pricesIncludeVat);

  const balance = await creditTokens(
    session.id,
    pkg.tokenAmount,
    "purchase_simulated",
    {
      packageId: pkg.id,
      packageName: pkg.name,
      priceTl: pkg.priceTl,
      ...vatMetaFromBreakdown(vat),
    },
    vat.grossTl
  );

  return NextResponse.json({ ok: true, balance, simulated: true, added: pkg.tokenAmount });
}
