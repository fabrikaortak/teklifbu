"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CommercialSubtypePicker } from "@/components/CommercialSubtypePicker";
import { CommercialBusinessForm } from "@/components/CommercialBusinessForm";
import {
  accountTypeLabelTr,
  normalizeAccountType,
  parseCommercialSubtypes,
  type CommercialSubtype,
} from "@/lib/accountTypes";
import {
  commercialStatusLabel,
  parseCommercialProfile,
  validateCommercialProfile,
  type CommercialProfile,
  EMPTY_COMMERCIAL_PROFILE,
} from "@/data/commercialProfile";
import { useTokenBuyGate } from "@/hooks/useTokenBuyGate";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialSubtypes?: string[];
  initialProfile?: unknown;
  initialLogoUrl?: string | null;
  initialStoreCoverUrl?: string | null;
  pendingProfile?: CommercialProfile | null;
  pendingSubtypes?: string[];
  commercialStatus?: string | null;
  hasPendingUpdate?: boolean;
};

export function CommercialEditModal({
  open,
  onClose,
  onSaved,
  initialSubtypes,
  initialProfile,
  initialLogoUrl,
  initialStoreCoverUrl,
  pendingProfile,
  pendingSubtypes,
  commercialStatus,
  hasPendingUpdate,
}: Props) {
  const [subtypes, setSubtypes] = useState<CommercialSubtype[]>([]);
  const [profile, setProfile] = useState<CommercialProfile>({ ...EMPTY_COMMERCIAL_PROFILE });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [storeCoverUrl, setStoreCoverUrl] = useState<string | null>(null);
  const [logoEnabled, setLogoEnabled] = useState(true);
  const [logoPaid, setLogoPaid] = useState(false);
  const [logoFee, setLogoFee] = useState(0);
  const [demoFillEnabled, setDemoFillEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const { tokenModal, handleFetchResult } = useTokenBuyGate({
    continueLabel: "Logoya dön",
    title: "Logo yükleme için jeton gerekli",
    description:
      "İşletme logosu yüklemek jeton harcar. Bakiyeniz yetersiz. Jeton yükledikten sonra logoyu tekrar seçebilirsiniz.",
  });

  useEffect(() => {
    if (!open) return;
    if (hasPendingUpdate && pendingProfile) {
      setSubtypes(parseCommercialSubtypes(pendingSubtypes?.length ? pendingSubtypes : initialSubtypes));
      setProfile(pendingProfile);
    } else {
      setSubtypes(parseCommercialSubtypes(initialSubtypes));
      setProfile(parseCommercialProfile(initialProfile));
    }
    setLogoUrl(initialLogoUrl || null);
    setStoreCoverUrl(initialStoreCoverUrl || null);
    setError("");
    setMsg("");
    fetch("/api/commercial-settings")
      .then((r) => r.json())
      .then((d) => {
        setDemoFillEnabled(Boolean(d.demoFillEnabled));
        setLogoEnabled(d.logoEnabled !== false);
        setLogoPaid(Boolean(d.logoPaid));
        setLogoFee(Number(d.logoFeeTokens) || 0);
      })
      .catch(() => {});
  }, [
    open,
    initialSubtypes,
    initialProfile,
    initialLogoUrl,
    initialStoreCoverUrl,
    pendingProfile,
    pendingSubtypes,
    hasPendingUpdate,
  ]);

  if (!open) return null;

  async function saveLogo(next: string | null) {
    setLogoBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-commercial-logo", logoUrl: next }),
      });
      const data = await res.json();
      if (handleFetchResult(res, data, logoFee || 1)) {
        return;
      }
      if (!res.ok) {
        setError(data.error || "Logo kaydedilemedi");
        return;
      }
      setLogoUrl(data.logoUrl || null);
      setMsg(data.message || "Logo güncellendi");
      onSaved?.();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLogoBusy(false);
    }
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body });
      const data = await up.json();
      if (!up.ok) {
        setError(data.error || "Yükleme başarısız");
        return;
      }
      await saveLogo(data.url);
    } catch {
      setError("Yükleme hatası");
    } finally {
      setLogoBusy(false);
    }
  }

  async function saveCover(next: string | null) {
    setCoverBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-commercial-store-cover", storeCoverUrl: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kapak kaydedilemedi");
        return;
      }
      setStoreCoverUrl(data.storeCoverUrl || null);
      setMsg(data.message || "Mağaza kapağı güncellendi");
      onSaved?.();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setCoverBusy(false);
    }
  }

  async function onCoverFile(file: File | null) {
    if (!file) return;
    setCoverBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body });
      const data = await up.json();
      if (!up.ok) {
        setError(data.error || "Yükleme başarısız");
        return;
      }
      await saveCover(data.url);
    } catch {
      setError("Yükleme hatası");
    } finally {
      setCoverBusy(false);
    }
  }

  async function submit() {
    setError("");
    setMsg("");
    if (!subtypes.length) {
      setError("En az bir faaliyet alanı seçin");
      return;
    }
    const cerr = validateCommercialProfile(profile);
    if (cerr) {
      setError(cerr);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request-commercial-update",
          commercialSubtypes: subtypes,
          commercialProfile: profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kaydedilemedi");
        return;
      }
      setMsg(data.message || "Gönderildi");
      onSaved?.();
      setTimeout(() => onClose(), 900);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }

  const status = String(commercialStatus || "").toUpperCase();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {tokenModal}
      <div
        className="auth-modal auth-modal--wide"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label="Kapat">
          <X size={18} />
        </button>
        <h3 className="auth-modal__title auth-modal__title--compact">Ticari işletme bilgileri</h3>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          Değişiklikler yönetici onayından sonra yayınlanır.
          {status ? (
            <>
              {" "}
              Durum: <strong>{commercialStatusLabel(status)}</strong>
              {hasPendingUpdate ? " · Güncelleme onayı bekleniyor" : ""}
            </>
          ) : null}
        </p>
        <div className="auth-modal__form">
          {logoEnabled ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                marginBottom: 4,
              }}
            >
              <strong style={{ fontSize: 13 }}>İşletme logosu</strong>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {logoPaid
                  ? `Logo yükleme ücretli: ${logoFee} jeton (değiştirirken kesilir).`
                  : "Logo yükleme ücretsiz."}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    color: "#c2410c",
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    "Logo"
                  )}
                </div>
                <label className="btn-outline" style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}>
                  {logoBusy ? "Yükleniyor…" : "Logo seç"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={logoBusy}
                    onChange={(e) => void onLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                {logoUrl ? (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    disabled={logoBusy}
                    onClick={() => void saveLogo(null)}
                  >
                    Kaldır
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {logoEnabled ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                marginBottom: 4,
              }}
            >
              <strong style={{ fontSize: 13 }}>Mağaza kapağı</strong>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Mağaza sayfasında logonun karşısında görünen vitrin görseli.
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 120,
                    height: 72,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  {storeCoverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={storeCoverUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    "Kapak"
                  )}
                </div>
                <label className="btn-outline" style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}>
                  {coverBusy ? "Yükleniyor…" : "Kapak seç"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={coverBusy}
                    onChange={(e) => void onCoverFile(e.target.files?.[0] || null)}
                  />
                </label>
                {storeCoverUrl ? (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    disabled={coverBusy}
                    onClick={() => void saveCover(null)}
                  >
                    Kaldır
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <CommercialSubtypePicker value={subtypes} onChange={setSubtypes} />
          <CommercialBusinessForm
            value={profile}
            onChange={setProfile}
            demoFillEnabled={demoFillEnabled}
            wide
            hideIntro
          />
          {error ? <div className="auth-modal__error">{error}</div> : null}
          {msg ? (
            <div style={{ color: "#166534", fontWeight: 700, fontSize: 13 }}>{msg}</div>
          ) : null}
          <div className="auth-modal__actions">
            <button type="button" className="btn-outline auth-modal__submit" onClick={onClose}>
              Kapat
            </button>
            <button
              type="button"
              className="btn-orange auth-modal__submit"
              disabled={loading || !subtypes.length || Boolean(validateCommercialProfile(profile))}
              onClick={() => void submit()}
            >
              {loading ? "Gönderiliyor..." : "Onaya gönder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** İsim kartı üstündeki üyelik tipi etiketi */
export function MemberTypeBadge({
  accountType,
  onCommercialClick,
  compact,
}: {
  accountType?: string | null;
  onCommercialClick?: () => void;
  compact?: boolean;
}) {
  const type = normalizeAccountType(accountType);
  const label = accountTypeLabelTr(type);
  const isCommercial = type === "TICARI";

  if (isCommercial && onCommercialClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCommercialClick();
        }}
        className="member-type-badge member-type-badge--clickable"
        title="Ticari bilgileri düzenle"
        style={compact ? { fontSize: 10, padding: "1px 6px" } : undefined}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className="member-type-badge"
      style={compact ? { fontSize: 10, padding: "1px 6px" } : undefined}
    >
      {label}
    </span>
  );
}
