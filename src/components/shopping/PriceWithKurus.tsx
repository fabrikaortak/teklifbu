"use client";

import { cn } from "@/lib/format";

type Props = {
  value: number | null | undefined;
  className?: string;
  /** TL soneki göster (varsayılan true) */
  suffix?: boolean | string;
  /** Üstü çizili liste fiyatı vb. */
  muted?: boolean;
};

/** 1.458⁹⁹ TL — kuruş yarım boyutta ve üstte */
export function PriceWithKurus({ value, className, suffix = true, muted }: Props) {
  if (value == null || !Number.isFinite(Number(value))) {
    return <span className={className}>—</span>;
  }
  const rounded = Math.round(Number(value) * 100) / 100;
  const whole = Math.trunc(rounded);
  const kurus = Math.round(Math.abs(rounded - whole) * 100);
  const wholeStr = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.abs(whole));
  const kurusStr = String(kurus).padStart(2, "0");
  const suffixText = suffix === true ? " TL" : suffix === false ? "" : String(suffix);

  return (
    <span className={cn("price-with-kurus", muted && "price-with-kurus--muted", className)}>
      {rounded < 0 ? <span className="price-with-kurus__sign">-</span> : null}
      <span className="price-with-kurus__whole">{wholeStr}</span>
      <span className="price-with-kurus__kurus" aria-hidden>
        {kurusStr}
      </span>
      {suffixText ? <span className="price-with-kurus__suffix">{suffixText}</span> : null}
      <span className="sr-only">
        {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded)}
        {suffixText}
      </span>
    </span>
  );
}
