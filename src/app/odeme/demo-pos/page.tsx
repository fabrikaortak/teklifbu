"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatFeeTl, formatTl } from "@/lib/format";
import { clearListingDraft, readListingDraft, writeListingDraft } from "@/lib/listingDraft";
import type { ListingFeeInvoice } from "@/lib/listingFeeInvoice";

const SUCCESS_HREF = "/hesabim?s=ilanlarim";
const ESCROW_SUCCESS_HREF = "/hesabim?s=guvenli-ode";

function DemoPosInner() {
  const params = useSearchParams();
  const intentId = params.get("intent") || "";
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState<{
    amountTl: number;
    title: string;
    status: string;
    demoPosEnabled: boolean;
    listingId?: string | null;
    purpose?: string;
    fee?: {
      baseFeeTl: number;
      premiumFeeTl: number;
      premiumBreakdown: Array<{ label: string; amountTl: number }>;
      totalFeeTl: number;
      invoice?: ListingFeeInvoice | null;
    };
  } | null>(null);
  const [done, setDone] = useState(false);
  const payLock = useRef(false);
  const autoTried = useRef(false);
  const redirected = useRef(false);
  const purposeRef = useRef<string | undefined>(undefined);
  const isEscrow = info?.purpose === "escrow_hold";
  const successHref = isEscrow ? ESCROW_SUCCESS_HREF : SUCCESS_HREF;

  function goSuccess() {
    if (redirected.current) return;
    redirected.current = true;
    clearListingDraft();
    setDone(true);
    setPaying(false);
    const href = purposeRef.current === "escrow_hold" ? ESCROW_SUCCESS_HREF : SUCCESS_HREF;
    window.setTimeout(() => {
      window.location.assign(href);
    }, 600);
  }

  async function completePay(silent = false) {
    if (!intentId || payLock.current) return false;
    payLock.current = true;
    if (!silent) {
      setError("");
      setPaying(true);
    }
    try {
      const res = await fetch("/api/payments/demo-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", intentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) setError((data as { error?: string }).error || "Ödeme başarısız");
        return false;
      }
      goSuccess();
      return true;
    } catch {
      if (!silent) setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      return false;
    } finally {
      payLock.current = false;
      setPaying(false);
    }
  }

  useEffect(() => {
    if (!intentId) {
      setError("Ödeme oturumu eksik.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/payments/demo-pos?intent=${encodeURIComponent(intentId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Oturum yüklenemedi");
          setLoading(false);
          return;
        }
        setInfo(data);
        purposeRef.current = data.purpose;

        if (data.status === "PAID" && data.listingId) {
          setLoading(false);
          goSuccess();
          return;
        }

        if (data.status === "PAID" && !data.listingId && !autoTried.current) {
          autoTried.current = true;
          setLoading(false);
          const ok = await completePay(true);
          if (!ok && !cancelled) {
            setError("Ödeme alınmış ancak ilan oluşturulamadı. «Öde (Demo)» ile tekrar deneyin.");
          }
          return;
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Oturum yüklenemedi");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentId]);

  if (loading) {
    return (
      <div className="page-shell" style={{ maxWidth: 440, marginTop: 48, marginBottom: 48 }}>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          Ödeme ekranı yükleniyor…
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page-shell" style={{ maxWidth: 440, marginTop: 48, marginBottom: 48 }}>
        <div className="card" style={{ padding: 28, display: "grid", gap: 12, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Ödeme alındı</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            {isEscrow
              ? "Ödemeniz TeklifBu Güvenli Öde havuzuna aktarıldı. Hesabım sayfasına yönlendiriliyorsunuz…"
              : "İlanınız onay kuyruğuna gönderildi. İlanlarım sayfasına yönlendiriliyorsunuz…"}
          </p>
          <button
            className="btn-orange"
            style={{ padding: 12 }}
            onClick={() => {
              redirected.current = true;
              window.location.assign(successHref);
            }}
          >
            {isEscrow ? "Güvenli Öde işlemlerime git" : "İlanlarıma git"}
          </button>
        </div>
      </div>
    );
  }

  const invoice = info?.fee?.invoice || null;
  const row = (label: string, value: string, opts?: { strong?: boolean; muted?: boolean; accent?: boolean }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
        fontSize: opts?.strong ? 14 : 13,
        fontWeight: opts?.strong ? 800 : 600,
        color: opts?.accent ? "#c2410c" : opts?.muted ? "#64748b" : "#0f172a",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );

  return (
    <div className="page-shell" style={{ maxWidth: 440, marginTop: 48, marginBottom: 48 }}>
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          boxShadow: "0 12px 40px rgba(11,31,58,0.08)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #0B1F3A 0%, #163a66 100%)",
            color: "#fff",
            padding: "22px 24px",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 0.6, textTransform: "uppercase" }}>
            TeklifBu · Demo Sanal POS
          </div>
          <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>Güvenli ödeme</h1>
        </div>

        <div style={{ padding: 24, display: "grid", gap: 16 }}>
          {!info?.demoPosEnabled && (
            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fdba74",
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: "#9a3412",
              }}
            >
              Demo POS şu an kapalı. Admin panelinden Ödemeler → POS ayarlarından açabilirsiniz.
            </div>
          )}

          <div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Açıklama</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{info?.title || "İlan ücreti"}</div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 14,
              display: "grid",
              gap: 8,
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.04em" }}>
              ÜCRET DÖKÜMÜ
            </div>

            {invoice ? (
              <>
                {invoice.lines.map((line) => (
                  <div key={line.key}>{row(line.label, formatFeeTl(line.amountTl))}</div>
                ))}
                <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />
                {invoice.vatPercent > 0 && invoice.pricesIncludeVat ? (
                  <>
                    {row("Ara toplam (KDV dahil)", formatFeeTl(invoice.subtotalTl), { strong: true })}
                    {row("KDV hariç tutar", formatFeeTl(invoice.subtotalExVatTl), { muted: true })}
                  </>
                ) : (
                  row(
                    invoice.vatPercent > 0 ? "Ara toplam (KDV hariç)" : "Ara toplam",
                    formatFeeTl(invoice.subtotalExVatTl ?? invoice.subtotalTl),
                    { strong: true }
                  )
                )}
                {invoice.corporateDiscountPercent > 0 ? (
                  <>
                    {row(
                      `Kurumsal indirim${invoice.packageName ? ` (${invoice.packageName})` : ""} %${invoice.corporateDiscountPercent}`,
                      `−${formatFeeTl(invoice.corporateDiscountTl)}`,
                      { accent: true }
                    )}
                    {row("İndirim sonrası (KDV hariç)", formatFeeTl(invoice.afterDiscountExVatTl))}
                  </>
                ) : null}
                {invoice.vatPercent > 0 ? (
                  <>
                    <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />
                    {row(`KDV (%${invoice.vatPercent})`, formatFeeTl(invoice.vatTl), { muted: true })}
                  </>
                ) : null}
                <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />
                {row("Gerçek ödenecek tutar", formatFeeTl(invoice.payableTl), { strong: true, accent: true })}
              </>
            ) : (
              <>
                {info?.fee && info.fee.baseFeeTl > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "var(--muted)" }}>
                      {isEscrow ? "Güvenli Öde tutarı" : "Temel ilan ücreti"}
                    </span>
                    <strong>{formatTl(info.fee.baseFeeTl)}</strong>
                  </div>
                )}
                {(info?.fee?.premiumBreakdown || []).map((rowItem) => (
                  <div key={rowItem.label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "var(--muted)" }}>{rowItem.label}</span>
                    <strong>{formatTl(rowItem.amountTl)}</strong>
                  </div>
                ))}
                <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />
                {row("Gerçek ödenecek tutar", formatTl(info?.amountTl || 0), { strong: true, accent: true })}
              </>
            )}
          </div>

          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            Bu ekran gerçek bir banka POS’u değildir. Altyapı hazır olunca iyzico / PayTR vb. buraya bağlanacak.
            Şimdilik <strong>Öde (Demo)</strong> ile ödemeyi simüle edersiniz.
          </div>

          {error && <div style={{ color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>{error}</div>}

          <button
            className="btn-orange"
            style={{ padding: 14, fontWeight: 800 }}
            disabled={!info?.demoPosEnabled || paying || !intentId}
            onClick={() => completePay(false)}
          >
            {paying ? "Ödeniyor…" : "Öde (Demo)"}
          </button>
          <button
            className="btn-outline"
            style={{ padding: 12 }}
            onClick={() => {
              if (isEscrow) {
                window.location.assign(
                  info?.listingId ? `/ilan/${info.listingId}` : "/hesabim?s=guvenli-ode"
                );
                return;
              }
              const draft = readListingDraft();
              if (draft) {
                writeListingDraft({
                  form: draft.form,
                  attrs: draft.attrs,
                  housingExtras: draft.housingExtras,
                  vehicleExtras: draft.vehicleExtras || [],
                  images: draft.images,
                  mapPoint: draft.mapPoint,
                  premium: draft.premium,
                  mode: "preview",
                });
              }
              window.location.assign("/ilan-ver?resume=1");
            }}
            disabled={paying}
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemoPosPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell" style={{ maxWidth: 440, marginTop: 48, marginBottom: 48 }}>
          <div className="card" style={{ padding: 28, textAlign: "center" }}>
            Yükleniyor…
          </div>
        </div>
      }
    >
      <DemoPosInner />
    </Suspense>
  );
}
