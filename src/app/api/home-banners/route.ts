import { NextResponse } from "next/server";
import { ContentKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseBannerBody, type HomeVisibilitySlide } from "@/lib/homeBanners";

/** Anasayfa sağ panel — Daha Fazla Görünürlük slaytları (BANNER) */
export async function GET() {
  const rows = await prisma.contentPage.findMany({
    where: { kind: ContentKind.BANNER, isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 12,
    select: { id: true, title: true, body: true, slug: true },
  });

  const slides: HomeVisibilitySlide[] = rows
    .map((r) => {
      const parsed = parseBannerBody(r.body);
      return {
        id: r.id,
        title: r.title || "Daha Fazla Görünürlük",
        ...parsed,
        href: parsed.href || (r.slug?.startsWith("/") ? r.slug : parsed.href),
      };
    })
    .filter((s) => Boolean(s.imageUrl));

  return NextResponse.json({ slides });
}
