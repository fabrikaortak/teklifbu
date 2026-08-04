"use client";

import { Phone, ShieldAlert, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  contactPhone?: string;
  contactLabel?: string;
};

export function AccountDisabledDialog({
  open,
  onClose,
  contactPhone = "0216 606 60 00",
  contactLabel = "Müşteri Hizmetleri",
}: Props) {
  if (!open) return null;

  const telHref = `tel:${String(contactPhone).replace(/\s/g, "")}`;

  return (
    <div className="tb-dialog-backdrop" style={{ zIndex: 320 }} onClick={onClose} role="presentation">
      <div
        className="tb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-disabled-title"
        style={{ width: "min(420px, 100%)", textAlign: "left", padding: "28px 24px 20px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="Kapat">
          <X size={16} />
        </button>

        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(145deg, #fee2e2, #fecaca)",
            color: "#b91c1c",
            display: "grid",
            placeItems: "center",
            marginBottom: 16,
          }}
        >
          <ShieldAlert size={28} />
        </div>

        <h2 id="account-disabled-title" style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 850, color: "#0f172a" }}>
          Hesabınız pasif
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#475569" }}>
          Hesabınız yönetici tarafından pasifleştirildiği için giriş yapamazsınız. Yardım için lütfen yönetici veya
          müşteri hizmetleri ile iletişime geçin.
        </p>

        <a
          href={telHref}
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #fed7aa",
            background: "linear-gradient(180deg, #fff7ed, #ffedd5)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#fff",
              color: "#ea580c",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Phone size={18} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9a3412" }}>
              {contactLabel}
            </span>
            <span style={{ display: "block", fontSize: 17, fontWeight: 850, color: "#0f172a", marginTop: 2 }}>
              {contactPhone}
            </span>
          </span>
        </a>

        <button
          type="button"
          className="btn-orange"
          style={{ width: "100%", padding: 12, marginTop: 16 }}
          onClick={onClose}
        >
          Anladım
        </button>
      </div>
    </div>
  );
}
