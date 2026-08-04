"use client";

import { CheckCircle2, MessageCircle, X } from "lucide-react";
import { formatTl } from "@/lib/format";

type Props = {
  open: boolean;
  amountTl?: number | null;
  onClose: () => void;
};

export function BidSentModal({ open, amountTl, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          padding: 0,
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            padding: "28px 24px 22px",
            background: "linear-gradient(165deg, #0b1f3a 0%, #163a66 55%, #1e4976 100%)",
            color: "#fff",
          }}
        >
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              border: "none",
              background: "rgba(255,255,255,0.12)",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#fff",
            }}
          >
            <X size={16} />
          </button>

          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              margin: "0 auto 16px",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(145deg, #fb923c, #ea580c)",
              boxShadow: "0 12px 28px rgba(234, 88, 12, 0.45)",
            }}
          >
            <CheckCircle2 size={32} strokeWidth={2.2} />
          </div>

          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
            Teklifin iletildi
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14.5,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.88)",
              maxWidth: 320,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Muhteşem teklifini ilettik
            {amountTl != null && Number.isFinite(amountTl) && amountTl > 0
              ? ` (${formatTl(amountTl)})`
              : ""}
            .
          </p>
        </div>

        <div style={{ padding: "20px 22px 22px", display: "grid", gap: 14 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              textAlign: "left",
              padding: "14px 14px",
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#ffedd5",
                color: "#c2410c",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <MessageCircle size={18} />
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#9a3412", fontWeight: 600 }}>
              Alıcı teklifini onaylarsa iletişime geçebileceksiniz. Onay sonrası satıcı bilgileri ve mesajlaşma
              açılır.
            </p>
          </div>

          <button
            type="button"
            className="btn-orange"
            style={{ padding: 13, fontWeight: 800, fontSize: 15 }}
            onClick={onClose}
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
