import { NextResponse } from "next/server";
import { getSetting } from "@/core/settings";

/** Kayıt formu / ticari modal için herkese açık ticari ayarlar */
export async function GET() {
  const [demoFill, approvalRequired, notifyDemo, logoEnabled, logoPaid, logoFee] = await Promise.all([
    getSetting<boolean>("commercial_register_demo_fill_enabled", true),
    getSetting<boolean>("commercial_approval_required", true),
    getSetting<boolean>("commercial_notify_demo_mode", true),
    getSetting<boolean>("commercial_logo_enabled", true),
    getSetting<boolean>("commercial_logo_paid", false),
    getSetting<number>("commercial_logo_fee_tokens", 10),
  ]);
  return NextResponse.json({
    demoFillEnabled: demoFill !== false,
    approvalRequired: approvalRequired !== false,
    notifyDemoMode: notifyDemo !== false,
    logoEnabled: logoEnabled !== false,
    logoPaid: Boolean(logoPaid),
    logoFeeTokens: Number(logoFee) || 0,
  });
}
