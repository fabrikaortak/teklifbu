"use client";

import { useEffect, useState } from "react";
import { Coins, Sparkles, X } from "lucide-react";
import { formatTl } from "@/lib/format";

type TokenPackage = {
  id: string;
  name: string;
  tokenAmount: number;
  priceTl: number;
};

type QuickToken = {
  enabled: boolean;
  presets: number[];
  max: number;
  pricePerTokenTl: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  requiredTokens?: number;
  balance?: number;
  onPurchased?: (balance: number) => void;
  /** Yeterli bakiyede kapatma butonu metni */
  continueLabel?: string;
  /** Modal başlığı — örn. "Bu işlem için jeton gerekli" */
  title?: string;
  /** Modal açıklaması */
  description?: string;
};

export function TokenBuyModal({
  open,
  onClose,
  requiredTokens = 1,
  balance = 0,
  onPurchased,
  continueLabel = "Devam et",
  title = "Bu işlem için jeton gerekli",
  description = "Bakiyeniz bu işlem için yetersiz. Jeton yükledikten sonra kaldığınız yerden devam edebilirsiniz.",
}: Props) {
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [quick, setQuick] = useState<QuickToken>({
    enabled: true,
    presets: [1, 5, 10, 25, 50, 100],
    max: 10000,
    pricePerTokenTl: 0,
  });
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [customAmount, setCustomAmount] = useState(String(Math.max(requiredTokens, 5)));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCurrentBalance(balance);
    setCustomAmount(String(Math.max(requiredTokens, 5)));
    setMsg("");
    setError("");
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((d) => {
        if (d.packages) setPackages(d.packages);
        if (typeof d.balance === "number") setCurrentBalance(d.balance);
        if (d.quickToken) {
          setQuick(d.quickToken);
          if (d.quickToken.presets?.[0]) setCustomAmount(String(Math.max(requiredTokens, d.quickToken.presets[0])));
        }
      })
      .catch(() => undefined);
  }, [open, balance, requiredTokens]);

  if (!open) return null;

  const need = Math.max(0, requiredTokens - currentBalance);

  async function claim(amount: number) {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo_claim", amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Jeton alınamadı");
        return;
      }
      setCurrentBalance(data.balance);
      setMsg(`${data.added} jeton eklendi. Yeni bakiye: ${data.balance}`);
      window.dispatchEvent(new Event("teklifbu:auth"));
      onPurchased?.(data.balance);
    } finally {
      setLoading(false);
    }
  }

  async function buyPackage(packageId: string) {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Satın alma başarısız");
        return;
      }
      setCurrentBalance(data.balance);
      setMsg(`${data.added} jeton eklendi. Yeni bakiye: ${data.balance}`);
      window.dispatchEvent(new Event("teklifbu:auth"));
      onPurchased?.(data.balance);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal token-buy-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 100%)", padding: 0, overflow: "hidden" }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #0B1F3A 0%, #1e3a5f 55%, #c2410c 160%)",
            color: "white",
            padding: "22px 22px 18px",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              border: "none",
              background: "rgba(255,255,255,.12)",
              color: "white",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X size={16} />
          </button>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9, fontWeight: 700 }}>
            <Sparkles size={14} /> TeklifBu · Demo Jeton
          </div>
          <h2 style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
            {title}
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, opacity: 0.92, maxWidth: 380 }}>
            {description}
          </p>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              background: "#f8fafc",
              borderRadius: 12,
              padding: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Bakiyeniz</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{currentBalance}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Gerekli</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#c2410c" }}>{requiredTokens}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Eksik</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: need > 0 ? "#dc2626" : "#16a34a" }}>{need}</div>
            </div>
          </div>

          {quick.enabled && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Coins size={15} color="#ea580c" /> Hızlı jeton al
                {quick.pricePerTokenTl > 0 ? ` · ${formatTl(quick.pricePerTokenTl)} / jeton` : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(quick.presets || []).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn-outline"
                    disabled={loading}
                    onClick={() => claim(n)}
                    style={{ padding: "8px 12px", fontSize: 13 }}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  className="input"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder={`Özel miktar (max ${quick.max})`}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-orange"
                  disabled={loading || !Number(customAmount)}
                  onClick={() => claim(Number(customAmount))}
                  style={{ padding: "10px 16px", whiteSpace: "nowrap" }}
                >
                  Jeton Al
                </button>
              </div>
            </div>
          )}

          {packages.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                {quick.enabled ? "Paketler" : "Jeton paketleri"}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={loading}
                    onClick={() => buyPackage(p.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      background: "white",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{p.tokenAmount} jeton</div>
                    </div>
                    <div style={{ fontWeight: 800, color: "#ea580c" }}>{formatTl(p.priceTl)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {msg && <div style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>{msg}</div>}
          {error && <div style={{ color: "#dc2626", fontWeight: 700, fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-outline" style={{ flex: 1, padding: 12 }} onClick={onClose}>
              Kapat
            </button>
            <button
              type="button"
              className="btn-orange"
              style={{ flex: 1, padding: 12 }}
              disabled={loading || currentBalance < requiredTokens}
              onClick={onClose}
            >
              {currentBalance >= requiredTokens ? continueLabel : "Jeton Alın"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
