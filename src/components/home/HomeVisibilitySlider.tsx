"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import type { HomeVisibilitySlide } from "@/lib/homeBanners";

const FALLBACK: HomeVisibilitySlide = {
  id: "fallback",
  title: "Daha Fazla Görünürlük",
  subtitle: "Vitrin & Premium ile ilanınızı öne çıkarın.",
  imageUrl: "",
  href: "/ilan-ver",
  ctaOutline: "Vitrin İlan",
  ctaPrimary: "Premium İlan",
  hrefOutline: "/ilan-ver",
  hrefPrimary: "/ilan-ver",
};

function displayTitle(title: string) {
  const t = String(title || "").trim();
  if (!t || /^sağ\s*alt\s*banner$/i.test(t)) return "Daha Fazla Görünürlük";
  return t;
}

export function HomeVisibilitySlider({
  slides,
  heightPx = 148,
  slideSeconds = 5,
}: {
  slides: HomeVisibilitySlide[];
  heightPx?: number;
  slideSeconds?: number;
}) {
  const items = slides.length ? slides : [FALLBACK];
  const [idx, setIdx] = useState(0);
  const h = Math.min(360, Math.max(40, Number(heightPx) || 148));
  const ms = Math.min(60, Math.max(2, slideSeconds || 5)) * 1000;

  useEffect(() => {
    if (items.length < 2) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, ms);
    return () => window.clearInterval(t);
  }, [items.length, ms]);

  const slide = items[idx] || items[0];

  return (
    <div className="v2-vis-slider" style={{ height: h, ["--v2-vis-h" as string]: `${h}px` }}>
      <div
        className="v2-vis-slide"
        style={{
          ...(slide.imageUrl
            ? {
                backgroundImage: `linear-gradient(120deg, rgba(8,18,36,.88), rgba(8,18,36,.55)), url(${slide.imageUrl})`,
              }
            : {}),
        }}
      >
        <div className="v2-vis-copy">
          <strong>{displayTitle(slide.title)}</strong>
          <span>{slide.subtitle}</span>
          <div className="v2-vis-ctas">
            <Link href={slide.hrefOutline || "/ilan-ver"} className="v2-vis-btn-outline">
              {slide.ctaOutline}
            </Link>
            <Link href={slide.hrefPrimary || "/ilan-ver"} className="v2-vis-btn-primary">
              {slide.ctaPrimary}
            </Link>
          </div>
        </div>
        <div className="v2-vis-ico" aria-hidden>
          <Crown size={36} strokeWidth={1.5} color="#fbbf24" fill="#f59e0b" />
        </div>
      </div>
      {items.length > 1 && (
        <div className="v2-vis-dots">
          {items.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={i === idx ? "active" : undefined}
              aria-label={`Slayt ${i + 1}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
