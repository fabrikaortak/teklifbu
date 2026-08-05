import { NextResponse } from "next/server";
import { requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import { prisma } from "@/lib/db";
import { minorToTl } from "@/lib/catalogCommerce";

export async function GET(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") || undefined;
  const offers = await prisma.sellerOffer.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, title: true } },
      shop: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true, phone: true } },
    },
  });
  return NextResponse.json({
    ok: true,
    offers: offers.map((o) => ({
      ...o,
      price: minorToTl(o.price),
      discountedPrice: o.discountedPrice != null ? minorToTl(o.discountedPrice) : null,
    })),
  });
}
