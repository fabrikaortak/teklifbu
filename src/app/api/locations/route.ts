import { NextResponse } from "next/server";
import data from "@/data/turkey-locations.json";

type Dist = { name: string; neighborhoods: string[] };
type City = { name: string; districts: Dist[] };

const cities = (data as { cities: City[] }).cities;
const cityMap = new Map(cities.map((c) => [c.name, c]));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "";
  const district = searchParams.get("district") || "";

  if (!city) {
    return NextResponse.json({ cities: cities.map((c) => c.name) });
  }

  const c = cityMap.get(city);
  if (!c) return NextResponse.json({ districts: [], neighborhoods: [] });

  if (!district) {
    return NextResponse.json({ districts: c.districts.map((d) => d.name) });
  }

  const d = c.districts.find((x) => x.name === district);
  return NextResponse.json({ neighborhoods: d?.neighborhoods || [] });
}
