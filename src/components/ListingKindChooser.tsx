"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Hotel, ShoppingBag } from "lucide-react";
import { allowedListingKindsForUser } from "@/lib/verticalAccessPolicy";
import {
  defaultCommercialPublishMap,
  entryPathsForSubtypes,
  type CommercialPublishMap,
} from "@/lib/commercialPublishMap";
import { parseCommercialSubtypes } from "@/lib/accountTypes";

type Props = {
  genelHref?: string;
  alisverisHref?: string;
  premiumHref?: string;
  /** Premium dikeylerden en az biri açıksa true (tema ayarı) */
  showPremium?: boolean;
  /** Alışveriş dikeyi açıksa true */
  showAlisveris?: boolean;
  /** Kullanıcı dikey yetkisi — yoksa tüm kartlar (backend yine engeller) */
  user?: {
    accountType?: string | null;
    commercialSubtypes?: string[] | null;
    profile?: unknown;
  } | null;
};

/** Ticari üye — Genel / Alışveriş / Premium ilan seçimi (yalnız izinli dikeyler) */
export function ListingKindChooser({
  genelHref = "/ilan-ver?kind=genel",
  alisverisHref = "/ilan-ver/alisveris",
  premiumHref = "/ilan-ver/premium",
  showPremium = true,
  showAlisveris = true,
  user = null,
}: Props) {
  const [publishMap, setPublishMap] = useState<CommercialPublishMap>(defaultCommercialPublishMap());

  useEffect(() => {
    fetch("/api/commercial-publish-map")
      .then((r) => r.json())
      .then((d) => {
        if (d?.map) setPublishMap(d.map);
      })
      .catch(() => {});
  }, []);

  const kinds = user
    ? allowedListingKindsForUser(user, publishMap)
    : { genel: true, alisveris: true, premium: true };

  const hrefs = useMemo(() => {
    const subs = parseCommercialSubtypes(user?.commercialSubtypes || [], null, true);
    const paths = entryPathsForSubtypes(subs, publishMap);
    let genel = genelHref;
    let alisveris = alisverisHref;
    let premium = premiumHref;
    for (const p of paths) {
      if (p.includes("kind=genel") || (p.includes("/ilan-ver") && !p.includes("alisveris") && !p.includes("premium") && !p.includes("ilan-ekle"))) {
        genel = p;
      }
      if (p.includes("alisveris") || p.includes("ilan-ekle")) alisveris = p;
      if (p.includes("premium")) premium = p;
    }
    // Haritadan form kind’e göre de bak
    for (const row of publishMap.rows.filter((r) => r.enabled && subs.map((s) => s.toUpperCase()).includes(r.subtypeKey))) {
      if (row.listingForm === "genel") genel = row.entryPath || genel;
      if (row.listingForm === "alisveris") alisveris = row.entryPath || alisveris;
      if (row.listingForm === "premium") premium = row.entryPath || premium;
    }
    return { genel, alisveris, premium };
  }, [user, publishMap, genelHref, alisverisHref, premiumHref]);

  const showGenel = kinds.genel;
  const showAlisverisCard = showAlisveris && kinds.alisveris;
  const showPremiumCard = showPremium && kinds.premium;

  if (!showGenel && !showAlisverisCard && !showPremiumCard) {
    return (
      <div className="page-shell" style={{ maxWidth: 820, margin: "32px auto 64px", padding: "0 16px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>İlan ekle</h1>
        <p style={{ margin: "12px 0 0", color: "#64748b", lineHeight: 1.5 }}>
          Faaliyet alanınıza uygun ilan türü bulunamadı. Hesap ayarlarından emlak ofisi, galeri veya
          mağaza seçimini kontrol edin.
        </p>
      </div>
    );
  }

  const cardStyle = {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    padding: 20,
    textDecoration: "none",
    color: "inherit",
    border: "1px solid #e8edf3",
    borderRadius: 16,
  } as const;

  return (
    <div className="page-shell" style={{ maxWidth: 820, margin: "32px auto 64px", padding: "0 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>İlan ekle</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 15, lineHeight: 1.5 }}>
          Ticari hesabınızla hangi tür ilan oluşturmak istediğinizi seçin.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {showGenel ? (
          <Link href={hrefs.genel} className="card" style={cardStyle}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#fff7ed",
                color: "#c2410c",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Building2 size={22} />
            </span>
            <span>
              <strong style={{ display: "block", fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
                Genel kategori ilanı ekle
              </strong>
              <span style={{ fontSize: 14, color: "#64748b", lineHeight: 1.45 }}>
                Emlak, vasıta, işyeri ve arsa kategorilerinde klasik teklif ilanı oluşturun.
              </span>
            </span>
          </Link>
        ) : null}

        {showAlisverisCard ? (
          <Link href={hrefs.alisveris} className="card" style={cardStyle}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#eff6ff",
                color: "#1d4ed8",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <ShoppingBag size={22} />
            </span>
            <span>
              <strong style={{ display: "block", fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
                Alışveriş kategori ilanı ekle
              </strong>
              <span style={{ fontSize: 14, color: "#64748b", lineHeight: 1.45 }}>
                Elektronik, moda, ev &amp; yaşam ve diğer alışveriş kategorilerinde ürün ilanı oluşturun.
              </span>
            </span>
          </Link>
        ) : null}

        {showPremiumCard ? (
          <Link href={hrefs.premium} className="card" style={cardStyle}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#ecfdf5",
                color: "#047857",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Hotel size={22} />
            </span>
            <span>
              <strong style={{ display: "block", fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
                Premium kategori ilanı ekle
              </strong>
              <span style={{ fontSize: 14, color: "#64748b", lineHeight: 1.45 }}>
                Otel konaklama, lojistik taşıma veya yolculuk paylaşımı kapasite ilanı oluşturun.
              </span>
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
