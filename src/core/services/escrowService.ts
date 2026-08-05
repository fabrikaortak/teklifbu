import { EscrowStatus, ListingStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";
import { getEscrowRuntimeSettings, type EscrowRuntimeSettings } from "@/core/services/escrowSettingsService";
import { isDemoPosEnabled } from "@/core/services/paymentModeService";
import { isOffersEnabled } from "@/core/services/marketplaceModeService";
import { isOffersEnabledMode, type MarketplaceMode } from "@/lib/marketplaceMode";
import { ESCROW_ACTIVE_STATUSES, ESCROW_HELD_STATUSES, isValidShipDays } from "@/lib/escrowTypes";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type EscrowFail = { ok: false; status: number; body: { error: string; code?: string } };

function fail(status: number, error: string, code?: string): EscrowFail {
  return { ok: false, status, body: { error, ...(code ? { code } : {}) } };
}

/** Güvenli Öde modülü kullanılabilir mi (ayar + ürün modu kontrolü). */
export async function assertEscrowModuleAvailable(
  marketplaceMode?: MarketplaceMode
): Promise<
  | { allowed: true; settings: EscrowRuntimeSettings }
  | { allowed: false; error: string; code: string }
> {
  const settings = await getEscrowRuntimeSettings();
  if (!settings.enabled) {
    return {
      allowed: false,
      error: "Güvenli Öde modülü şu anda kapalı.",
      code: "ESCROW_DISABLED",
    };
  }
  if (!settings.allowInBiddingMode) {
    const offersEnabled = marketplaceMode
      ? isOffersEnabledMode(marketplaceMode)
      : await isOffersEnabled();
    if (offersEnabled) {
      return {
        allowed: false,
        error: "Güvenli Öde şu anda yalnızca Sahibinden Teklifsiz modunda kullanılabiliyor.",
        code: "ESCROW_NOT_IN_BIDDING_MODE",
      };
    }
  }
  return { allowed: true, settings };
}

export type EscrowCheckoutResult =
  | {
      ok: true;
      payUrl: string;
      dealId: string;
      amountTl: number;
      intentId: string;
    }
  | EscrowFail;

/** Alıcı için Güvenli Öde başlatır: EscrowDeal + bekleyen Payment (escrow_hold) oluşturur. */
export async function createEscrowCheckout(
  session: SessionUser,
  listingId: string,
  shipDaysInput: number
): Promise<EscrowCheckoutResult> {
  const avail = await assertEscrowModuleAvailable();
  if (!avail.allowed) return fail(403, avail.error, avail.code);
  const settings = avail.settings;

  const demoEnabled = await isDemoPosEnabled();
  if (!demoEnabled) {
    return fail(
      403,
      "Demo sanal POS kapalı. Admin → Ödemeler ayarlarından Demo POS’u açın.",
      "DEMO_POS_DISABLED"
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id: String(listingId || "") },
    include: { category: { select: { slug: true } } },
  });
  if (!listing) return fail(404, "İlan bulunamadı.");
  if (listing.status !== ListingStatus.ACTIVE && listing.status !== ListingStatus.SELECTION) {
    return fail(400, "Bu ilan şu anda satışa açık değil.");
  }
  const shoppingListing = isAlisverisCategorySlug(listing.category?.slug);
  if (!listing.escrowEligible && !shoppingListing) {
    return fail(400, "Bu ilan Güvenli Öde ile satışa uygun değil.", "ESCROW_NOT_ELIGIBLE");
  }
  if (listing.sellerId === session.id) {
    return fail(403, "Kendi ilanınız için Güvenli Öde başlatamazsınız.");
  }

  // Katalog offer mirror: stoklu checkout /api/catalog/checkout üzerinden
  if (listing.sellerOfferId) {
    return fail(
      400,
      "Bu ürün katalog teklifidir. /api/catalog/checkout kullanın.",
      "USE_CATALOG_CHECKOUT"
    );
  }

  const shipDays = Math.floor(Number(shipDaysInput));
  if (!isValidShipDays(shipDays, settings.shipDaysOptions)) {
    return fail(
      400,
      `Kargo süresi şu seçeneklerden biri olmalı: ${settings.shipDaysOptions.join(", ")} gün.`
    );
  }

  // Aynı alıcının ödenmemiş checkout'unu sürdür
  const myPending = await prisma.escrowDeal.findFirst({
    where: {
      listingId: listing.id,
      buyerId: session.id,
      status: EscrowStatus.AWAITING_PAYMENT,
    },
    orderBy: { createdAt: "desc" },
  });
  if (myPending?.paymentId) {
    return {
      ok: true,
      payUrl: `/odeme/demo-pos?intent=${myPending.paymentId}`,
      dealId: myPending.id,
      amountTl: myPending.amountTl,
      intentId: myPending.paymentId,
    };
  }

  const existing = await prisma.escrowDeal.findFirst({
    where: { listingId: listing.id, status: { in: ESCROW_ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    // Alışveriş (stoklu): başka alıcının işlemi bu ilanı kilitlemez — demo/çoklu satış
    if (shoppingListing) {
      // ödenmemiş terk edilmiş kayıtları kapat (aynı alıcı hariç zaten yukarıda ele alındı)
      if (existing.status === EscrowStatus.AWAITING_PAYMENT && existing.buyerId !== session.id) {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs > 30 * 60 * 1000) {
          await prisma.escrowDeal.update({
            where: { id: existing.id },
            data: { status: EscrowStatus.CANCELLED },
          });
        }
      }
    } else {
      // Tekil ilan: aktif Güvenli Öde varken ikinci satış yok
      // Demo: 30 dk+ ödenmemiş checkout'u iptal edip yeniye izin ver
      if (existing.status === EscrowStatus.AWAITING_PAYMENT) {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs > 30 * 60 * 1000) {
          await prisma.escrowDeal.update({
            where: { id: existing.id },
            data: { status: EscrowStatus.CANCELLED },
          });
        } else {
          return fail(
            409,
            "Bu ilan için zaten devam eden bir Güvenli Öde işlemi var. Önceki alışveriş başka bir hesapla yapıldıysa o sipariş tamamlanana veya iptal edilene kadar bu ilan kilitli kalır.",
            "ESCROW_ALREADY_ACTIVE"
          );
        }
      } else {
        return fail(
          409,
          "Bu ilan için zaten devam eden bir Güvenli Öde işlemi var. Önceki alışveriş başka bir hesapla yapıldıysa o sipariş tamamlanana veya iptal edilene kadar bu ilan kilitli kalır.",
          "ESCROW_ALREADY_ACTIVE"
        );
      }
    }
  }

  const seller = await prisma.user.findUnique({ where: { id: listing.sellerId } });
  if (!seller) return fail(404, "Satıcı bulunamadı.");
  if (settings.requireSellerIban && !seller.iban && !shoppingListing) {
    return fail(
      400,
      "Satıcı IBAN bilgisini tanımlamadığı için Güvenli Öde kullanılamıyor.",
      "SELLER_IBAN_MISSING"
    );
  }

  const amountTl = (() => {
    const attrs =
      listing.attributes && typeof listing.attributes === "object"
        ? (listing.attributes as Record<string, unknown>)
        : {};
    const raw = Number(listing.askPrice);
    if (attrs.priceInKurus === true || attrs.catalogOffer === true) {
      return Math.round(raw / 100);
    }
    return Math.round(raw);
  })();
  if (!Number.isFinite(amountTl) || amountTl <= 0) {
    return fail(400, "İlan tutarı geçersiz.");
  }
  if (settings.minAmountTl > 0 && amountTl < settings.minAmountTl) {
    return fail(400, `Güvenli Öde için minimum tutar ${settings.minAmountTl} TL.`);
  }
  if (settings.maxAmountTl > 0 && amountTl > settings.maxAmountTl) {
    return fail(400, `Güvenli Öde için maksimum tutar ${settings.maxAmountTl} TL.`);
  }

  const commissionTl = Math.round((amountTl * settings.commissionPercent) / 100);
  const sellerPayoutTl = amountTl - commissionTl;

  const deal = await prisma.escrowDeal.create({
    data: {
      listingId: listing.id,
      buyerId: session.id,
      sellerId: listing.sellerId,
      amountTl,
      commissionTl,
      sellerPayoutTl,
      shipDays,
      status: EscrowStatus.AWAITING_PAYMENT,
      sellerIbanSnapshot: seller.iban || null,
    },
  });

  const payment = await prisma.payment.create({
    data: {
      userId: session.id,
      amountTl,
      purpose: "escrow_hold",
      status: PaymentStatus.PENDING,
      meta: asJson({
        kind: "escrow",
        channel: "demo_pos",
        escrowDealId: deal.id,
        listingId: listing.id,
        shipDays,
      }),
    },
  });

  await prisma.escrowDeal.update({ where: { id: deal.id }, data: { paymentId: payment.id } });

  await writeAuditLog({
    actorId: session.id,
    action: "escrow.checkout.create",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { listingId: listing.id, amountTl, shipDays },
  });

  return {
    ok: true,
    payUrl: `/odeme/demo-pos?intent=${payment.id}`,
    dealId: deal.id,
    amountTl,
    intentId: payment.id,
  };
}

/** Demo POS ödemesi PAID işaretlendiğinde escrow'u fonlar (havuza para düştü). */
export async function fundEscrowFromPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.purpose !== "escrow_hold") {
    return { ok: false as const, error: "Geçersiz Güvenli Öde ödemesi." };
  }
  const meta = (payment.meta || {}) as Record<string, unknown>;
  const dealId = String(meta.escrowDealId || "");
  const deal = dealId ? await prisma.escrowDeal.findUnique({ where: { id: dealId } }) : null;
  if (!deal) return { ok: false as const, error: "Güvenli Öde kaydı bulunamadı." };

  if (deal.status !== EscrowStatus.AWAITING_PAYMENT) {
    // Idempotent: ensure Order PAID if lifecycle on
    const { isCatalogLifecycleV2Enabled, markOrderPaidInTx } = await import(
      "@/core/services/catalog/catalogOrderLifecycleService"
    );
    if (await isCatalogLifecycleV2Enabled()) {
      const orderId = String(meta.orderId || "") || null;
      if (orderId) {
        await prisma.$transaction(async (tx) => {
          await markOrderPaidInTx(tx, { orderId, paymentId: payment.id });
        });
      }
    }
    return { ok: true as const, deal, alreadyFunded: true };
  }

  const now = new Date();
  const shipDeadlineAt = new Date(now.getTime() + deal.shipDays * 24 * 60 * 60 * 1000);
  const dealMeta = (deal.meta || {}) as Record<string, unknown>;
  const orderId =
    String(meta.orderId || dealMeta.orderId || "") || null;

  const { isCatalogLifecycleV2Enabled, markOrderPaidInTx } = await import(
    "@/core/services/catalog/catalogOrderLifecycleService"
  );
  const lifecycleOn = await isCatalogLifecycleV2Enabled();

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status::text AS status FROM "EscrowDeal" WHERE id = ${deal.id} FOR UPDATE
    `;
    if (!locked[0] || locked[0].status !== EscrowStatus.AWAITING_PAYMENT) {
      return null;
    }

    const next = await tx.escrowDeal.update({
      where: { id: deal.id },
      data: {
        status: EscrowStatus.AWAITING_SHIPMENT,
        shipDeadlineAt,
        meta: asJson({ ...dealMeta, fundedAt: now.toISOString() }),
      },
    });

    if (lifecycleOn && orderId) {
      await markOrderPaidInTx(tx, { orderId, paymentId: payment.id, now });
    }

    return next;
  });

  if (!updated) {
    const current = await prisma.escrowDeal.findUnique({ where: { id: deal.id } });
    return { ok: true as const, deal: current || deal, alreadyFunded: true };
  }

  await notifyUser(deal.sellerId, {
    title: "Güvenli Öde: Ödeme alındı",
    body: `Alıcı ödemeyi TeklifBu Güvenli Öde havuzuna yatırdı. Ürünü ${deal.shipDays} gün içinde kargoya vermelisiniz.`,
    eventKey: "escrow_funded",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });
  await notifyUser(deal.buyerId, {
    title: "Güvenli Öde: Ödemeniz alındı",
    body: "Ödemeniz güvenle TeklifBu havuzunda tutuluyor. Satıcı ürünü kargoya verince bilgilendirileceksiniz.",
    eventKey: "escrow_funded",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    action: "escrow.funded",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { paymentId, orderId },
  });

  return { ok: true as const, deal: updated };
}

/** Demo POS ekranından "Öde" tıklanınca escrow_hold ödemesini PAID'e çevirir ve fonlar. */
export async function completeEscrowPayment(session: SessionUser, intentId: string) {
  const demoEnabled = await isDemoPosEnabled();
  if (!demoEnabled) return fail(403, "Demo POS kapalı.", "DEMO_POS_DISABLED");

  const payment = await prisma.payment.findUnique({ where: { id: String(intentId || "") } });
  if (!payment || payment.userId !== session.id || payment.purpose !== "escrow_hold") {
    return fail(404, "Ödeme oturumu bulunamadı.");
  }
  if (
    payment.status !== PaymentStatus.PENDING &&
    payment.status !== PaymentStatus.PAID
  ) {
    return fail(409, `Ödeme durumu uygun değil: ${payment.status}`);
  }

  const now = new Date();
  const providerTxId = `demo-${payment.id}`;

  // Single transaction: Payment PAID + Escrow fund + Order PAID
  const { isCatalogLifecycleV2Enabled, markOrderPaidInTx } = await import(
    "@/core/services/catalog/catalogOrderLifecycleService"
  );
  const lifecycleOn = await isCatalogLifecycleV2Enabled();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const paymentMetaEarly = (payment.meta || {}) as Record<string, unknown>;
      const orderIdEarly = String(paymentMetaEarly.orderId || "") || null;
      const dealIdEarly = String(paymentMetaEarly.escrowDealId || "");

      // Consistent lock order with cancel: Order → Payment → EscrowDeal
      if (orderIdEarly) {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderIdEarly} FOR UPDATE`;
        const ord = await tx.order.findUnique({ where: { id: orderIdEarly } });
        if (ord?.status === OrderStatus.CANCELLED) {
          throw new Error("ORDER_CANCELLED");
        }
      }

      const lockedPay = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status::text AS status FROM "Payment" WHERE id = ${payment.id} FOR UPDATE
      `;
      if (!lockedPay[0]) throw new Error("PAYMENT_NOT_FOUND");
      if (
        lockedPay[0].status !== PaymentStatus.PENDING &&
        lockedPay[0].status !== PaymentStatus.PAID &&
        lockedPay[0].status !== "PENDING" &&
        lockedPay[0].status !== "PAID"
      ) {
        throw new Error(`PAYMENT_STATUS_${lockedPay[0].status}`);
      }

      const paymentMeta = (payment.meta || {}) as Record<string, unknown>;
      let dealId = dealIdEarly;
      const orderId = orderIdEarly;

      if (!dealId && orderId) {
        const ordLink = await tx.order.findUnique({
          where: { id: orderId },
          select: { escrowDealId: true },
        });
        dealId = ordLink?.escrowDealId || "";
      }
      if (!dealId) {
        const byOrder = await tx.escrowDeal.findFirst({
          where: { orderId: orderId || undefined },
          select: { id: true },
        });
        if (byOrder) dealId = byOrder.id;
      }

      if (lockedPay[0].status === PaymentStatus.PENDING || lockedPay[0].status === "PENDING") {
        // Unique providerTransactionId — second completion no-ops via catch
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt: now,
            providerTransactionId: providerTxId,
            meta: asJson({
              ...paymentMeta,
              channel: "demo_pos",
              paidAt: now.toISOString(),
              simulated: true,
            }),
          },
        });
      }

      if (!dealId) throw new Error("NO_DEAL");

      const lockedDeal = await tx.$queryRaw<Array<{ id: string; status: string; shipDays: number }>>`
        SELECT id, status::text AS status, "shipDays" FROM "EscrowDeal" WHERE id = ${dealId} FOR UPDATE
      `;
      const d = lockedDeal[0];
      if (!d) throw new Error("NO_DEAL");

      let alreadyFunded = false;
      if (d.status === EscrowStatus.AWAITING_PAYMENT || d.status === "AWAITING_PAYMENT") {
        const shipDeadlineAt = new Date(now.getTime() + d.shipDays * 24 * 60 * 60 * 1000);
        const dealRow = await tx.escrowDeal.findUnique({ where: { id: dealId } });
        const dealMeta = (dealRow?.meta || {}) as Record<string, unknown>;
        await tx.escrowDeal.update({
          where: { id: dealId },
          data: {
            status: EscrowStatus.AWAITING_SHIPMENT,
            shipDeadlineAt,
            meta: asJson({ ...dealMeta, fundedAt: now.toISOString() }),
          },
        });
      } else {
        alreadyFunded = true;
      }

      if (lifecycleOn && orderId) {
        await markOrderPaidInTx(tx, { orderId, paymentId: payment.id, now });
      }

      return { dealId, alreadyFunded, orderId };
    });

    if (!result.alreadyFunded) {
      const deal = await prisma.escrowDeal.findUnique({ where: { id: result.dealId } });
      if (deal) {
        await notifyUser(deal.sellerId, {
          title: "Güvenli Öde: Ödeme alındı",
          body: `Alıcı ödemeyi TeklifBu Güvenli Öde havuzuna yatırdı. Ürünü ${deal.shipDays} gün içinde kargoya vermelisiniz.`,
          eventKey: "escrow_funded",
          link: `/hesabim/guvenli-ode/${deal.id}`,
        });
        await notifyUser(deal.buyerId, {
          title: "Güvenli Öde: Ödemeniz alındı",
          body: "Ödemeniz güvenle TeklifBu havuzunda tutuluyor. Satıcı ürünü kargoya verince bilgilendirileceksiniz.",
          eventKey: "escrow_funded",
          link: `/hesabim/guvenli-ode/${deal.id}`,
        });
      }
      await writeAuditLog({
        action: "escrow.funded",
        entity: "EscrowDeal",
        entityId: result.dealId,
        meta: { paymentId: payment.id, orderId: result.orderId },
      });
    }

    return {
      ok: true as const,
      dealId: result.dealId,
      alreadyCompleted: result.alreadyFunded,
      message: result.alreadyFunded
        ? "Ödeme zaten tamamlanmış."
        : "Ödemeniz alındı ve Güvenli Öde havuzuna aktarıldı.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ORDER_CANCELLED")) {
      return fail(409, "Sipariş süresi doldu / iptal edildi.", "ORDER_CANCELLED");
    }
    if (msg.includes("Unique constraint") || msg.includes("providerTransactionId")) {
      // Second completion with same provider id — treat as success
      const meta = (payment.meta || {}) as Record<string, unknown>;
      return {
        ok: true as const,
        dealId: String(meta.escrowDealId || ""),
        alreadyCompleted: true,
        message: "Ödeme zaten tamamlanmış.",
      };
    }
    if (msg.startsWith("PAYMENT_STATUS_")) {
      return fail(409, `Ödeme durumu uygun değil: ${msg.replace("PAYMENT_STATUS_", "")}`);
    }
    return fail(400, msg || "Güvenli Öde fonlanamadı.");
  }
}

/** Satıcı kargo bilgisi girer: SHIPPED üzerinden BUYER_REVIEW'a geçer (aynı adımda). */
export async function sellerSubmitCargo(
  session: SessionUser,
  dealId: string,
  input: { trackingNo?: string; carrier?: string; receiptUrl?: string; note?: string }
) {
  const deal = await prisma.escrowDeal.findUnique({ where: { id: String(dealId || "") } });
  if (!deal) return fail(404, "Güvenli Öde işlemi bulunamadı.");
  if (deal.sellerId !== session.id) return fail(403, "Bu işlem size ait değil.");
  if (deal.status !== EscrowStatus.AWAITING_SHIPMENT) {
    return fail(400, "Bu işlem kargo bilgisi girilebilecek durumda değil.");
  }

  const trackingNo = String(input.trackingNo || "").trim();
  if (!trackingNo) return fail(400, "Kargo takip numarası gerekli.");

  const settings = await getEscrowRuntimeSettings();
  const now = new Date();
  const buyerConfirmDeadlineAt = new Date(
    now.getTime() + settings.buyerConfirmDays * 24 * 60 * 60 * 1000
  );

  const updated = await prisma.escrowDeal.update({
    where: { id: deal.id },
    data: {
      status: EscrowStatus.BUYER_REVIEW,
      cargoTrackingNo: trackingNo,
      cargoCarrier: input.carrier ? String(input.carrier).trim() : null,
      cargoReceiptUrl: input.receiptUrl ? String(input.receiptUrl).trim() : null,
      cargoNote: input.note ? String(input.note).trim() : null,
      shippedAt: now,
      buyerConfirmDeadlineAt,
    },
  });

  await notifyUser(deal.buyerId, {
    title: "Ürününüz kargoya verildi",
    body: `Satıcı ürünü kargoya verdi${
      input.carrier ? ` (${input.carrier})` : ""
    }. Takip no: ${trackingNo}. Teslim sonrası ${settings.buyerConfirmDays} gün içinde onaylamanız gerekir, aksi halde otomatik işlem uygulanır.`,
    eventKey: "escrow_shipped",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    actorId: session.id,
    action: "escrow.shipped",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { trackingNo, carrier: input.carrier || null },
  });

  return { ok: true as const, deal: updated };
}

/** Alıcı teslim aldığını onaylar → satıcıya ödeme (simülasyon) serbest bırakılır. */
export async function buyerConfirmReceipt(session: SessionUser, dealId: string) {
  const deal = await prisma.escrowDeal.findUnique({ where: { id: String(dealId || "") } });
  if (!deal) return fail(404, "Güvenli Öde işlemi bulunamadı.");
  if (deal.buyerId !== session.id) return fail(403, "Bu işlem size ait değil.");
  if (deal.status !== EscrowStatus.BUYER_REVIEW) {
    return fail(400, "Bu işlem onaylanabilecek durumda değil.");
  }

  const now = new Date();
  const dealMeta = (deal.meta || {}) as Record<string, unknown>;
  const updated = await prisma.escrowDeal.update({
    where: { id: deal.id },
    data: {
      status: EscrowStatus.RELEASED,
      buyerConfirmedAt: now,
      releasedAt: now,
      meta: asJson({
        ...dealMeta,
        release: {
          releasedAt: now.toISOString(),
          method: "bank_transfer_simulated",
          sellerIban: deal.sellerIbanSnapshot,
          amountTl: deal.sellerPayoutTl,
          note: "Admin simülasyonu: satıcı hesabına banka havalesi yapıldığı kaydedildi.",
        },
      }),
    },
  });

  if (deal.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: deal.paymentId } });
    if (payment) {
      const paymentMeta = (payment.meta || {}) as Record<string, unknown>;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { meta: asJson({ ...paymentMeta, escrowReleasedAt: now.toISOString() }) },
      });
    }
  }

  await notifyUser(deal.sellerId, {
    title: "Güvenli Öde: Ödemeniz aktarıldı",
    body: `Alıcı ürünü onayladı. ${deal.sellerPayoutTl} TL tutarındaki ödemeniz IBAN hesabınıza aktarılıyor.`,
    eventKey: "escrow_released",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });
  await notifyUser(deal.buyerId, {
    title: "Güvenli Öde tamamlandı",
    body: "Teslim aldığınızı onayladınız. İşlem tamamlandı, teşekkürler.",
    eventKey: "escrow_released",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    actorId: session.id,
    action: "escrow.buyer_confirm_release",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { sellerPayoutTl: deal.sellerPayoutTl },
  });

  return { ok: true as const, deal: updated };
}

/** Alıcı ürünü reddeder / anlaşmazlık açar → yönetici incelemesine düşer. */
export async function buyerRejectOrDispute(session: SessionUser, dealId: string, reason: string) {
  const deal = await prisma.escrowDeal.findUnique({ where: { id: String(dealId || "") } });
  if (!deal) return fail(404, "Güvenli Öde işlemi bulunamadı.");
  if (deal.buyerId !== session.id) return fail(403, "Bu işlem size ait değil.");
  if (deal.status !== EscrowStatus.BUYER_REVIEW && deal.status !== EscrowStatus.SHIPPED) {
    return fail(400, "Bu işlem için anlaşmazlık açılamaz.");
  }

  const trimmed = String(reason || "").trim();
  if (!trimmed) return fail(400, "Anlaşmazlık sebebi gerekli.");

  const updated = await prisma.escrowDeal.update({
    where: { id: deal.id },
    data: { status: EscrowStatus.DISPUTED, disputeReason: trimmed },
  });

  await notifyUser(deal.sellerId, {
    title: "Güvenli Öde: Anlaşmazlık açıldı",
    body: `Alıcı bu işlem için anlaşmazlık bildirdi: ${trimmed}. Yönetici inceleyecek.`,
    eventKey: "escrow_disputed",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    actorId: session.id,
    action: "escrow.dispute.buyer",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { reason: trimmed },
  });

  return { ok: true as const, deal: updated };
}

/** Yönetici: parayı satıcıya serbest bırakır (simülasyon). adminId=null → sistem (timeout) tetikli. */
export async function adminRelease(dealId: string, adminId: string | null, note?: string | null) {
  const deal = await prisma.escrowDeal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error("Güvenli Öde işlemi bulunamadı");
  if (deal.status === EscrowStatus.RELEASED) throw new Error("Bu işlem zaten ödendi");
  if (deal.status === EscrowStatus.REFUNDED || deal.status === EscrowStatus.CANCELLED) {
    throw new Error("Bu işlem artık ödemeye açılamaz");
  }

  const now = new Date();
  const dealMeta = (deal.meta || {}) as Record<string, unknown>;
  const updated = await prisma.escrowDeal.update({
    where: { id: deal.id },
    data: {
      status: EscrowStatus.RELEASED,
      releasedAt: now,
      adminNote: note ? String(note).trim() : deal.adminNote,
      meta: asJson({
        ...dealMeta,
        release: {
          releasedAt: now.toISOString(),
          method: "bank_transfer_simulated",
          byAdmin: adminId || "system",
          sellerIban: deal.sellerIbanSnapshot,
          amountTl: deal.sellerPayoutTl,
          note: note || "Yönetici tarafından manuel serbest bırakıldı.",
        },
      }),
    },
  });

  await notifyUser(deal.sellerId, {
    title: "Güvenli Öde: Ödemeniz aktarıldı",
    body: `Yönetici onayı ile ${deal.sellerPayoutTl} TL tutarındaki ödemeniz IBAN hesabınıza aktarılıyor.`,
    eventKey: "escrow_released",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });
  await notifyUser(deal.buyerId, {
    title: "Güvenli Öde tamamlandı",
    body: "İşleminiz yönetici tarafından tamamlandı ve satıcıya ödeme yapıldı.",
    eventKey: "escrow_released",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    actorId: adminId,
    action: "escrow.admin_release",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { note: note || null },
  });

  return updated;
}

/** Yönetici: parayı alıcıya iade eder (simülasyon). adminId=null → sistem (timeout) tetikli. */
export async function adminRefund(dealId: string, adminId: string | null, note?: string | null) {
  const deal = await prisma.escrowDeal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error("Güvenli Öde işlemi bulunamadı");
  if (deal.status === EscrowStatus.REFUNDED) throw new Error("Bu işlem zaten iade edildi");
  if (deal.status === EscrowStatus.RELEASED) {
    throw new Error("Bu işlem zaten satıcıya ödendi, iade edilemez");
  }

  const now = new Date();
  const dealMeta = (deal.meta || {}) as Record<string, unknown>;
  const updated = await prisma.escrowDeal.update({
    where: { id: deal.id },
    data: {
      status: EscrowStatus.REFUNDED,
      refundedAt: now,
      adminNote: note ? String(note).trim() : deal.adminNote,
      meta: asJson({
        ...dealMeta,
        refund: {
          refundedAt: now.toISOString(),
          method: "bank_transfer_simulated",
          byAdmin: adminId || "system",
          amountTl: deal.amountTl,
          note: note || "Yönetici tarafından iade edildi.",
        },
      }),
    },
  });

  await notifyUser(deal.buyerId, {
    title: "Güvenli Öde: Ödemeniz iade edildi",
    body: `${deal.amountTl} TL tutarındaki ödemeniz yönetici tarafından size iade edilmek üzere işleme alındı.`,
    eventKey: "escrow_refunded",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });
  await notifyUser(deal.sellerId, {
    title: "Güvenli Öde işlemi iade edildi",
    body: "Bu Güvenli Öde işlemi yönetici tarafından iptal edilip alıcıya iade edildi.",
    eventKey: "escrow_refunded",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    actorId: adminId,
    action: "escrow.admin_refund",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { note: note || null },
  });

  return updated;
}

/** Yönetici işlemi anlaşmazlık olarak işaretler. adminId=null → sistem (timeout) tetikli. */
export async function adminMarkDisputed(
  dealId: string,
  adminId: string | null,
  reason?: string | null,
  note?: string | null
) {
  const deal = await prisma.escrowDeal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error("Güvenli Öde işlemi bulunamadı");
  if (deal.status === EscrowStatus.RELEASED || deal.status === EscrowStatus.REFUNDED) {
    throw new Error("Bu işlem sonuçlanmış, anlaşmazlığa açılamaz");
  }

  const updated = await prisma.escrowDeal.update({
    where: { id: deal.id },
    data: {
      status: EscrowStatus.DISPUTED,
      disputeReason: reason ? String(reason).trim() : deal.disputeReason,
      adminNote: note ? String(note).trim() : deal.adminNote,
    },
  });

  await notifyUser(deal.buyerId, {
    title: "Güvenli Öde: Anlaşmazlık",
    body: "Bu işlem yönetici tarafından anlaşmazlık olarak işaretlendi. Sizinle iletişime geçilecek.",
    eventKey: "escrow_disputed",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });
  await notifyUser(deal.sellerId, {
    title: "Güvenli Öde: Anlaşmazlık",
    body: "Bu işlem yönetici tarafından anlaşmazlık olarak işaretlendi. Sizinle iletişime geçilecek.",
    eventKey: "escrow_disputed",
    link: `/hesabim/guvenli-ode/${deal.id}`,
  });

  await writeAuditLog({
    actorId: adminId,
    action: "escrow.admin_dispute",
    entity: "EscrowDeal",
    entityId: deal.id,
    meta: { reason: reason || null, note: note || null },
  });

  return updated;
}

export type EscrowDealFilters = {
  status?: string;
  listingId?: string;
  buyerId?: string;
  sellerId?: string;
  q?: string;
  take?: number;
};

/** Admin panel: filtreli Güvenli Öde işlem listesi. */
export async function listEscrowDeals(filters: EscrowDealFilters = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && Object.values(EscrowStatus).includes(filters.status as EscrowStatus)) {
    where.status = filters.status as EscrowStatus;
  }
  if (filters.listingId) where.listingId = filters.listingId;
  if (filters.buyerId) where.buyerId = filters.buyerId;
  if (filters.sellerId) where.sellerId = filters.sellerId;
  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { listing: { title: { contains: q, mode: "insensitive" } } },
      { buyer: { name: { contains: q, mode: "insensitive" } } },
      { buyer: { phone: { contains: q, mode: "insensitive" } } },
      { seller: { name: { contains: q, mode: "insensitive" } } },
      { seller: { phone: { contains: q, mode: "insensitive" } } },
      { cargoTrackingNo: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.escrowDeal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, Number(filters.take) || 100)),
    include: {
      listing: {
        select: { id: true, title: true, listingNo: true, coverImage: true, askPrice: true },
      },
      linkedOrder: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          items: {
            take: 1,
            select: {
              productNameSnapshot: true,
              variantTitleSnapshot: true,
              productImageSnapshot: true,
              productId: true,
              sellerOfferId: true,
            },
          },
        },
      },
      sellerOffer: {
        select: {
          id: true,
          product: { select: { id: true, name: true, mainImage: true } },
          variant: { select: { title: true } },
        },
      },
      buyer: { select: { id: true, name: true, phone: true, email: true } },
      seller: { select: { id: true, name: true, phone: true, email: true, iban: true } },
    },
  });
}

/** Admin panel: havuzda tutulan / serbest bırakılan / iade edilen toplam tutarlar. */
export async function getEscrowPoolSummary() {
  const [heldAgg, releasedAgg, refundedAgg, byStatus] = await Promise.all([
    prisma.escrowDeal.aggregate({
      where: { status: { in: ESCROW_HELD_STATUSES } },
      _sum: { amountTl: true },
      _count: true,
    }),
    prisma.escrowDeal.aggregate({
      where: { status: EscrowStatus.RELEASED },
      _sum: { sellerPayoutTl: true, commissionTl: true },
      _count: true,
    }),
    prisma.escrowDeal.aggregate({
      where: { status: EscrowStatus.REFUNDED },
      _sum: { amountTl: true },
      _count: true,
    }),
    prisma.escrowDeal.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    heldTl: Number(heldAgg._sum.amountTl || 0),
    heldCount: heldAgg._count,
    releasedTl: Number(releasedAgg._sum.sellerPayoutTl || 0),
    releasedCommissionTl: Number(releasedAgg._sum.commissionTl || 0),
    releasedCount: releasedAgg._count,
    refundedTl: Number(refundedAgg._sum.amountTl || 0),
    refundedCount: refundedAgg._count,
    byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
  };
}

/** Zamanlanmış görev: süresi geçen escrow işlemlerine ayarlardaki timeout kuralını uygular. */
export async function processEscrowTimeouts() {
  const settings = await getEscrowRuntimeSettings();
  const now = new Date();
  const actions: string[] = [];

  const overdueShipments = await prisma.escrowDeal.findMany({
    where: { status: EscrowStatus.AWAITING_SHIPMENT, shipDeadlineAt: { lt: now } },
  });
  for (const deal of overdueShipments) {
    if (settings.sellerTimeoutAction === "auto_refund") {
      await adminRefund(deal.id, null, "Satıcı kargo süresini kaçırdı — otomatik iade");
      actions.push(`refund:${deal.id}`);
    } else if (settings.sellerTimeoutAction === "open_dispute") {
      await adminMarkDisputed(deal.id, null, "Satıcı kargo süresini kaçırdı");
      actions.push(`dispute:${deal.id}`);
    } else {
      actions.push(`hold:${deal.id}`);
    }
  }

  const overdueReviews = await prisma.escrowDeal.findMany({
    where: { status: EscrowStatus.BUYER_REVIEW, buyerConfirmDeadlineAt: { lt: now } },
  });
  for (const deal of overdueReviews) {
    if (settings.buyerTimeoutAction === "auto_release") {
      await adminRelease(deal.id, null, "Alıcı onay süresini kaçırdı — otomatik ödeme");
      actions.push(`release:${deal.id}`);
    } else if (settings.buyerTimeoutAction === "open_dispute") {
      await adminMarkDisputed(deal.id, null, "Alıcı onay süresini kaçırdı");
      actions.push(`dispute:${deal.id}`);
    } else {
      actions.push(`hold:${deal.id}`);
    }
  }

  return {
    ok: true as const,
    sellerTimeouts: overdueShipments.length,
    buyerTimeouts: overdueReviews.length,
    actions,
  };
}
