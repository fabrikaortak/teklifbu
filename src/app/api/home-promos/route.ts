import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePromoBody, type HomePromoSlide } from "@/lib/homePromos";

/** Anasayfa orta “Teklif ver kazan” kayan reklam (PROMO) */
export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; body: string; slug: string }>
    >(
      `SELECT id, title, body, slug FROM "ContentPage"
       WHERE kind = 'PROMO' AND "isPublished" = true
       ORDER BY "sortOrder" ASC, "createdAt" DESC
       LIMIT 12`
    );

    const slides: HomePromoSlide[] = rows
      .map((r) => {
        const parsed = parsePromoBody(r.body);
        return {
          id: r.id,
          title: r.title || "Banner",
          imageUrl: parsed.imageUrl,
          href: parsed.href || "",
        };
      })
      .filter((s) => Boolean(s.imageUrl));

    return NextResponse.json({ slides });
  } catch (err) {
    console.error("[home-promos]", err);
    return NextResponse.json({ slides: [] });
  }
}
