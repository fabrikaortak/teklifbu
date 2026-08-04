import type { CSSProperties } from "react";

/** Marka logosu: kuşak rengine göre metin rengi, B her zaman turuncu */
export function BrandLogo({
  className,
  style,
  accentStyle,
}: {
  className?: string;
  style?: CSSProperties;
  accentStyle?: CSSProperties;
}) {
  return (
    <span className={className} style={{ color: "var(--v2-logo-color, #fff)", ...style }}>
      Teklif
      <span style={{ color: "var(--orange)", ...accentStyle }}>B</span>
      u
    </span>
  );
}
