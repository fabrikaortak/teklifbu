import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRepublishReasonOptions } from "@/core/services/listingRepublishService";

/** Satıcı — sonuçlanan ilanı yeniden yayınlama sebep listesi */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const reasons = await getRepublishReasonOptions();
  return NextResponse.json({ reasons });
}
