"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PREMIUM_CATEGORY_SEEDS,
  childPremiumSlug,
  filterPremiumSeedsByEnabled,
  isPremiumCategorySlug,
} from "@/data/premiumCategories";
import type { CategoryLadderValue } from "@/components/CategoryLadderPicker";

type Props = {
  value: CategoryLadderValue;
  onChange: (next: CategoryLadderValue) => void;
  disabled?: boolean;
};

/** Premium kapasite kategori merdiveni: dikey → alt kategori (yalnızca açık dikeyler) */
export function PremiumCategoryLadderPicker({ value, onChange, disabled }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        if (d?.premiumVerticals && typeof d.premiumVerticals === "object") {
          setEnabled(d.premiumVerticals);
        } else {
          setEnabled({});
        }
      })
      .catch(() => setEnabled({}));
  }, []);

  const roots = useMemo(() => filterPremiumSeedsByEnabled(enabled), [enabled]);
  const selectedRoot = useMemo(() => {
    return roots.find(
      (r) => value.categorySlug === r.slug || value.categorySlug.startsWith(`${r.slug}-`)
    );
  }, [roots, value.categorySlug]);

  if (enabled && !roots.length) {
    return (
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
        Şu an açık premium dikey yok. Genel veya alışveriş kategori ilanı kullanın.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {roots.map((r) => {
          const active = selectedRoot?.slug === r.slug;
          return (
            <button
              key={r.slug}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange({
                  categorySlug: r.slug,
                  dealType: "SATILIK",
                  subtype: "",
                  rentalPeriod: "",
                  brand: "",
                  model: "",
                  trim: "",
                });
              }}
              style={{
                border: active ? "1.5px solid var(--orange)" : "1px solid #e2e8f0",
                background: active ? "rgba(255,106,0,0.1)" : "#fff",
                color: active ? "var(--orange)" : "#334155",
                fontWeight: 750,
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 10,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {r.name}
            </button>
          );
        })}
      </div>

      {selectedRoot ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 2 }}>
          {selectedRoot.children.map((c) => {
            const slug = childPremiumSlug(selectedRoot.slug, c.slug);
            const active = value.categorySlug === slug;
            return (
              <button
                key={slug}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    categorySlug: slug,
                    dealType: "SATILIK",
                    subtype: "",
                    rentalPeriod: "",
                    brand: "",
                    model: "",
                    trim: "",
                  })
                }
                style={{
                  border: active ? "1.5px solid var(--orange)" : "1px solid #e2e8f0",
                  background: active ? "rgba(255,106,0,0.08)" : "#f8fafc",
                  color: active ? "var(--orange)" : "#475569",
                  fontWeight: active ? 800 : 600,
                  fontSize: 12.5,
                  padding: "7px 11px",
                  borderRadius: 8,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Önce bir premium dikey seçin.</div>
      )}

      {value.categorySlug && !isPremiumCategorySlug(value.categorySlug) ? (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>Premium kategori seçmelisiniz.</div>
      ) : null}
    </div>
  );
}

export function isPremiumCategoryLadderComplete(value: CategoryLadderValue): boolean {
  if (!isPremiumCategorySlug(value.categorySlug)) return false;
  return PREMIUM_CATEGORY_SEEDS.some(
    (r) =>
      value.categorySlug === r.slug ||
      r.children.some((c) => childPremiumSlug(r.slug, c.slug) === value.categorySlug)
  );
}
