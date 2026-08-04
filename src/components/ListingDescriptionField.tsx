"use client";

import { useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { validateListingDescription, wrapDescriptionSelection } from "@/lib/listingDescription";

export function ListingDescriptionField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const check = validateListingDescription(value);

  function apply(kind: "bold" | "italic" | "underline") {
    const el = ref.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const next = wrapDescriptionSelection(value, start, end, kind);
    onChange(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  const btnStyle = {
    padding: "6px 10px",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
  } as const;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" className="btn-outline" style={btnStyle} disabled={disabled} onClick={() => apply("bold")} title="Kalın">
          <Bold size={15} /> Kalın
        </button>
        <button type="button" className="btn-outline" style={btnStyle} disabled={disabled} onClick={() => apply("italic")} title="İtalik">
          <Italic size={15} /> İtalik
        </button>
        <button type="button" className="btn-outline" style={btnStyle} disabled={disabled} onClick={() => apply("underline")} title="Altı çizili">
          <Underline size={15} /> Altı çizili
        </button>
      </div>
      <textarea
        ref={ref}
        className="input"
        disabled={disabled}
        style={{ minHeight: 130, whiteSpace: "pre-wrap" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Örn:\n• Merkezi konum\n• Asansörlü\n• Otopark mevcut"}
      />
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
        Kalın / italik / altı çizili için metni seçip butona basın. Telefon, e-posta ve TeklifBu dışı link
        yasaktır.
      </p>
      {!check.ok && check.error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {check.error}
        </div>
      )}
    </div>
  );
}
