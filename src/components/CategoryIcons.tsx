import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string; active?: boolean };

function Svg({ size = 22, children, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Canlı çizgi ikonlar — referans mockup stili */
export const CatIcon = {
  konut: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path d="M8 22 L24 8 L40 22" stroke="#FF6A00" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 20.5 V38 H36 V20.5" stroke="#FF6A00" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 38 V28 H28 V38" stroke="#FFB068" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="16" r="2.2" fill="#FF6A00" />
    </Svg>
  ),
  arac: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path
        d="M10 28 H38 C40 28 41 26.5 41 24.5 V22 C41 20 39.5 19 38 18.5 L34 12 C33 10.5 31.5 10 30 10 H18 C16.5 10 15 10.5 14 12 L10 18.5 C8.5 19 7 20 7 22 V24.5 C7 26.5 8 28 10 28 Z"
        stroke="#2563EB"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="30" r="4" stroke="#60A5FA" strokeWidth="3" />
      <circle cx="33" cy="30" r="4" stroke="#60A5FA" strokeWidth="3" />
      <path d="M14 18 H34" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  ),
  isyeri: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path d="M10 40 V16 L24 8 L38 16 V40" stroke="#7C3AED" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M18 40 V28 H30 V40" stroke="#A78BFA" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 20 H20 M28 20 H32 M16 26 H20 M28 26 H32" stroke="#C4B5FD" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  ),
  arsa: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path d="M6 34 L16 18 L24 28 L32 14 L42 34 Z" stroke="#16A34A" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M6 34 H42" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" />
      <circle cx="34" cy="12" r="3" fill="#86EFAC" />
    </Svg>
  ),
  kiralik: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <circle cx="18" cy="18" r="8" stroke="#EAB308" strokeWidth="3.2" />
      <circle cx="18" cy="18" r="3" fill="#FACC15" />
      <path d="M24.5 24.5 L38 38" stroke="#EAB308" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M34 34 L38 38 L34 40" stroke="#FDE047" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  diger: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <rect x="8" y="8" width="12" height="12" rx="3" stroke="#64748B" strokeWidth="3" />
      <rect x="28" y="8" width="12" height="12" rx="3" stroke="#94A3B8" strokeWidth="3" />
      <rect x="8" y="28" width="12" height="12" rx="3" stroke="#94A3B8" strokeWidth="3" />
      <rect x="28" y="28" width="12" height="12" rx="3" stroke="#64748B" strokeWidth="3" />
    </Svg>
  ),
  "ikinci-el": ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path
        d="M14 16 H30 C34 16 38 20 38 26 V32 H14 C10 32 8 28 8 24 C8 20 10 16 14 16 Z"
        stroke="#0D9488"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M18 16 V12 C18 10 20 8 24 8 C28 8 30 10 30 12 V16" stroke="#14B8A6" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M16 26 H28 M16 30 H24" stroke="#5EEAD4" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="34" cy="14" r="7" fill="#fff" stroke="#F59E0B" strokeWidth="2.5" />
      <path d="M31 14 H37 M34 11 V17" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  ),
  "sifir-urun": ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <rect x="10" y="14" width="28" height="24" rx="4" stroke="#DC2626" strokeWidth="3" />
      <path d="M10 22 H38" stroke="#F87171" strokeWidth="2.5" />
      <path d="M18 14 V10 H30 V14" stroke="#EF4444" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M20 28 L23 31 L28 24" stroke="#FCA5A5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
};

export const StatIcon = {
  listings: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path d="M8 22 L24 8 L40 22" stroke="#FF6A00" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 20.5 V38 H36 V20.5" stroke="#FF6A00" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M20 38 V28 H28 V38" stroke="#FFB068" strokeWidth="3" strokeLinejoin="round" />
    </Svg>
  ),
  bids: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path d="M8 32 L18 22 L26 28 L40 12" stroke="#16A34A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 12 H40 V22" stroke="#4ADE80" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  buyers: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <circle cx="18" cy="16" r="6" stroke="#2563EB" strokeWidth="3" />
      <circle cx="32" cy="18" r="5" stroke="#60A5FA" strokeWidth="2.8" />
      <path d="M6 36 C6 28 12 26 18 26 C24 26 30 28 30 36" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 36 C30 30 34 28 38 28 C41 28 44 29 44 34" stroke="#60A5FA" strokeWidth="2.8" strokeLinecap="round" />
    </Svg>
  ),
  sellers: ({ size = 22 }: IconProps) => (
    <Svg size={size}>
      <path
        d="M24 8 L36 14 V24 C36 32 30 37 24 40 C18 37 12 32 12 24 V14 Z"
        stroke="#7C3AED"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M18 24 L22 28 L30 18" stroke="#A78BFA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
};

export function getCatIcon(slug: string, size = 22) {
  const map: Record<string, (p: IconProps) => ReactNode> = {
    all: CatIcon.konut,
    "": CatIcon.konut,
    emlak: CatIcon.konut,
    konut: CatIcon.konut,
    arac: CatIcon.arac,
    isyeri: CatIcon.isyeri,
    arsa: CatIcon.arsa,
    kiralik: CatIcon.kiralik,
    diger: CatIcon.diger,
    "ikinci-el": CatIcon["ikinci-el"],
    "sifir-urun": CatIcon["sifir-urun"],
  };
  let Comp = map[slug];
  if (!Comp) {
    if (slug.startsWith("ikinci-el-")) Comp = CatIcon["ikinci-el"];
    else if (slug.startsWith("sifir-urun-")) Comp = CatIcon["sifir-urun"];
    else Comp = CatIcon.diger;
  }
  return <Comp size={size} />;
}
