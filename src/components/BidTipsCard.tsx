"use client";

import { Coins, Clock3, MessageCircle, Gavel, AlertTriangle, X, Lightbulb } from "lucide-react";

export const BID_TIPS_STORAGE_KEY = "teklifbu_bid_tips_hide";

export function bidTipsHidden(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(BID_TIPS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

type Props = {
  open: boolean;
  maxBids: number;
  onClose: () => void;
  onDontRemind: () => void;
};

const TIPS = (maxBids: number) =>
  [
    {
      icon: Gavel,
      title: "Teklif limiti",
      text: `Her ilana en fazla ${maxBids} teklif verebilirsiniz. Tekliflerinizi buna göre planlayın.`,
    },
    {
      icon: Clock3,
      title: "Süre ve onay",
      text: "Seçtiğiniz süre dolunca ilan sahibi onaylamadıysa teklifiniz bir daha onaylanmaz.",
    },
    {
      icon: MessageCircle,
      title: "İletişim",
      text: "İlan sahibi teklifinizi onaylarsa iletişim açılır; onaylanmadan mesaj / telefon görünmez.",
    },
    {
      icon: Coins,
      title: "Jeton",
      text: "Her teklif ayrı jeton harcar. Teklif sırası yükseldikçe jeton maliyeti de artabilir.",
    },
    {
      icon: AlertTriangle,
      title: "En yüksek teklife aldanmayın",
      text: "Listede görünen en yüksek teklif yanıltıcı olabilir. Tutarı kendi bütçenize göre belirleyin.",
    },
  ] as const;

export function BidTipsCard({ open, maxBids, onClose, onDontRemind }: Props) {
  if (!open) return null;

  return (
    <aside className="bid-tips-card" role="complementary" aria-label="Teklif bilgilendirmesi">
      <div className="bid-tips-card__head">
        <div className="bid-tips-card__badge">
          <Lightbulb size={16} strokeWidth={2.25} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bid-tips-card__title">Teklif vermeden önce</div>
          <div className="bid-tips-card__sub">İlk teklifiniz için kısa hatırlatmalar</div>
        </div>
        <button type="button" className="bid-tips-card__x" onClick={onClose} aria-label="Kapat">
          <X size={16} />
        </button>
      </div>

      <ul className="bid-tips-card__list">
        {TIPS(maxBids).map((tip) => {
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

      <button type="button" className="bid-tips-card__mute" onClick={onDontRemind}>
        Bir daha hatırlatma
      </button>
    </aside>
  );
}
