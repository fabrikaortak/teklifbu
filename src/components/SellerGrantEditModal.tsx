"use client";

import { useEffect, useState } from "react";
import { formatTl, parseNumberTr, formatNumberTr } from "@/lib/format";
import { fieldLabel, isAttrField, attrKeyFromField } from "@/lib/listingEditFields";
import { ImageUploader } from "@/components/ImageUploader";

type GrantData = {
  id: string;
  status: string;
  adminNote?: string | null;
  allowedFields: string[];
  listing: {
    id: string;
    title: string;
    description: string;
    askPrice: number;
    city: string;
    district?: string | null;
    neighborhood?: string | null;
    dealType: string;
    images: string[];
    coverImage?: string | null;
    attributes?: Record<string, unknown> | null;
  };
  snapshot: Record<string, unknown>;
};

export function SellerGrantEditModal({
  grantId,
  onClose,
  onSubmitted,
}: {
  grantId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [data, setData] = useState<GrantData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    setError("");
    setData(null);
    fetch(`/api/edit-grants/${grantId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        return d.request as GrantData;
      })
      .then((req) => {
        if (cancelled) return;
        setData(req);
        const snap = { ...(req.snapshot || {}) };
        const attrs =
          snap.attributes && typeof snap.attributes === "object"
            ? (snap.attributes as Record<string, unknown>)
            : {};
        for (const f of req.allowedFields || []) {
          if (isAttrField(f)) {
            const ak = attrKeyFromField(f)!;
            snap[f] = attrs[ak];
          }
        }
        setForm(snap);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yüklenemedi");
      });
    return () => {
      cancelled = true;
    };
  }, [grantId]);

  async function submit() {
    if (!data) return;
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = {};
    for (const key of data.allowedFields) {
      if (isAttrField(key)) {
        payload[key] = form[key];
        continue;
      }
      payload[key] = form[key];
      if (key === "images") {
        payload.images = form.images;
        payload.coverImage = Array.isArray(form.images)
          ? (form.images as string[])[0]
          : form.coverImage;
      }
      if (key === "askPrice") {
        payload.askPrice =
          typeof form.askPrice === "string"
            ? parseNumberTr(form.askPrice)
            : Number(form.askPrice);
      }
    }
    const res = await fetch(`/api/edit-grants/${data.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", payload }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Gönderilemedi");
      return;
    }
    onSubmitted?.();
    onClose();
  }

  return (
    <div className="tb-dialog-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="tb-dialog"
        style={{
          textAlign: "left",
          width: "min(520px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" aria-label="Kapat" onClick={onClose}>
          ×
        </button>
        <h3 className="tb-dialog-title" style={{ textAlign: "left", paddingRight: 28 }}>
          İzinli alanları düzenle
        </h3>

        {!data && !error && (
          <p className="tb-dialog-message" style={{ textAlign: "left" }}>
            Yükleniyor...
          </p>
        )}

        {error && !data && (
          <p className="tb-dialog-message" style={{ textAlign: "left", color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {data && data.status !== "GRANTED" && (
          <p className="tb-dialog-message" style={{ textAlign: "left" }}>
            Bu izin şu anda düzenlenebilir değil (durum: {data.status}).
          </p>
        )}

        {data && data.status === "GRANTED" && (
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Yalnızca yöneticinin seçtiği alanlar aşağıda. Diğer bilgiler değiştirilemez.
            </p>
            {data.adminNote && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  fontSize: 13,
                }}
              >
                Yönetici notu: {data.adminNote}
              </div>
            )}

            {data.allowedFields.map((key) => {
              if (key === "title") {
                return (
                  <label key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <input
                      className="input"
                      value={String(form.title || "")}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </label>
                );
              }
              if (key === "description") {
                return (
                  <label key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <textarea
                      className="input"
                      rows={4}
                      value={String(form.description || "")}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                );
              }
              if (key === "askPrice") {
                return (
                  <label key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <input
                      className="input"
                      value={formatNumberTr(Number(form.askPrice || 0))}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, askPrice: parseNumberTr(e.target.value) }))
                      }
                    />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Güncel: {formatTl(Number(data.listing.askPrice))}
                    </span>
                  </label>
                );
              }
              if (key === "city" || key === "district" || key === "neighborhood") {
                return (
                  <label key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <input
                      className="input"
                      value={String(form[key] || "")}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </label>
                );
              }
              if (key === "dealType") {
                return (
                  <label key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <select
                      className="input"
                      value={String(form.dealType || "SATILIK")}
                      onChange={(e) => setForm((f) => ({ ...f, dealType: e.target.value }))}
                    >
                      <option value="SATILIK">Satılık</option>
                      <option value="KIRALIK">Kiralık</option>
                      <option value="DEVREN_SATILIK">Devren Satılık</option>
                      <option value="DEVREN_KIRALIK">Devren Kiralık</option>
                    </select>
                  </label>
                );
              }
              if (key === "images") {
                return (
                  <div key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <ImageUploader
                      images={(form.images as string[]) || []}
                      onChange={(images) =>
                        setForm((f) => ({ ...f, images, coverImage: images[0] || null }))
                      }
                    />
                  </div>
                );
              }
              if (isAttrField(key)) {
                return (
                  <label key={key} style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{fieldLabel(key)}</span>
                    <input
                      className="input"
                      value={String(form[key] ?? "")}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </label>
                );
              }
              return null;
            })}

            {error && (
              <div style={{ color: "#b91c1c", fontWeight: 600, fontSize: 13 }}>{error}</div>
            )}

            <div className="tb-dialog-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="tb-dialog-btn tb-dialog-btn-ghost"
                disabled={busy}
                onClick={onClose}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="tb-dialog-btn tb-dialog-btn-primary"
                disabled={busy}
                onClick={submit}
              >
                {busy ? "Gönderiliyor..." : "Onaya gönder"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
