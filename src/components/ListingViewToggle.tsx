"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

export type ListingViewMode = "grid" | "list";

export function useListingView(storageKey: string, defaultView: ListingViewMode = "grid") {
  const [view, setView] = useState<ListingViewMode>(defaultView);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function changeView(next: ListingViewMode) {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  return { view, changeView };
}

export function ListingViewToggle({
  view,
  onChange,
  compact = false,
}: {
  view: ListingViewMode;
  onChange: (next: ListingViewMode) => void;
  /** v2: sadece ikon, kare butonlar */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="v2-view-toggle" role="group" aria-label="Görünüm">
        <button
          type="button"
          onClick={() => onChange("grid")}
          title="Kare görünüm"
          aria-pressed={view === "grid"}
          className={view === "grid" ? "active" : undefined}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          type="button"
          onClick={() => onChange("list")}
          title="Liste görünüm"
          aria-pressed={view === "list"}
          className={view === "list" ? "active" : undefined}
        >
          <List size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="card listing-view-toggle"
      style={{
        display: "inline-flex",
        padding: 4,
        gap: 4,
        borderRadius: 12,
      }}
      role="group"
      aria-label="Görünüm"
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        title="Kare görünüm"
        aria-pressed={view === "grid"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 9,
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          background: view === "grid" ? "#fff7ed" : "transparent",
          color: view === "grid" ? "var(--orange)" : "#64748b",
        }}
      >
        <LayoutGrid size={16} /> Kare
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        title="Liste görünüm"
        aria-pressed={view === "list"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 9,
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          background: view === "list" ? "#fff7ed" : "transparent",
          color: view === "list" ? "var(--orange)" : "#64748b",
        }}
      >
        <List size={16} /> Liste
      </button>
    </div>
  );
}
