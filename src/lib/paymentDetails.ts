import { formatTl, paymentPurposeLabel, paymentStatusLabel } from "@/lib/format";

export type PaymentDetailRow = { label: string; value: string; href?: string };

/** Admin ödeme satırı → okunabilir detay satırları */
export function paymentMetaDetails(p: {
  id?: string;
  purpose?: string;
  amountTl?: number;
  status?: string;
  createdAt?: string | Date;
  user?: { name?: string | null; phone?: string | null; id?: string };
  meta?: unknown;
}): PaymentDetailRow[] {
  const meta =
    p.meta && typeof p.meta === "object" && !Array.isArray(p.meta)
      ? (p.meta as Record<string, unknown>)
      : {};
  const listing =
    meta.listing && typeof meta.listing === "object" && !Array.isArray(meta.listing)
      ? (meta.listing as Record<string, unknown>)
      : null;
  const fee =
    meta.fee && typeof meta.fee === "object" && !Array.isArray(meta.fee)
      ? (meta.fee as Record<string, unknown>)
      : null;
  const listingId = meta.listingId ? String(meta.listingId) : "";
  const rows: PaymentDetailRow[] = [
    { label: "Ödeme no", value: String(p.id || "—") },
    { label: "Kullanıcı", value: p.user?.name || p.user?.phone || "—" },
    { label: "Amaç", value: paymentPurposeLabel(p.purpose) },
    { label: "Tutar", value: formatTl(Number(p.amountTl || 0)) },
    { label: "Durum", value: paymentStatusLabel(p.status) },
    {
      label: "Tarih",
      value: p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—",
    },
  ];
  if (meta.kind) rows.push({ label: "Kayıt türü", value: String(meta.kind) });
  if (meta.channel) rows.push({ label: "Kanal", value: String(meta.channel) });
  if (listingId) {
    rows.push({
      label: "İlan",
      value: listingId,
      href: `/ilan/${listingId}`,
    });
  }
  if (listing?.title) rows.push({ label: "İlan başlığı", value: String(listing.title) });
  if (listing?.city) {
    rows.push({
      label: "Konum",
      value: [listing.district, listing.city].filter(Boolean).join(", ") || String(listing.city),
    });
  }
  if (listing?.categorySlug) rows.push({ label: "Kategori", value: String(listing.categorySlug) });
  if (fee) {
    if (fee.baseFeeTl != null) {
      rows.push({
        label: "Temel ilan ücreti",
        value: formatTl(Number(fee.baseFeeTl)),
      });
    } else if (fee.feeTl != null) {
      rows.push({
        label: "İlan ücreti (toplam)",
        value: formatTl(Number(fee.feeTl)),
      });
    }
    let premiumItems = Array.isArray(fee.premiumBreakdown)
      ? (fee.premiumBreakdown as Array<{ key?: string; label?: string; amountTl?: number }>)
      : [];
    /** Eski kayıtlarda breakdown yoksa ilan payload’ından çıkar */
    if (!premiumItems.length && listing) {
      const inferred: Array<{ label: string; amountTl: number }> = [];
      if (listing.titleBold) inferred.push({ label: "Kalın başlık", amountTl: 0 });
      if (listing.titleLarge) inferred.push({ label: "Büyük harf başlık", amountTl: 0 });
      if (listing.isColored) inferred.push({ label: "Renkli ilan", amountTl: 0 });
      const days = Number(listing.featuredDays || 0);
      if (days === 3) inferred.push({ label: "3 gün ana sayfa", amountTl: 0 });
      if (days === 7) inferred.push({ label: "7 gün ana sayfa", amountTl: 0 });
      premiumItems = inferred;
    }
    const premiumTotal = Number(fee.premiumFeeTl || 0);
    if (premiumTotal > 0 || premiumItems.length > 0) {
      rows.push({
        label: "Premium ek ücret",
        value: formatTl(
          premiumTotal || premiumItems.reduce((s, x) => s + Number(x.amountTl || 0), 0)
        ),
      });
      if (premiumItems.length) {
        rows.push({
          label: "Satın alınan premium",
          value: premiumItems
            .map((x) => {
              const label = String(x.label || x.key || "Premium").trim();
              const amt = Number(x.amountTl || 0);
              return amt > 0 ? `${label} — ${formatTl(amt)}` : label;
            })
            .join(" · "),
        });
      } else {
        rows.push({
          label: "Satın alınan premium",
          value: "Detay kaydı yok",
        });
      }
    }
    if (fee.feeTl != null && fee.baseFeeTl != null) {
      rows.push({
        label: "Ödenen toplam",
        value: formatTl(Number(fee.feeTl)),
      });
    }
    if (fee.quota != null) {
      rows.push({
        label: "Kota",
        value: `${fee.used ?? "—"} / ${fee.quota}${fee.mode ? ` (${fee.mode})` : ""}`,
      });
    }
  }
  if (meta.tokenAmount != null) rows.push({ label: "Jeton adedi", value: String(meta.tokenAmount) });
  if (meta.packageId) rows.push({ label: "Paket id", value: String(meta.packageId) });
  if (meta.packageName) rows.push({ label: "Paket", value: String(meta.packageName) });
  if (meta.months != null) rows.push({ label: "Süre (ay)", value: String(meta.months) });
  if (meta.subscriptionId) rows.push({ label: "Abonelik", value: String(meta.subscriptionId) });
  if (meta.accountType) rows.push({ label: "Üyelik tipi", value: String(meta.accountType) });

  // KDV bölümü (ödeme meta veya ilan faturası)
  {
    let vatPercent =
      meta.vatPercent != null && Number.isFinite(Number(meta.vatPercent))
        ? Number(meta.vatPercent)
        : null;
    let vatTl =
      meta.vatTl != null && Number.isFinite(Number(meta.vatTl)) ? Number(meta.vatTl) : null;
    let netTl =
      meta.netTl != null && Number.isFinite(Number(meta.netTl)) ? Number(meta.netTl) : null;
    let grossTl =
      meta.grossTl != null && Number.isFinite(Number(meta.grossTl))
        ? Number(meta.grossTl)
        : Number(p.amountTl || 0);
    let pricesIncludeVat =
      meta.pricesIncludeVat == null ? null : meta.pricesIncludeVat !== false;

    const feeInv =
      fee && fee.invoice && typeof fee.invoice === "object" && !Array.isArray(fee.invoice)
        ? (fee.invoice as Record<string, unknown>)
        : null;
    if (feeInv) {
      if (vatPercent == null && feeInv.vatPercent != null) vatPercent = Number(feeInv.vatPercent);
      if (vatTl == null && feeInv.vatTl != null) vatTl = Number(feeInv.vatTl);
      if (netTl == null && feeInv.afterDiscountExVatTl != null) {
        netTl = Number(feeInv.afterDiscountExVatTl);
      }
      if (feeInv.payableTl != null) grossTl = Number(feeInv.payableTl);
      if (pricesIncludeVat == null && feeInv.pricesIncludeVat != null) {
        pricesIncludeVat = feeInv.pricesIncludeVat !== false;
      }
    }

    if (vatTl != null && vatTl > 0) {
      rows.push({
        label: "KDV oranı",
        value: vatPercent != null ? `%${vatPercent}` : "—",
      });
      if (pricesIncludeVat != null) {
        rows.push({
          label: "Fiyat KDV",
          value: pricesIncludeVat ? "Dahil" : "Hariç",
        });
      }
      if (netTl != null) rows.push({ label: "KDV hariç", value: formatTl(netTl) });
      rows.push({ label: "KDV tutarı", value: formatTl(vatTl) });
      rows.push({ label: "KDV dahil", value: formatTl(grossTl) });
    }
  }

  if (meta.paidAt) {
    rows.push({
      label: "Ödeme zamanı",
      value: new Date(String(meta.paidAt)).toLocaleString("tr-TR"),
    });
  }
  if (meta.simulated === true || meta.simulatedBy) {
    rows.push({
      label: "Simülasyon",
      value: meta.simulatedBy ? `Evet (admin: ${meta.simulatedBy})` : "Evet",
    });
  }
  if (meta.consumed != null) rows.push({ label: "Kullanıldı", value: meta.consumed ? "Evet" : "Hayır" });
  return rows;
}
