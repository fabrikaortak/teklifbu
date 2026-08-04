"use client";

import { AlertTriangle, Ban, Coins, ShieldAlert, X } from "lucide-react";
import { SELLER_REVIEW_RULES_TEXT } from "@/lib/sellerBadges";

export const REVIEW_RULES_STORAGE_KEY = "teklifbu_review_rules_accepted";

export function reviewRulesAccepted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(REVIEW_RULES_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function acceptReviewRules() {
  try {
    localStorage.setItem(REVIEW_RULES_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
};

const ITEMS = [
  {
    icon: Ban,
    title: "Küfür ve hakaret yasak",
    text: "Küfür, hakaret, izinsiz saldırı veya aşağılayıcı / rencide edici ifadeler yazılamaz.",
  },
  {
    icon: ShieldAlert,
    title: "Fiyat / satıcı karalama",
    text: "Fiyat veya satıcı hakkında küçük düşürücü, iftira niteliğinde içerik yasaktır.",
  },
  {
    icon: AlertTriangle,
    title: "Onay ve yaptırım",
    text: "İhlalde yorum onaylanmaz; üyeliğiniz sonlandırılabilir.",
  },
  {
    icon: Coins,
    title: "Jeton iadesi yok",
    text: "Üyelik sonlandırılırsa jeton bakiyeniz iade edilmez.",
  },
] as const;

export function ReviewRulesCard({ open, onClose, onAccept }: Props) {
  if (!open) return null;

  return (
    <aside className="bid-tips-card review-rules-card" role="dialog" aria-label="Yorum kuralları">
      <div className="bid-tips-card__head">
        <div className="bid-tips-card__badge" style={{ background: "#fff7ed", color: "#c2410c" }}>
          <AlertTriangle size={16} strokeWidth={2.25} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bid-tips-card__title">Yorum yazmadan önce</div>
          <div className="bid-tips-card__sub">Kuralları kabul etmeden yorum yazamazsınız</div>
        </div>
        <button type="button" className="bid-tips-card__x" onClick={onClose} aria-label="Kapat">
          <X size={16} />
        </button>
      </div>

      <ul className="bid-tips-card__list">
        {ITEMS.map((tip) => {
          const Icon = tip.icon;
          return (
            <li key={tip.title} className="bid-tips-card__item">
              <span className="bid-tips-card__icon">
                <Icon size={15} strokeWidth={2.2} />
              </span>
              <div>
                <strong>{tip.title}</strong>
                <p>{tip.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
        {SELLER_REVIEW_RULES_TEXT}
      </p>

      <button
        type="button"
        className="btn-orange"
        style={{ width: "100%", padding: 12, fontWeight: 800 }}
        onClick={onAccept}
      >
        Kabul ediyorum
      </button>
    </aside>
  );
}
