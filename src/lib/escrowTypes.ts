import { EscrowStatus } from "@prisma/client";

/** Güvenli Öde (escrow) durum etiketleri (TR) */
export const ESCROW_STATUS_LABELS_TR: Record<EscrowStatus, string> = {
  AWAITING_PAYMENT: "Ödeme bekleniyor",
  FUNDED: "Ödeme alındı",
  AWAITING_SHIPMENT: "Kargo bekleniyor",
  SHIPPED: "Kargoya verildi",
  BUYER_REVIEW: "Alıcı onayı bekleniyor",
  RELEASED: "Satıcıya ödendi",
  REFUNDED: "Alıcıya iade edildi",
  DISPUTED: "Anlaşmazlık",
  CANCELLED: "İptal edildi",
  EXPIRED: "Süresi doldu",
};

export function escrowStatusLabelTr(status: EscrowStatus | string): string {
  return ESCROW_STATUS_LABELS_TR[status as EscrowStatus] || String(status);
}

/** "3,7,10" gibi virgüllü gün listesini number[] olarak döndürür. */
export function parseShipDaysOptions(raw: string | null | undefined): number[] {
  const list = String(raw || "")
    .split(",")
    .map((s) => Math.floor(Number(s.trim())))
    .filter((n) => Number.isFinite(n) && n > 0);
  return list.length > 0 ? Array.from(new Set(list)).sort((a, b) => a - b) : [7];
}

export function isValidShipDays(days: number, options: number[]): boolean {
  return options.includes(Math.floor(Number(days)));
}

/** Escrow'un işlem tuttuğu (parada kilitli) sayılan durumlar */
export const ESCROW_HELD_STATUSES: EscrowStatus[] = [
  "FUNDED",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "BUYER_REVIEW",
  "DISPUTED",
] as EscrowStatus[];

/** Aynı ilan üzerinde ikinci bir alıcının Güvenli Öde başlatmasını engelleyen aktif durumlar */
export const ESCROW_ACTIVE_STATUSES: EscrowStatus[] = [
  "AWAITING_PAYMENT",
  "FUNDED",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "BUYER_REVIEW",
  "DISPUTED",
] as EscrowStatus[];
