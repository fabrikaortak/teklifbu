import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAiListingConfig } from "@/core/services/aiListingConfig";
import { parseListingFromScreenshot } from "@/core/services/aiListingParseService";
import { refundTokens, spendTokens } from "@/core/services/tokenSpendService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function collectImageUrls(body: { imageUrl?: string; imageUrls?: unknown }): string[] {
  const fromArr = Array.isArray(body.imageUrls)
    ? body.imageUrls.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  if (fromArr.length) return fromArr.slice(0, 2);
  const single = String(body.imageUrl || "").trim();
  return single ? [single] : [];
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const cfg = await getAiListingConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "AI ile ilan aktarımı kapalı" }, { status: 403 });
  }
  if (!cfg.apiKey) {
    return NextResponse.json({ error: "OpenAI API anahtarı tanımlı değil" }, { status: 503 });
  }

  let body: { imageUrl?: string; imageUrls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const imageUrls = collectImageUrls(body);
  if (!imageUrls.length) {
    return NextResponse.json({ error: "En az 1 ekran görüntüsü gerekli" }, { status: 400 });
  }

  const spend = await spendTokens({
    userId: session.id,
    amount: cfg.tokenCost,
    reason: "ai_listing_parse",
    meta: {
      mode: "image",
      count: imageUrls.length,
      sources: imageUrls.map((u) => u.slice(0, 200)),
      tokenCost: cfg.tokenCost,
    },
  });
  if (!spend.ok) {
    return NextResponse.json(
      {
        error: spend.error,
        code: "INSUFFICIENT_TOKENS",
        balance: spend.balance,
        requiredTokens: cfg.tokenCost,
        tokenCost: cfg.tokenCost,
      },
      { status: 402 }
    );
  }

  try {
    const draft = await parseListingFromScreenshot(imageUrls);
    return NextResponse.json({
      ok: true,
      draft,
      mode: "image",
      imageUrls,
      tokenCost: cfg.tokenCost,
      balanceAfter: spend.balanceAfter,
    });
  } catch (err) {
    if (cfg.tokenCost > 0) {
      await refundTokens({
        userId: session.id,
        amount: cfg.tokenCost,
        reason: "ai_listing_parse_refund",
        meta: {
          mode: "image",
          count: imageUrls.length,
          sources: imageUrls.map((u) => u.slice(0, 200)),
        },
      });
    }
    const message = err instanceof Error ? err.message : "AI okuma başarısız";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
