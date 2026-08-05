"use client";

import { Crown, X } from "lucide-react";

export type PremiumStorePopupConfig = {
  enabled: boolean;
  title: string;
  body: string;
  applyEnabled: boolean;
  applyLabel: string;
  applyUrl: string;
};

type Props = {
  open: boolean;
  config: PremiumStorePopupConfig;
  onClose: () => void;
  onApply?: () => void;
};

function bodyToParagraphs(body: string) {
  return String(body || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function renderBlock(block: string, key: number) {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const allBullets = lines.length > 0 && lines.every((l) => /^[•\-\*]\s+/.test(l) || /^[•\-\*]/.test(l));
  if (allBullets) {
    return (
      <ul key={key} className="premium-store-popup__list">
        {lines.map((l, i) => (
          <li key={i}>{l.replace(/^[•\-\*]\s*/, "")}</li>
        ))}
      </ul>
    );
  }
  return (
    <p key={key} className="premium-store-popup__p">
      {lines.map((l, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {l}
        </span>
      ))}
    </p>
  );
}

export function PremiumStoreInfoModal({ open, config, onClose, onApply }: Props) {
  if (!open || !config.enabled) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="premium-store-popup-title"
      className="premium-store-popup__overlay"
      onClick={onClose}
    >
      <div className="premium-store-popup__card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="premium-store-popup__close" onClick={onClose} aria-label="Kapat">
          <X size={18} />
        </button>

        <div className="premium-store-popup__badge">
          <Crown size={16} strokeWidth={2.4} />
          Premium Mağaza
        </div>

        <h2 id="premium-store-popup-title" className="premium-store-popup__title">
          {config.title || "Premium Mağaza"}
        </h2>

        <div className="premium-store-popup__body">
          {bodyToParagraphs(config.body).map((block, i) => renderBlock(block, i))}
        </div>

        <div className="premium-store-popup__actions">
          <button type="button" className="btn-outline premium-store-popup__btn" onClick={onClose}>
            Kapat
          </button>
          {config.applyEnabled ? (
            <button type="button" className="btn-orange premium-store-popup__btn" onClick={onApply}>
              {config.applyLabel || "Başvur"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
