"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

function partsFrom(endsAt: Date | string | null | undefined) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { done: true as const, days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    done: false as const,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type CountdownVariant = "compact" | "panel";

/** Tarayıcıda çalışır; sunucuya istek atmaz. */
export function CountdownBadge({
  endsAt,
  variant = "compact",
}: {
  endsAt?: Date | string | null;
  variant?: CountdownVariant;
}) {
  const [parts, setParts] = useState(() => partsFrom(endsAt));

  useEffect(() => {
    setParts(partsFrom(endsAt));
    const id = window.setInterval(() => setParts(partsFrom(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt || !parts) return null;

  if (variant === "panel") {
    if (parts.done) {
      return (
        <div className="cd-panel cd-panel--done">
          <div className="cd-panel__top">
            <span className="cd-panel__icon">
              <Clock3 size={14} strokeWidth={2.25} />
            </span>
            <span>Kalan Süre</span>
          </div>
          <div className="cd-panel__box">
            <span className="cd-panel__done-msg">Süre doldu</span>
          </div>
        </div>
      );
    }

    const units = [
      { n: pad(parts.days), label: "Gün" },
      { n: pad(parts.hours), label: "Saat" },
      { n: pad(parts.mins), label: "Dakika" },
      { n: pad(parts.secs), label: "Saniye" },
    ];

    return (
      <div className="cd-panel" title="Kalan süre">
        <div className="cd-panel__top">
          <span className="cd-panel__icon">
            <Clock3 size={14} strokeWidth={2.25} />
          </span>
          <span>Kalan Süre</span>
        </div>
        <div className="cd-panel__box">
          {units.map((u, i) => (
            <div key={u.label} className="cd-panel__unit">
              {i > 0 && <span className="cd-panel__vline" aria-hidden />}
              <strong>{u.n}</strong>
              <em>{u.label}</em>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (parts.done) {
    return (
      <div className="cd-card cd-card--done">
        <Clock3 size={14} />
        <span>Süre doldu</span>
      </div>
    );
  }

  const urgent = parts.days === 0 && parts.hours < 6;

  return (
    <div className={`cd-card${urgent ? " cd-card--urgent" : ""}`} title="Kalan süre">
      <div className="cd-card__top">
        <Clock3 size={13} />
        <span>Kalan süre</span>
      </div>
      <div className="cd-card__time">
        <span>
          {parts.days}
          <em>g</em>
        </span>
        <span className="cd-card__sep">:</span>
        <span>
          {pad(parts.hours)}
          <em>s</em>
        </span>
        <span className="cd-card__sep">:</span>
        <span>
          {pad(parts.mins)}
          <em>d</em>
        </span>
        <span className="cd-card__sep">:</span>
        <span>
          {pad(parts.secs)}
          <em>sn</em>
        </span>
      </div>
    </div>
  );
}
