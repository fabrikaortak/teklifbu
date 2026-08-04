"use client";

import { useEffect, useState } from "react";
import {
  ReviewRulesCard,
  acceptReviewRules,
  reviewRulesAccepted,
} from "@/components/ReviewRulesCard";

type Review = {
  id: string;
  body: string;
  rating: number | null;
  createdAt: string;
  authorName: string;
};

type Props = {
  sellerId: string;
  listingId: string;
  enabled: boolean;
  isSeller: boolean;
  me: { id: string } | null;
  onNeedLogin: () => void;
};

export function SellerReviewsPanel({
  sellerId,
  listingId,
  enabled,
  isSeller,
  me,
  onNeedLogin,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setAccepted(reviewRulesAccepted());
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setReviews([]);
      return;
    }
    setLoading(true);
    fetch(`/api/seller-reviews?sellerId=${encodeURIComponent(sellerId)}`)
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .finally(() => setLoading(false));
  }, [sellerId, enabled]);

  if (!enabled) {
    return (
      <div
        className="card"
        style={{
          padding: 28,
          textAlign: "center",
          color: "#64748b",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        Çok yakında
      </div>
    );
  }

  async function submit() {
    if (!me) {
      onNeedLogin();
      return;
    }
    if (!accepted) {
      setRulesOpen(true);
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/seller-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          listingId,
          body,
          rating,
          rulesAccepted: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Gönderilemedi");
        return;
      }
      setMsg(d.message || "Gönderildi");
      setBody("");
      const refreshed = await fetch(
        `/api/seller-reviews?sellerId=${encodeURIComponent(sellerId)}`
      ).then((r) => r.json());
      setReviews(refreshed.reviews || []);
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14, position: "relative" }}>
      <ReviewRulesCard
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onAccept={() => {
          acceptReviewRules();
          setAccepted(true);
          setRulesOpen(false);
        }}
      />

      {!isSeller ? (
        <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Yorum yaz</strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={rating === n ? "btn-orange" : "btn-outline"}
                style={{ padding: "6px 10px", fontSize: 13 }}
                onClick={() => setRating(n)}
              >
                {n}★
              </button>
            ))}
          </div>
          <textarea
            className="input"
            rows={4}
            value={body}
            placeholder={
              accepted
                ? "Deneyiminizi yazın…"
                : "Yorum yazmak için önce kuralları kabul edin"
            }
            onFocus={() => {
              if (!me) {
                onNeedLogin();
                return;
              }
              if (!accepted) setRulesOpen(true);
            }}
            onClick={() => {
              if (!me) {
                onNeedLogin();
                return;
              }
              if (!accepted) setRulesOpen(true);
            }}
            onChange={(e) => {
              if (!accepted) {
                setRulesOpen(true);
                return;
              }
              setBody(e.target.value);
            }}
            readOnly={!accepted}
          />
          <button
            type="button"
            className="btn-orange"
            style={{ padding: 12, justifySelf: "start" }}
            disabled={busy || !accepted || body.trim().length < 10}
            onClick={() => void submit()}
          >
            {busy ? "Gönderiliyor…" : "Yorumu gönder"}
          </button>
          {msg ? <div style={{ color: "#166534", fontWeight: 700, fontSize: 13 }}>{msg}</div> : null}
          {err ? <div style={{ color: "#b91c1c", fontWeight: 700, fontSize: 13 }}>{err}</div> : null}
        </div>
      ) : null}

      <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 14 }}>Kullanıcı yorumları</strong>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Yükleniyor…</div>
        ) : !reviews.length ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Henüz onaylı yorum yok.</div>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              style={{
                borderTop: "1px solid #f1f5f9",
                paddingTop: 10,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{r.authorName}</strong>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {r.rating ? `${r.rating}★ · ` : ""}
                  {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#334155" }}>{r.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
