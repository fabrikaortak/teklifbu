import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAiListingConfig } from "@/core/services/aiListingConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenAI bağlantı smoke test — anahtar + model erişimi */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let body: { apiKey?: string; baseUrl?: string; model?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* formdan boş gelebilir — kayıtlı ayar kullanılır */
  }

  const cfg = await getAiListingConfig();
  const apiKey = String(body.apiKey || cfg.apiKey || "").trim();
  const baseUrl = String(body.baseUrl || cfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = String(body.model || cfg.model || "gpt-4o-mini").trim();

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API anahtarı boş. Önce kaydedin veya alana yapıştırın." }, { status: 400 });
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 20,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
      }),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = raw?.error?.message || raw?.error || `HTTP ${res.status}`;
      return NextResponse.json(
        { ok: false, error: typeof msg === "string" ? msg : "OpenAI yanıt vermedi", status: res.status },
        { status: 200 }
      );
    }

    const text = String(raw?.choices?.[0]?.message?.content || "").trim();
    return NextResponse.json({
      ok: true,
      model,
      reply: text.slice(0, 80),
      message: "Bağlantı başarılı — OpenAI yanıt verdi.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bağlantı hatası";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
