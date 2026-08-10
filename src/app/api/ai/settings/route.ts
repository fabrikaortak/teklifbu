import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAiListingConfig } from "@/core/services/aiListingConfig";

export const dynamic = "force-dynamic";

/** Profil menüsü için — API anahtarı dönmez */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const cfg = await getAiListingConfig();
  return NextResponse.json({
    enabled: cfg.enabled,
    offerPopupEnabled: cfg.offerPopupEnabled,
    tokenCost: cfg.tokenCost,
    configured: Boolean(cfg.apiKey),
    model: cfg.model,
  });
}
