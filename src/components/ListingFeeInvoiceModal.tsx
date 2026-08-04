"use client";

import { AlertTriangle, X } from "lucide-react";
import { formatFeeTl } from "@/lib/format";
import type { ListingFeeInvoice } from "@/lib/listingFeeInvoice";

type Props = {
  open: boolean;
  intro: string;
  invoice: ListingFeeInvoice;
  busy?: boolean;
  /** Premium jeton ödemesi açıksa ve tutar > 0 */
  tokensOption?: { tokens: number; label?: string } | null;
  /** POS kapalı — yalnızca jeton */
  tokensOnly?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onPayWithTokens?: () => void;
};

export function ListingFeeInvoiceModal({
  open,
  intro,
  invoice,
  busy,
  tokensOption,
  tokensOnly,
  onCancel,
  onConfirm,
  onPayWithTokens,
}: Props) {
  if (!open) return null;

  const row = (label: string, value: string, opts?: { strong?: boolean; muted?: boolean; accent?: boolean }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "baseline",
        fontSize: opts?.strong ? 14 : 13.5,
        fontWeight: opts?.strong ? 800 : 600,
        color: opts?.accent ? "#c2410c" : opts?.muted ? "#64748b" : "#0f172a",
        lineHeight: 1.45,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );

  const showVat = invoice.vatPercent > 0;
  const listIsGross = showVat && invoice.pricesIncludeVat;

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(440px, 100%)", padding: 0, overflow: "hidden", textAlign: "left" }}
      >
        <div style={{ padding: "18px 20px 14px", position: "relative", borderBottom: "1px solid #eef2f7" }}>
          <button
            type="button"
            aria-label="Kapat"
            disabled={busy}
            onClick={onCancel}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              border: "none",
              background: "#f1f5f9",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#64748b",
            }}
          >
            <X size={16} />
          </button>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(145deg,#ffedd5,#fed7aa)",
              color: "#c2410c",
              display: "grid",
              placeItems: "center",
              marginBottom: 10,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>İlan ücreti</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#64748b", lineHeight: 1.5, paddingRight: 28 }}>
            {intro}
          </p>
        </div>

        <div style={{ padding: 18, display: "grid", gap: 10 }}>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.04em" }}>
              ÜCRET DÖKÜMÜ{listIsGross ? " (KDV DAHİL LİSTE)" : showVat ? " (KDV HARİÇ)" : ""}
            </div>
            {invoice.lines.map((line) => (
              <div key={line.key}>{row(line.label, formatFeeTl(line.amountTl))}</div>
            ))}

            <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />

            {listIsGross ? (
              <>
                {row("Ara toplam (KDV dahil)", formatFeeTl(invoice.subtotalTl), { strong: true })}
                {row("KDV hariç tutar", formatFeeTl(invoice.subtotalExVatTl), { muted: true })}
              </>
            ) : (
              row(
                showVat ? "Ara toplam (KDV hariç)" : "Ara toplam",
                formatFeeTl(invoice.subtotalExVatTl),
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

            {showVat ? (
              <>
                <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
                {row(`KDV (%${invoice.vatPercent})`, formatFeeTl(invoice.vatTl), { muted: true })}
              </>
            ) : null}

            <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
            {row("Gerçek ödenecek tutar", formatFeeTl(invoice.payableTl), { strong: true, accent: true })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-outline"
              style={{ flex: 1, minWidth: 100, padding: 12 }}
              disabled={busy}
              onClick={onCancel}
            >
              Vazgeç
            </button>
            {tokensOption && tokensOption.tokens > 0 && onPayWithTokens ? (
              <button
                type="button"
                className={tokensOnly ? "btn-orange" : "btn-outline"}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: 12,
                  fontWeight: 800,
                  ...(tokensOnly
                    ? {}
                    : { borderColor: "#fb923c", color: "#c2410c" }),
                }}
                disabled={busy}
                onClick={onPayWithTokens}
              >
                {busy ? "…" : tokensOption.label || `${tokensOption.tokens} jeton`}
              </button>
            ) : null}
            {!tokensOnly ? (
              <button
                type="button"
                className="btn-orange"
                style={{ flex: 1, minWidth: 100, padding: 12, fontWeight: 800 }}
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? "Hazırlanıyor…" : "TL ile öde"}
              </button>
            ) : null}
          </div>
          {tokensOnly ? (
            <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
              POS kapalı — ödeme yalnızca jeton ile yapılır.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
