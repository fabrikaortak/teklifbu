"use client";

import Link from "next/link";
import { Hotel, Truck, Users } from "lucide-react";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { PREMIUM_CATEGORY_SEEDS, type PremiumVertical } from "@/data/premiumCategories";
import { formatCompact } from "@/lib/format";

const ICONS: Record<PremiumVertical, typeof Hotel> = {
  hotel: Hotel,
  logistics: Truck,
  rideshare: Users,
};

export type PremiumHomeLimits = Record<PremiumVertical, number>;

type VerticalBucket = {
  vertical: PremiumVertical;
  slug: string;
  name: string;
  listings: ListingCardData[];
};

type Props = {
  buckets: VerticalBucket[];
  limits: PremiumHomeLimits;
  activeCategory?: string;
  onSelectVertical: (slug: string) => void;
};

export function PremiumVerticalCards({ buckets, limits, activeCategory, onSelectVertical }: Props) {
  return (
    <div className="premium-vitrin featured-vitrin" aria-label="Premium öne çıkanlar">
      {buckets.map((b) => {
        const Icon = ICONS[b.vertical];
        const limit = Math.min(12, Math.max(1, limits[b.vertical] || 4));
        const rows = b.listings.slice(0, limit);
        const active =
          activeCategory === b.slug || Boolean(activeCategory?.startsWith(`${b.slug}-`));

        return (
          <section
            key={b.vertical}
            className={`premium-vitrin-card${active ? " is-active" : ""}`}
          >
            <header className="premium-vitrin-head">
              <button type="button" className="premium-vitrin-title" onClick={() => onSelectVertical(b.slug)}>
                <Icon size={18} strokeWidth={2.25} />
                <span>{b.name}</span>
                <em>{formatCompact(b.listings.length)}+</em>
              </button>
              <Link href={`/premium?category=${encodeURIComponent(b.slug)}`} className="premium-vitrin-more">
                Tümü
              </Link>
            </header>
            <div
              className="premium-vitrin-rows"
              style={{
                // Satır sayısı kadar alan; admin limit’i kart boyunu belirler
                minHeight: rows.length ? undefined : 72,
              }}
            >
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

export function emptyPremiumBuckets(): VerticalBucket[] {
  return PREMIUM_CATEGORY_SEEDS.map((r) => ({
    vertical: r.vertical,
    slug: r.slug,
    name: r.name,
    listings: [],
  }));
}
