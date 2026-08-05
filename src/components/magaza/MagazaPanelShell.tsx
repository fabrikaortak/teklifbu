"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  MessageCircleQuestion,
  Truck,
  ArrowLeft,
  Store,
} from "lucide-react";
import "@/app/magaza-panel.css";

const NAV = [
  { href: "/magaza/panel", label: "Özet", icon: LayoutDashboard, exact: true, module: null },
  { href: "/magaza/panel/ilanlar", label: "İlanlar", icon: Package, module: "listings" as const },
  {
    href: "/magaza/panel/sorular",
    label: "Soru–cevap",
    icon: MessageCircleQuestion,
    module: "questions" as const,
  },
  {
    href: "/magaza/panel/siparisler",
    label: "Sipariş & kargo",
    icon: Truck,
    module: "orders" as const,
  },
];

export type MagazaModules = {
  listings: boolean;
  questions: boolean;
  orders: boolean;
};

export function MagazaPanelShell({
  children,
  shopName,
  modules,
}: {
  children: ReactNode;
  shopName?: string;
  modules?: MagazaModules;
}) {
  const pathname = usePathname();
  const mods = modules || { listings: true, questions: true, orders: true };

  return (
    <div className="sp-shell">
      <header className="sp-top">
        <div>
          <Link href="/hesabim" className="sp-back">
            <ArrowLeft size={14} /> Hesabıma dön
          </Link>
          <div className="sp-brand">
            <span className="sp-brand-ico">
              <Store size={18} />
            </span>
            <div>
              <h1>Satıcı Paneli</h1>
              <p>{shopName || "Mağazanız"} — sipariş, kargo ve müşteri soruları</p>
            </div>
          </div>
        </div>
        <Link href="/ilan-ver" className="sp-cta">
          Yeni ilan
        </Link>
      </header>

      <nav className="sp-nav" aria-label="Satıcı paneli">
        {NAV.filter((item) => !item.module || mods[item.module]).map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`sp-nav-link${active ? " is-active" : ""}`}>
              <Icon size={16} strokeWidth={2.25} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="sp-main">{children}</main>
    </div>
  );
}

export function MagazaPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="sp-card">
      <h2 className="sp-h2">{title}</h2>
      <p className="sp-muted">{description}</p>
    </div>
  );
}

export function SpKpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "danger" | "neutral";
  hint?: string;
}) {
  return (
    <div className={`sp-kpi sp-kpi--${tone || "neutral"}`}>
      <div className="sp-kpi__value">{value}</div>
      <div className="sp-kpi__label">{label}</div>
      {hint ? <div className="sp-kpi__hint">{hint}</div> : null}
    </div>
  );
}

export function SpEmpty({ children }: { children: ReactNode }) {
  return <div className="sp-empty">{children}</div>;
}

export function SpStatus({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`sp-pill sp-pill--${tone || "neutral"}`}>{children}</span>;
}
