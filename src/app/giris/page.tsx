"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

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

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = safeNextPath(search.get("next"));
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [identifier, setIdentifier] = useState(formatPhoneTr("5324445566"));
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("123456");
  const [passwordConfirm, setPasswordConfirm] = useState("123456");
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
    fetch("/api/commercial-settings")
      .then((r) => r.json())
      .then((d) => setDemoFillEnabled(Boolean(d.demoFillEnabled)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) return;
        if (nextPath) {
          router.replace(nextPath);
          return;
        }
        router.replace(d.user.role === "ADMIN" ? "/admin" : "/hesabim");
      });
  }, [router, nextPath]);

  function goAfterLogin(user?: { role?: string }) {
    window.dispatchEvent(new Event("teklifbu:auth"));
    if (nextPath) {
      router.push(nextPath);
    } else {
      router.push(user?.role === "ADMIN" ? "/admin" : "/hesabim");
    }
    router.refresh();
  }

  async function login() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          identifier: identifier.includes("@") ? identifier.trim() : normalizePhoneTr(identifier),
          password,
        }),
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
        return setError(data.error || "Giriş başarısız");
      }
      goAfterLogin(data.user);
    } finally {
      setLoading(false);
    }
  }

  async function requestRegisterOtp() {
    setError("");
    if (password !== passwordConfirm) return setError("Şifreler eşleşmiyor");
    if (password.length < 6) return setError("Şifre en az 6 karakter olmalı");
    if (accountType === "TICARI") {
      if (!commercialSubtypes.length) return setError("En az bir faaliyet alanı seçin");
      const cerr = validateCommercialProfile(commercialProfile);
      if (cerr) return setError(cerr);
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
      if (!res.ok) return setError(data.error || "Kod gönderilemedi");
      setHint(data.message || "");
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
      goAfterLogin(data.user);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "otp") return;
    const digits = code.replace(/\D/g, "");
    if (digits.length < 4 || loading || otpSubmitting.current) return;
    otpSubmitting.current = true;
    void verifyRegisterOtp(digits).finally(() => {
      otpSubmitting.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  return (
    <div
      className="page-shell"
      style={{
        maxWidth: step === "commercial" ? 820 : 480,
        marginTop: 48,
        marginBottom: 48,
        transition: "max-width 0.2s ease",
      }}
    >
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900 }}>
          {step === "commercial" ? "İşletme bilgileri" : "Giriş / Üye Ol"}
        </h1>
        <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: 14 }}>
          {step === "commercial"
            ? "Kurumsal faaliyet alanlarını seçin ve işletme bilgilerinizi doldurun."
            : "Üyeler telefon veya e-posta + şifre ile giriş yapar. Yeni üyelikte OTP zorunludur."}
        </p>

        {step !== "commercial" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={mode === "login" ? "btn-orange" : "btn-outline"}
              style={{ padding: 10 }}
              onClick={() => {
                setMode("login");
                setStep("form");
                setError("");
              }}
            >
              Üye Girişi
            </button>
            <button
              type="button"
              className={mode === "register" ? "btn-orange" : "btn-outline"}
              style={{ padding: 10 }}
              onClick={() => {
                setMode("register");
                setStep("form");
                setError("");
              }}
            >
              Yeni Üye Ol
            </button>
          </div>
        ) : null}

        {mode === "login" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <input
              className="input"
              placeholder="Telefon veya e-posta"
              value={identifier}
              onChange={(e) => setIdentifier(formatLoginIdentifier(e.target.value))}
            />
            <input
              className="input"
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn-orange" style={{ padding: 12 }} disabled={loading} onClick={login}>
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Demo alıcı: 532 444 55 66 / 123456 · Admin: 500 000 00 00 / admin123
            </div>
          </div>
        ) : step === "form" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input className="input" placeholder="Ad" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <input className="input" placeholder="Soyad" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <input
              className="input"
              placeholder="532 111 22 33"
              value={phone}
              onChange={(e) => setPhone(formatPhoneTr(e.target.value))}
              inputMode="tel"
            />
            <input className="input" type="email" placeholder="E-posta (opsiyonel)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className="input"
              type="password"
              placeholder="Şifre (en az 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Şifre tekrar"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
            {accountType === "TICARI" ? (
              <button
                className="btn-orange"
                style={{ padding: 12 }}
                disabled={!basicsOk}
                onClick={() => tryGoCommercial()}
              >
                İleri — İşletme bilgileri
              </button>
            ) : (
              <button
                className="btn-orange"
                style={{ padding: 12 }}
                disabled={loading || !basicsOk}
                onClick={requestRegisterOtp}
              >
                {loading ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
              </button>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Geliştirme OTP: 1234</div>
          </div>
        ) : step === "commercial" ? (
          <div style={{ display: "grid", gap: 14 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
              <button
                className="btn-outline"
                style={{ padding: 12 }}
                onClick={() => {
                  setError("");
                  setStep("form");
                }}
              >
                Geri
              </button>
              <button
                className="btn-orange"
                style={{ padding: 12 }}
                disabled={loading}
                onClick={() => {
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
                {loading ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {hint && <div style={{ background: "#fff7ed", padding: 10, borderRadius: 8, fontSize: 13 }}>{hint}</div>}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>SMS doğrulama kodu</div>
            <OtpInput value={code} onChange={setCode} disabled={loading} />
            <button
              className="btn-orange"
              style={{ padding: 12 }}
              disabled={loading || code.replace(/\D/g, "").length < 4}
              onClick={() => verifyRegisterOtp()}
            >
              {loading ? "Doğrulanıyor..." : "Devam Et"}
            </button>
            <button
              className="btn-outline"
              style={{ padding: 10 }}
              onClick={() => setStep(accountType === "TICARI" ? "commercial" : "form")}
            >
              Geri
            </button>
          </div>
        )}

        {error && <div style={{ color: "#dc2626", marginTop: 12, fontSize: 14 }}>{error}</div>}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page-shell" style={{ maxWidth: 420, marginTop: 40, paddingTop: 40, paddingBottom: 40 }}>Yükleniyor...</div>}>
      <LoginInner />
    </Suspense>
  );
}
