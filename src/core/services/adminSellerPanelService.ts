import { EscrowStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";

export async function getAdminSellerPanelOverview() {
  const qaSla = Number((await getSetting<number>("seller_panel_qa_sla_hours", 24)) || 24);
  const slaCut = new Date(Date.now() - qaSla * 3600_000);
  const panelEnabled = (await getSetting<boolean>("seller_panel_enabled", true)) !== false;

  const [
    awaitShip,
    inTransit,
    disputed,
    completed,
    refunded,
    openQuestions,
    overdueQuestions,
    answeredQuestions,
    activeShops,
    alisverisFocusApprox,
  ] = await Promise.all([
    prisma.escrowDeal.count({
      where: { status: { in: [EscrowStatus.AWAITING_SHIPMENT, EscrowStatus.FUNDED] } },
    }),
    prisma.escrowDeal.count({
      where: { status: { in: [EscrowStatus.SHIPPED, EscrowStatus.BUYER_REVIEW] } },
    }),
    prisma.escrowDeal.count({ where: { status: EscrowStatus.DISPUTED } }),
    prisma.escrowDeal.count({ where: { status: EscrowStatus.RELEASED } }),
    prisma.escrowDeal.count({ where: { status: EscrowStatus.REFUNDED } }),
    prisma.listingQuestion.count({ where: { answeredAt: null, isHidden: false } }),
    prisma.listingQuestion.count({
      where: { answeredAt: null, isHidden: false, createdAt: { lt: slaCut } },
    }),
    prisma.listingQuestion.count({ where: { answeredAt: { not: null }, isHidden: false } }),
    prisma.user.count({
      where: {
        accountType: { in: ["TICARI", "EMLAKCI", "GALERICI"] },
        commercialStatus: "APPROVED",
        isActive: true,
      },
    }),
    prisma.user.count({
      where: {
        accountType: { in: ["TICARI", "EMLAKCI", "GALERICI"] },
        commercialStatus: "APPROVED",
        isActive: true,
        profile: { path: ["shopFocusRoot"], equals: "alisveris" },
      },
    }).catch(() => 0),
  ]);

  const commissionPct = Number((await getSetting<number>("escrow_commission_percent", 0)) || 0);

  return {
    panelEnabled,
    qaSlaHours: qaSla,
    commissionPct,
    kpis: {
      awaitShip,
      inTransit,
      disputed,
      completed,
      refunded,
      openQuestions,
      overdueQuestions,
      answeredQuestions,
      activeShops,
      alisverisFocusShops: alisverisFocusApprox,
    },
  };
}

export async function listAdminSellerOrders(statusGroup?: string, take = 80) {
  const where: { status?: EscrowStatus | { in: EscrowStatus[] } } = {};
  if (statusGroup === "ship") {
    where.status = { in: [EscrowStatus.AWAITING_SHIPMENT, EscrowStatus.FUNDED] };
  } else if (statusGroup === "transit") {
    where.status = { in: [EscrowStatus.SHIPPED, EscrowStatus.BUYER_REVIEW] };
  } else if (statusGroup === "dispute") {
    where.status = EscrowStatus.DISPUTED;
  } else if (statusGroup === "done") {
    where.status = { in: [EscrowStatus.RELEASED, EscrowStatus.REFUNDED] };
  } else if (statusGroup === "refund") {
    where.status = EscrowStatus.REFUNDED;
  }

  const rows = await prisma.escrowDeal.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    include: {
      listing: { select: { id: true, title: true, listingNo: true, coverImage: true } },
      buyer: { select: { id: true, name: true, phone: true } },
      seller: { select: { id: true, name: true, phone: true } },
    },
  });

  return rows.map((d) => ({
    id: d.id,
    status: d.status,
    amountTl: d.amountTl,
    commissionTl: d.commissionTl,
    sellerPayoutTl: d.sellerPayoutTl,
    cargoTrackingNo: d.cargoTrackingNo,
    cargoCarrier: d.cargoCarrier,
    shipDeadlineAt: d.shipDeadlineAt?.toISOString() || null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    listing: d.listing,
    buyer: d.buyer,
    seller: d.seller,
  }));
}

export async function listAdminSellerQuestions(filter: "open" | "overdue" | "answered" | "all" = "open") {
  const qaSla = Number((await getSetting<number>("seller_panel_qa_sla_hours", 24)) || 24);
  const slaCut = new Date(Date.now() - qaSla * 3600_000);

  const where =
    filter === "open"
      ? { answeredAt: null, isHidden: false }
      : filter === "overdue"
        ? { answeredAt: null, isHidden: false, createdAt: { lt: slaCut } }
        : filter === "answered"
          ? { answeredAt: { not: null }, isHidden: false }
          : { isHidden: false };

  const rows = await prisma.listingQuestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          listingNo: true,
          seller: { select: { id: true, name: true } },
        },
      },
      asker: { select: { id: true, name: true } },
    },
  });

  return rows.map((q) => ({
    id: q.id,
    body: q.body,
    answerBody: q.answerBody,
    answeredAt: q.answeredAt?.toISOString() || null,
    createdAt: q.createdAt.toISOString(),
    overdue: !q.answeredAt && q.createdAt < slaCut,
    askerName: q.asker.name || "Alıcı",
    listing: {
      id: q.listing.id,
      title: q.listing.title,
      listingNo: q.listing.listingNo,
      sellerName: q.listing.seller.name || "Satıcı",
      sellerId: q.listing.seller.id,
    },
  }));
}
