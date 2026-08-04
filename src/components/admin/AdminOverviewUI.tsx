"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function AdmGlassCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.7)",
        borderRadius: 14,
        boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function AdmHero({
  eyebrow,
  title,
  subtitle,
  accent = "orange",
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: "orange" | "blue" | "violet" | "emerald";
  actions?: ReactNode;
}) {
  const glows: Record<string, string> = {
    orange:
      "radial-gradient(ellipse at 12% 0%, rgba(251,146,60,0.45), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(37,99,235,0.22), transparent 45%)",
    blue:
      "radial-gradient(ellipse at 12% 0%, rgba(59,130,246,0.45), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(14,165,233,0.25), transparent 45%)",
    violet:
      "radial-gradient(ellipse at 12% 0%, rgba(167,139,250,0.5), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(244,114,182,0.22), transparent 45%)",
    emerald:
      "radial-gradient(ellipse at 12% 0%, rgba(52,211,153,0.45), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(45,212,191,0.22), transparent 45%)",
  };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        padding: "18px 20px 16px",
        background: `${glows[accent]}, linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)`,
        color: "#fff",
        boxShadow: "0 14px 40px rgba(15,23,42,0.2)",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              marginBottom: 6,
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.45 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
    </div>
  );
}

export type AdmKpiItem = {
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  icon: LucideIcon;
  tone?: "orange" | "blue" | "violet" | "emerald" | "rose" | "slate";
  href?: string;
};

const TONE: Record<
  NonNullable<AdmKpiItem["tone"]>,
  { bg: string; fg: string; ring: string }
> = {
  orange: { bg: "#fff7ed", fg: "#ea580c", ring: "rgba(234,88,12,0.15)" },
  blue: { bg: "#eff6ff", fg: "#2563eb", ring: "rgba(37,99,235,0.15)" },
  violet: { bg: "#f5f3ff", fg: "#7c3aed", ring: "rgba(124,58,237,0.15)" },
  emerald: { bg: "#ecfdf5", fg: "#059669", ring: "rgba(5,150,105,0.15)" },
  rose: { bg: "#fff1f2", fg: "#e11d48", ring: "rgba(225,29,72,0.15)" },
  slate: { bg: "#f8fafc", fg: "#475569", ring: "rgba(71,85,105,0.12)" },
};

export function AdmKpiGrid({ items }: { items: AdmKpiItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 10,
        marginBottom: 14,
      }}
    >
      {items.map((k) => {
        const tone = TONE[k.tone || "orange"];
        const Icon = k.icon;
        const body = (
          <AdmGlassCard
            style={{
              padding: "12px 13px 11px",
              transition: "transform .15s ease, box-shadow .15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: tone.bg,
                  color: tone.fg,
                  boxShadow: `0 0 0 3px ${tone.ring}`,
                }}
              >
                <Icon size={16} strokeWidth={2.25} />
              </div>
              {typeof k.trend === "number" ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: k.trend >= 0 ? "#059669" : "#e11d48",
                  }}
                >
                  {k.trend >= 0 ? "↑" : "↓"} %{Math.abs(Math.round(k.trend))}
                </span>
              ) : k.href ? (
                <ArrowUpRight size={14} color="#94a3b8" />
              ) : null}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>{k.label}</div>
            <div style={{ marginTop: 2, fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", color: "#0f172a" }}>
              {k.value}
            </div>
            {k.hint ? (
              <div style={{ marginTop: 3, fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{k.hint}</div>
            ) : null}
          </AdmGlassCard>
        );
        return k.href ? (
          <Link key={k.label} href={k.href} style={{ textDecoration: "none", color: "inherit" }}>
            {body}
          </Link>
        ) : (
          <div key={k.label}>{body}</div>
        );
      })}
    </div>
  );
}

export function AdmQuickLink({
  href,
  label,
  description,
  badge,
}: {
  href: string;
  label: string;
  description?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
        border: "1px solid #e2e8f0",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, color: "#0f172a" }}>{label}</div>
        {description ? (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.35 }}>{description}</div>
        ) : null}
      </div>
      {badge && badge > 0 ? (
        <span
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 999,
            background: "#fff7ed",
            color: "#ea580c",
            fontSize: 11,
            fontWeight: 800,
            display: "grid",
            placeItems: "center",
            padding: "0 6px",
          }}
        >
          {badge}
        </span>
      ) : (
        <ArrowUpRight size={15} color="#94a3b8" />
      )}
    </Link>
  );
}
