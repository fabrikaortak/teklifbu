"use client";

import { useCallback, useEffect, useState } from "react";
import { commercialStatusLabel, parseCommercialProfile, getPendingCommercialFromProfile, commercialToShopFocus } from "@/data/commercialProfile";
import { formatShopFocusLine } from "@/data/shopFocus";
import { commercialSubtypeLabelTr } from "@/lib/accountTypes";
import { formatPhoneTr } from "@/lib/format";
import { commercialBusinessTypeLabel } from "@/lib/commercialBusinessTypes";

type Row = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  accountType: string;
  commercialSubtypes: string[];
  commercialStatus: string | null;
  commercialReviewNote: string | null;
  commercialReviewedAt: string | null;
  createdAt: string;
  memberSince?: string;
  profile: unknown;
  isActive: boolean;
  logoUrl?: string | null;
  isPremiumSeller?: boolean;
  premiumSellerUntil?: string | null;
};

function subtypeText(subs: string[], labelMap?: Record<string, string>) {
  return (subs || [])
    .map((s) => labelMap?.[s] || commercialBusinessTypeLabel(s) || commercialSubtypeLabelTr(s))
    .join(", ");
}

function ProfileBlock({
  title,
  p,
  subs,
}: {
  title: string;
  p: ReturnType<typeof parseCommercialProfile>;
  subs: string;
}) {
  const focusLine = formatShopFocusLine(commercialToShopFocus(p));
  return (
    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{title}</div>
      <div>
        <strong style={{ color: "#0f172a" }}>Mağaza odağı:</strong> {focusLine}
      </div>
      <div>Faaliyet: {subs || "—"}</div>
      <div>
        Unvan: {p.commercialTitle || "—"} · Tür: {p.companyType || "—"}
      </div>
      <div>
        Vergi: {p.taxNumber || "—"} / {p.taxOffice || "—"}
      </div>
      <div>
        Adres: {[p.businessDistrict, p.businessCity].filter(Boolean).join(", ") || "—"} —{" "}
        {p.businessAddress || "—"}
      </div>
      <div>
        Yetkili: {p.authorizedTitle || "—"} {p.authorizedPhone ? `(${p.authorizedPhone})` : ""}
      </div>
    </div>
  );
}

export function AdminCommercialUsersPanel() {
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [labelMap, setLabelMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin?view=commercial-users&status=${tab}`);
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Yüklenemedi");
        return;
      }
      setRows(d.users || []);
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/commercial-business-types");
        if (!res.ok) return;
        const json = await res.json();
        const all = Array.isArray(json.all) ? json.all : [];
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const t of all) {
          map[String(t.key).toUpperCase()] = String(t.label || t.key);
        }
        setLabelMap(map);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(userId: string, action: "approve-commercial-user" | "reject-commercial-user") {
    setBusyId(userId);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userId,
          note: notes[userId] || "",
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "İşlem başarısız");
        return;
      }
      setMsg(d.message || "İşlem tamam");
      await load();
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="adm-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(
            [
              ["PENDING", "Onay bekleyen"],
              ["APPROVED", "Onaylı"],
              ["REJECTED", "Reddedilen"],
              ["ALL", "Tümü"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "btn-orange" : "btn-outline"}
              style={{ padding: "8px 12px", fontSize: 13 }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
        {msg ? <div style={{ color: "#166534", fontWeight: 700, marginBottom: 8 }}>{msg}</div> : null}
        {err ? <div style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 8 }}>{err}</div> : null}
        {loading ? (
          <div>Yükleniyor…</div>
        ) : !rows.length ? (
          <div style={{ color: "#64748b" }}>Kayıt yok.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((u) => {
              const p = parseCommercialProfile(u.profile);
              const pending = getPendingCommercialFromProfile(u.profile);
              const subs = subtypeText(u.commercialSubtypes || [], labelMap);
              const pendingSubs = pending.profile ? subtypeText(pending.subtypes, labelMap) : "";
              return (
                <div
                  key={u.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 15 }}>
                        {pending.profile?.commercialTitle || p.commercialTitle || u.name || "—"}
                      </strong>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        {u.name} · {formatPhoneTr(u.phone)}
                        {u.email ? ` · ${u.email}` : ""}
                        {" · "}
                        {u.isActive ? "Hesap aktif" : "Hesap pasif"}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "4px 8px",
                        borderRadius: 8,
                        background: "#fff7ed",
                        color: "#c2410c",
                        height: "fit-content",
                      }}
                    >
                      {commercialStatusLabel(u.commercialStatus)}
                      {pending.profile ? " · Güncelleme" : ""}
                    </span>
                  </div>
                  {pending.profile ? (
                    <>
                      <ProfileBlock title="Mevcut (yayında)" p={p} subs={subs} />
                      <ProfileBlock title="Onay bekleyen değişiklik" p={pending.profile} subs={pendingSubs} />
                    </>
                  ) : (
                    <ProfileBlock title="Başvuru bilgileri" p={p} subs={subs} />
                  )}
                  {String(u.commercialStatus).toUpperCase() === "APPROVED" && !pending.profile ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {u.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.logoUrl}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }}
                        />
                      ) : null}
                      <button
                        type="button"
                        className={u.isPremiumSeller ? "btn-orange" : "btn-outline"}
                        style={{ padding: "8px 12px", fontSize: 13 }}
                        disabled={busyId === u.id}
                        onClick={async () => {
                          setBusyId(u.id);
                          setMsg("");
                          setErr("");
                          try {
                            const res = await fetch("/api/admin", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "set-commercial-premium",
                                userId: u.id,
                                isPremiumSeller: !u.isPremiumSeller,
                              }),
                            });
                            const d = await res.json();
                            if (!res.ok) {
                              setErr(d.error || "İşlem başarısız");
                              return;
                            }
                            setMsg(d.message || "Tamam");
                            await load();
                          } catch {
                            setErr("Bağlantı hatası");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {u.isPremiumSeller ? "Premium rozeti kapat" : "Premium üye yap"}
                      </button>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Üyelik:{" "}
                        {u.memberSince
                          ? new Date(u.memberSince).toLocaleDateString("tr-TR")
                          : "—"}
                      </span>
                    </div>
                  ) : null}
                  {String(u.commercialStatus).toUpperCase() === "PENDING" || tab === "PENDING" || pending.profile ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        className="input"
                        placeholder="Red notu (opsiyonel)"
                        value={notes[u.id] || ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [u.id]: e.target.value }))}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn-orange"
                          style={{ padding: "8px 14px" }}
                          disabled={busyId === u.id}
                          onClick={() => void act(u.id, "approve-commercial-user")}
                        >
                          {pending.profile ? "Güncellemeyi onayla" : "Onayla"}
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: "8px 14px", color: "#b91c1c", borderColor: "#fecaca" }}
                          disabled={busyId === u.id}
                          onClick={() => void act(u.id, "reject-commercial-user")}
                        >
                          {pending.profile ? "Güncellemeyi reddet" : "Reddet"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
