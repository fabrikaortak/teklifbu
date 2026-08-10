import { NextResponse } from "next/server";
import { getCommercialPublishMap } from "@/core/services/commercialPublishMapService";

/** Public — ilan türü seçici / istemci ACL */
export async function GET() {
  const map = await getCommercialPublishMap();
  return NextResponse.json({ map });
}
