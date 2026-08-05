import { NextResponse } from "next/server";
import { getSession, requireUser } from "@/lib/auth";
import { resolveMagazaPanelAccess } from "@/lib/magazaPanelAccess";
import {
  getMagazaOverview,
  listSellerMagazaListings,
  listSellerMagazaOrders,
} from "@/core/services/magazaPanelService";
import {
  answerListingQuestion,
  listQuestionsForSeller,
} from "@/core/services/listingQuestionService";
import { sellerSubmitCargo } from "@/core/services/escrowService";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const access = await resolveMagazaPanelAccess(user);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || "Erişim yok", access }, { status: 403 });
    }

    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "overview";

    if (view === "access") {
      return NextResponse.json({ ok: true, access });
    }
    if (view === "overview") {
      const data = await getMagazaOverview(user.id);
      if (!data.ok) return NextResponse.json({ error: data.error }, { status: data.status });
      return NextResponse.json(data);
    }
    if (view === "listings") {
      if (!access.modules.listings) {
        return NextResponse.json({ error: "İlanlar modülü kapalı" }, { status: 403 });
      }
      const listings = await listSellerMagazaListings(user.id);
      return NextResponse.json({ ok: true, listings, access });
    }
    if (view === "orders") {
      if (!access.modules.orders) {
        return NextResponse.json({ error: "Sipariş modülü kapalı" }, { status: 403 });
      }
      const status = url.searchParams.get("status") || undefined;
      const orders = await listSellerMagazaOrders(user.id, status || undefined);
      return NextResponse.json({ ok: true, orders, access });
    }
    if (view === "questions") {
      if (!access.modules.questions) {
        return NextResponse.json({ error: "Soru–cevap modülü kapalı" }, { status: 403 });
      }
      const filter = (url.searchParams.get("filter") || "open") as "open" | "answered" | "all";
      const questions = await listQuestionsForSeller(user.id, filter);
      return NextResponse.json({ ok: true, questions, access });
    }

    return NextResponse.json({ error: "Geçersiz view" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hata";
    console.error("magaza panel GET", e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Sunucu hatası" : msg || "Sunucu hatası" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

    const access = await resolveMagazaPanelAccess(user);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || "Erişim yok" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "answer-question") {
      if (!access.modules.questions) {
        return NextResponse.json({ error: "Soru–cevap modülü kapalı" }, { status: 403 });
      }
      const result = await answerListingQuestion({
        questionId: String(body.questionId || ""),
        sellerId: user.id,
        answerBody: String(body.answerBody || ""),
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }

    if (action === "submit-cargo") {
      if (!access.modules.orders) {
        return NextResponse.json({ error: "Sipariş modülü kapalı" }, { status: 403 });
      }
      const result = await sellerSubmitCargo(session, String(body.dealId || ""), {
        trackingNo: String(body.cargoTrackingNo || body.trackingNo || ""),
        carrier: String(body.cargoCarrier || body.carrier || ""),
        receiptUrl: body.cargoReceiptUrl ? String(body.cargoReceiptUrl) : undefined,
        note: body.cargoNote ? String(body.cargoNote) : undefined,
      });
      if (!result.ok) {
        return NextResponse.json(result.body, { status: result.status });
      }
      return NextResponse.json({ ok: true, deal: result.deal });
    }

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hata";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    console.error("magaza panel POST", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
