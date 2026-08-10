"use client";

import { useEffect, useState } from "react";

type Q = {
  id: string;
  body: string;
  answerBody: string | null;
  answeredAt: string | null;
  createdAt: string;
  askerName: string;
};

export function ListingQuestionsBlock({ listingId }: { listingId: string }) {
  const [items, setItems] = useState<Q[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    fetch(`/api/listings/${encodeURIComponent(listingId)}/questions`)
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled !== false);
        setItems(Array.isArray(d.questions) ? d.questions : []);
      })
      .catch(() => setEnabled(false));
  }

  useEffect(() => {
    load();
  }, [listingId]);

  if (enabled === false) return null;
  if (enabled === null) return null;

  async function ask() {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.error || "Soru gönderilemedi");
        return;
      }
      setBody("");
      setMsg("Sorunuz iletildi. Satıcı yanıtladığında burada görünür.");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 850 }}>Ürün soruları</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Satıcıya ürün hakkında soru sorun. Yanıtlar herkese açıktır.
        </p>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Henüz soru yok.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((q) => (
            <div
              key={q.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {q.askerName}: {q.body}
              </div>
              <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>
                {new Date(q.createdAt).toLocaleString("tr-TR")}
              </div>
              {q.answerBody ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 10,
                    background: "#ecfdf5",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Satıcı:</strong> {q.answerBody}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12.5, color: "#b45309", fontWeight: 700 }}>
                  Yanıt bekleniyor
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <textarea
          className="input"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Örn. Kargo ücreti alıcıya mı ait?"
          style={{ resize: "vertical" }}
        />
        <button
          type="button"
          className="btn-orange"
          style={{ padding: "10px 14px", width: "fit-content" }}
          disabled={busy || body.trim().length < 5}
          onClick={() => void ask()}
        >
          {busy ? "Gönderiliyor…" : "Soru sor"}
        </button>
        {msg ? <div style={{ fontSize: 13, fontWeight: 650, color: "#166534" }}>{msg}</div> : null}
      </div>
    </section>
  );
}
