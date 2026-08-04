"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTl } from "@/lib/format";
import { listingHasBids, isLiveListingStatus } from "@/lib/listingStatus";
import type { ListingCardData } from "@/components/ListingCard";

type RowListing = ListingCardData & {
  status?: string;
  durationDays?: number;
  endsAt?: string | Date | null;
  highestBid?: number | null;
  bidCount?: number | null;
};

type Draft = { title: string; askPrice: string; durationDays: string };

type Props = {
  listings: RowListing[];
  onSubmitted?: () => void;
  /** Sekme satırından açıldığında tetikleyici gizlenir; panel her zaman gösterilir */
  embedded?: boolean;
};

export function CommercialBulkListingUpdate({ listings, onSubmitted, embedded }: Props) {
  const eligible = useMemo(
    () =>
      listings.filter(
        (l) => isLiveListingStatus(l.status) && !listingHasBids(l)
      ),
    [listings]
  );

  const [open, setOpen] = useState(Boolean(embedded));
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [applyTitle, setApplyTitle] = useState("");
  const [applyPrice, setApplyPrice] = useState("");
  const [applyDays, setApplyDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const nextSel: Record<string, boolean> = {};
    const nextDraft: Record<string, Draft> = {};
    for (const l of eligible) {
      nextSel[l.id] = true;
      nextDraft[l.id] = {
        title: l.title || "",
        askPrice: String(l.askPrice ?? ""),
        durationDays: String(l.durationDays ?? 7),
      };
    }
    setSelected(nextSel);
    setDrafts(nextDraft);
  }, [eligible]);

  const selectedIds = eligible.filter((l) => selected[l.id]).map((l) => l.id);
  const hasEligible = eligible.length > 0;

  function setDraft(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function applyToSelected() {
    setDrafts((d) => {
      const next = { ...d };
      for (const id of selectedIds) {
        next[id] = {
          title: applyTitle.trim() ? applyTitle : next[id]?.title || "",
          askPrice: applyPrice.trim() ? applyPrice : next[id]?.askPrice || "",
          durationDays: applyDays.trim() ? applyDays : next[id]?.durationDays || "7",
        };
      }
      return next;
    });
  }

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const l of eligible) next[l.id] = on;
    setSelected(next);
  }

  async function submit() {
    setError("");
    setMsg("");
    if (!selectedIds.length) {
      setError("En az bir ilan seçin");
      return;
    }
    const items = selectedIds.map((id) => {
      const d = drafts[id];
      return {
        listingId: id,
        title: d?.title,
        askPrice: Number(String(d?.askPrice || "").replace(/\D/g, "")) || 0,
        durationDays: Number(d?.durationDays) || 7,
      };
    });
    setBusy(true);
    try {
      const res = await fetch("/api/listings/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gönderilemedi");
        return;
      }
      setMsg(data.message || "Onaya gönderildi");
      setOpen(false);
      onSubmitted?.();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  const showPanel = embedded || open;

  return (
    <div className="card" style={{ padding: 14, marginTop: embedded ? 0 : undefined, marginBottom: 12, display: "grid", gap: 10 }}>
      {!embedded ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <strong style={{ fontSize: 14 }}>Toplu güncelleme</strong>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              İlan adı, fiyat ve geçerlilik süresini seçili ilanlarda hızlıca değiştirin. Yönetici
              onayına düşer.
            </div>
          </div>
          <button
            type="button"
            className={open ? "btn-outline" : "btn-orange"}
            style={{ padding: "8px 12px", fontSize: 13 }}
            disabled={!hasEligible}
            title={
              hasEligible
                ? undefined
                : "Yayında ve teklifsiz ilanınız olduğunda kullanılabilir"
            }
            onClick={() => hasEligible && setOpen((v) => !v)}
          >
            {open ? "Kapat" : "Toplu güncelle"}
          </button>
        </div>
      ) : (
        <div>
          <strong style={{ fontSize: 14 }}>Toplu güncelleme</strong>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            İlan adı, fiyat ve geçerlilik süresini seçili ilanlarda hızlıca değiştirin. Yönetici
            onayına düşer.
          </div>
        </div>
      )}

      {!hasEligible ? (
        <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>
          Şu an toplu düzenlenecek yayında ilan yok. Teklif almış veya yayında olmayan ilanlar bu
          işleme dahil edilmez. Yayına ilan verdikten sonra burada görünecek.
        </div>
      ) : null}

      {msg ? <div style={{ color: "#166534", fontWeight: 700, fontSize: 13 }}>{msg}</div> : null}
      {error ? <div style={{ color: "#b91c1c", fontWeight: 700, fontSize: 13 }}>{error}</div> : null}

      {showPanel && hasEligible ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.7fr auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
              Tümüne ilan adı
              <input
                className="input"
                value={applyTitle}
                onChange={(e) => setApplyTitle(e.target.value)}
                placeholder="Boş bırakırsanız değişmez"
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
              Tümüne fiyat
              <input
                className="input"
                inputMode="numeric"
                value={applyPrice}
                onChange={(e) => setApplyPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="₺"
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
              Tümüne süre (gün)
              <input
                className="input"
                inputMode="numeric"
                value={applyDays}
                onChange={(e) => setApplyDays(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="7–90"
              />
            </label>
            <button type="button" className="btn-outline" style={{ padding: "10px 12px" }} onClick={applyToSelected}>
              Seçililere uygula
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, fontSize: 13 }}>
            <button type="button" className="btn-outline" style={{ padding: "6px 10px" }} onClick={() => toggleAll(true)}>
              Tümünü seç
            </button>
            <button type="button" className="btn-outline" style={{ padding: "6px 10px" }} onClick={() => toggleAll(false)}>
              Seçimi kaldır
            </button>
            <span style={{ color: "var(--muted)", alignSelf: "center" }}>
              {selectedIds.length} / {eligible.length} seçili
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: 8, width: 36 }} />
                  <th style={{ padding: 8 }}>İlan adı</th>
                  <th style={{ padding: 8, width: 120 }}>Fiyat</th>
                  <th style={{ padding: 8, width: 90 }}>Süre (gün)</th>
                  <th style={{ padding: 8, width: 110 }}>Mevcut</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((l) => {
                  const d = drafts[l.id] || { title: "", askPrice: "", durationDays: "7" };
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[l.id])}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [l.id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          className="input"
                          value={d.title}
                          onChange={(e) => setDraft(l.id, { title: e.target.value })}
                          disabled={!selected[l.id]}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={d.askPrice}
                          onChange={(e) =>
                            setDraft(l.id, { askPrice: e.target.value.replace(/\D/g, "") })
                          }
                          disabled={!selected[l.id]}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={d.durationDays}
                          onChange={(e) =>
                            setDraft(l.id, {
                              durationDays: e.target.value.replace(/\D/g, "").slice(0, 2),
                            })
                          }
                          disabled={!selected[l.id]}
                        />
                      </td>
                      <td style={{ padding: 8, color: "#64748b", fontSize: 12 }}>
                        {formatTl(l.askPrice)} · {l.durationDays || 7}g
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="btn-orange"
            style={{ padding: 12, justifySelf: "start" }}
            disabled={busy || !selectedIds.length}
            onClick={() => void submit()}
          >
            {busy ? "Gönderiliyor..." : `Onaya gönder (${selectedIds.length} ilan)`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
