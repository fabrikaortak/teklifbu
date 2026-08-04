"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { HomePromoSlide } from "@/lib/homePromos";

function SlideMedia({ slide }: { slide: HomePromoSlide }) {
  return (
    <div
      className="v2-promo-slide"
      style={{ backgroundImage: `url(${slide.imageUrl})` }}
      role="img"
      aria-label={slide.title || "Reklam"}
    />
  );
}

function SlideWrap({ slide, children }: { slide: HomePromoSlide; children: ReactNode }) {
  const href = String(slide.href || "").trim();
  if (!href) return <>{children}</>;

  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a href={href} className="v2-promo-link" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="v2-promo-link">
      {children}
    </Link>
  );
}

export function HomePromoSlider({
  slides,
  heightPx = 168,
  slideSeconds = 5,
}: {
  slides: HomePromoSlide[];
  heightPx?: number;
  slideSeconds?: number;
}) {
  const [idx, setIdx] = useState(0);
  const h = Math.min(420, Math.max(40, Number(heightPx) || 168));
  const ms = Math.min(60, Math.max(2, slideSeconds || 5)) * 1000;

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, ms);
    return () => window.clearInterval(t);
  }, [slides.length, ms]);

  const boxStyle = { height: h, ["--v2-promo-h" as string]: `${h}px` };

  if (!slides.length) {
    return <div className="v2-promo v2-promo-fallback" style={boxStyle} aria-hidden />;
  }

  const slide = slides[idx] || slides[0];

  return (
    <div className="v2-promo" style={boxStyle}>
      <SlideWrap slide={slide}>
        <SlideMedia slide={slide} />
      </SlideWrap>
      {slides.length > 1 && (
        <div className="v2-promo-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={i === idx ? "active" : undefined}
              aria-label={`Reklam ${i + 1}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
