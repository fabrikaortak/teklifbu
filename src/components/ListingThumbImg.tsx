"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { listingThumbUrl } from "@/lib/listingImage";

/**
 * Liste / şerit kartları: önce .thumb.webp, yoksa orijinale düş.
 */
export function ListingThumbImg({
  src,
  alt = "",
  className,
  style,
  loading = "lazy",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
}) {
  const original = String(src || "").trim();
  const thumb = useMemo(() => listingThumbUrl(original), [original]);
  const preferThumb = Boolean(original && thumb && thumb !== original);
  const [failedThumb, setFailedThumb] = useState(false);

  if (!original) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={preferThumb && !failedThumb ? thumb : original}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={() => {
        if (preferThumb && !failedThumb) setFailedThumb(true);
      }}
    />
  );
}
