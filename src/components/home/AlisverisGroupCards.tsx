"use client";

import Link from "next/link";
import { Smartphone, Sofa, Shirt, Bike, Package, type LucideIcon } from "lucide-react";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { ALISVERIS_BROWSE_TREE } from "@/data/classicBrowseTree";
import { formatCompact } from "@/lib/format";

const ICONS: Record<string, LucideIcon> = {
  elektronik: Smartphone,
  "ev-yasam": Sofa,
  moda: Shirt,
  hobi: Bike,
  diger: Package,
};

type GroupBucket = {
  id: string;
  name: string;
  category: string;
  listings: ListingCardData[];
};

type Props = {
  buckets: GroupBucket[];
  limit?: number;
  activeCategory?: string;
  onSelectGroup: (category: string) => void;
};

export function AlisverisGroupCards({ buckets, limit = 4, activeCategory, onSelectGroup }: Props) {
  return (
    <div className="premium-vitrin featured-vitrin" aria-label="Alışveriş öne çıkanlar">
      {buckets.map((b) => {
        const Icon = ICONS[b.id] || Package;
        const take = Math.min(12, Math.max(1, limit));
        const rows = b.listings.slice(0, take);
        const active =
          activeCategory === b.category ||
          activeCategory === b.id ||
          Boolean(
            activeCategory &&
              b.category.split(",").some((p) => p && (activeCategory === p || activeCategory.startsWith(`${p}-`)))
          );

        return (
          <section key={b.id} className={`premium-vitrin-card${active ? " is-active" : ""}`}>
            <header className="premium-vitrin-head">
              <button type="button" className="premium-vitrin-title" onClick={() => onSelectGroup(b.category)}>
                <Icon size={18} strokeWidth={2.25} />
                <span>{b.name}</span>
                <em>{formatCompact(b.listings.length)}+</em>
              </button>
              <Link
                href={`/alisveris?category=${encodeURIComponent(b.category)}`}
                className="premium-vitrin-more"
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

export function emptyAlisverisBuckets(): GroupBucket[] {
  return ALISVERIS_BROWSE_TREE.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.filter.category || n.id,
    listings: [],
  }));
}
