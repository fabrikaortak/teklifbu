import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";
import { getSiteFooterConfig } from "@/core/siteFooter";

export async function GET() {
  const [footer, brandName, footerBeltRaw] = await Promise.all([
    getSiteFooterConfig(),
    getSetting<string>("brand_name", "TeklifBu"),
    getSetting<string>("v2_footer_belt", "white"),
  ]);
  const footerBelt = String(footerBeltRaw || "white") === "navy" ? "navy" : "white";
  return NextResponse.json({
    footer,
    brandName: String(brandName || "TeklifBu"),
    footerBelt,
  });
}
