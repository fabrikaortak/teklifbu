"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_MID_BELT_BANNER,
  DEFAULT_TOP_BELT_BANNER,
  type BeltBannerConfig,
} from "@/core/siteBeltBanners";

function BeltBannerView({
  config,
  placement,
}: {
  config: BeltBannerConfig;
  placement: "top" | "mid";
}) {
  if (!config.enabled || !config.imageUrl) return null;

  const height = config.heightPx;
  const widthStyle =
    config.widthPx > 0
      ? { width: "100%", maxWidth: config.widthPx }
      : { width: "100%", maxWidth: placement === "mid" ? "var(--page-max)" : "100%" };

  const inner = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.imageUrl}
      alt=""
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
      }}
    />
  );

  const box = (
    <div
      style={{
        ...widthStyle,
        height,
        margin: "0 auto",
        overflow: "hidden",
        background: "#0f172a",
      }}
    >
      {config.href ? (
        <a
          href={config.href}
          target={config.href.startsWith("http") ? "_blank" : undefined}
          rel={config.href.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{ display: "block", width: "100%", height: "100%" }}
          aria-label="Reklam"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );

  if (placement === "top") {
    return (
      <div
        className="site-top-belt-banner"
        style={{
          width: "100%",
          background: "#0b1220",
          borderBottom: "1px solid rgba(0,0,0,.06)",
        }}
      >
        {box}
      </div>
    );
  }

  return (
    <div
      className="site-mid-belt-banner page-shell-wide"
      style={{
        paddingTop: 12,
        paddingBottom: 4,
        boxSizing: "border-box",
      }}
    >
      {box}
    </div>
  );
}

/** Header üstü — boydan boya */
export function SiteTopBeltBanner() {
  const pathname = usePathname();
  const [config, setConfig] = useState<BeltBannerConfig>(DEFAULT_TOP_BELT_BANNER);

  useEffect(() => {
    fetch("/api/site-belt-banners")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.top) setConfig({ ...DEFAULT_TOP_BELT_BANNER, ...d.top });
      })
      .catch(() => {});
  }, []);

  if (pathname?.startsWith("/admin")) return null;
  return <BeltBannerView config={config} placement="top" />;
}

/** Kuşak / kategori ile kartların arası — ana sayfa */
export function SiteMidBeltBanner() {
  const [config, setConfig] = useState<BeltBannerConfig>(DEFAULT_MID_BELT_BANNER);

  useEffect(() => {
    fetch("/api/site-belt-banners")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.mid) setConfig({ ...DEFAULT_MID_BELT_BANNER, ...d.mid });
      })
      .catch(() => {});
  }, []);

  return <BeltBannerView config={config} placement="mid" />;
}
