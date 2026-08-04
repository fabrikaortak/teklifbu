"use client";

import type { CSSProperties } from "react";
import { renderListingDescriptionHtml } from "@/lib/listingDescription";

/** Açıklamayı güvenli HTML olarak göster (kalın/italik/altı çizili) */
export function ListingDescriptionHtml({
  text,
  style,
}: {
  text?: string | null;
  style?: CSSProperties;
}) {
  const html = renderListingDescriptionHtml(text || "");
  if (!String(text || "").trim()) {
    return <p style={{ margin: 0, ...style }}>—</p>;
  }
  return (
    <div
      style={{ margin: 0, lineHeight: 1.75, color: "#334155", fontSize: 15, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
