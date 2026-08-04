import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSellerEditGrant,
  submitGrantedListingEdit,
} from "@/core/services/sellerAdminRequestService";
import { parseAllowedFields, fieldLabel, snapshotListingFields } from "@/lib/listingEditFields";
import { serializeListing } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const { id } = await ctx.params;
  const req = await getSellerEditGrant(id, session.id);
  if (!req) return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });

  return NextResponse.json({
    request: {
      id: req.id,
      status: req.status,
      message: req.message,
      adminNote: req.adminNote,
      allowedFields: parseAllowedFields(req.allowedFields),
      fieldLabels: parseAllowedFields(req.allowedFields).map(fieldLabel),
      grantedAt: req.grantedAt,
      listing: serializeListing(req.listing),
      snapshot: snapshotListingFields(req.listing),
    },
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.action === "submit") {
    try {
      const updated = await submitGrantedListingEdit({
        requestId: id,
        sellerId: session.id,
        payload: (body.payload || {}) as Record<string, unknown>,
      });
      return NextResponse.json({
        ok: true,
        status: updated.status,
        message: "Değişiklikleriniz yönetici onayına gönderildi.",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gönderilemedi" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Geçersiz aksiyon" }, { status: 400 });
}
