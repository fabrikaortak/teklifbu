import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function requireCatalogAdmin() {
  try {
    const admin = await requireAdmin();
    return { admin, error: null as null };
  } catch {
    return {
      admin: null as null,
      error: NextResponse.json({ error: "Yetkisiz" }, { status: 403 }),
    };
  }
}

export function catalogError(e: unknown, status = 400) {
  const msg = e instanceof Error ? e.message : "İşlem başarısız";
  return NextResponse.json({ error: msg }, { status });
}
