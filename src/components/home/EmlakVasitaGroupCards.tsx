"use client";

import Link from "next/link";
import { Home, Car, type LucideIcon } from "lucide-react";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { formatCompact } from "@/lib/format";

export type EmlakVasitaBucket = {
  id: "konut" | "arac";
  name: string;
  category: string;
  listings: ListingCardData[];
};

const ICONS: Record<string, LucideIcon> = {
  konut: Home,
  arac: Car,
};

type Props = {
  buckets: EmlakVasitaBucket[];
  limit?: number;
  activeCategory?: string;
  onSelectGroup: (category: string) => void;
};

export function EmlakVasitaGroupCards({
  buckets,
  limit = 4,
  activeCategory,
  onSelectGroup,
}: Props) {
  return (
    <div className="premium-vitrin featured-vitrin" aria-label="Emlak ve Vasıta öne çıkanlar">
      {buckets.map((b) => {
        const Icon = ICONS[b.id] || Home;
        const take = Math.min(12, Math.max(1, limit));
        const rows = b.listings.slice(0, take);
        const active =
          activeCategory === b.category ||
          activeCategory === b.id ||
          Boolean(activeCategory?.startsWith(`${b.category}-`));

        return (
          <section key={b.id} className={`premium-vitrin-card${active ? " is-active" : ""}`}>
            <header className="premium-vitrin-head">
              <button type="button" className="premium-vitrin-title" onClick={() => onSelectGroup(b.category)}>
                <Icon size={18} strokeWidth={2.25} />
                <span>{b.name}</span>
                <em>{formatCompact(b.listings.length)}+</em>
              </button>
              <Link
                href={`/?category=${encodeURIComponent(b.category)}`}
                className="premium-vitrin-more"
                onClick={(e) => {
                  e.preventDefault();
                  onSelectGroup(b.category);
                }}
              >
                Tümü
              </Link>
            </header>
            <div className="premium-vitrin-rows" style={{ minHeight: rows.length ? undefined : 72 }}>
              {rows.length === 0 ? (
                <div className="premium-vitrin-empty">Henüz ilan yok.</div>
              ) : (
                rows.map((l) => (
                  <ListingCard key={l.id} listing={l} variant="row" homeMode featuredSection />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function emptyEmlakVasitaBuckets(): EmlakVasitaBucket[] {
  return [
    { id: "konut", name: "Emlak", category: "konut", listings: [] },
    { id: "arac", name: "Vasıta", category: "arac", listings: [] },
  ];
}
