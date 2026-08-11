import type { Metadata } from "next";
import type { CSSProperties } from "react";
/* Self-hosted — Docker build Google Fonts'a ihtiyaç duymaz (VPS gstatic engeli) */
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/plus-jakarta-sans/latin-ext-400.css";
import "@fontsource/plus-jakarta-sans/latin-ext-500.css";
import "@fontsource/plus-jakarta-sans/latin-ext-600.css";
import "@fontsource/plus-jakarta-sans/latin-ext-700.css";
import "@fontsource/plus-jakarta-sans/latin-ext-800.css";
import "./globals.css";
import "./theme-v2.css";
import "./shopping-product.css";
import "./modern-shopping-form.css";
import "./alisveris-home.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteTopBeltBanner } from "@/components/SiteBeltBanner";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { AlisverisBrowseProvider } from "@/components/AlisverisBrowseProvider";
import { getSetting } from "@/core/settings";
import { getAlisverisBrowseNavTree } from "@/lib/alisverisBrowseNav";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";

export const metadata: Metadata = {
  title: "TeklifBu — Gerçek satıcılar, gerçek alıcılarla buluşur",
  description: "Şeffaf teklif pazarı: konut, araç, işyeri, arsa ve daha fazlası.",
  manifest: "/manifest.webmanifest",
};

/** Tema ayarı DB'den; Docker build'de DB yok → static prerender yasak */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [themeRaw, beltRaw, alisverisBrowse] = await Promise.all([
    getSetting<string>("ui_theme", "v1"),
    getSetting<string>("v2_header_belt", "navy"),
    getAlisverisBrowseNavTree().catch((e) => {
      console.warn("[layout] alisveris browse bootstrap failed", e);
      return [] as Awaited<ReturnType<typeof getAlisverisBrowseNavTree>>;
    }),
  ]);
  const theme = themeRaw === "v2" ? "v2" : "v1";
  const belt = beltRaw === "white" ? "white" : "navy";
  const beltStyle: CSSProperties | undefined =
    theme === "v2"
      ? belt === "white"
        ? {
            ["--v2-header-bg" as string]: "#ffffff",
            ["--v2-header-fg" as string]: "#0f172a",
            ["--v2-logo-color" as string]: "#0f172a",
          }
        : {
            ["--v2-header-bg" as string]: "#0b1f3a",
            ["--v2-header-fg" as string]: "#ffffff",
            ["--v2-logo-color" as string]: "#ffffff",
          }
      : undefined;

  return (
    <html
      lang="tr"
      data-theme={theme}
      {...(theme === "v2" ? { "data-v2-belt": belt } : {})}
      style={
        {
          ...beltStyle,
          ["--font-teklifbu" as string]: '"Plus Jakarta Sans"',
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider initialTheme={theme} initialHeaderBelt={belt}>
          <ConfirmDialogProvider>
            <CartProvider>
              <AlisverisBrowseProvider initialTree={alisverisBrowse.length ? alisverisBrowse : null}>
                <SiteTopBeltBanner />
                <SiteHeader />
                <main>{children}</main>
                <SiteFooter />
              </AlisverisBrowseProvider>
            </CartProvider>
          </ConfirmDialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
