import { ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/core/services/tenantService";
import { formatTl, paymentPurposeLabel } from "@/lib/format";

export type PaymentDeleteEffect = {
  kind: "payment" | "tokens" | "ledger" | "subscription" | "listing" | "warning";
  label: string;
  severity: "info" | "warning" | "danger";
};

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function subtractDuration(from: Date, months: number, days: number) {
  const d = new Date(from);
  if (months > 0) d.setMonth(d.getMonth() - months);
  if (days > 0) d.setDate(d.getDate() - days);
  return d;
}

async function findLinkedTokenCredit(paymentId: string, userId: string, tokenAmount: number, createdAt: Date) {
  const byMeta = await prisma.tokenLedger.findFirst({
    where: {
      userId,
      delta: { gt: 0 },
      AND: [{ meta: { path: ["paymentId"], equals: paymentId } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (byMeta) return byMeta;

  if (tokenAmount <= 0) return null;

  const windowMs = 15_000;
  const from = new Date(createdAt.getTime() - windowMs);
  const to = new Date(createdAt.getTime() + windowMs);
  return prisma.tokenLedger.findFirst({
    where: {
      userId,
      delta: tokenAmount,
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Silmeden önce bağlı işlemleri listeler (popup uyarısı için). */
export async function previewPaymentDelete(paymentId: string): Promise<{
  effects: PaymentDeleteEffect[];
  canDelete: boolean;
  error?: string;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, name: true, phone: true, tokenBalance: true } } },
  });
  if (!payment) {
    return { effects: [], canDelete: false, error: "Ödeme kaydı bulunamadı" };
  }

  const effects: PaymentDeleteEffect[] = [];
  const meta = asMeta(payment.meta);
  const purpose = String(payment.purpose || "");

  effects.push({
    kind: "payment",
    label: `Ödeme kaydı silinecek (${paymentPurposeLabel(purpose)} · ${formatTl(Number(payment.amountTl || 0))})`,
    severity: "danger",
  });

  const tokenAmount = Number(meta.tokenAmount || 0);
  const isTokenPurpose =
    purpose === "token_purchase" ||
    purpose === "token_package" ||
    (tokenAmount > 0 && (purpose.includes("token") || purpose === "manual"));

  if (isTokenPurpose && tokenAmount > 0) {
    const balance = Number(payment.user.tokenBalance || 0);
    const ledger = await findLinkedTokenCredit(payment.id, payment.userId, tokenAmount, payment.createdAt);
    if (ledger) {
      effects.push({
        kind: "ledger",
        label: `Jeton hareketi geri alınacak (+${ledger.delta} kayıt)`,
        severity: "warning",
      });
    }
    if (balance < tokenAmount) {
      effects.push({
        kind: "warning",
        label: `Kullanıcının bakiyesi (${balance}) yüklenen jetondan az; bakiye 0'a düşecek (−${tokenAmount})`,
        severity: "warning",
      });
    } else {
      effects.push({
        kind: "tokens",
        label: `Kullanıcı bakiyesinden ${tokenAmount} jeton düşülecek (kalan ≈ ${balance - tokenAmount})`,
        severity: "warning",
      });
    }
  }

  if (purpose === "shop_subscription" || meta.subscriptionId || meta.kind === "shop_package_purchase") {
    const subId = meta.subscriptionId ? String(meta.subscriptionId) : "";
    const sub = subId
      ? await prisma.shopSubscription.findUnique({
          where: { id: subId },
          include: { package: { select: { name: true } } },
        })
      : await prisma.shopSubscription.findUnique({
          where: { userId: payment.userId },
          include: { package: { select: { name: true } } },
        });

    if (sub) {
      const months = Math.max(0, Math.floor(Number(meta.months || 0)));
      const days = Math.max(0, Math.floor(Number(meta.days || 0)));
      const pkgName = sub.package?.name || "paket";
      if (months > 0 || days > 0) {
        const nextEnds = subtractDuration(sub.endsAt, months, days);
        const willDeactivate = nextEnds <= new Date() || !sub.isActive;
        effects.push({
          kind: "subscription",
          label: willDeactivate
            ? `«${pkgName}» aboneliği iptal edilecek / pasife alınacak`
            : `«${pkgName}» bitiş tarihi kısaltılacak (−${months ? `${months} ay` : ""}${
                months && days ? ", " : ""
              }${days ? `${days} gün` : ""})`,
          severity: "warning",
        });
      } else if (sub.isActive) {
        effects.push({
          kind: "subscription",
          label: `«${pkgName}» aboneliği pasife alınacak`,
          severity: "warning",
        });
      } else {
        effects.push({
          kind: "subscription",
          label: `Abonelik kaydı güncellenecek («${pkgName}», zaten pasif)`,
          severity: "info",
        });
      }
    }
  }

  const listingId = meta.listingId ? String(meta.listingId) : "";
  if (listingId || purpose === "listing_fee") {
    if (listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          title: true,
          status: true,
          listingNo: true,
          _count: { select: { bids: true } },
        },
      });
      if (!listing) {
        effects.push({
          kind: "warning",
          label: "Bağlı ilan kaydı bulunamadı (yalnızca ödeme silinecek)",
          severity: "info",
        });
      } else if (listing.status === ListingStatus.APPROVED) {
        effects.push({
          kind: "warning",
          label: `İlan «${listing.title}» sonuçlanmış — ilan silinmeyecek, yalnızca ödeme kaydı silinecek`,
          severity: "warning",
        });
      } else {
        effects.push({
          kind: "listing",
          label: `İlan silinecek: «${listing.title}»${
            listing._count.bids > 0 ? ` (${listing._count.bids} teklif de silinir)` : ""
          }`,
          severity: "danger",
        });
      }
    } else if (meta.consumed) {
      effects.push({
        kind: "warning",
        label: "İlan ücreti kullanılmış görünüyor ama ilan bağlantısı yok",
        severity: "warning",
      });
    }
  }

  return { effects, canDelete: true };
}

/** Ödeme + bağlı jeton / abonelik / ilan kayıtlarını geri alır. */
export async function deletePaymentCascade(opts: {
  paymentId: string;
  adminId: string;
  tenantId: string;
}) {
  const preview = await previewPaymentDelete(opts.paymentId);
  if (!preview.canDelete) {
    throw new Error(preview.error || "Ödeme silinemedi");
  }

  const payment = await prisma.payment.findUnique({ where: { id: opts.paymentId } });
  if (!payment) throw new Error("Ödeme kaydı bulunamadı");

  const meta = asMeta(payment.meta);
  const purpose = String(payment.purpose || "");
  const applied: PaymentDeleteEffect[] = [];

  await prisma.$transaction(async (tx) => {
    const tokenAmount = Number(meta.tokenAmount || 0);
    const isTokenPurpose =
      purpose === "token_purchase" ||
      purpose === "token_package" ||
      (tokenAmount > 0 && (purpose.includes("token") || purpose === "manual"));

    if (isTokenPurpose && tokenAmount > 0) {
      const user = await tx.user.findUnique({ where: { id: payment.userId } });
      if (user) {
        const nextBalance = Math.max(0, Number(user.tokenBalance || 0) - tokenAmount);
        await tx.user.update({
          where: { id: payment.userId },
          data: { tokenBalance: nextBalance },
        });
        applied.push({
          kind: "tokens",
          label: `Jeton bakiyesi ${user.tokenBalance} → ${nextBalance}`,
          severity: "warning",
        });

        const ledger = await tx.tokenLedger.findFirst({
          where: {
            userId: payment.userId,
            delta: { gt: 0 },
            OR: [
              { meta: { path: ["paymentId"], equals: payment.id } },
              {
                AND: [
                  { delta: tokenAmount },
                  {
                    createdAt: {
                      gte: new Date(payment.createdAt.getTime() - 15_000),
                      lte: new Date(payment.createdAt.getTime() + 15_000),
                    },
                  },
                ],
              },
            ],
          },
          orderBy: { createdAt: "asc" },
        });
        if (ledger) {
          await tx.tokenLedger.delete({ where: { id: ledger.id } });
          applied.push({
            kind: "ledger",
            label: `Jeton hareketi silindi (+${ledger.delta})`,
            severity: "warning",
          });
        }
        await tx.tokenLedger.create({
          data: {
            userId: payment.userId,
            delta: -Math.min(tokenAmount, Number(user.tokenBalance || 0)),
            balanceAfter: nextBalance,
            reason: "payment_delete_reversal",
            meta: {
              paymentId: payment.id,
              reversedTokenAmount: tokenAmount,
              adminId: opts.adminId,
            } as Prisma.InputJsonValue,
          },
        });
      }
    }

    if (purpose === "shop_subscription" || meta.subscriptionId || meta.kind === "shop_package_purchase") {
      const subId = meta.subscriptionId ? String(meta.subscriptionId) : "";
      const sub = subId
        ? await tx.shopSubscription.findUnique({ where: { id: subId }, include: { package: true } })
        : await tx.shopSubscription.findUnique({
            where: { userId: payment.userId },
            include: { package: true },
          });

      if (sub) {
        const months = Math.max(0, Math.floor(Number(meta.months || 0)));
        const days = Math.max(0, Math.floor(Number(meta.days || 0)));
        let endsAt = sub.endsAt;
        if (months > 0 || days > 0) {
          endsAt = subtractDuration(sub.endsAt, months, days);
        } else {
          endsAt = new Date();
        }
        const isActive = endsAt > new Date();
        await tx.shopSubscription.update({
          where: { id: sub.id },
          data: {
            endsAt,
            isActive,
          },
        });
        applied.push({
          kind: "subscription",
          label: isActive
            ? `Abonelik kısaltıldı → ${endsAt.toLocaleString("tr-TR")}`
            : `Abonelik pasife alındı («${sub.package?.name || "paket"}»)`,
          severity: "warning",
        });
      }
    }

    const listingId = meta.listingId ? String(meta.listingId) : "";
    if (listingId) {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (listing && listing.status !== ListingStatus.APPROVED) {
        await tx.listing.update({
          where: { id: listingId },
          data: { approvedBidId: null },
        });
        await tx.message.updateMany({
          where: { listingId },
          data: { listingId: null },
        });
        await tx.listing.delete({ where: { id: listingId } });
        applied.push({
          kind: "listing",
          label: `İlan silindi: «${listing.title}»`,
          severity: "danger",
        });
      } else if (listing?.status === ListingStatus.APPROVED) {
        applied.push({
          kind: "warning",
          label: "Sonuçlanan ilan korundu",
          severity: "warning",
        });
      }
    }

    await tx.payment.delete({ where: { id: payment.id } });
    applied.push({
      kind: "payment",
      label: "Ödeme kaydı silindi",
      severity: "danger",
    });
  });

  await writeAuditLog({
    tenantId: opts.tenantId,
    actorId: opts.adminId,
    action: "payment.delete",
    entity: "Payment",
    entityId: opts.paymentId,
    meta: {
      purpose: payment.purpose,
      amountTl: payment.amountTl,
      userId: payment.userId,
      effects: applied.map((e) => e.label),
      preview: preview.effects.map((e) => e.label),
    },
  });

  return { ok: true as const, effects: applied, preview: preview.effects };
}
