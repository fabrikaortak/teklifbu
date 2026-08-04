import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { serializeListing } from "@/lib/format";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const favs = await prisma.favorite.findMany({
    where: { userId: session.id },
    include: { listing: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    items: favs.map((f) => ({
      id: f.id,
      listing: { ...serializeListing(f.listing), isFavorited: true },
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const { listingId } = await req.json();
  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: session.id, listingId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, favorited: false });
  }
  await prisma.favorite.create({ data: { userId: session.id, listingId } });
  return NextResponse.json({ ok: true, favorited: true });
}
