"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatTl } from "@/lib/format";
import { escrowStatusLabelTr } from "@/lib/escrowTypes";
import {
  Check,
  ChevronDown,
  FileText,
  Minus,
  Package,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";

type Deal = {
  id: string;
  amountTl: number;
  commissionTl?: number;
  sellerPayoutTl?: number;
  status: string;
  createdAt: string;
  buyerId?: string;
  sellerId?: string;
  cargoTrackingNo?: string | null;
  cargoCarrier?: string | null;
  cargoReceiptUrl?: string | null;
  cargoNote?: string | null;
  shippedAt?: string | null;
  buyerConfirmedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  shipDays?: number;
  listing?: {
    id: string;
    title: string;
    coverImage?: string | null;
    listingNo?: string | null;
    askPrice?: number;
  } | null;
  buyer?: { id: string; name: string | null; phone: string | null } | null;
  seller?: { id: string; name: string | null; phone: string | null } | null;
};

type StatusFilter = "all" | "ongoing" | "cancelled" | "refunded" | "undelivered";
type ScopeFilter = "all" | "buyer" | "seller" | "30d" | "90d" | "180d" | "year";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "ongoing", label: "Devam edenler" },
  { key: "cancelled", label: "İptaller" },
  { key: "refunded", label: "İadeler" },
  { key: "undelivered", label: "Teslim edilemeyenler" },
];

const SCOPE_OPTIONS: { key: ScopeFilter; label: string }[] = [
  { key: "all", label: "Tüm siparişler" },
  { key: "buyer", label: "Aldıklarım" },
  { key: "seller", label: "Sattıklarım" },
  { key: "30d", label: "Son 30 gün" },
  { key: "90d", label: "Son 3 ay" },
  { key: "180d", label: "Son 6 ay" },
  { key: "year", label: "Bu yıl" },
];

const ONGOING = new Set([
  "AWAITING_PAYMENT",
  "FUNDED",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "BUYER_REVIEW",
  "DISPUTED",
  "PAID",
  "DELIVERED",
]);

function matchesStatus(status: string, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "ongoing") return ONGOING.has(status);
  if (filter === "cancelled") return status === "CANCELLED" || status === "EXPIRED";
  if (filter === "refunded") return status === "REFUNDED";
  if (filter === "undelivered") return status === "DISPUTED";
  return true;
}

function matchesScope(deal: Deal, scope: ScopeFilter, userId?: string) {
  const now = Date.now();
  const created = new Date(deal.createdAt).getTime();
  if (scope === "buyer") return Boolean(userId && deal.buyerId === userId);
  if (scope === "seller") return Boolean(userId && deal.sellerId === userId);
  if (scope === "30d") return now - created <= 30 * 86400000;
  if (scope === "90d") return now - created <= 90 * 86400000;
  if (scope === "180d") return now - created <= 180 * 86400000;
  if (scope === "year") return new Date(deal.createdAt).getFullYear() === new Date().getFullYear();
  return true;
}

function orderNo(deal: Deal) {
  const raw = deal.listing?.listingNo || deal.id.replace(/[^a-zA-Z0-9]/g, "").slice(-10);
  return String(raw).replace(/(.{3})/g, "$1 ").trim();
}

function formatDateLong(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string): "ok" | "bad" | "warn" | "info" {
  switch (status) {
    case "RELEASED":
    case "DELIVERED":
      return "ok";
    case "REFUNDED":
    case "CANCELLED":
    case "EXPIRED":
      return "bad";
    case "DISPUTED":
    case "AWAITING_PAYMENT":
      return "warn";
    default:
      return "info";
  }
}

function summaryStatus(status: string): { tone: "ok" | "bad" | "warn" | "info"; label: string } {
  const tone = statusTone(status);
  switch (status) {
    case "RELEASED":
    case "DELIVERED":
      return { tone, label: "Sipariş tamamlandı" };
    case "REFUNDED":
      return { tone, label: "Sipariş iade edildi" };
    case "CANCELLED":
    case "EXPIRED":
      return { tone, label: "Sipariş iptal edildi" };
    case "DISPUTED":
      return { tone, label: "Anlaşmazlık sürecinde" };
    case "SHIPPED":
      return { tone, label: "Kargoda" };
    case "BUYER_REVIEW":
      return { tone, label: "Teslim onayı bekleniyor" };
    case "AWAITING_SHIPMENT":
    case "FUNDED":
    case "PAID":
      return { tone, label: "Kargo bekleniyor" };
    case "AWAITING_PAYMENT":
      return { tone, label: "Ödeme bekleniyor" };
    default:
      return { tone, label: escrowStatusLabelTr(status) };
  }
}

function detailStatus(status: string): { tone: "ok" | "bad" | "warn" | "info"; label: string } {
  const tone = statusTone(status);
  switch (status) {
    case "RELEASED":
    case "DELIVERED":
      return { tone, label: "Teslim edildi" };
    case "REFUNDED":
      return { tone, label: "İade edildi" };
    case "CANCELLED":
    case "EXPIRED":
      return { tone, label: "İptal edildi" };
    case "DISPUTED":
      return { tone, label: "Anlaşmazlık" };
    case "SHIPPED":
      return { tone, label: "Kargoda" };
    case "BUYER_REVIEW":
      return { tone, label: "Teslim onayı bekleniyor" };
    case "AWAITING_SHIPMENT":
    case "FUNDED":
    case "PAID":
      return { tone, label: "Kargo bekleniyor" };
    case "AWAITING_PAYMENT":
      return { tone, label: "Ödeme bekleniyor" };
    default:
      return { tone, label: escrowStatusLabelTr(status) };
  }
}

function maskPhone(phone?: string | null) {
  const p = String(phone || "").replace(/\D/g, "");
  if (p.length < 7) return phone || "—";
  return `${p.slice(0, 3)} *** ** ${p.slice(-2)}`;
}

export function AccountShoppingPanel({ userId }: { userId?: string }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/escrow")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = Array.isArray(d?.deals) ? d.deals : Array.isArray(d) ? d : [];
        setDeals(rows);
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    return deals.filter((d) => {
      if (!matchesStatus(d.status, statusFilter)) return false;
      if (!matchesScope(d, scope, userId)) return false;
      if (!needle) return true;
      const title = String(d.listing?.title || "").toLocaleLowerCase("tr-TR");
      const id = String(d.id || "").toLocaleLowerCase("tr-TR");
      const no = String(d.listing?.listingNo || "").toLocaleLowerCase("tr-TR");
      return title.includes(needle) || id.includes(needle) || no.includes(needle);
    });
  }, [deals, q, statusFilter, scope, userId]);

  const scopeLabel = SCOPE_OPTIONS.find((o) => o.key === scope)?.label || "Tüm siparişler";

  if (loading) {
    return <div className="card" style={{ padding: 18 }}>Yükleniyor…</div>;
  }

  return (
    <div className="acc-shop">
      <div className="acc-shop__head">
        <div>
          <h1>
            <ShoppingBag size={20} /> Alışverişlerim
          </h1>
          <p>Siparişlerinizi, teklifli ödemelerinizi ve kargo sürecini buradan takip edin.</p>
        </div>
        <div className="acc-shop__actions">
          <Link href="/hesabim?s=guvenli-ode" className="acc-shop__link">
            Güvenli Öde işlemleri
          </Link>
          <Link href="/alisveris" className="btn-orange" style={{ padding: "10px 14px", textDecoration: "none" }}>
            Alışverişe Git
          </Link>
        </div>
      </div>

      <div className="acc-shop-toolbar">
        <label className="acc-shop-search">
          <Search size={16} strokeWidth={2} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Siparişlerimde ara"
            aria-label="Siparişlerimde ara"
          />
        </label>

        <div className="acc-shop-filters" role="tablist" aria-label="Sipariş durumu">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={statusFilter === f.key}
              className={`acc-shop-chip${statusFilter === f.key ? " is-active" : ""}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="acc-shop-scope">
          <select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} aria-label="Sipariş kapsamı">
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="acc-shop-scope__face" aria-hidden>
            <span>{scopeLabel}</span>
            <ChevronDown size={15} />
          </span>
        </label>
      </div>

      {!deals.length ? (
        <div className="card acc-shop__empty">
          <Package size={28} />
          <strong>Henüz alışveriş kaydı yok</strong>
          <p>Hemen Al veya teklif sonrası Güvenli Öde ile aldığınız ürünler burada listelenir.</p>
          <Link href="/alisveris">Alışveriş kategorisine git →</Link>
        </div>
      ) : !filtered.length ? (
        <div className="card acc-shop__empty">
          <Package size={28} />
          <strong>Sonuç bulunamadı</strong>
          <p>Arama veya filtreye uyan sipariş yok.</p>
          <button
            type="button"
            className="acc-shop-chip is-active"
            onClick={() => {
              setQ("");
              setStatusFilter("all");
              setScope("all");
            }}
          >
            Filtreleri sıfırla
          </button>
        </div>
      ) : (
        <div className="acc-order-list">
          {filtered.map((d) => {
            const open = openId === d.id;
            const sum = summaryStatus(d.status);
            const det = detailStatus(d.status);
            const isBuyer = Boolean(userId && d.buyerId === userId);
            const sellerName = d.seller?.name || "Satıcı";
            const buyerName = d.buyer?.name || "Alıcı";
            const cover = d.listing?.coverImage || null;
            const title = d.listing?.title || "Ürün";
            const deliveredAt = d.buyerConfirmedAt || d.releasedAt || d.shippedAt;

            return (
              <article key={d.id} className={`acc-order${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="acc-order__summary"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : d.id)}
                >
                  <span className="acc-order__thumbs">
                    <span className="acc-order__thumb">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" />
                      ) : (
                        <span className="acc-order__thumb-ph" />
                      )}
                      <span className="acc-order__qty">x1</span>
                    </span>
                  </span>

                  <span className="acc-order__no">
                    Sipariş no: <strong>{orderNo(d)}</strong>
                  </span>

                  <span className={`acc-order__state acc-order__state--${sum.tone}`}>
                    <span className="acc-order__state-ico" aria-hidden>
                      {sum.tone === "ok" ? <Check size={12} strokeWidth={3} /> : null}
                      {sum.tone === "bad" ? <Minus size={12} strokeWidth={3} /> : null}
                      {sum.tone === "warn" || sum.tone === "info" ? <Package size={11} strokeWidth={2.5} /> : null}
                    </span>
                    <span>{sum.label}</span>
                  </span>

                  <span className="acc-order__right">
                    <span className="acc-order__date">{formatDateLong(d.createdAt)}</span>
                    <span className="acc-order__price">{formatTl(d.amountTl)}</span>
                  </span>

                  <ChevronDown size={18} className="acc-order__chevron" />
                </button>

                {open ? (
                  <div className="acc-order__detail">
                    <div className="acc-order__notice">
                      Ödemelerinizi yalnızca TeklifBu / Güvenli Öde üzerinden yapın. Satıcıyla platform dışı ödeme
                      anlaşması yapmayın.
                    </div>

                    <div className="acc-order__main">
                      <div className="acc-order__seller-row">
                        <div>
                          Satıcı: <strong>{sellerName}</strong>
                        </div>
                        {d.listing?.id ? (
                          <Link href={`/ilan/${d.listing.id}`} className="acc-order__ask">
                            Satıcıya sor
                          </Link>
                        ) : null}
                      </div>

                      <div className="acc-order__product-row">
                        <div className="acc-order__product">
                          <span className="acc-order__product-img">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt="" />
                            ) : (
                              <span className="acc-order__thumb-ph" />
                            )}
                          </span>
                          <div>
                            {d.listing?.id ? (
                              <Link href={`/ilan/${d.listing.id}`} className="acc-order__product-title">
                                {title}
                              </Link>
                            ) : (
                              <div className="acc-order__product-title">{title}</div>
                            )}
                            <div className="acc-order__product-price">{formatTl(d.amountTl)}</div>
                            <div className="acc-order__product-actions">
                              {d.listing?.id ? (
                                <Link href={`/ilan/${d.listing.id}`} className="acc-order__mini-btn">
                                  Tekrar al
                                </Link>
                              ) : null}
                              <Link href="/hesabim?s=guvenli-ode" className="acc-order__mini-btn">
                                İşlemi yönet
                              </Link>
                            </div>
                          </div>
                        </div>

                        <div className="acc-order__delivery">
                          <div className={`acc-order__state acc-order__state--${det.tone}`}>
                            <span className="acc-order__state-ico" aria-hidden>
                              {det.tone === "ok" ? <Check size={12} strokeWidth={3} /> : <Package size={11} />}
                            </span>
                            <strong>{det.label}</strong>
                          </div>
                          <div className="acc-order__delivery-meta">
                            {deliveredAt ? formatDateTime(deliveredAt) : formatDateLong(d.createdAt)}
                            <br />
                            {isBuyer
                              ? `Teslim alan: ${buyerName}`
                              : `Alıcı: ${buyerName}`}
                          </div>
                          <div className="acc-order__delivery-links">
                            <span className="acc-order__dlink">
                              <Truck size={14} /> Kargo takibi
                              {d.cargoTrackingNo ? `: ${d.cargoTrackingNo}` : ""}
                            </span>
                            <span className="acc-order__dlink">
                              <FileText size={14} /> Fatura bilgisi
                            </span>
                            <Link href="/hesabim?s=guvenli-ode" className="acc-order__dlink">
                              <RotateCcw size={14} /> İade ve diğer talepler
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="acc-order__cols">
                      <div className="acc-order__col">
                        <h3>Adres Bilgileri</h3>
                        <div className="acc-order__box">
                          <div className="acc-order__box-label">Teslimat / Alıcı</div>
                          <strong>{buyerName}</strong>
                          <p>{maskPhone(d.buyer?.phone)}</p>
                          <p className="acc-order__muted">
                            Adres bilgisi sipariş sırasında paylaşılmadıysa satıcı ile mesajlaşarak netleştirin.
                          </p>
                        </div>
                        <div className="acc-order__box acc-order__box--soft">
                          <div className="acc-order__box-label">Fatura / Satıcı</div>
                          <strong>{sellerName}</strong>
                          <p>{maskPhone(d.seller?.phone)}</p>
                        </div>
                      </div>

                      <div className="acc-order__col">
                        <h3>Ödeme Bilgileri</h3>
                        <div className="acc-order__box">
                          <div className="acc-order__pay-row">
                            <span>Güvenli Öde</span>
                            <strong>{formatTl(d.amountTl)}</strong>
                          </div>
                          <div className="acc-order__muted">Platform üzerinden güvence altında ödeme</div>
                        </div>
                        <div className="acc-order__costs">
                          <div>
                            <span>Kargo</span>
                            <strong>Bedava</strong>
                          </div>
                          <div>
                            <span>Ürün</span>
                            <strong>{formatTl(d.amountTl)}</strong>
                          </div>
                          {Number(d.commissionTl) > 0 ? (
                            <div>
                              <span>Komisyon</span>
                              <strong>{formatTl(d.commissionTl || 0)}</strong>
                            </div>
                          ) : null}
                          <div className="acc-order__total">
                            <span>Genel toplam</span>
                            <strong>{formatTl(d.amountTl)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="acc-order__other">
                      <h3>Diğer</h3>
                      <div className="acc-order__other-links">
                        <Link href="/yardim">Satış Sözleşmesi</Link>
                        <Link href="/yardim">İade Koşulları</Link>
                        {d.cargoCarrier ? <span>Kargo: {d.cargoCarrier}</span> : null}
                        {d.shipDays ? <span>Kargo süresi: {d.shipDays} gün</span> : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
