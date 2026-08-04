"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTl } from "@/lib/format";

export default function TokensPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [customAmount, setCustomAmount] = useState("10");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/tokens");
    if (res.status === 401) {
      router.push("/giris");
      return;
    }
    const json = await res.json();
    setData(json);
    if (json.quickToken?.presets?.[0]) {
      setCustomAmount(String(json.quickToken.presets[0]));
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Hata");
        return;
      }
      setMsg(`+${json.added} jeton eklendi. Yeni bakiye: ${json.balance}`);
      window.dispatchEvent(new Event("teklifbu:auth"));
      await load();
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <div style={{ padding: 40 }}>Yükleniyor...</div>;

  const quick = data.quickToken || { enabled: false, presets: [], max: 10000, pricePerTokenTl: 0 };
  const priceHint =
    quick.pricePerTokenTl > 0 ? ` · ${formatTl(quick.pricePerTokenTl)} / jeton` : " · ücretsiz / demo";

  return (
    <div className="page-shell" style={{ marginTop: 32, paddingBottom: 40 }}>
      <h1 style={{ fontWeight: 900 }}>Jeton Al</h1>
      <p style={{ color: "var(--muted)" }}>
        Bakiyeniz: <strong>{data.balance}</strong> jeton.
      </p>
      {msg && <div style={{ color: "var(--green)", fontWeight: 700, marginBottom: 12 }}>{msg}</div>}
      {error && <div style={{ color: "#dc2626", fontWeight: 700, marginBottom: 12 }}>{error}</div>}

      {quick.enabled && (
        <div className="card" style={{ padding: 18, marginBottom: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>Hızlı jeton al{priceHint}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(quick.presets || []).map((n: number) => (
              <button
                key={n}
                type="button"
                className="btn-outline"
                disabled={loading}
                style={{ padding: "8px 12px" }}
                onClick={() => claim(n)}
              >
                +{n}
                {quick.pricePerTokenTl > 0 ? ` (${formatTl(n * quick.pricePerTokenTl)})` : ""}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
            <input
              className="input"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
              placeholder={`Özel miktar (max ${quick.max})`}
            />
            <button
              type="button"
              className="btn-orange"
              disabled={loading || !Number(customAmount)}
              style={{ padding: "10px 16px", whiteSpace: "nowrap" }}
              onClick={() => claim(Number(customAmount))}
            >
              Jeton Al
            </button>
          </div>
        </div>
      )}

      {!quick.enabled && (
        <div style={{ marginBottom: 16, fontSize: 14, color: "var(--muted)" }}>
          Hızlı jeton alımı kapalı. Aşağıdaki paketlerden seçim yapabilirsiniz.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
        {data.packages.map((p: any) => (
          <div key={p.id} className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 800 }}>{p.name}</div>
            {p.description ? (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
                {p.description}
              </div>
            ) : null}
            <div style={{ fontSize: 36, fontWeight: 900, margin: "10px 0" }}>{p.tokenAmount}</div>
            <div style={{ color: "var(--muted)", marginBottom: 12 }}>{formatTl(p.priceTl)}</div>
            <button
              className="btn-orange"
              style={{ width: "100%", padding: 12 }}
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError("");
                setMsg("");
                try {
                  const res = await fetch("/api/tokens", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ packageId: p.id }),
                  });
                  const json = await res.json();
                  if (!res.ok) return setError(json.error || "Hata");
                  setMsg(`+${json.added} jeton. Yeni bakiye: ${json.balance}`);
                  window.dispatchEvent(new Event("teklifbu:auth"));
                  await load();
                } finally {
                  setLoading(false);
                }
              }}
            >
              Paketi Al
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
