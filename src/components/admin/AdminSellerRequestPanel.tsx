"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { listingStatusLabel } from "@/lib/listingStatus";
import {
  attributeFieldOptions,
  fieldLabel,
} from "@/lib/listingEditFields";
import { formatTl } from "@/lib/format";
import { dealTypeLabel } from "@/lib/dealType";

type SellerRequest = {
  id: string;
  message: string;
  kind: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  grantedAt?: string | null;
  adminNote?: string | null;
  allowedFields?: string[] | null;
  editPayload?: Record<string, unknown> | null;
  changedFields?: Record<string, { from: unknown; to: unknown }> | null;
  rejectionReason?: string | null;
  listing: {
    id: string;
    title: string;
    listingNo?: string | null;
    city?: string | null;
    district?: string | null;
    neighborhood?: string | null;
    status: string;
    bidCount: number;
    coverImage?: string | null;
    askPrice?: number;
    description?: string;
    dealType?: string;
    images?: string[];
    attributes?: Record<string, unknown> | null;
  };
  seller: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
};

function SelectableField({
  selected,
  label,
  value,
  onToggle,
}: {
  selected: boolean;
  label: string;
  value: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        textAlign: "left",
        width: "100%",
        padding: "10px 12px",
        borderRadius: 12,
        border: selected ? "2px solid var(--orange)" : "1px solid var(--line)",
        background: selected ? "#fff7ed" : "white",
        cursor: "pointer",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: selected ? "#c2410c" : "#64748b" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: selected ? "#c2410c" : "#94a3b8",
          }}
        >
          {selected ? "Seçildi ✓" : "Tıkla"}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>
        {value}
      </div>
    </button>
  );
}

function ListingClickPicker({
  listing,
  selected,
  onToggle,
  onSetSelected,
}: {
  listing: SellerRequest["listing"];
  selected: string[];
  onToggle: (key: string) => void;
  onSetSelected: (keys: string[]) => void;
}) {
  const sel = new Set(selected);
  const attrs = attributeFieldOptions(listing.attributes);
  const location = [listing.city, listing.district, listing.neighborhood].filter(Boolean).join(" / ");
  const locKeys = ["city", "district", "neighborhood"];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>
        İlan üzerinde düzenlenecek alanlara tıklayın
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
        Seçtiğiniz bölümler satıcıya iletilir. Satıcı yalnızca bu alanları popup içinde değiştirebilir.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "start" }}>
        <button
          type="button"
          onClick={() => onToggle("images")}
          style={{
            border: sel.has("images") ? "2px solid var(--orange)" : "1px solid var(--line)",
            borderRadius: 12,
            padding: 0,
            overflow: "hidden",
            background: "none",
            cursor: "pointer",
          }}
        >
          {listing.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.coverImage} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 90, background: "var(--line)" }} />
          )}
          <div style={{ fontSize: 11, fontWeight: 800, padding: 6, color: sel.has("images") ? "#c2410c" : "#64748b" }}>
            Fotoğraflar {sel.has("images") ? "✓" : ""}
          </div>
        </button>
        <div style={{ display: "grid", gap: 8 }}>
          <SelectableField
            selected={sel.has("title")}
            label="Başlık"
            value={listing.title}
            onToggle={() => onToggle("title")}
          />
          <SelectableField
            selected={sel.has("askPrice")}
            label="İlan fiyatı"
            value={listing.askPrice != null ? formatTl(listing.askPrice) : "—"}
            onToggle={() => onToggle("askPrice")}
          />
        </div>
      </div>

      <SelectableField
        selected={sel.has("description")}
        label="Açıklama"
        value={
          <span style={{ fontWeight: 500, fontSize: 13, color: "#334155" }}>
            {(listing.description || "—").slice(0, 180)}
            {(listing.description || "").length > 180 ? "…" : ""}
          </span>
        }
        onToggle={() => onToggle("description")}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <SelectableField
          selected={locKeys.every((k) => sel.has(k))}
          label="Konum (il / ilçe / mahalle)"
          value={location || "—"}
          onToggle={() => {
            const allOn = locKeys.every((k) => sel.has(k));
            if (allOn) {
              onSetSelected(selected.filter((k) => !locKeys.includes(k)));
            } else {
              onSetSelected([...new Set([...selected, ...locKeys])]);
            }
          }}
        />
        <SelectableField
          selected={sel.has("dealType")}
          label="İşlem tipi"
          value={dealTypeLabel(listing.dealType || "SATILIK")}
          onToggle={() => onToggle("dealType")}
        />
      </div>

      {attrs.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>Özellikler (ör. m²)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {attrs.map((a) => (
              <SelectableField
                key={a.key}
                selected={sel.has(a.key)}
                label={a.label}
                value={String(a.value ?? "—")}
                onToggle={() => onToggle(a.key)}
              />
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>
          Seçilen ({selected.length}): {selected.map(fieldLabel).join(", ")}
        </div>
      )}
    </div>
  );
}

export function AdminSellerRequestPanel() {
  const [pending, setPending] = useState<SellerRequest[]>([]);
  const [granted, setGranted] = useState<SellerRequest[]>([]);
  const [pendingApproval, setPendingApproval] = useState<SellerRequest[]>([]);
  const [resolved, setResolved] = useState<SellerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [fieldsById, setFieldsById] = useState<Record<string, string[]>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin?view=seller-admin-requests");
    if (res.ok) {
      const d = await res.json();
      setPending(d.pending || []);
      setGranted(d.granted || []);
      setPendingApproval(d.pendingApproval || []);
      setResolved(d.resolved || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleField(id: string, key: string) {
    setFieldsById((prev) => {
      const cur = prev[id] || [];
      return {
        ...prev,
        [id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
      };
    });
  }

  function setFields(id: string, next: string[]) {
    setFieldsById((prev) => ({ ...prev, [id]: next }));
  }

  async function grant(id: string) {
    const fields = fieldsById[id] || [];
    if (!fields.length) {
      setMsg("İlan üzerinde en az bir alan seçin.");
      return;
    }
    setBusyId(id);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "grant-seller-edit-fields",
        requestId: id,
        fields,
        adminNote: noteById[id] || "",
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMsg(d.error || "İzin verilemedi");
      return;
    }
    setMsg("Seçilen alanlar satıcıya iletildi. Bildirim gönderildi.");
    await load();
  }

  async function approve(id: string) {
    setBusyId(id);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve-seller-edit", requestId: id }),
    });
    const d = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMsg(d.error || "Onay başarısız");
      return;
    }
    setMsg("Düzenleme onaylandı. Teklif verenlere bildirim gitti.");
    await load();
  }

  async function reject(id: string) {
    const reason = (reasonById[id] || "").trim();
    if (!reason) {
      setMsg("Red sebebi yazın.");
      return;
    }
    setBusyId(id);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject-seller-edit", requestId: id, reason }),
    });
    const d = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMsg(d.error || "Red başarısız");
      return;
    }
    setMsg("Talep reddedildi.");
    await load();
  }

  async function closeOnly(id: string) {
    setBusyId(id);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve-seller-request", requestId: id }),
    });
    const d = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMsg(d.error || "İşlem başarısız");
      return;
    }
    setMsg("Talep işlem yapılmadan kapatıldı.");
    await load();
  }

  if (loading) {
    return <div className="card" style={{ padding: 18 }}>Yükleniyor...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {msg && (
        <div className="card" style={{ padding: 12, fontWeight: 600, fontSize: 14 }}>
          {msg}
        </div>
      )}

      <Section title="1) Alan izni bekleyen talepler" count={pending.length} tone="pending">
        {pending.map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
            <RequestHeader r={r} />
            <MessageBox text={r.message} />
            <ListingClickPicker
              listing={r.listing}
              selected={fieldsById[r.id] || []}
              onToggle={(key) => toggleField(r.id, key)}
              onSetSelected={(keys) => setFields(r.id, keys)}
            />
            <textarea
              className="input"
              rows={2}
              placeholder="Satıcıya not (opsiyonel)"
              value={noteById[r.id] || ""}
              onChange={(e) => setNoteById((p) => ({ ...p, [r.id]: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-orange"
                disabled={busyId === r.id}
                onClick={() => grant(r.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px" }}
              >
                <Send size={16} /> İzin ver ve satıcıya bildir
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={busyId === r.id}
                onClick={() => closeOnly(r.id)}
                style={{ padding: "10px 14px" }}
              >
                İşlemsiz kapat
              </button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="2) Satıcı düzenlemesi bekleniyor" count={granted.length} tone="info">
        {granted.map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
            <RequestHeader r={r} />
            <div style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>
              Açılan alanlar: {(Array.isArray(r.allowedFields) ? r.allowedFields : [])
                .map((k) => fieldLabel(String(k)))
                .join(", ")}
            </div>
            {r.adminNote && <div style={{ fontSize: 13 }}>Not: {r.adminNote}</div>}
          </div>
        ))}
      </Section>

      <Section title="3) Onay bekleyen düzenlemeler" count={pendingApproval.length} tone="pending">
        {pendingApproval.map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
            <RequestHeader r={r} />
            <DiffBox changed={r.changedFields || {}} />
            <textarea
              className="input"
              rows={2}
              placeholder="Red sebebi"
              value={reasonById[r.id] || ""}
              onChange={(e) => setReasonById((p) => ({ ...p, [r.id]: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-orange"
                disabled={busyId === r.id}
                onClick={() => approve(r.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px" }}
              >
                <CheckCircle2 size={16} /> Onayla ve teklif verenleri bilgilendir
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={busyId === r.id}
                onClick={() => reject(r.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px" }}
              >
                <XCircle size={16} /> Reddet
              </button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Geçmiş" count={resolved.length} tone="ok">
        {resolved.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
            <RequestHeader r={r} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Durum: {r.status}</div>
            {r.changedFields && <DiffBox changed={r.changedFields} />}
            {r.rejectionReason && (
              <div style={{ fontSize: 13, color: "#b91c1c" }}>Red: {r.rejectionReason}</div>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "pending" | "ok" | "info";
  children: ReactNode;
}) {
  const color = tone === "ok" ? "#0f766e" : tone === "info" ? "#0369a1" : "#c2410c";
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, color }}>{title}</h2>
        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>({count})</span>
      </div>
      {count ? (
        <div style={{ display: "grid", gap: 12 }}>{children}</div>
      ) : (
        <div className="card" style={{ padding: 14, color: "var(--muted)", fontSize: 14 }}>
          Kayıt yok.
        </div>
      )}
    </section>
  );
}

function RequestHeader({ r }: { r: SellerRequest }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      {r.listing.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.listing.coverImage}
          alt=""
          style={{ width: 88, height: 72, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 88, height: 72, borderRadius: 10, background: "var(--line)", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          <Link href={`/ilan/${r.listing.id}`} style={{ color: "inherit" }}>
            {r.listing.title}
          </Link>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          {r.listing.listingNo ? `#${r.listing.listingNo} · ` : ""}
          {[r.listing.city, r.listing.district].filter(Boolean).join(" / ")} ·{" "}
          {listingStatusLabel(r.listing.status)} · {r.listing.bidCount} teklif
          {r.listing.askPrice != null ? ` · ${formatTl(r.listing.askPrice)}` : ""}
        </div>
        <div style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>
          Satıcı: {r.seller.name || "—"} · {r.seller.phone || "—"}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          Talep: {new Date(r.createdAt).toLocaleString("tr-TR")}
        </div>
      </div>
    </div>
  );
}

function MessageBox({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}

function DiffBox({ changed }: { changed: Record<string, { from: unknown; to: unknown }> }) {
  const keys = Object.keys(changed || {});
  if (!keys.length) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Değişen alanlar</div>
      {keys.map((k) => (
        <div
          key={k}
          style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 1fr",
            gap: 8,
            fontSize: 13,
            padding: 8,
            background: "rgba(185,28,28,.04)",
            borderRadius: 8,
            border: "1px solid #fecaca",
          }}
        >
          <strong>{fieldLabel(k)}</strong>
          <span style={{ color: "#64748b", wordBreak: "break-word" }}>{formatVal(changed[k].from)}</span>
          <span style={{ color: "#b91c1c", fontWeight: 700, wordBreak: "break-word" }}>
            {formatVal(changed[k].to)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatVal(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "number") return formatTl(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
