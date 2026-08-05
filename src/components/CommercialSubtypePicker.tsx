"use client";

import { useEffect, useState } from "react";
import type { CommercialSubtype } from "@/lib/accountTypes";
import { COMMERCIAL_SUBTYPE_LABELS, COMMERCIAL_SUBTYPES } from "@/lib/accountTypes";

type Props = {
  value: CommercialSubtype[];
  onChange: (next: CommercialSubtype[]) => void;
  disabled?: boolean;
};

type Opt = { key: string; label: string };

export function CommercialSubtypePicker({ value, onChange, disabled }: Props) {
  const [options, setOptions] = useState<Opt[]>(() =>
    COMMERCIAL_SUBTYPES.map((key) => ({
      key,
      label: COMMERCIAL_SUBTYPE_LABELS[key] || key,
    }))
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/commercial-business-types");
        if (!res.ok) return;
        const json = await res.json();
        const types = Array.isArray(json.types) ? json.types : [];
        if (!cancelled && types.length) {
          setOptions(
            types.map((t: { key: string; label: string }) => ({
              key: String(t.key).toUpperCase(),
              label: String(t.label || t.key),
            }))
          );
        }
      } catch {
        /* fallback defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(sub: string) {
    if (disabled) return;
    if (value.includes(sub)) onChange(value.filter((x) => x !== sub));
    else onChange([...value, sub]);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
        Kurumsal faaliyet alanları <span style={{ color: "#dc2626" }}>*</span>{" "}
        <span style={{ color: "#b91c1c", fontWeight: 800 }}>(zorunlu)</span>
        <span style={{ fontWeight: 500 }}> — birden fazla seçebilirsiniz</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const on = value.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt.key)}
              style={{
                border: on ? "1.5px solid var(--orange)" : "1px solid #e2e8f0",
                background: on ? "rgba(255,106,0,0.1)" : "#fff",
                color: on ? "var(--orange)" : "#334155",
                fontWeight: on ? 800 : 600,
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 10,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
