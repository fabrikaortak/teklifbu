"use client";

import {
  SHOP_FOCUS_ROOTS,
  shopFocusSubsFor,
  validateShopFocus,
  type ShopFocus,
  type ShopFocusRoot,
} from "@/data/shopFocus";

type Props = {
  value: ShopFocus;
  onChange: (next: ShopFocus) => void;
  disabled?: boolean;
  /** Eksik seçimde kırmızı uyarı göster */
  showError?: boolean;
};

export function ShopFocusPicker({ value, onChange, disabled, showError }: Props) {
  const subs = shopFocusSubsFor(value.root);
  const focusErr = validateShopFocus(value);
  const incomplete = Boolean(focusErr);
  const warn = Boolean(showError && incomplete);

  function setRoot(root: ShopFocusRoot) {
    onChange({ root, sub: "", otherNote: "" });
  }

  function setSub(sub: string) {
    onChange({
      ...value,
      sub,
      otherNote: sub === "diger" ? value.otherNote : "",
    });
  }

  return (
    <div
      id="shop-focus-picker"
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        border: warn ? "2px solid #dc2626" : "1px solid #e2e8f0",
        background: warn ? "#fef2f2" : "#f8fafc",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
          Mağaza kategori seçimi <span style={{ color: "#dc2626" }}>*</span>
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 800,
              color: "#b91c1c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Zorunlu
          </span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Ana kategori ve alt kategori seçmeden kurumsal kayıt tamamlanamaz.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SHOP_FOCUS_ROOTS.map((r) => {
          const active = value.root === r.id;
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => setRoot(r.id)}
              style={{
                border: active ? "2px solid #ea580c" : "1px solid #cbd5e1",
                background: active ? "#fff7ed" : "#fff",
                color: active ? "#c2410c" : "#334155",
                borderRadius: 999,
                padding: "8px 14px",
                fontWeight: 800,
                fontSize: 13,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {value.root ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 750, color: "#475569" }}>
            Alt kategori <span style={{ color: "#dc2626" }}>*</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {subs.map((s) => {
              const active = value.sub === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSub(s.id)}
                  style={{
                    border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: active ? "#eff6ff" : "#fff",
                    color: active ? "#1d4ed8" : "#475569",
                    borderRadius: 10,
                    padding: "7px 12px",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {value.sub === "diger" ? (
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            Diğer — açıklama <span style={{ color: "#dc2626" }}>*</span>
          </span>
          <textarea
            className="input"
            disabled={disabled}
            rows={2}
            value={value.otherNote}
            onChange={(e) => onChange({ ...value, otherNote: e.target.value })}
            placeholder="Mağazanızda hangi ürün / hizmetleri sunacağınızı yazın"
            style={{ resize: "vertical", minHeight: 64 }}
            required
          />
        </label>
      ) : null}

      {warn && focusErr ? (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b91c1c" }}>{focusErr}</div>
      ) : null}
    </div>
  );
}
