"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, XCircle, MapPin, Clock3, UserRound } from "lucide-react";
import { formatTl } from "@/lib/format";
import { dealTypeLabel } from "@/lib/dealType";
import { accountTypeLabelTr, formatListingAttributeRows } from "@/lib/listingEditFields";
import { isCorporateAccount } from "@/lib/accountTypes";
import { groupHousingExtras, parseHousingExtras } from "@/data/housingExtras";
import { groupVehicleExtras, parseVehicleExtras } from "@/data/vehicleExtras";
import {
  expertiseReportHasDamage,
  parseExpertiseReport,
  supportsVehicleExpertiseReport,
} from "@/data/vehicleExpertiseReport";
import { VehicleExpertiseReportPanel } from "@/components/VehicleExpertiseReport";
import { formatPremiumTitle } from "@/lib/listingPremiumDisplay";
import { paymentMetaDetails } from "@/lib/paymentDetails";
import { useDialog } from "@/components/ui/ConfirmDialog";
import type { AdminVertical } from "@/lib/adminVertical";

type PendingListing = {
  id: string;
  title: string;
  description: string;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  dealType: string;
  askPrice: number;
  durationDays?: number;
  coverImage?: string | null;
  images?: string[];
  attributes?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  eidsVerified?: boolean;
  sellerListingIndex?: number;
  feePaidTl?: number;
  feePaymentId?: string | null;
  feePayment?: {
    id: string;
    amountTl: number;
    status: string;
    purpose: string;
    createdAt: string;
    meta?: unknown;
    userId?: string;
  } | null;
  titleBold?: boolean;
  titleLarge?: boolean;
  isColored?: boolean;
  isFeatured?: boolean;
  featuredDays?: number;
  republishReasonCode?: string | null;
  republishReasonNote?: string | null;
  republishReasonLabel?: string | null;
  republishRequestedAt?: string | null;
  republishWinnerUserId?: string | null;
  republishWinnerBidAmount?: number | null;
  republishWinnerResponse?: string | null;
  republishWinnerNote?: string | null;
  republishWinnerRespondedAt?: string | null;
  republishWinner?: { id: string; name?: string | null; phone?: string | null } | null;
  category?: { name: string; slug: string };
  seller?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    accountType?: string;
    memberSince?: string;
  };
};

function formatShortDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const premiumChipStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#065f46",
  borderRadius: 99,
  padding: "3px 9px",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
  letterSpacing: "-0.01em",
};

type DetailTab = "ozet" | "ozellikler" | "donanim" | "ekspertiz";

function ApprovalDetailModal({
  listing,
  busy,
  msg,
  reason,
  onReasonChange,
  onClose,
  onApprove,
  onReject,
}: {
  listing: PendingListing;
  busy: boolean;
  msg: string;
  reason: string;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [tab, setTab] = useState<DetailTab>("ozet");
  const [feeOpen, setFeeOpen] = useState(false);

  useEffect(() => {
    setPhotoIdx(0);
    setTab("ozet");
    setFeeOpen(false);
  }, [listing.id]);

  const photos = listing.images?.length
    ? listing.images
    : listing.coverImage
      ? [listing.coverImage]
      : [];

  const attrRows = formatListingAttributeRows(listing.attributes, listing.category?.slug, {
    showEmptyAsBelirtilmedi: true,
  });
  const extrasGrouped =
    listing.category?.slug === "arac"
      ? groupVehicleExtras(parseVehicleExtras((listing.attributes as any)?.extras))
      : groupHousingExtras(parseHousingExtras((listing.attributes as any)?.extras));
  const extrasCount = extrasGrouped.reduce((n, g) => n + g.items.length, 0);
  const expertiseReport = useMemo(() => {
    if (listing.category?.slug !== "arac") return null;
    const attrs = listing.attributes as Record<string, unknown> | null | undefined;
    if (!supportsVehicleExpertiseReport(String(attrs?.subtype || ""))) return null;
    return parseExpertiseReport(attrs?.expertiseReport);
  }, [listing]);
  const showExpertise =
    Boolean(expertiseReport) &&
    (expertiseReportHasDamage(expertiseReport) ||
      Boolean(expertiseReport?.obtainedAt) ||
      Boolean(expertiseReport?.firm));

  const feePaid = Number(listing.feePaidTl || 0) > 0;
  const feePayment = listing.feePayment || null;
  const feeRows = feePayment
    ? paymentMetaDetails({
        id: feePayment.id,
        purpose: feePayment.purpose,
        amountTl: feePayment.amountTl,
        status: feePayment.status,
        createdAt: feePayment.createdAt,
        user: listing.seller,
        meta: feePayment.meta,
      })
    : [];

  const tabs: Array<{ key: DetailTab; label: string; count?: number; hide?: boolean }> = [
    { key: "ozet", label: "Özet" },
    { key: "ozellikler", label: "Özellikler", count: attrRows.length, hide: attrRows.length === 0 },
    { key: "donanim", label: "Ek donanım", count: extrasCount, hide: extrasCount === 0 },
    { key: "ekspertiz", label: "Ekspertiz", hide: !showExpertise },
  ];

  return (
    <div className="tb-dialog-backdrop" onClick={onClose}>
      <div
        className="tb-dialog"
        style={{
          textAlign: "left",
          width: "min(880px, 100%)",
          maxHeight: "92vh",
          overflow: "hidden",
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="Kapat">
          ×
        </button>

        {/* Üst: medya + kimlik */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 300px) minmax(0, 1fr)",
            gap: 0,
            borderBottom: "1px solid #eef2f7",
            flexShrink: 0,
          }}
        >
          <div style={{ background: "#0f172a", padding: 14 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "4 / 3",
                borderRadius: 12,
                overflow: "hidden",
                background: "#1e293b",
              }}
            >
              {photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photos[photoIdx]}
                  alt={listing.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  Fotoğraf yok
                </div>
              )}
              {photos.length > 1 && (
                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    bottom: 8,
                    background: "rgba(15,23,42,0.75)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 99,
                  }}
                >
                  {photoIdx + 1}/{photos.length}
                </div>
              )}
            </div>
            {photos.length > 1 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
                {photos.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    style={{
                      border: i === photoIdx ? "2px solid #fb923c" : "2px solid transparent",
                      borderRadius: 8,
                      padding: 0,
                      overflow: "hidden",
                      background: "#1e293b",
                      cursor: "pointer",
                      flexShrink: 0,
                      width: 52,
                      height: 40,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: "18px 44px 18px 20px", display: "grid", gap: 12, alignContent: "start" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>
                {listing.category?.name} · {dealTypeLabel(listing.dealType)}
                {listing.eidsVerified ? (
                  <span style={{ marginLeft: 8, color: "#059669", fontWeight: 800 }}>EİDS ✓</span>
                ) : null}
              </div>
              <h2
                style={{
                  margin: "6px 0 0",
                  fontSize: listing.titleLarge ? 20 : 18,
                  fontWeight: listing.titleBold ? 900 : 800,
                  lineHeight: 1.3,
                  color: listing.isColored ? "#c2410c" : "#0f172a",
                }}
              >
                {formatPremiumTitle(listing.title, listing)}
              </h2>
              <div
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                <MapPin size={14} />
                {[listing.neighborhood, listing.district, listing.city].filter(Boolean).join(", ") || "—"}
              </div>
              {(listing.titleBold ||
                listing.titleLarge ||
                listing.isColored ||
                (listing.featuredDays || 0) > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {listing.titleBold ? <span style={premiumChipStyle}>Kalın başlık</span> : null}
                  {listing.titleLarge ? <span style={premiumChipStyle}>Büyük harf</span> : null}
                  {listing.isColored ? <span style={premiumChipStyle}>Renkli ilan</span> : null}
                  {(listing.featuredDays || 0) > 0 ? (
                    <span style={premiumChipStyle}>{listing.featuredDays} gün ana sayfa</span>
                  ) : null}
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 11, color: "#9a3412", fontWeight: 700 }}>Talep fiyatı</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ea580c", marginTop: 2 }}>
                  {formatTl(listing.askPrice)}
                </div>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Süre</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    marginTop: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Clock3 size={14} /> {listing.durationDays || 7} gün
                </div>
              </div>
              <button
                type="button"
                disabled={!feePaid || !feePayment}
                title={feePaid && feePayment ? (feeOpen ? "Ücret detayını gizle" : "Ücret detayını göster") : undefined}
                onClick={() => feePaid && feePayment && setFeeOpen((v) => !v)}
                style={{
                  background: feeOpen ? "#ecfdf5" : "#f8fafc",
                  border: feeOpen ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 12px",
                  textAlign: "left",
                  cursor: feePaid && feePayment ? "pointer" : "default",
                  opacity: feePaid && !feePayment ? 0.85 : 1,
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  İlan ücreti
                  {feePaid && feePayment ? (
                    <span style={{ color: "#059669", marginLeft: 4 }}>
                      {feeOpen ? "· gizle" : "· detay"}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    marginTop: 2,
                    color: feePaid ? "#059669" : "#94a3b8",
                  }}
                >
                  {feePaid ? formatTl(listing.feePaidTl) : "Ücretsiz"}
                </div>
              </button>
            </div>

            {feeOpen && feePayment && (
              <div
                style={{
                  border: "1px solid #a7f3d0",
                  background: "#f0fdf4",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "#065f46",
                    marginBottom: 8,
                  }}
                >
                  Ücret nereden geliyor?
                </div>
                {feeRows.map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px 1fr",
                      gap: 10,
                      padding: "7px 0",
                      borderTop: "1px solid #d1fae5",
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: "#64748b", fontWeight: 650 }}>{row.label}</span>
                    {row.href ? (
                      <Link href={row.href} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                        {row.value}
                      </Link>
                    ) : (
                      <strong style={{ color: "#0f172a", fontWeight: 750 }}>{row.value}</strong>
                    )}
                  </div>
                ))}
                {feeRows.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>Kırılım kaydı bulunamadı.</div>
                ) : null}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 99,
                    background: "#e2e8f0",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <UserRound size={16} color="#475569" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5 }}>{listing.seller?.name || "—"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {listing.seller?.phone || "—"} · {accountTypeLabelTr(listing.seller?.accountType)}
                    {listing.sellerListingIndex
                      ? ` · ${listing.sellerListingIndex}. ilan`
                      : ""}
                  </div>
                </div>
              </div>
              <Link
                href={`/ilan/${listing.id}`}
                target="_blank"
                style={{ fontSize: 12.5, fontWeight: 750, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                İlanı aç ↗
              </Link>
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "10px 16px 0",
            borderBottom: "1px solid #eef2f7",
            flexShrink: 0,
          }}
        >
          {tabs
            .filter((t) => !t.hide)
            .map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 750,
                    color: active ? "#ea580c" : "#64748b",
                    borderBottom: active ? "2px solid #ea580c" : "2px solid transparent",
                    cursor: "pointer",
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                  {t.count != null ? (
                    <span style={{ marginLeft: 6, opacity: 0.75, fontWeight: 700 }}>{t.count}</span>
                  ) : null}
                </button>
              );
            })}
        </div>

        {/* İçerik */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 18px", minHeight: 160 }}>
          {tab === "ozet" && (
            <div style={{ display: "grid", gap: 10 }}>
              <h3 style={sectionTitleStyle}>Açıklama</h3>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "14px 16px",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.55,
                  color: "#334155",
                  fontSize: 13.5,
                  maxHeight: 280,
                  overflow: "auto",
                }}
              >
                {listing.description || "—"}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Başvuru: {formatShortDate(listing.createdAt)}
              </div>
            </div>
          )}

          {tab === "ozellikler" && (
            <div style={{ display: "grid", gap: 8 }}>
              <h3 style={sectionTitleStyle}>Özellikler</h3>
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {attrRows.map((row, i) => (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr",
                      gap: 12,
                      padding: "10px 14px",
                      borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                      background: i % 2 === 0 ? "#fff" : "#fafbfc",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ color: "#64748b", fontWeight: 650 }}>{row.label}</div>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "donanim" && (
            <div style={{ display: "grid", gap: 16 }}>
              {extrasGrouped.map((g) => (
                <div key={g.id}>
                  <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>{g.label}</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.items.map((i) => (
                      <span
                        key={i.id}
                        style={{
                          fontSize: 12,
                          fontWeight: 650,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          color: "#9a3412",
                          borderRadius: 8,
                          padding: "5px 10px",
                        }}
                      >
                        {i.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "ekspertiz" && showExpertise && (
            <div style={{ display: "grid", gap: 10 }}>
              <h3 style={sectionTitleStyle}>Boyalı / değişen parça ekspertiz</h3>
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <VehicleExpertiseReportPanel value={expertiseReport} editable={false} />
              </div>
            </div>
          )}
        </div>

        {/* Alt aksiyon */}
        <div
          style={{
            borderTop: "1px solid #eef2f7",
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 12,
            alignItems: "end",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
            Red sebebi
            <textarea
              className="input"
              style={{ minHeight: 44, fontWeight: 500, fontSize: 13, padding: "8px 10px", resize: "vertical" }}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Reddetmek için sebep yazın…"
            />
            {msg ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: msg.includes("başarısız") || msg.includes("yazın") ? "#b91c1c" : "#059669",
                }}
              >
                {msg}
              </span>
            ) : null}
          </label>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={onClose}
              style={{ padding: "10px 14px", fontSize: 13 }}
            >
              Kapat
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={onReject}
              style={{
                padding: "10px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#b91c1c",
                borderColor: "#fecaca",
                fontSize: 13,
              }}
            >
              <XCircle size={15} /> Reddet
            </button>
            <button
              type="button"
              className="btn-orange"
              disabled={busy}
              onClick={onApprove}
              style={{
                padding: "10px 18px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              <CheckCircle2 size={15} /> Onayla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminListingApprovalPanel({
  vertical,
  republishOnly = false,
}: {
  vertical?: AdminVertical;
  /** Yalnızca sonuçlanıp yeniden yayınlanmak istenenler */
  republishOnly?: boolean;
} = {}) {
  const { confirm, alert } = useDialog();
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [toggleBusy, setToggleBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ view: "pending-listings" });
    if (vertical) qs.set("vertical", vertical);
    if (republishOnly) qs.set("republish", "1");
    const res = await fetch(`/api/admin?${qs}`);
    if (res.ok) {
      const d = await res.json();
      const items: PendingListing[] = d.listings || [];
      setListings(items);
      setAutoApprove(d.autoApprove === true);
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (items.some((x) => x.id === id)) next.add(id);
        }
        return next;
      });
      setSelectedId((prev) => {
        if (prev && items.some((x) => x.id === prev)) return prev;
        return null;
      });
    }
    setLoading(false);
  }, [vertical, republishOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setReason("");
    setMsg("");
  }, [selectedId]);

  const selected = useMemo(
    () => listings.find((l) => l.id === selectedId) || null,
    [listings, selectedId]
  );

  const allSelected = listings.length > 0 && selectedIds.size === listings.length;
  const someSelected = selectedIds.size > 0;

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelectedIds(new Set(listings.map((l) => l.id)));
    else setSelectedIds(new Set());
  }

  async function setAutoApproveSetting(next: boolean) {
    setToggleBusy(true);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-settings",
        settings: { listing_auto_approve: next },
      }),
    });
    setToggleBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      await alert({
        title: "Ayar kaydedilemedi",
        message: d.error || "Otomatik onay ayarı güncellenemedi.",
        tone: "danger",
      });
      return;
    }
    setAutoApprove(next);
  }

  async function approveOne(listingId: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve-listing", listingId }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || "Onay başarısız");
      return false;
    }
    setSelectedId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
    await load();
    return true;
  }

  async function rejectSelected() {
    if (!selected) return;
    if (!reason.trim()) {
      setMsg("Red sebebi yazın.");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject-listing",
        listingId: selected.id,
        reason: reason.trim(),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || "Red başarısız");
      return;
    }
    setReason("");
    setSelectedId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(selected.id);
      return next;
    });
    await load();
  }

  async function bulkApprove() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const ok = await confirm({
      title: "Toplu onay",
      message: `${ids.length} ilanı onayla?`,
      confirmLabel: "Onayla",
      tone: "warning",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk-approve-listings", listingIds: ids }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await alert({
        title: "Toplu onay başarısız",
        message: d.error || "İşlem tamamlanamadı.",
        tone: "danger",
      });
      return;
    }
    const failed = Array.isArray(d.failed) ? d.failed : [];
    if (failed.length > 0) {
      await alert({
        title: "Kısmi onay",
        message: `${d.approved || 0} ilan onaylandı, ${failed.length} başarısız.`,
        tone: "warning",
      });
    }
    setSelectedId(null);
    setSelectedIds(new Set());
    await load();
  }

  if (loading) return <div className="adm-card">Onay kuyruğu yükleniyor...</div>;

  return (
    <div className="adm-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: toggleBusy ? "wait" : "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={autoApprove}
            disabled={toggleBusy || busy}
            onChange={(e) => setAutoApproveSetting(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Otomatik onay
        </label>

        <button
          type="button"
          className="btn-orange"
          disabled={busy || !someSelected}
          onClick={bulkApprove}
          style={{ padding: "6px 12px", fontSize: 13, fontWeight: 800 }}
        >
          Seçilenleri onayla{someSelected ? ` (${selectedIds.size})` : ""}
        </button>

        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 800,
            background: listings.length ? "#fff7ed" : "#f1f5f9",
            color: listings.length ? "#c2410c" : "#64748b",
            borderRadius: 99,
            padding: "3px 10px",
          }}
        >
          Onay bekleyen: {listings.length}
          {republishOnly ? " · yeniden yayın" : ""}
        </span>
      </div>

      {autoApprove && (
        <div
          style={{
            padding: "8px 12px",
            fontSize: 12,
            color: "#065f46",
            background: "#ecfdf5",
            borderBottom: "1px solid #a7f3d0",
          }}
        >
          Otomatik onay açık — yeni ilanlar kuyruğa düşmeden yayına alınır.
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="adm-table adm-table--compact adm-listings-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={!listings.length || busy}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Tümünü seç"
                />
              </th>
              <th style={{ width: 52 }}>Kapak</th>
              <th>Başlık</th>
              <th>Kategori</th>
              <th>Satıcı</th>
              <th>Üye tipi</th>
              <th>Fiyat</th>
              <th>Ücret</th>
              <th>Tarih</th>
              <th style={{ width: 88 }}></th>
            </tr>
          </thead>
          <tbody>
            {!listings.length && (
              <tr>
                <td colSpan={10} style={{ color: "var(--adm-muted)", padding: 18 }}>
                  Onay bekleyen ilan yok
                  {republishOnly ? " (yeniden yayın talebi)." : "."}
                </td>
              </tr>
            )}
            {listings.map((l) => {
              const checked = selectedIds.has(l.id);
              return (
                <tr
                  key={l.id}
                  className="adm-listings-row"
                  onClick={() => setSelectedId(l.id)}
                  title="Detay için tıklayın"
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={(e) => toggleOne(l.id, e.target.checked)}
                      aria-label={`${l.title} seç`}
                    />
                  </td>
                  <td>
                    <div className="adm-listing-thumb">
                      {l.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.coverImage} alt="" />
                      ) : (
                        <span />
                      )}
                    </div>
                  </td>
                  <td className="adm-listing-title-cell">
                    <span className="adm-listing-title">{l.title}</span>
                    {l.republishReasonLabel || l.republishReasonCode ? (
                      <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700, marginTop: 4 }}>
                        Yeniden yayın: {l.republishReasonLabel || l.republishReasonCode}
                        {l.republishReasonNote ? ` — ${l.republishReasonNote}` : ""}
                      </div>
                    ) : null}
                    {l.republishWinnerUserId || l.republishWinnerResponse ? (
                      <div
                        style={{
                          fontSize: 11,
                          marginTop: 6,
                          padding: "6px 8px",
                          borderRadius: 8,
                          background:
                            l.republishWinnerResponse === "DISPUTED"
                              ? "#fef2f2"
                              : l.republishWinnerResponse === "CONFIRMED"
                                ? "#ecfdf5"
                                : "#f8fafc",
                          border: "1px solid #e2e8f0",
                          color: "#334155",
                          lineHeight: 1.4,
                        }}
                      >
                        <strong>Kazanan teklif sahibi cevabı:</strong>{" "}
                        {l.republishWinnerResponse === "CONFIRMED"
                          ? "Onaylıyorum"
                          : l.republishWinnerResponse === "DISPUTED"
                            ? "Onaylamıyorum"
                            : "Yanıt bekleniyor"}
                        {l.republishWinner?.name || l.republishWinner?.phone
                          ? ` · ${l.republishWinner?.name || l.republishWinner?.phone}`
                          : ""}
                        {l.republishWinnerBidAmount != null
                          ? ` · teklif ${formatTl(l.republishWinnerBidAmount)}`
                          : ""}
                        {l.republishWinnerResponse === "DISPUTED" && l.republishWinnerNote ? (
                          <div style={{ marginTop: 4, color: "#b91c1c" }}>
                            Sebep: {l.republishWinnerNote}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {l.category?.name || "—"}
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{dealTypeLabel(l.dealType)}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{l.seller?.name || l.seller?.phone || "—"}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontWeight: 750,
                        color: isCorporateAccount(l.seller?.accountType) ? "#1d4ed8" : "#475569",
                      }}
                    >
                      {isCorporateAccount(l.seller?.accountType) ? "Kurumsal" : "Bireysel"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap", fontWeight: 700 }}>
                    {formatTl(l.askPrice)}
                  </td>
                  <td
                    style={{
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      color: (l.feePaidTl || 0) > 0 ? "#059669" : "#94a3b8",
                    }}
                  >
                    {(l.feePaidTl || 0) > 0 ? formatTl(l.feePaidTl) : "Ücretsiz"}
                  </td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap", color: "#64748b" }}>
                    {formatShortDate(l.createdAt)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const res = await fetch("/api/admin", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "approve-listing", listingId: l.id }),
                        });
                        const d = await res.json().catch(() => ({}));
                        setBusy(false);
                        if (!res.ok) {
                          await alert({
                            title: "Onay başarısız",
                            message: d.error || "İlan onaylanamadı.",
                            tone: "danger",
                          });
                          return;
                        }
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          next.delete(l.id);
                          return next;
                        });
                        if (selectedId === l.id) setSelectedId(null);
                        await load();
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#059669",
                        borderColor: "#a7f3d0",
                      }}
                    >
                      Onayla
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <ApprovalDetailModal
          listing={selected}
          busy={busy}
          msg={msg}
          reason={reason}
          onReasonChange={setReason}
          onClose={() => {
            setSelectedId(null);
            setMsg("");
            setReason("");
          }}
          onApprove={async () => {
            const ok = await approveOne(selected.id);
            if (ok) setMsg("");
          }}
          onReject={rejectSelected}
        />
      )}
    </div>
  );
}
