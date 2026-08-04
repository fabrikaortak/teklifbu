import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";
import { getHomeInsightsData } from "@/core/services/homeInsightsService";
import { isOffersEnabled } from "@/core/services/marketplaceModeService";
import { prisma } from "@/lib/db";

export async function GET() {
  const offersEnabled = await isOffersEnabled();
  const sections = (await getSetting<Record<string, boolean>>("home_insight_sections", {
    ending_soon: true,
    most_bids_today: true,
    top_profit: true,
    turkey_map: true,
    live_stats: true,
    for_you: true,
  })) || {};

  const enabled = offersEnabled
    ? {
        ending_soon: sections.ending_soon !== false,
        most_bids_today: sections.most_bids_today !== false,
        top_profit: sections.top_profit !== false,
        turkey_map: sections.turkey_map !== false,
        live_stats: sections.live_stats !== false,
        for_you: sections.for_you !== false,
      }
    : {
        ending_soon: false,
        most_bids_today: false,
        top_profit: false,
        turkey_map: sections.turkey_map !== false,
        live_stats: false,
        for_you: sections.for_you !== false,
      };

  const anyOn = Object.values(enabled).some(Boolean);
  if (!anyOn) {
    return NextResponse.json({ enabled, offersEnabled, data: null });
  }

  const data = await getHomeInsightsData();

  if (!offersEnabled && enabled.turkey_map) {
    const shops = await prisma.shop.groupBy({
      by: ["city"],
      where: { isActive: true, city: { not: null } },
      _count: { _all: true },
    });
    data.turkeyMap = shops
      .filter((s) => s.city)
      .map((s) => ({ city: String(s.city), count: s._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);

    // Mağaza şehri yoksa aktif ilan şehirleriyle doldur
    if (!data.turkeyMap.length) {
      const byCity = await prisma.listing.groupBy({
        by: ["city"],
        where: { status: { in: ["ACTIVE", "SELECTION"] } },
        _count: { _all: true },
      });
      data.turkeyMap = byCity
        .map((r) => ({ city: r.city, count: r._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 40);
    }
  }

  return NextResponse.json({
    enabled,
    offersEnabled,
    mapTitle: offersEnabled ? "Türkiye Teklif Haritası" : "Türkiye Üye Haritası",
    data,
  });
}
