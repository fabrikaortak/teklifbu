"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Coins } from "lucide-react";
import type { AiListingDraft } from "@/core/services/aiListingParseService";
import { fieldStr } from "@/data/housingMatch";
import { writeListingDraft } from "@/lib/listingDraft";
import { ImageUploader } from "@/components/ImageUploader";
import Link from "next/link";
import { useTokenBuyGate } from "@/hooks/useTokenBuyGate";

function draftToListingForm(d: AiListingDraft, aiSourceImages: string[] = []) {
  return writeListingDraft({
    form: {
      title: d.title || "",
      description: d.description || "",
      city: d.city || "",
      district: d.district || "",
      neighborhood: d.neighborhood || "",
      dealType: d.dealType === "KIRALIK" ? "KIRALIK" : "SATILIK",
      askPrice: d.askPrice != null ? String(d.askPrice) : "",
      categorySlug: d.categorySlug || "konut",
      days: "7",
    },
    aiSourceImages: aiSourceImages.filter(Boolean),
    attrs: {
      rooms: fieldStr(d.rooms),
      m2: fieldStr(d.m2),
      subtype: fieldStr(d.subtype),
      rentalPeriod: "",
      brand: fieldStr(d.brand),
      model: fieldStr(d.model),
      condition: "",
      warranty: "",
      trim: fieldStr(d.trim),
      netM2: fieldStr(d.netM2),
      buildingAge: fieldStr(d.buildingAge),
      floor: fieldStr(d.floor),
      totalFloors: fieldStr(d.totalFloors),
      heating: fieldStr(d.heating),
      bathrooms: fieldStr(d.bathrooms),
      balcony: fieldStr(d.balcony),
      kitchen: fieldStr(d.kitchen),
      usageStatus: fieldStr(d.usageStatus),
      inSite: fieldStr(d.inSite),
      siteName: fieldStr(d.siteName),
      elevator: fieldStr(d.elevator),
      creditEligible: fieldStr(d.creditEligible),
      energyCertificate: fieldStr(d.energyCertificate),
      sellerType: fieldStr(d.sellerType),
      swap: fieldStr(d.swap),
      furnished: fieldStr(d.furnished),
      dues: fieldStr(d.dues),
      deedStatus: fieldStr(d.deedStatus),
      zoning: "",
      frontage: "",
      year: fieldStr(d.year),
      km: fieldStr(d.km),
      fuel: fieldStr(d.fuel),
      gear: fieldStr(d.gear),
      color: fieldStr(d.color),
      series: fieldStr(d.series),
      vehicleStatus: fieldStr(d.vehicleStatus),
      bodyType: fieldStr(d.bodyType),
      chassis: fieldStr(d.chassis),
      enginePower: fieldStr(d.enginePower),
      engineSize: fieldStr(d.engineSize),
      drive: fieldStr(d.drive),
      seats: fieldStr(d.seats),
      licenseRecord: fieldStr(d.licenseRecord),
      heavyDamage: fieldStr(d.heavyDamage),
      plateOrigin: fieldStr(d.plateOrigin),
      tramer: fieldStr(d.tramer),
      boyaDurumu: fieldStr(d.boyaDurumu),
      degisenDurumu: fieldStr(d.degisenDurumu),
      hasarDurumu: fieldStr(d.hasarDurumu),
    },
    housingExtras: [],
    vehicleExtras: [],
    images: [],
    mapPoint: null,
    premium: { titleBold: false, titleLarge: false, isColored: false, featuredDays: 0 },
    mode: "edit",
  });
}

export function AiBulkListingPanel({
  tokenBalance = 0,
  tokenCost = 2,
}: {
  tokenBalance?: number;
  tokenCost?: number;
}) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState(tokenBalance);
  const { tokenModal, ensureTokens, handleFetchResult, setTokenBalance } = useTokenBuyGate({
    continueLabel: "AI okumaya dön",
    title: "AI okuma için jeton gerekli",
    description:
      "Ekran görüntüsünü okuyup forma aktarmak jeton harcar. Bakiyeniz yetersiz. Jeton yükledikten sonra tekrar «AI ile oku ve forma aktar»a basabilirsiniz.",
    onPurchased: (b) => setBalance(b),
  });

  useEffect(() => {
    setBalance(tokenBalance);
  }, [tokenBalance]);

  const canParse = images.length >= 1 && images.length <= 2;

  async function parseAndOpenForm() {
    if (!canParse) {
      setErr("En az 1, en fazla 2 ekran görüntüsü yükleyin");
      return;
    }
    if (!ensureTokens(balance, tokenCost)) {
      setErr("");
      return;
    }
    setBusy(true);
    setErr("");

    const res = await fetch("/api/ai/parse-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrls: images }),
    });
    const data = await res.json().catch(() => ({}));
    if (handleFetchResult(res, data, tokenCost)) {
      if (typeof data.balance === "number") {
        setBalance(data.balance);
        setTokenBalance(data.balance);
      }
      setBusy(false);
      window.dispatchEvent(new Event("teklifbu:auth"));
      return;
    }
    if (!res.ok) {
      setErr(data.error || "AI okuma başarısız");
      if (typeof data.balance === "number") setBalance(data.balance);
      setBusy(false);
      window.dispatchEvent(new Event("teklifbu:auth"));
      return;
    }
    if (typeof data.balanceAfter === "number") setBalance(data.balanceAfter);
    window.dispatchEvent(new Event("teklifbu:auth"));

    const ok = draftToListingForm(data.draft as AiListingDraft, images);
    if (!ok) {
      setErr("Taslak kaydedilemedi (tarayıcı depolama)");
      setBusy(false);
      return;
    }

    setImages([]);
    router.push("/ilan-ver?from=ai");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {tokenModal}
      <div
        className="card"
        style={{
          padding: 22,
          background: "linear-gradient(135deg, #0b1f3a 0%, #1a3a5c 55%, #0f2744 100%)",
          color: "#fff",
          border: "none",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(255,102,0,.22)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={24} color="#ff8a3d" />
          </span>
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>AI ile ilan ekle</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, opacity: 0.94 }}>
              sahibinden.com ilan sayfanızın ekran görüntüsünü — ister <strong>tek tam sayfa</strong>, ister{" "}
              <strong>2 parça</strong> halinde — aşağıdaki alandan <strong>Fotoğraf ekle</strong> diyerek yükleyin.
              Ardından <strong>AI ile oku ve forma aktar</strong>’a tıklayın. Sistem bilgileri forma doldurur; siz
              kontrol edip yayınlarsınız.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                width: "fit-content",
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,102,0,.2)",
                border: "1px solid rgba(255,138,61,.45)",
                fontSize: 13.5,
                fontWeight: 800,
              }}
            >
              <Coins size={16} color="#ffb080" />
              Bu işlem <strong style={{ color: "#ffb080" }}>{tokenCost} jeton</strong> tutar · Bakiye:{" "}
              <strong>{balance}</strong>
            </div>
            {balance < tokenCost && (
              <Link href="/jeton" style={{ color: "#ffb080", fontWeight: 800, fontSize: 13.5 }}>
                Jeton yükle →
              </Link>
            )}
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          background: "#fffbeb",
          border: "1px solid #fcd34d",
        }}
      >
        <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#92400e" }}>
          <strong style={{ display: "block", marginBottom: 4 }}>Dikkat — bilgileri mutlaka kontrol edin</strong>
          AI okuma yardımcı bir araçtır; <strong>%100 doğru bilgi vereceğini garanti etmez</strong>. Forma aktarılan
          başlık, fiyat, adres, m², oda ve diğer alanları yayınlamadan önce mutlaka kontrol edin. Eksik veya hatalı
          alanları elle düzeltin. İlan ek özellikleri AI tarafından seçilmez.
        </div>
      </div>

      <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Ekran görüntüsü</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            1 veya 2 görsel yükleyebilirsiniz. Uzun sayfayı iki parçaya bölüp sırayla ekleyebilirsiniz.
          </p>
        </div>
        <ImageUploader images={images} onChange={setImages} max={2} />
      </div>

      <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
        <button
          type="button"
          className="btn-orange"
          disabled={busy || !canParse}
          onClick={() => void parseAndOpenForm()}
          style={{
            padding: "13px 18px",
            width: "fit-content",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            opacity: busy || !canParse ? 0.65 : 1,
            fontWeight: 800,
          }}
          title={
            !canParse
              ? "Önce 1–2 ekran görüntüsü yükleyin"
              : balance < tokenCost
                ? "Yetersiz jeton — tıklayınca jeton alma açılır"
                : undefined
          }
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {busy ? "AI okuyor, forma aktarılıyor…" : `AI ile oku ve forma aktar · ${tokenCost} jeton`}
        </button>
        {balance < tokenCost && canParse ? (
          <div style={{ fontSize: 13, color: "#9a3412", fontWeight: 650, lineHeight: 1.45 }}>
            Bakiyeniz yetersiz ({balance}/{tokenCost} jeton). Butona basınca jeton alma ekranı açılır.
          </div>
        ) : null}
        {err && (
          <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontSize: 13.5 }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
