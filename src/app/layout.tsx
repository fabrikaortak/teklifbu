import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./theme-v2.css";
import "./shopping-product.css";
import "./modern-shopping-form.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteTopBeltBanner } from "@/components/SiteBeltBanner";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CartProvider } from "@/components/cart/CartProvider";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={sans.variable} data-theme="v1">
      <body className={sans.className}>
        <ThemeProvider>
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
