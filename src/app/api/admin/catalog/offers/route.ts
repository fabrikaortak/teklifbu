import { NextResponse } from "next/server";
import { requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import { prisma } from "@/lib/db";
import { minorToTl } from "@/lib/catalogCommerce";
import {
  approveCatalogOffer,
  rejectCatalogOffer,
} from "@/core/services/catalog/catalogCommerceService";
import { writeAuditLog } from "@/core/services/tenantService";
import { getSession } from "@/lib/auth";

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

/** POST — mirror’süz SellerOffer onay/red (Listing kuyruğuna düşmeyen teklifler) */
export async function POST(req: Request) {
  const { error } = await requireCatalogAdmin();
  if (error) return error;
  const admin = await getSession();
  if (!admin) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const offerId = String(body.offerId || "");
  if (!offerId) return NextResponse.json({ error: "offerId gerekli" }, { status: 400 });

  try {
    if (action === "approve") {
      const offer = await approveCatalogOffer(offerId, admin.id);
      await writeAuditLog({
        actorId: admin.id,
        action: "catalog.offer.approve",
        entity: "SellerOffer",
        entityId: offerId,
        meta: { listingId: offer.listingId, status: offer.status, mirrorless: !offer.listingId },
      });
      return NextResponse.json({
        ok: true,
        offer: {
          id: offer.id,
          status: offer.status,
          listingId: offer.listingId,
        },
      });
    }
    if (action === "reject") {
      await rejectCatalogOffer(offerId, admin.id);
      await writeAuditLog({
        actorId: admin.id,
        action: "catalog.offer.reject",
        entity: "SellerOffer",
        entityId: offerId,
        meta: { reason: body.reason || null },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Bilinmeyen aksiyon" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "İşlem başarısız" },
      { status: 400 }
    );
  }
}
