import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";

/** Anasayfa reklam boyut / süre ayarları — giriş gerektirmez */
export async function GET() {
  const [promoHeightPx, promoSeconds, sidebarHeightPx, sidebarSeconds] = await Promise.all([
    getSetting<number>("home_promo_banner_height_px", 168),
    getSetting<number>("home_promo_slide_seconds", 5),
    getSetting<number>("home_sidebar_banner_height_px", 148),
    getSetting<number>("home_sidebar_slide_seconds", 5),
  ]);

  return NextResponse.json({
    promo: {
      heightPx: Math.min(420, Math.max(40, Number(promoHeightPx) || 168)),
      slideSeconds: Math.min(60, Math.max(2, Number(promoSeconds) || 5)),
    },
    sidebar: {
      heightPx: Math.min(360, Math.max(40, Number(sidebarHeightPx) || 148)),
      slideSeconds: Math.min(60, Math.max(2, Number(sidebarSeconds) || 5)),
    },
  });
}
