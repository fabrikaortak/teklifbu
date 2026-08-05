export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatTl(
  value: number | bigint | string | null | undefined,
  opts?: { fractionDigits?: number }
) {
  if (value === null || value === undefined || value === "") return "—";
  let n: number;
  if (typeof value === "bigint") {
    n = Number(value);
  } else if (typeof value === "number") {
    n = value;
  } else {
    // TR metin: "1.250,50" → nokta binlik, virgül ondalık
    n = Number(String(value).trim().replace(/\./g, "").replace(/,/g, "."));
  }
  if (!Number.isFinite(n)) return "—";
  const digits = Math.max(0, Math.min(2, opts?.fractionDigits ?? 2));
  const rounded = digits === 0 ? Math.round(n) : Math.round(n * 100) / 100;
  return (
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(rounded) + " TL"
  );
}

/** İlan ücreti / fatura satırları: kuruşlu */
export function formatFeeTl(value: number | bigint | string | null | undefined) {
  return formatTl(value, { fractionDigits: 2 });
}

/** Ödeme durumu (PaymentStatus) Türkçe */
export function paymentStatusLabel(status?: string | null) {
  switch (String(status || "").toUpperCase()) {
    case "PENDING":
      return "Beklemede";
    case "PAID":
      return "Ödendi";
    case "SIMULATED":
      return "Simüle";
    case "FAILED":
      return "Başarısız";
    case "CANCELLED":
      return "İptal";
    default:
      return status || "—";
  }
}

/** Ödeme amacı Türkçe */
export function paymentPurposeLabel(purpose?: string | null) {
  const p = String(purpose || "").toLowerCase();
  if (p === "listing_fee") return "İlan ücreti";
  if (p === "token_package") return "Jeton paketi";
  if (p === "token_purchase") return "Jeton alımı";
  if (p === "shop_subscription") return "Kurumsal paket";
  if (p === "escrow_hold") return "Güvenli Öde (havuz)";
  if (p === "manual") return "Manuel";
  return purpose || "—";
}

export function formatNumberTr(value: number | bigint | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  let n: number;
  if (typeof value === "bigint") {
    n = Number(value);
  } else if (typeof value === "number") {
    n = value;
  } else {
    n = Number(String(value).trim().replace(/\./g, "").replace(/,/g, "."));
  }
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Kuruşlu TR para girişi: 1.458,99 */
export function formatMoneyTr(value: number | bigint | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  let n: number;
  if (typeof value === "bigint") {
    n = Number(value);
  } else if (typeof value === "number") {
    n = value;
  } else {
    n = parseMoneyTr(String(value));
  }
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function parseNumberTr(raw: string) {
  const cleaned = String(raw || "").replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  return Number(cleaned);
}

/**
 * TR para metni → sayı.
 * "1.458,99" | "1458,99" | "1458.99" | "1.458"
 */
export function parseMoneyTr(raw: string) {
  const s = String(raw || "").trim().replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  // yalnızca nokta: son kısım 1–2 hane ise ondalık, aksi binlik
  const parts = s.split(".");
  if (parts.length === 1) {
    const n = Number(parts[0]);
    return Number.isFinite(n) ? n : 0;
  }
  const last = parts[parts.length - 1] || "";
  if (parts.length === 2 && last.length <= 2) {
    const n = Number(`${parts[0]}.${last}`);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(parts.join(""));
  return Number.isFinite(n) ? n : 0;
}

export function hasPriceInKurus(attributes?: unknown): boolean {
  if (!attributes || typeof attributes !== "object") return false;
  const v = (attributes as Record<string, unknown>).priceInKurus;
  return v === 1 || v === true || v === "1";
}

/** DB askPrice → TL (priceInKurus ise /100) */
export function askPriceToTl(askPrice: number | bigint | string | null | undefined, attributes?: unknown) {
  const n = typeof askPrice === "bigint" ? Number(askPrice) : Number(askPrice);
  if (!Number.isFinite(n)) return 0;
  return hasPriceInKurus(attributes) ? Math.round(n) / 100 : n;
}

/** TL → DB BigInt (priceInKurus ise ×100) */
export function askPriceToStored(tl: number, priceInKurus: boolean): bigint {
  if (!Number.isFinite(tl) || tl < 0) return BigInt(0);
  return BigInt(priceInKurus ? Math.round(tl * 100) : Math.round(tl));
}

/** Sadece rakamlar (boşluk/tire temiz) */
export function phoneDigits(raw: string) {
  return String(raw || "").replace(/\D/g, "");
}

/**
 * Görünüm (0'sız): 532 111 22 33
 * Kullanıcı 0 ile başlarsa görünümden düşülür.
 */
export function formatPhoneTr(raw: string) {
  let d = phoneDigits(raw);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return "";
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.join(" ");
}

/** API/DB için: 05XXXXXXXXX (giriş 0'sız 10 hane → başına 0) */
export function normalizePhoneTr(raw: string) {
  let d = phoneDigits(raw);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 10) return `0${d}`;
  return d;
}

/** Giriş alanı: e-posta ise dokunma, telefon ise formatla */
export function formatLoginIdentifier(raw: string) {
  const s = String(raw || "");
  if (s.includes("@") || /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(s)) return s;
  return formatPhoneTr(s);
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("tr-TR").format(n);
}

export function maskName(name?: string | null) {
  if (!name) return "K***";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 1 ? p + "***" : p[0] + "***"))
    .join(" ");
}

export function remainingLabel(endsAt: Date | string | null | undefined) {
  if (!endsAt) return "—";
  const end = new Date(endsAt).getTime();
  const diff = end - Date.now();
  if (diff <= 0) return "Süre doldu";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days} Gün ${hours} Saat Kaldı`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours} Saat ${mins} Dk Kaldı`;
}

/** v2 kart rozeti: 3g 12sa 45dk */
export function remainingLabelCompact(endsAt: Date | string | null | undefined) {
  if (!endsAt) return "—";
  const end = new Date(endsAt).getTime();
  const diff = end - Date.now();
  if (diff <= 0) return "Süre doldu";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${days}g ${hours}sa ${mins}dk`;
}

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** v2 kart tarihi: 01 Ağustos 2026 */
export function formatListingDate(iso: Date | string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function serializeListing<T extends { askPrice: bigint | number; highestBid: bigint | number }>(listing: T) {
  return {
    ...listing,
    askPrice: Number(listing.askPrice),
    highestBid: Number(listing.highestBid),
  };
}
