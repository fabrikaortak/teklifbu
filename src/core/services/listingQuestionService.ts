import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { ListingStatus } from "@prisma/client";
import { resolveListingVerticalFromDb } from "@/lib/listingVertical";

const ASKABLE: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.SELECTION,
  ListingStatus.PENDING_REVIEW,
];

/** Emlak/Vasıta → emlak ayarı; Alışveriş → satıcı paneli modülü */
export async function isListingQuestionsEnabledForListing(listingId: string): Promise<boolean> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, categoryId: true, category: { select: { slug: true } } },
  });
  if (!listing) return false;
  const vertical = await resolveListingVerticalFromDb({
    categoryId: listing.categoryId,
    categorySlug: listing.category?.slug,
  });
  if (vertical === "alisveris") {
    return (await getSetting<boolean>("seller_panel_module_questions", true)) !== false;
  }
  if (vertical === "emlak" || vertical === "vasita") {
    return (await getSetting<boolean>("emlak_vasita_listing_questions_enabled", true)) !== false;
  }
  // premium / unknown: emlak-vasita anahtarına bağlama — kapalı say
  return false;
}

export async function listQuestionsForSeller(sellerId: string, filter: "open" | "answered" | "all" = "open") {
  const qaSla = Number((await getSetting<number>("seller_panel_qa_sla_hours", 24)) || 24);
  const slaCut = new Date(Date.now() - qaSla * 3600_000);

  const where =
    filter === "open"
      ? { listing: { sellerId }, answeredAt: null, isHidden: false }
      : filter === "answered"
        ? { listing: { sellerId }, answeredAt: { not: null }, isHidden: false }
        : { listing: { sellerId }, isHidden: false };

  const rows = await prisma.listingQuestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      listing: { select: { id: true, title: true, coverImage: true, listingNo: true } },
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
    listing: q.listing,
    askerName: q.asker.name || "Alıcı",
  }));
}

export async function answerListingQuestion(opts: {
  questionId: string;
  sellerId: string;
  answerBody: string;
}) {
  const answer = String(opts.answerBody || "").trim();
  if (answer.length < 2) return { ok: false as const, status: 400, error: "Yanıt en az 2 karakter olmalı" };

  const q = await prisma.listingQuestion.findUnique({
    where: { id: opts.questionId },
    include: { listing: { select: { sellerId: true, title: true } } },
  });
  if (!q || q.listing.sellerId !== opts.sellerId) {
    return { ok: false as const, status: 404, error: "Soru bulunamadı" };
  }

  const updated = await prisma.listingQuestion.update({
    where: { id: q.id },
    data: {
      answerBody: answer,
      answeredAt: new Date(),
      answeredById: opts.sellerId,
    },
  });

  await prisma.notification.create({
    data: {
      userId: q.askerId,
      title: "Sorunuz yanıtlandı",
      body: `${q.listing.title}: ${answer.slice(0, 120)}`,
      link: `/ilan/${q.listingId}`,
      eventKey: "listing_question_answered",
    },
  }).catch(() => {});

  return { ok: true as const, question: updated };
}

export async function askListingQuestion(opts: {
  listingId: string;
  askerId: string;
  body: string;
}) {
  const body = String(opts.body || "").trim();
  if (body.length < 5) return { ok: false as const, status: 400, error: "Soru en az 5 karakter olmalı" };
  if (body.length > 1000) return { ok: false as const, status: 400, error: "Soru çok uzun" };

  if (!(await isListingQuestionsEnabledForListing(opts.listingId))) {
    return { ok: false as const, status: 403, error: "Bu ilan türünde soru–cevap kapalı" };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: opts.listingId },
    select: { id: true, sellerId: true, status: true, title: true, category: { select: { slug: true } } },
  });
  if (!listing || !ASKABLE.includes(listing.status)) {
    return { ok: false as const, status: 404, error: "İlana soru sorulamaz" };
  }
  if (listing.sellerId === opts.askerId) {
    return { ok: false as const, status: 400, error: "Kendi ilanınıza soru soramazsınız" };
  }

  const q = await prisma.listingQuestion.create({
    data: {
      listingId: listing.id,
      askerId: opts.askerId,
      body,
      isPublic: true,
    },
  });

  const vertical = await resolveListingVerticalFromDb({
    categorySlug: listing.category?.slug,
  });
  const sellerLink =
    vertical === "alisveris" ? `/magaza/panel/sorular` : `/hesabim?s=mesajlar`;

  await prisma.notification.create({
    data: {
      userId: listing.sellerId,
      title: "Yeni ürün sorusu",
      body: `${listing.title}: ${body.slice(0, 120)}`,
      link: sellerLink,
      eventKey: "listing_question_new",
    },
  }).catch(() => {});

  return { ok: true as const, question: q };
}

export async function listPublicQuestionsForListing(listingId: string) {
  return prisma.listingQuestion.findMany({
    where: { listingId, isPublic: true, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      body: true,
      answerBody: true,
      answeredAt: true,
      createdAt: true,
      asker: { select: { name: true } },
    },
  });
}
