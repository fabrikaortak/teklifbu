import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/core/notify";
import {
  assertCanSendMessage,
  createListingMessage,
  getMessagingAccess,
} from "@/core/services/messagingService";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const peerId = searchParams.get("peerId") || searchParams.get("to") || "";
  const listingId = searchParams.get("listingId") || "";

  const access = await getMessagingAccess();
  const gate = listingId
    ? await assertCanSendMessage(session.id, { listingId })
    : access === "everyone"
      ? { ok: true as const, access, approved: true }
      : { ok: false as const, access, approved: false };

  const where: Record<string, unknown> = {
    OR: [{ senderId: session.id }, { receiverId: session.id }],
  };

  if (peerId) {
    where.AND = [
      {
        OR: [
          { senderId: session.id, receiverId: peerId },
          { senderId: peerId, receiverId: session.id },
        ],
      },
    ];
  }
  if (listingId) {
    where.listingId = listingId;
  }

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
      listing: { select: { id: true, title: true, sellerId: true } },
    },
    orderBy: { createdAt: peerId || listingId ? "asc" : "desc" },
    take: peerId || listingId ? 200 : 100,
  });

  if (peerId) {
    await prisma.message.updateMany({
      where: {
        receiverId: session.id,
        senderId: peerId,
        isRead: false,
        ...(listingId ? { listingId } : {}),
      },
      data: { isRead: true },
    });
  }

  return NextResponse.json({
    messages,
    canSend: gate.ok,
    access,
    approved: Boolean(gate.ok && "approved" in gate ? gate.approved : gate.ok),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json();
  const result = await createListingMessage({
    senderId: session.id,
    receiverId: String(body.receiverId || ""),
    listingId: body.listingId || null,
    body: String(body.body || ""),
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  await notifyUser(String(body.receiverId), {
    title: "Yeni mesaj",
    body: "Hesabınıza yeni bir mesaj geldi.",
    eventKey: "message_received",
    link: `/hesabim?s=mesajlar&to=${session.id}${body.listingId ? `&listingId=${body.listingId}` : ""}`,
  });

  return NextResponse.json({ ok: true, message: result.message });
}
