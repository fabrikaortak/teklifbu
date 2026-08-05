"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SpEmpty, SpStatus } from "@/components/magaza/MagazaPanelShell";

type Q = {
  id: string;
  body: string;
  answerBody: string | null;
  answeredAt: string | null;
  createdAt: string;
  overdue: boolean;
  askerName: string;
  listing: { id: string; title: string; coverImage: string | null; listingNo: string };
};

export default function MagazaSorularPage() {
  const [filter, setFilter] = useState<"open" | "answered" | "all">("open");
  const [rows, setRows] = useState<Q[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/magaza/panel?view=questions&filter=${filter}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setRows(d.questions || []);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Hata"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitAnswer(id: string) {
    const answerBody = String(answers[id] || "").trim();
    if (!answerBody) return;
    setBusy(id);
    try {
      const res = await fetch("/api/magaza/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer-question", questionId: id, answerBody }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Yanıt gönderilemedi");
        return;
      }
      setAnswers((a) => ({ ...a, [id]: "" }));
      load();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="sp-card">
      <h2 className="sp-h2">Müşteri soru–cevap</h2>
      <p className="sp-muted">
        Ürün sayfasından gelen soruları yanıtlayın. SLA aşan sorular kırmızı işaretlenir.
      </p>

      <div className="sp-filters" style={{ marginTop: 12 }}>
        {(
          [
            ["open", "Açık"],
            ["answered", "Yanıtlanan"],
            ["all", "Tümü"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`sp-filter${filter === k ? " is-active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="sp-alert" style={{ marginTop: 10 }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Yükleniyor…</div> : null}

      {!loading && !rows.length ? (
        <SpEmpty>Bu filtrede soru yok.</SpEmpty>
      ) : (
        <div style={{ marginTop: 8 }}>
          {rows.map((q) => (
            <div key={q.id} className="sp-row" style={{ gridTemplateColumns: "56px 1fr", alignItems: "start" }}>
              {q.listing.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.listing.coverImage} alt="" className="sp-thumb" />
              ) : (
                <div className="sp-thumb-ph" />
              )}
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  {q.answeredAt ? (
                    <SpStatus tone="ok">Yanıtlandı</SpStatus>
                  ) : q.overdue ? (
                    <SpStatus tone="danger">SLA aştı</SpStatus>
                  ) : (
                    <SpStatus tone="warn">Bekliyor</SpStatus>
                  )}
                  <Link href={`/ilan/${q.listing.id}`} className="sp-row-meta" style={{ color: "#ea580c" }}>
                    {q.listing.title}
                  </Link>
                </div>
                <p className="sp-row-title" style={{ fontWeight: 700 }}>
                  {q.askerName}: {q.body}
                </p>
                <div className="sp-row-meta">
                  {new Date(q.createdAt).toLocaleString("tr-TR")}
                </div>
                {q.answerBody ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 10,
                      background: "#f0fdf4",
                      fontSize: 13,
                      lineHeight: 1.45,
                    }}
                  >
                    <strong>Yanıtınız:</strong> {q.answerBody}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <textarea
                      className="sp-textarea"
                      placeholder="Yanıtınızı yazın…"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    />
                    <div>
                      <button
                        type="button"
                        className="sp-btn"
                        disabled={busy === q.id || !(answers[q.id] || "").trim()}
                        onClick={() => void submitAnswer(q.id)}
                      >
                        {busy === q.id ? "Gönderiliyor…" : "Yanıtla"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
