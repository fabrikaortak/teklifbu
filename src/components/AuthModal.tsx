"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { formatLoginIdentifier, formatPhoneTr, normalizePhoneTr, phoneDigits } from "@/lib/format";
import { OtpInput } from "@/components/OtpInput";
import { CommercialSubtypePicker } from "@/components/CommercialSubtypePicker";
import { CommercialBusinessForm } from "@/components/CommercialBusinessForm";
import type { CommercialSubtype } from "@/lib/accountTypes";
import {
  EMPTY_COMMERCIAL_PROFILE,
  validateCommercialProfile,
  type CommercialProfile,
} from "@/data/commercialProfile";
import { AccountDisabledDialog } from "@/components/AccountDisabledDialog";

type Mode = "login" | "register";
type Step = "form" | "commercial" | "otp";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
};

function registerBasicsReady(opts: {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  passwordConfirm: string;
}) {
  return (
    opts.firstName.trim().length > 0 &&
    opts.lastName.trim().length > 0 &&
    phoneDigits(opts.phone).replace(/^0/, "").length >= 10 &&
    opts.password.length >= 6 &&
    opts.password === opts.passwordConfirm
  );
}

export function AuthModal({
  open,
  onClose,
  onSuccess,
  title = "Giriş yapın veya üye olun",
  subtitle = "Üyeler telefon veya e-posta + şifre ile giriş yapar. Yeni üyelikte telefon OTP ile doğrulanır.",
}: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState("BIREYSEL_TICARI");
  const [commercialSubtypes, setCommercialSubtypes] = useState<CommercialSubtype[]>([]);
  const [commercialProfile, setCommercialProfile] = useState<CommercialProfile>({
    ...EMPTY_COMMERCIAL_PROFILE,
  });
  const [demoFillEnabled, setDemoFillEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [disabledOpen, setDisabledOpen] = useState(false);
  const [disabledContact, setDisabledContact] = useState<{ phone?: string; phoneLabel?: string }>({});
  const otpSubmitting = useRef(false);

  const basicsOk = registerBasicsReady({ firstName, lastName, phone, password, passwordConfirm });

  function tryGoCommercial() {
    setError("");
    if (!basicsOk) {
      setError("Önce ad, soyad, telefon ve şifre alanlarını doldurun");
      return false;
    }
    setStep("commercial");
    return true;
  }

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setStep("form");
    setIdentifier("");
    setPhone("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setFirstName("");
    setLastName("");
    setAccountType("BIREYSEL_TICARI");
    setCommercialSubtypes([]);
    setCommercialProfile({ ...EMPTY_COMMERCIAL_PROFILE });
    setCode("");
    setError("");
    setHint("");
    otpSubmitting.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/commercial-settings")
      .then((r) => r.json())
      .then((d) => setDemoFillEnabled(Boolean(d.demoFillEnabled)))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || step !== "otp") return;
    const digits = code.replace(/\D/g, "");
    if (digits.length < 4 || loading || otpSubmitting.current) return;
    otpSubmitting.current = true;
    void verifyRegisterOtp(digits).finally(() => {
      otpSubmitting.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step, open]);

  if (!open) return null;

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setIdentifier("");
    setPhone("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setFirstName("");
    setLastName("");
    setAccountType("BIREYSEL_TICARI");
    setCommercialSubtypes([]);
    setCommercialProfile({ ...EMPTY_COMMERCIAL_PROFILE });
    setCode("");
    setError("");
    setHint("");
    otpSubmitting.current = false;
  }

  async function login() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", identifier: identifier.includes("@") ? identifier.trim() : normalizePhoneTr(identifier), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "ACCOUNT_DISABLED") {
          setDisabledContact({
            phone: data.contact?.phone,
            phoneLabel: data.contact?.phoneLabel,
          });
          setDisabledOpen(true);
          setError("");
          return;
        }
        setError(data.error || "Giriş başarısız");
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function requestRegisterOtp() {
    setError("");
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      return;
    }
    if (accountType === "TICARI") {
      if (!commercialSubtypes.length) {
        setError("En az bir faaliyet alanı seçin");
        return;
      }
      const cerr = validateCommercialProfile(commercialProfile);
      if (cerr) {
        setError(cerr);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register-request-otp",
          phone: normalizePhoneTr(phone),
          email,
          password,
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          accountType,
          commercialSubtypes: accountType === "TICARI" ? commercialSubtypes : [],
          commercialProfile: accountType === "TICARI" ? commercialProfile : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kod gönderilemedi");
        return;
      }
      setHint(data.message || "Kod gönderildi");
      setCode("");
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function verifyRegisterOtp(codeOverride?: string) {
    const otp = (codeOverride ?? code).replace(/\D/g, "");
    if (otp.length < 4) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register-verify-otp", phone: normalizePhoneTr(phone), code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Doğrulama başarısız");
        setCode("");
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`auth-modal${step === "commercial" ? " auth-modal--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label="Kapat">
          <X size={18} />
        </button>

        {step === "commercial" ? (
          <h3 className="auth-modal__title auth-modal__title--compact">İşletme bilgileri</h3>
        ) : (
          <>
            <div className="auth-modal__icon">
              <KeyRound size={26} strokeWidth={1.75} />
            </div>
            <h3 className="auth-modal__title">{title}</h3>
            <p className="auth-modal__subtitle">{subtitle}</p>
          </>
        )}

        {step !== "commercial" ? (
          <div className="auth-modal__tabs">
            <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => switchMode("login")}>
              Üye Girişi
            </button>
            <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => switchMode("register")}>
              Yeni Üye Ol
            </button>
          </div>
        ) : null}

        {mode === "login" ? (
          <form
            className="auth-modal__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (loading || identifier.replace(/\s/g, "").length < 3 || password.length < 1) return;
              void login();
            }}
          >
            <input
              className="input"
              placeholder="Telefon veya e-posta"
              value={identifier}
              onChange={(e) => setIdentifier(formatLoginIdentifier(e.target.value))}
              autoComplete="username"
              inputMode="email"
            />
            <input
              className="input"
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="btn-orange auth-modal__submit"
              disabled={loading || identifier.replace(/\s/g, "").length < 3 || password.length < 1}
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        ) : step === "form" ? (
          <form
            className="auth-modal__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!basicsOk) return;
              if (accountType === "TICARI") {
                tryGoCommercial();
                return;
              }
              void requestRegisterOtp();
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                className="input"
                placeholder="Ad"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
              <input
                className="input"
                placeholder="Soyad"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <input
              className="input"
              placeholder="532 111 22 33"
              value={phone}
              onChange={(e) => setPhone(formatPhoneTr(e.target.value))}
              inputMode="tel"
              autoComplete="tel"
            />
            <input
              className="input"
              type="email"
              placeholder="E-posta (opsiyonel)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Şifre (en az 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className="input"
              type="password"
              placeholder="Şifre tekrar"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <select
              className="select"
              value={accountType}
              onChange={(e) => {
                const v = e.target.value;
                setAccountType(v);
                if (v !== "TICARI") {
                  setCommercialSubtypes([]);
                  setCommercialProfile({ ...EMPTY_COMMERCIAL_PROFILE });
                }
              }}
            >
              <option value="BIREYSEL_TICARI">Bireysel</option>
              <option value="TICARI">Kurumsal</option>
            </select>
            <button
              type="submit"
              className="btn-orange auth-modal__submit"
              disabled={loading || !basicsOk}
            >
              {accountType === "TICARI"
                ? "İleri — İşletme bilgileri"
                : loading
                  ? "Gönderiliyor..."
                  : "Doğrulama Kodu Gönder"}
            </button>
          </form>
        ) : step === "commercial" ? (
          <form
            className="auth-modal__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (loading) return;
              if (!commercialSubtypes.length) {
                setError("En az bir faaliyet alanı seçin (veya Demo doldur kullanın)");
                return;
              }
              const cerr = validateCommercialProfile(commercialProfile);
              if (cerr) {
                setError(cerr);
                return;
              }
              void requestRegisterOtp();
            }}
          >
            <CommercialSubtypePicker value={commercialSubtypes} onChange={setCommercialSubtypes} />
            <CommercialBusinessForm
              value={commercialProfile}
              onChange={setCommercialProfile}
              onDemoFill={({ profile, subtypes }) => {
                setCommercialProfile(profile);
                setCommercialSubtypes(subtypes);
                setError("");
              }}
              demoFillEnabled={demoFillEnabled}
              wide
              hideIntro
            />
            <div className="auth-modal__actions">
              <button
                type="button"
                className="btn-outline auth-modal__submit"
                onClick={() => {
                  setError("");
                  setStep("form");
                }}
              >
                Geri
              </button>
              <button
                type="submit"
                className="btn-orange auth-modal__submit"
                disabled={loading}
              >
                {loading ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="auth-modal__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (loading || code.replace(/\D/g, "").length < 4) return;
              void verifyRegisterOtp();
            }}
          >
            {hint && <div className="auth-modal__hint">{hint}</div>}
            <div style={{ textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: -2 }}>
              SMS doğrulama kodu
            </div>
            <OtpInput value={code} onChange={setCode} disabled={loading} />
            <button
              type="submit"
              className="btn-orange auth-modal__submit"
              disabled={loading || code.replace(/\D/g, "").length < 4}
            >
              {loading ? "Doğrulanıyor..." : "Devam Et"}
            </button>
            <button
              type="button"
              className="btn-outline auth-modal__submit"
              onClick={() => setStep(accountType === "TICARI" ? "commercial" : "form")}
            >
              Geri
            </button>
          </form>
        )}

        {error && <div className="auth-modal__error">{error}</div>}
        <div className="auth-modal__note">
          Demo: <strong>532 444 55 66</strong> / <strong>123456</strong> · OTP: <strong>1234</strong>
        </div>
      </div>
      <AccountDisabledDialog
        open={disabledOpen}
        onClose={() => setDisabledOpen(false)}
        contactPhone={disabledContact.phone}
        contactLabel={disabledContact.phoneLabel}
      />
    </div>
  );
}
