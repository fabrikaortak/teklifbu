"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, X } from "lucide-react";
import { formatTl } from "@/lib/format";
import { normalizeBillingType } from "@/lib/shopPackageBilling";
import { useTokenBuyGate } from "@/hooks/useTokenBuyGate";

export type ShopPackageCard = {
  id: string;
  name: string;
  billingType?: string;
  monthlyPrice: number;
  tokenPrice?: number | null;
  listingLimit: number;
  minDays?: number;
  maxDays?: number;
  description: string | null;
  premiumDiscountPercent: number;
};

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onPurchased?: () => void;
};

export function ShopPackageBuyModal({
  open,
  title = "İlan paketi gerekli",
  description = "İlan vermek için paket seçip satın alabilirsiniz. Günlük paketlerde istediğiniz gün sayısını seçersiniz.",
  onClose,
  onPurchased,
}: Props) {
  const [packages, setPackages] = useState<ShopPackageCard[]>([]);
  const [months, setMonths] = useState(1);
  const [years, setYears] = useState(1);
  const [days, setDays] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [buyEnabled, setBuyEnabled] = useState(true);
  const [tokensOnly, setTokensOnly] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const { tokenModal, handleFetchResult, ensureTokens, setTokenBalance: setGateBalance } =
    useTokenBuyGate({
      continueLabel: "Pakete dön",
      title: "Paket için jeton gerekli",
      description:
        "Seçilen paket için bakiyeniz yetersiz. Jeton yükledikten sonra paketi tekrar alabilirsiniz.",
      onPurchased: (bal) => {
        setTokenBalance(bal);
        setGateBalance(bal);
      },
    });

  useEffect(() => {
    if (!open) return;
    setError("");
    setMsg("");
    setLoadingList(true);
    fetch("/api/shop-packages")
      .then((r) => r.json())
      .then((d) => {
        setBuyEnabled(d.buyPopupEnabled !== false);
        setTokensOnly(d.tokensOnly === true || d.demoPosEnabled === false);
        setTokenBalance(Number(d.tokenBalance) || 0);
        setGateBalance(Number(d.tokenBalance) || 0);
        const list: ShopPackageCard[] = Array.isArray(d.packages) ? d.packages : [];
        setPackages(list);
        setCurrentName(d.current?.packageName || null);
        if (list[0]?.id) {
          setSelectedId(list[0].id);
          setDays(Math.max(1, Number(list[0].minDays) || 1));
        }
      })
      .catch(() => setError("Paketler yüklenemedi"))
      .finally(() => setLoadingList(false));
  }, [open, setGateBalance]);

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) || null,
    [packages, selectedId]
  );
  const daily = selected ? normalizeBillingType(selected.billingType) === "DAILY" : false;
  const yearly = selected ? normalizeBillingType(selected.billingType) === "YEARLY" : false;
  const minD = Math.max(1, Number(selected?.minDays) || 1);
  const maxD = Math.max(minD, Number(selected?.maxDays) || 30);
  const qty = daily ? Math.max(minD, Math.min(maxD, days)) : yearly ? years : months;
  const totalTl = selected ? selected.monthlyPrice * qty : 0;
  const unitTokens =
    selected?.tokenPrice != null && Number(selected.tokenPrice) > 0
      ? Math.floor(Number(selected.tokenPrice))
      : 0;
  const totalTokens = selected && tokensOnly ? unitTokens * qty : 0;

  useEffect(() => {
    if (!selected || !daily) return;
    setDays((d) => Math.max(minD, Math.min(maxD, d || minD)));
  }, [selectedId, daily, minD, maxD, selected]);

  if (!open) return null;

  async function buy() {
    if (!selectedId || !selected) {
      setError("Paket seçin");
      return;
    }
    if (tokensOnly) {
      if (totalTokens <= 0) {
        setError("Bu paket için jeton fiyatı yok.");
        return;
      }
      if (!ensureTokens(tokenBalance, totalTokens)) return;
    }

    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/shop-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          packageId: selectedId,
          months: daily || yearly ? undefined : months,
          days: daily ? days : undefined,
          years: yearly ? years : undefined,
          payWithTokens: tokensOnly,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (handleFetchResult(res, data, totalTokens || 1)) return;
      if (!res.ok) {
        setError((data as { error?: string }).error || "Satın alma başarısız");
        return;
      }
      if (typeof (data as { tokensSpent?: number }).tokensSpent === "number") {
        setTokenBalance((b) => Math.max(0, b - Number((data as { tokensSpent: number }).tokensSpent)));
      }
      setMsg((data as { message?: string }).message || "Paket aktifleştirildi.");
      window.dispatchEvent(new Event("teklifbu:auth"));
      onPurchased?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      {tokenModal}
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          padding: 0,
          overflow: "hidden",
          textAlign: "left",
        }}
      >
        <div style={{ padding: "18px 20px 14px", position: "relative", borderBottom: "1px solid #eef2f7" }}>
          <button
            type="button"
            aria-label="Kapat"
            disabled={loading}
            onClick={onClose}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              border: "none",
              background: "#f1f5f9",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#64748b",
            }}
          >
            <X size={16} />
          </button>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(145deg,#ffedd5,#fed7aa)",
              color: "#c2410c",
              display: "grid",
              placeItems: "center",
              marginBottom: 10,
            }}
          >
            <Building2 size={20} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{title}</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#64748b", lineHeight: 1.5, paddingRight: 28 }}>
            {description}
          </p>
          {tokensOnly ? (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#c2410c", fontWeight: 700 }}>
              Demo POS kapalı — paketler yalnızca jeton ile alınır · Bakiyeniz: {tokenBalance} jeton
            </p>
          ) : null}
          {currentName ? (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#0f172a", fontWeight: 700 }}>
              Mevcut paket: {currentName}
            </p>
          ) : null}
        </div>

        <div style={{ padding: 18, display: "grid", gap: 12 }}>
          {!buyEnabled ? (
            <div style={{ color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>
              Paket satın alma şu an kapalı. Lütfen yöneticiyle iletişime geçin.
            </div>
          ) : loadingList ? (
            <div style={{ color: "#64748b", fontSize: 14 }}>Paketler yükleniyor…</div>
          ) : !packages.length ? (
            <div style={{ color: "#64748b", fontSize: 14 }}>
              Satın alınabilir aktif paket yok. Yönetici paket tanımlamalı.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {packages.map((p) => {
                const on = p.id === selectedId;
                const isDaily = normalizeBillingType(p.billingType) === "DAILY";
                const isYearly = normalizeBillingType(p.billingType) === "YEARLY";
                const tok =
                  p.tokenPrice != null && Number(p.tokenPrice) > 0
                    ? Math.floor(Number(p.tokenPrice))
                    : 0;
                const unitLabel = isDaily ? "/ gün" : isYearly ? "/ yıl" : "/ ay";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setDays(Math.max(1, Number(p.minDays) || 1));
                    }}
                    style={{
                      textAlign: "left",
                      border: on ? "1.5px solid #fb923c" : "1px solid #e2e8f0",
                      background: on ? "#fff7ed" : "#fff",
                      borderRadius: 12,
                      padding: "12px 14px",
                      cursor: "pointer",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 800 }}>
                      <span>{p.name}</span>
                      <span style={{ textAlign: "right", color: tokensOnly ? "#c2410c" : undefined }}>
                        {tokensOnly
                          ? `${tok} jeton ${unitLabel}`
                          : `${formatTl(p.monthlyPrice)} ${unitLabel}`}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>
                      {isDaily ? "Günlük" : isYearly ? "Yıllık" : "Aylık"} · {p.listingLimit} ilan hakkı
                      {isDaily ? ` · ${p.minDays || 1}–${p.maxDays || 30} gün` : ""}
                      {p.premiumDiscountPercent > 0
                        ? ` · Premium %${p.premiumDiscountPercent} indirim`
                        : ""}
                    </div>
                    {p.description ? (
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{p.description}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {buyEnabled && selected ? (
            daily ? (
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                Kaç gün? ({minD}–{maxD})
                <input
                  className="input"
                  type="number"
                  min={minD}
                  max={maxD}
                  value={days}
                  disabled={loading}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
                <span style={{ fontWeight: 500, color: "#64748b" }}>
                  {tokensOnly
                    ? `${qty} gün × ${unitTokens} jeton = ${totalTokens} jeton`
                    : `${qty} gün × ${formatTl(selected.monthlyPrice)} = ${formatTl(totalTl)}`}
                </span>
              </label>
            ) : yearly ? (
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                Süre (yıl)
                <select
                  className="select"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  disabled={loading}
                >
                  {[1, 2, 3, 5].map((y) => (
                    <option key={y} value={y}>
                      {y} yıl
                    </option>
                  ))}
                </select>
                <span style={{ fontWeight: 500, color: "#64748b" }}>
                  {tokensOnly
                    ? `${years} yıl × ${unitTokens} jeton = ${totalTokens} jeton`
                    : `${years} yıl × ${formatTl(selected.monthlyPrice)} = ${formatTl(totalTl)}`}
                </span>
              </label>
            ) : (
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                Süre (ay)
                <select
                  className="select"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  disabled={loading}
                >
                  {[1, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>
                      {m} ay
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : null}

          {selected && buyEnabled ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "10px 12px",
                background: "#f8fafc",
                borderRadius: 10,
                fontWeight: 800,
              }}
            >
              <span style={{ color: "#64748b", fontWeight: 600 }}>Ödenecek</span>
              <span style={{ color: "#c2410c", fontSize: 18 }}>
                {tokensOnly ? `${totalTokens} jeton` : formatTl(totalTl)}
              </span>
            </div>
          ) : null}

          {error ? <div style={{ color: "#b91c1c", fontSize: 13.5, fontWeight: 600 }}>{error}</div> : null}
          {msg ? <div style={{ color: "#15803d", fontSize: 13.5, fontWeight: 600 }}>{msg}</div> : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-outline" style={{ flex: 1, padding: 12 }} disabled={loading} onClick={onClose}>
              Vazgeç
            </button>
            {buyEnabled && packages.length > 0 ? (
              <button
                type="button"
                className="btn-orange"
                style={{ flex: 1, padding: 12, fontWeight: 800 }}
                disabled={loading || !selectedId || (tokensOnly && totalTokens <= 0)}
                onClick={() => void buy()}
              >
                {loading
                  ? "İşleniyor…"
                  : tokensOnly
                    ? `Jetonla al (${totalTokens})`
                    : "Paket al"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
