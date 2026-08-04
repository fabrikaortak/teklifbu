import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/core/notify";

export async function POST(req: Request) {
  const session = await getSession();
  const body = await req.json();
  const listingId = String(body.listingId || "");
  const reason = String(body.reason || "");
  const note = String(body.note || "").slice(0, 1000);

  if (!listingId || !reason) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, title: true },
  });
  if (!listing) return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  const reporter = session?.phone || session?.id || "misafir";
  const title = "Yeni ilan şikayeti";
  const msg = `${listing.title} — neden: ${reason}${note ? ` — not: ${note}` : ""} (bildiren: ${reporter})`;

  for (const admin of admins) {
    await notifyUser(admin.id, {
      title,
      body: msg,
      eventKey: "message_received",
      link: `/ilan/${listing.id}`,
    });
  }

  // Keep an audit trail in payments meta-less store: TokenLedger unused; use Notification for reporter ack if logged in
  if (session?.id) {
    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Şikayetiniz alındı",
        body: `"${listing.title}" ilanı için şikayetiniz iletildi.`,
        eventKey: "message_received",
        link: `/ilan/${listing.id}`,
        channel: "IN_APP",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
