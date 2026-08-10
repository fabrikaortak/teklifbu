import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  askListingQuestion,
  isListingQuestionsEnabledForListing,
  listPublicQuestionsForListing,
} from "@/core/services/listingQuestionService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "İlan gerekli" }, { status: 400 });
  const enabled = await isListingQuestionsEnabledForListing(id);
  if (!enabled) {
    return NextResponse.json({ ok: true, enabled: false, questions: [] });
  }
  const questions = await listPublicQuestionsForListing(id);
  return NextResponse.json({
    ok: true,
    enabled: true,
    questions: questions.map((q) => ({
      id: q.id,
      body: q.body,
      answerBody: q.answerBody,
      answeredAt: q.answeredAt?.toISOString() || null,
      createdAt: q.createdAt.toISOString(),
      askerName: q.asker.name || "Üye",
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await askListingQuestion({
      listingId: id,
      askerId: user.id,
      body: String(body.body || ""),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, id: result.question.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hata";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
