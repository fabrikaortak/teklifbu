"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type Props = {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function normalizeTr(s: string) {
  return s.toLocaleLowerCase("tr-TR");
}

export function LocationSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hoverOpt, setHoverOpt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = normalizeTr(q.trim());
    if (!needle) return options;
    return options.filter((o) => normalizeTr(o).includes(needle));
  }, [options, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setHoverOpt(null);
    }
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function optionStyle(selected: boolean, hovered: boolean) {
    return {
      display: "flex",
      width: "100%",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      textAlign: "left" as const,
      padding: "9px 12px",
      border: "none",
      background: selected
        ? "rgba(249,115,22,0.14)"
        : hovered
          ? "rgba(15,23,42,0.04)"
          : "transparent",
      color: selected ? "var(--orange)" : "var(--navy)",
      fontWeight: selected ? 800 : 600,
      cursor: "pointer",
      fontSize: 13,
      boxShadow: selected ? "inset 3px 0 0 var(--orange)" : undefined,
    };
  }

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        className="select"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          color: value ? "inherit" : "#9ca3af",
          borderColor: open ? "var(--orange)" : undefined,
          boxShadow: open ? "0 0 0 2px rgba(249,115,22,0.15)" : undefined,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: open ? "var(--orange)" : "#9ca3af",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform .15s",
          }}
        />
      </button>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <Search size={15} color="#9ca3af" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${label} ara…`}
              style={{
                border: "none",
                outline: "none",
                width: "100%",
                fontSize: 14,
                background: "transparent",
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => pick("")}
              onMouseEnter={() => setHoverOpt("__empty")}
              onMouseLeave={() => setHoverOpt(null)}
              style={optionStyle(!value, hoverOpt === "__empty")}
            >
              <span>{placeholder}</span>
              {!value && <Check size={15} color="var(--orange)" strokeWidth={2.5} />}
            </button>
            {filtered.length === 0 && (
              <div style={{ padding: "12px", color: "#9ca3af", fontSize: 13 }}>Sonuç yok</div>
            )}
            {filtered.map((opt) => {
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => pick(opt)}
                  onMouseEnter={() => setHoverOpt(opt)}
                  onMouseLeave={() => setHoverOpt(null)}
                  style={optionStyle(selected, hoverOpt === opt)}
                >
                  <span>{opt}</span>
                  {selected && <Check size={15} color="var(--orange)" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
