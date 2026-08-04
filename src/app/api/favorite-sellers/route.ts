import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Favori mağaza / satıcı ekle-çıkar */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sellerId = String(body.sellerId || "").trim();
  if (!sellerId) return NextResponse.json({ error: "Satıcı gerekli" }, { status: 400 });
  if (sellerId === session.id) {
    return NextResponse.json({ error: "Kendinizi favoriye ekleyemezsiniz" }, { status: 400 });
  }

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, accountType: true },
  });
  if (!seller) return NextResponse.json({ error: "Satıcı bulunamadı" }, { status: 404 });

  const existing = await prisma.favoriteSeller.findUnique({
    where: { userId_sellerId: { userId: session.id, sellerId } },
  });

  if (body.action === "remove" || existing) {
    if (existing) {
      await prisma.favoriteSeller.delete({ where: { id: existing.id } });
    }
    return NextResponse.json({ ok: true, favorited: false });
  }

  await prisma.favoriteSeller.create({
    data: { userId: session.id, sellerId },
  });
  return NextResponse.json({ ok: true, favorited: true });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const sellerId = new URL(req.url).searchParams.get("sellerId");
  if (sellerId) {
    const row = await prisma.favoriteSeller.findUnique({
      where: { userId_sellerId: { userId: session.id, sellerId } },
      select: { id: true },
    });
    return NextResponse.json({ favorited: Boolean(row) });
  }
  const rows = await prisma.favoriteSeller.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    include: {
      seller: {
        select: { id: true, name: true, phone: true, accountType: true, profile: true },
      },
    },
  });
  return NextResponse.json({ items: rows });
}
