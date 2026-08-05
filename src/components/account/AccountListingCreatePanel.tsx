"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModernShoppingListingForm } from "@/components/shopping/ModernShoppingListingForm";
import { ListingKindChooser } from "@/components/ListingKindChooser";

/** Hesabım → İlan Ekle: Modern Tema açıksa adımlı form, değilse tür seçici */
export function AccountListingCreatePanel() {
  const [template, setTemplate] = useState<"classic" | "ecommerce_v1" | "modern_v1" | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(true);
  const [authUser, setAuthUser] = useState<{
    accountType?: string | null;
    commercialSubtypes?: string[] | null;
    profile?: unknown;
  } | null>(null);

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = String(d?.shoppingListingFormTemplate || "classic");
        setTemplate(t === "modern_v1" || t === "ecommerce_v1" ? t : "classic");
        const pv = d?.premiumVerticals;
        if (pv && typeof pv === "object") {
          setPremiumOpen(Object.values(pv).some(Boolean));
        }
      })
      .catch(() => setTemplate("classic"));
    fetch("/api/auth")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setAuthUser({
            accountType: d.user.accountType,
            commercialSubtypes: d.user.commercialSubtypes || [],
            profile: d.user.profile || null,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!template) {
    return <div className="card" style={{ padding: 24, color: "#64748b" }}>Yükleniyor…</div>;
  }

  if (template === "modern_v1") {
    return <ModernShoppingListingForm />;
  }

  return (
    <div>
      <ListingKindChooser showPremium={premiumOpen} user={authUser} />
      <p style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "#94a3b8" }}>
        Modern Tema için Admin → Alışveriş → Ayarlar → «Alışveriş — ilan giriş formu».
      </p>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <Link href="/ilan-ver" style={{ fontWeight: 700, color: "#ea580c" }}>
          Klasik ilan formuna git →
        </Link>
      </div>
    </div>
  );
}
