import { NextResponse } from "next/server";
import { getMidBeltBanner, getTopBeltBanner } from "@/core/siteBeltBanners";

/** Üst / orta kuşak banner — public, giriş gerekmez */
export async function GET() {
  const [top, mid] = await Promise.all([getTopBeltBanner(), getMidBeltBanner()]);
  return NextResponse.json({ top, mid });
}
