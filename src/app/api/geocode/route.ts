import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ point: null });

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "teklifbu-dev/1.0 (local listing map)",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return NextResponse.json({ point: null }, { status: 502 });
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.[0]) return NextResponse.json({ point: null });
  return NextResponse.json({
    point: { lat: Number(data[0].lat), lng: Number(data[0].lon) },
  });
}
