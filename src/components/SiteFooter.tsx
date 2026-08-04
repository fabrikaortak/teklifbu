"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DEFAULT_SITE_FOOTER, type SiteFooterConfig } from "@/core/siteFooter";

type FooterBelt = "navy" | "white";

function PaymentIcons({ dark }: { dark: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
      <span
        aria-label="Visa"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 28,
          padding: "0 10px",
          borderRadius: 6,
          border: dark ? "1px solid rgba(255,255,255,.25)" : "1px solid #e5e7eb",
          background: "#fff",
          fontSize: 12,
          fontWeight: 800,
          color: "#1a1f71",
          letterSpacing: 0.5,
        }}
      >
        VISA
      </span>
      <span
        aria-label="Mastercard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          height: 28,
          padding: "0 8px",
          borderRadius: 6,
          border: dark ? "1px solid rgba(255,255,255,.25)" : "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#eb001b" }} />
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#f79e1b",
            marginLeft: -5,
          }}
        />
      </span>
    </div>
  );
}

function AppBadge({
  href,
  label,
  sub,
  dark,
}: {
  href: string;
  label: string;
  sub: string;
  dark: boolean;
}) {
  const external = href && href !== "#";
  const style = {
    display: "inline-flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 1,
    minWidth: 118,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1.5px dashed var(--orange)",
    background: dark ? "rgba(255,255,255,.96)" : "#fff",
    color: "#111",
    textDecoration: "none",
    fontSize: 11,
    lineHeight: 1.2,
  };
  const inner = (
    <>
      <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>{sub}</span>
      <strong style={{ fontSize: 12.5, fontWeight: 800 }}>{label}</strong>
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={style}>
        {inner}
      </a>
    );
  }
  return <span style={{ ...style, opacity: 0.9 }}>{inner}</span>;
}

export function SiteFooter() {
  const pathname = usePathname();
  const [footer, setFooter] = useState<SiteFooterConfig>(DEFAULT_SITE_FOOTER);
  const [brandName, setBrandName] = useState("TeklifBu");
  const [belt, setBelt] = useState<FooterBelt>("white");

  useEffect(() => {
    fetch("/api/footer")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.footer) setFooter({ ...DEFAULT_SITE_FOOTER, ...d.footer });
        if (d.brandName) setBrandName(String(d.brandName));
        setBelt(d.footerBelt === "navy" ? "navy" : "white");
      })
      .catch(() => {});
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const year = new Date().getFullYear();
  const dark = belt === "navy";
  const text = dark ? "rgba(255,255,255,.88)" : "#334155";
  const muted = dark ? "rgba(255,255,255,.62)" : "#6b7280";
  const soft = dark ? "rgba(255,255,255,.48)" : "#9ca3af";
  const line = dark ? "rgba(255,255,255,.12)" : "#e8eaed";
  const lineSoft = dark ? "rgba(255,255,255,.1)" : "#f1f5f9";
  const strong = dark ? "#ffffff" : "#0f172a";
  const link = dark ? "rgba(255,255,255,.78)" : "#475569";

  return (
    <footer
      data-footer-belt={belt}
      style={{
        marginTop: 48,
        background: dark ? "var(--navy)" : "#fff",
        borderTop: `1px solid ${line}`,
        color: text,
      }}
    >
      <div
        className="page-shell-wide site-footer-main"
        style={{
          paddingTop: 28,
          paddingBottom: 20,
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) minmax(280px, 1.35fr)",
          gap: 32,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          {(footer.phoneLabel || footer.phone) && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Phone size={20} color="#fff" strokeWidth={2.2} />
              </span>
              <div>
                {footer.phoneLabel ? (
                  <div style={{ color: "var(--orange)", fontWeight: 800, fontSize: 14 }}>
                    {footer.phoneLabel}
                  </div>
                ) : null}
                {footer.phone ? (
                  <a
                    href={`tel:${footer.phone.replace(/\s/g, "")}`}
                    style={{
                      color: strong,
                      fontWeight: 800,
                      fontSize: 20,
                      letterSpacing: "-0.02em",
                      textDecoration: "none",
                    }}
                  >
                    {footer.phone}
                  </a>
                ) : null}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 6, fontSize: 13, color: muted, lineHeight: 1.55 }}>
            {footer.address ? <div>{footer.address}</div> : null}
            {footer.tradeRegistryNo ? <div>Ticaret Sicil No: {footer.tradeRegistryNo}</div> : null}
            {footer.mersis ? <div>MERSİS: {footer.mersis}</div> : null}
          </div>

          {footer.showPaymentIcons ? <PaymentIcons dark={dark} /> : null}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", lineHeight: 1 }}>
            <BrandLogo style={{ color: strong }} />
          </div>

          {footer.disclaimer ? (
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                lineHeight: 1.55,
                color: soft,
                maxWidth: 640,
              }}
            >
              {footer.disclaimer.replace(/teklifbu\.com/gi, `${brandName.toLowerCase().replace(/\s/g, "")}.com`)}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
            }}
          >
            {footer.showAppBadges ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <AppBadge href={footer.googlePlayUrl} sub="Hemen İndir" label="Google Play" dark={dark} />
                <AppBadge href={footer.appStoreUrl} sub="Hemen İndir" label="App Store" dark={dark} />
                <AppBadge href={footer.appGalleryUrl} sub="Hemen İndir" label="App Gallery" dark={dark} />
              </div>
            ) : null}

            {footer.showEtbis ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginLeft: footer.showAppBadges ? 4 : 0,
                  paddingLeft: footer.showAppBadges ? 14 : 0,
                  borderLeft: footer.showAppBadges ? `1px solid ${line}` : "none",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    border: `1px solid ${line}`,
                    background: footer.etbisQrUrl
                      ? `center / cover no-repeat url(${footer.etbisQrUrl})`
                      : dark
                        ? "repeating-linear-gradient(45deg,rgba(255,255,255,.12),rgba(255,255,255,.12) 4px,rgba(255,255,255,.04) 4px,rgba(255,255,255,.04) 8px)"
                        : "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#fff 4px,#fff 8px)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9,
                    color: soft,
                    fontWeight: 700,
                    textAlign: "center",
                    padding: 4,
                  }}
                >
                  {!footer.etbisQrUrl ? "QR" : null}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: dark ? "#fca5a5" : "#dc2626",
                    lineHeight: 1.3,
                  }}
                >
                  {footer.etbisText || "ETBİS'e Kayıtlıdır."}
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 13,
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            <Link href="/ilanlar" style={{ color: link }}>
              İlanlar
            </Link>
            <Link href="/nasil-calisir" style={{ color: link }}>
              Nasıl Çalışır?
            </Link>
            <Link href="/yardim" style={{ color: link }}>
              Yardım
            </Link>
            <Link href="/jeton" style={{ color: link }}>
              Jeton Al
            </Link>
          </div>
        </div>
      </div>

      <div
        className="page-shell-wide"
        style={{
          paddingTop: 10,
          paddingBottom: 16,
          borderTop: `1px solid ${lineSoft}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 11.5,
          color: soft,
        }}
      >
        <span>
          © {year} {brandName}
        </span>
        {footer.version ? <span>{footer.version}</span> : null}
      </div>

      <style>{`
        @media (max-width: 800px) {
          .site-footer-main {
            grid-template-columns: 1fr !important;
            gap: 22px !important;
          }
        }
      `}</style>
    </footer>
  );
}
