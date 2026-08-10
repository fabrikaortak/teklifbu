import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
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
import { getSetting } from "@/core/settings";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-teklifbu",
});

export const metadata: Metadata = {
  title: "TeklifBu — Gerçek satıcılar, gerçek alıcılarla buluşur",
  description: "Şeffaf teklif pazarı: konut, araç, işyeri, arsa ve daha fazlası.",
  manifest: "/manifest.webmanifest",
};

/** Tema ayarı DB'den; Docker build'de DB yok → static prerender yasak */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [themeRaw, beltRaw] = await Promise.all([
    getSetting<string>("ui_theme", "v1"),
    getSetting<string>("v2_header_belt", "navy"),
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
      className={sans.variable}
      data-theme={theme}
      {...(theme === "v2" ? { "data-v2-belt": belt } : {})}
      style={beltStyle}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={sans.className} suppressHydrationWarning>
        <ThemeProvider initialTheme={theme} initialHeaderBelt={belt}>
          <ConfirmDialogProvider>
            <CartProvider>
              <SiteTopBeltBanner />
              <SiteHeader />
              <main>{children}</main>
              <SiteFooter />
            </CartProvider>
          </ConfirmDialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
