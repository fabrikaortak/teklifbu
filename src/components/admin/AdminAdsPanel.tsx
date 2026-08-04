"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { AdminToast } from "@/components/admin/AdminToast";
import {
  DEFAULT_MID_BELT_BANNER,
  DEFAULT_TOP_BELT_BANNER,
  normalizeBeltBanner,
  type BeltBannerConfig,
} from "@/core/siteBeltBanners";
import type { AdminVertical } from "@/lib/adminVertical";
import { ADMIN_VERTICAL_META, contentMatchesVertical } from "@/lib/adminVertical";

type SlideForm = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  href: string;
  line1: string;
  line2: string;
  line3: string;
  subtitle: string;
  ctaOutline: string;
  ctaPrimary: string;
  hrefOutline: string;
  isPublished: boolean;
  sortOrder: number;
};

type AdsData = {
  settings: Record<string, unknown>;
  contents: Array<{
    id: string;
    slug: string;
    title: string;
    body: string;
    kind: string;
    isPublished: boolean;
    sortOrder: number;
  }>;
};

const emptyPromo = (): SlideForm => ({
  id: "",
  slug: "",
  title: "Banner",
  imageUrl: "",
  href: "",
  line1: "",
  line2: "",
  line3: "",
  subtitle: "",
  ctaOutline: "",
  ctaPrimary: "",
  hrefOutline: "",
  isPublished: true,
  sortOrder: 0,
});

const emptySidebar = (): SlideForm => ({
  id: "",
  slug: "",
  title: "Daha Fazla Görünürlük",
  imageUrl: "",
  href: "/ilan-ver",
  line1: "",
  line2: "",
  line3: "",
  subtitle: "Vitrin & Premium ile ilanınızı öne çıkarın.",
  ctaOutline: "Vitrin İlan",
  ctaPrimary: "Premium İlan",
  hrefOutline: "/ilan-ver",
  isPublished: true,
  sortOrder: 0,
});

function parseBody(body: string, kind: "PROMO" | "BANNER"): Partial<SlideForm> {
  const raw = String(body || "").trim();
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as Record<string, string>;
      if (kind === "PROMO") {
        return {
          imageUrl: j.imageUrl || j.image || "",
          href: j.hrefPrimary || j.href || "",
        };
      }
      return {
        imageUrl: j.imageUrl || j.image || "",
        href: j.hrefPrimary || j.href || "/ilan-ver",
        hrefOutline: j.hrefOutline || "/ilan-ver",
        line1: j.line1 || "",
        line2: j.line2 || "",
        line3: j.line3 || "",
        subtitle: j.subtitle || "",
        ctaOutline: j.ctaOutline || "Vitrin İlan",
        ctaPrimary: j.ctaPrimary || "Premium İlan",
      };
    } catch {
      /* ignore */
    }
  }
  if (raw.startsWith("/") || raw.startsWith("http")) {
    return { imageUrl: raw };
  }
  return {};
}

export function AdminAdsPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  const { confirm } = useDialog();
  const [data, setData] = useState<AdsData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState("");
  const [promoH, setPromoH] = useState(168);
  const [promoSec, setPromoSec] = useState(5);
  const [sideH, setSideH] = useState(148);
  const [sideSec, setSideSec] = useState(5);
  const [saving, setSaving] = useState(false);
  const [promoForm, setPromoForm] = useState<SlideForm>(emptyPromo());
  const [sideForm, setSideForm] = useState<SlideForm>(emptySidebar());
  const [topBelt, setTopBelt] = useState<BeltBannerConfig>(DEFAULT_TOP_BELT_BANNER);
  const [midBelt, setMidBelt] = useState<BeltBannerConfig>(DEFAULT_MID_BELT_BANNER);
  const [beltSaving, setBeltSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/admin?view=ads");
      if (!res.ok) {
        setLoadError(res.status === 403 ? "Yetkisiz — admin olarak giriş yapın." : "Veriler yüklenemedi.");
        setData(null);
        return;
      }
      const json = (await res.json()) as AdsData;
      // Dikeyde slug prefix varsa süz; yoksa tam paneli dikey başlığıyla göster (v1 shortcut)
      if (vertical) {
        json.contents = (json.contents || []).filter((c) =>
          contentMatchesVertical(c.slug, vertical)
        );
      }
      setData(json);
      setPromoH(Number(json.settings?.home_promo_banner_height_px ?? 168));
      setPromoSec(Number(json.settings?.home_promo_slide_seconds ?? 5));
      setSideH(Number(json.settings?.home_sidebar_banner_height_px ?? 148));
      setSideSec(Number(json.settings?.home_sidebar_slide_seconds ?? 5));
      setTopBelt(normalizeBeltBanner(json.settings?.site_top_belt_banner, DEFAULT_TOP_BELT_BANNER));
      setMidBelt(normalizeBeltBanner(json.settings?.site_mid_belt_banner, DEFAULT_MID_BELT_BANNER));
    } catch {
      setLoadError("Bağlantı hatası — sayfayı yenileyin.");
      setData(null);
    }
  }, [vertical]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError && !data) {
    return (
      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#b91c1c", fontWeight: 700 }}>{loadError}</div>
        <button className="btn-orange" style={{ padding: 12, width: 160 }} onClick={load}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  const contents = data.contents || [];
  const promos = contents.filter((c) => c.kind === "PROMO");
  const sidebars = contents.filter((c) => c.kind === "BANNER");

  /** Ana sayfa max genişlik (tema 4/5/6) → orta / sağ kolon banner genişliği */
  const PAGE_MAX: Record<string, number> = { "4": 1480, "5": 1640, "6": 1840 };
  const cols = String(data.settings?.v2_home_grid_cols || "4");
  const pageMax = PAGE_MAX[cols] || 1480;
  /** .v2-home: padding 16×2 + sol 252 + sağ 320 + gap 18×2 = 640 */
  const promoWidthPx = Math.max(0, pageMax - 640);
  const sideWidthPx = 320;
  const promoHLabel = Math.min(420, Math.max(40, Number(promoH) || 168));
  const sideHLabel = Math.min(360, Math.max(40, Number(sideH) || 148));
  const promoSizeLabel = `(${promoWidthPx} × ${promoHLabel} px)`;
  const sideSizeLabel = `(${sideWidthPx} × ${sideHLabel} px)`;

  async function saveDims() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: {
            ...data!.settings,
            home_promo_banner_height_px: Math.min(420, Math.max(40, Number(promoH) || 168)),
            home_promo_slide_seconds: Math.min(60, Math.max(2, Number(promoSec) || 5)),
            home_sidebar_banner_height_px: Math.min(360, Math.max(40, Number(sideH) || 148)),
            home_sidebar_slide_seconds: Math.min(60, Math.max(2, Number(sideSec) || 5)),
          },
        }),
      });
      if (!res.ok) {
        setMsg("Ayarlar kaydedilemedi");
        return;
      }
      setMsg("Banner boyut / süre kaydedildi — ana sayfayı yenileyin");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveSlide(kind: "PROMO" | "BANNER", form: SlideForm) {
    if (!form.imageUrl) {
      setMsg("Lütfen bir görsel veya GIF yükleyin");
      return;
    }
    const body =
      kind === "PROMO"
        ? JSON.stringify({
            imageUrl: form.imageUrl,
            href: String(form.href || "").trim(),
          })
        : JSON.stringify({
            imageUrl: form.imageUrl,
            subtitle: form.subtitle,
            href: form.href || "/ilan-ver",
            hrefOutline: form.hrefOutline || "/ilan-ver",
            hrefPrimary: form.href || "/ilan-ver",
            ctaOutline: form.ctaOutline || "Vitrin İlan",
            ctaPrimary: form.ctaPrimary || "Premium İlan",
          });

    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-content",
        id: form.id || undefined,
        slug: form.slug || `${kind === "PROMO" ? "promo" : "sidebar"}-${Date.now()}`,
        title:
          form.title ||
          (kind === "PROMO"
            ? String(form.href || "").trim() || `Slayt ${form.sortOrder || ""}`.trim() || "Banner"
            : "Daha Fazla Görünürlük"),
        body,
        kind,
        isPublished: form.isPublished,
        sortOrder: form.sortOrder,
      }),
    });
    if (!res.ok) {
      setMsg("Slayt kaydedilemedi");
      return;
    }
    setMsg(kind === "PROMO" ? "Üst banner slaytı kaydedildi" : "Sağ alt banner slaytı kaydedildi");
    if (kind === "PROMO") setPromoForm(emptyPromo());
    else setSideForm(emptySidebar());
    await load();
  }

  async function removeSlide(c: { id: string; title: string }) {
    const ok = await confirm({
      title: "Slaytı sil",
      message: `"${c.title}" silinsin mi?`,
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!ok) return;
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-content", id: c.id }),
    });
    setMsg("Slayt silindi");
    await load();
  }

  function SlideTable({
    rows,
    kind,
    onEdit,
  }: {
    rows: AdsData["contents"];
    kind: "PROMO" | "BANNER";
    onEdit: (c: AdsData["contents"][0]) => void;
  }) {
    const isPromo = kind === "PROMO";
    return (
      <table className="adm-table">
        <thead>
          <tr>
            <th>Önizleme</th>
            <th>{isPromo ? "Link" : "Başlık"}</th>
            <th>Sıra</th>
            <th>Yayında</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const parsed = parseBody(c.body, kind);
            return (
              <tr key={c.id}>
                <td>
                  {parsed.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={parsed.imageUrl}
                      alt=""
                      style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6, background: "#e2e8f0" }}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isPromo ? parsed.href || "—" : c.title}
                </td>
                <td>{c.sortOrder}</td>
                <td>{c.isPublished ? "Evet" : "Hayır"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn-outline" style={{ padding: "6px 10px" }} onClick={() => onEdit(c)}>
                    Düzenle
                  </button>
                  <button className="btn-outline" style={{ padding: "6px 10px" }} onClick={() => removeSlide(c)}>
                    Sil
                  </button>
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={5} style={{ color: "var(--adm-muted)" }}>
                Henüz slayt yok. Aşağıdan görsel / GIF ekleyin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  async function saveBeltBanners() {
    if (topBelt.enabled && !topBelt.imageUrl) {
      setMsg("Kuşak üstü banner açıkken görsel gerekli");
      return;
    }
    if (midBelt.enabled && !midBelt.imageUrl) {
      setMsg("Kuşak altı banner açıkken görsel gerekli");
      return;
    }
    setBeltSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: {
            site_top_belt_banner: normalizeBeltBanner(topBelt, DEFAULT_TOP_BELT_BANNER),
            site_mid_belt_banner: normalizeBeltBanner(midBelt, DEFAULT_MID_BELT_BANNER),
          },
        }),
      });
      if (!res.ok) {
        setMsg("Kuşak bannerları kaydedilemedi");
        return;
      }
      setMsg("Kuşak bannerları kaydedildi — siteyi yenileyin");
      await load();
    } finally {
      setBeltSaving(false);
    }
  }

  function BeltEditor({
    title,
    hint,
    value,
    onChange,
  }: {
    title: string;
    hint: string;
    value: BeltBannerConfig;
    onChange: (next: BeltBannerConfig) => void;
  }) {
    return (
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 14,
          borderRadius: 12,
          border: "1px solid var(--adm-line, #e2e8f0)",
          background: value.enabled ? "#fff7ed" : "#f8fafc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <strong style={{ fontSize: 14 }}>{title}</strong>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--adm-muted)", lineHeight: 1.45 }}>{hint}</p>
          </div>
          <button
            type="button"
            className={value.enabled ? "btn-orange" : "btn-outline"}
            style={{ padding: "8px 14px", minWidth: 88, flexShrink: 0 }}
            onClick={() => onChange({ ...value, enabled: !value.enabled })}
          >
            {value.enabled ? "Açık" : "Kapalı"}
          </button>
        </div>
        <ImageUploader
          images={value.imageUrl ? [value.imageUrl] : []}
          onChange={(imgs) => onChange({ ...value, imageUrl: imgs[0] || "" })}
          max={1}
        />
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Tıklanınca gidilecek URL</span>
          <input
            className="input"
            placeholder="https://… veya /ilan-ver"
            value={value.href}
            onChange={(e) => onChange({ ...value, href: e.target.value })}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Yükseklik (px)</span>
            <input
              className="input"
              type="number"
              min={40}
              max={400}
              value={value.heightPx}
              onChange={(e) => onChange({ ...value, heightPx: Number(e.target.value) || 90 })}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Genişlik (px)</span>
            <input
              className="input"
              type="number"
              min={0}
              max={2400}
              value={value.widthPx}
              onChange={(e) => onChange({ ...value, widthPx: Number(e.target.value) || 0 })}
            />
            <span style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>0 = tam genişlik</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-panel-wrap">
      {vertical ? (
        <div className="adm-card" style={{ fontSize: 13, marginBottom: 4 }}>
          Dikey reklam alanları: <strong>{ADMIN_VERTICAL_META[vertical].label}</strong>
          {" · "}
          Slug öneki <code>{ADMIN_VERTICAL_META[vertical].contentSlugPrefix}</code> ile filtrelenir;
          site-geneli kuşak bannerları Platform → Reklam menüsündedir.
        </div>
      ) : null}
      <AdminToast
        message={msg || null}
        tone={msg && /edilmedi|hata|Lütfen|gerekli/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />

      <div className="adm-card" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Kuşak bannerları (sahibinden tarzı)</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Varsayılan <strong>kapalı</strong>. Açınca görsel + yükseklik/genişlik + tıklanınca URL. Üstteki header’ın
            üstüne boydan boya; alttaki ise kategori kuşağı ile ilan kartlarının arasına yerleşir.
          </p>
        </div>
        <BeltEditor
          title="1) Kuşak üstü — boydan boya"
          hint="Header’ın hemen üstünde tam genişlik şerit (ör. sponsor bandı)."
          value={topBelt}
          onChange={setTopBelt}
        />
        <BeltEditor
          title="2) Kuşak altı — kartların üstü"
          hint="Kategori şeridi ile ana sayfa ilan kartlarının arasında."
          value={midBelt}
          onChange={setMidBelt}
        />
        <button
          className="btn-orange"
          style={{ padding: 12, width: 220 }}
          disabled={beltSaving}
          onClick={saveBeltBanners}
        >
          {beltSaving ? "Kaydediliyor…" : "Kuşak Bannerlarını Kaydet"}
        </button>
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          Üst banner{" "}
          <span style={{ fontWeight: 600, color: "var(--adm-muted)", fontSize: 14 }}>{promoSizeLabel}</span>
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
          Ana sayfa istatistiklerin altındaki orta reklam alanı. Sadece görsel / GIF; yazı yok. İsterseniz her slayta
          tıklanınca gidecek bir link ekleyin. Banner genişliği 4/5/6 ilan temasına göre otomatik büyür. Yükseklik ve
          geçiş süresi buradan ayarlanır. JPG, PNG, WEBP ve <strong>GIF</strong> yüklenebilir.
        </p>
        <SlideTable
          rows={promos}
          kind="PROMO"
          onEdit={(c) =>
            setPromoForm({
              ...emptyPromo(),
              id: c.id,
              slug: c.slug,
              title: c.title,
              isPublished: c.isPublished,
              sortOrder: c.sortOrder,
              ...parseBody(c.body, "PROMO"),
            } as SlideForm)
          }
        />
        <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--adm-line, #e2e8f0)", paddingTop: 12 }}>
          <strong style={{ fontSize: 14 }}>{promoForm.id ? "Slayt düzenle" : "Yeni üst banner slaytı"}</strong>
          <ImageUploader
            images={promoForm.imageUrl ? [promoForm.imageUrl] : []}
            onChange={(imgs) => setPromoForm({ ...promoForm, imageUrl: imgs[0] || "" })}
            max={1}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, alignItems: "center" }}>
            <input
              className="input"
              placeholder="Link (opsiyonel) — örn. /ilan-ver veya https://…"
              value={promoForm.href}
              onChange={(e) => setPromoForm({ ...promoForm, href: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Sıra"
              value={promoForm.sortOrder}
              onChange={(e) => setPromoForm({ ...promoForm, sortOrder: Number(e.target.value) })}
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={promoForm.isPublished}
                onChange={(e) => setPromoForm({ ...promoForm, isPublished: e.target.checked })}
              />
              Yayında
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-orange" style={{ padding: "10px 14px" }} onClick={() => saveSlide("PROMO", promoForm)}>
              {promoForm.id ? "Güncelle" : "Slayt Ekle"}
            </button>
            {promoForm.id ? (
              <button className="btn-outline" style={{ padding: "10px 14px" }} onClick={() => setPromoForm(emptyPromo())}>
                Vazgeç
              </button>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            borderTop: "1px solid var(--adm-line, #e2e8f0)",
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          <strong style={{ fontSize: 14 }}>Üst banner yüksekliği / süre</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, maxWidth: 560, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Yükseklik (px)</span>
              <input
                className="input"
                type="number"
                min={40}
                max={420}
                value={promoH}
                onChange={(e) => setPromoH(Number(e.target.value))}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Slayt süresi (sn)</span>
              <input
                className="input"
                type="number"
                min={2}
                max={60}
                value={promoSec}
                onChange={(e) => setPromoSec(Number(e.target.value))}
              />
            </label>
            <button className="btn-orange" style={{ padding: "10px 14px" }} disabled={saving} onClick={saveDims}>
              Kaydet
            </button>
          </div>
        </div>
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          Sağ alt banner{" "}
          <span style={{ fontWeight: 600, color: "var(--adm-muted)", fontSize: 14 }}>{sideSizeLabel}</span>
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
          Jeton paketlerinin altındaki sağ kolon reklam alanı. Banner genişliği 4/5/6 ilan temasına göre otomatik büyür.
          Yükseklik ve geçiş süresi buradan ayarlanır. JPG, PNG, WEBP ve <strong>GIF</strong> yüklenebilir.
        </p>
        <SlideTable
          rows={sidebars}
          kind="BANNER"
          onEdit={(c) =>
            setSideForm({
              ...emptySidebar(),
              id: c.id,
              slug: c.slug,
              title: c.title,
              isPublished: c.isPublished,
              sortOrder: c.sortOrder,
              ...parseBody(c.body, "BANNER"),
            } as SlideForm)
          }
        />
        <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--adm-line, #e2e8f0)", paddingTop: 12 }}>
          <strong style={{ fontSize: 14 }}>{sideForm.id ? "Slayt düzenle" : "Yeni sağ alt banner slaytı"}</strong>
          <ImageUploader
            images={sideForm.imageUrl ? [sideForm.imageUrl] : []}
            onChange={(imgs) => setSideForm({ ...sideForm, imageUrl: imgs[0] || "" })}
            max={1}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input className="input" placeholder="Başlık (kullanıcıya görünür)" value={sideForm.title} onChange={(e) => setSideForm({ ...sideForm, title: e.target.value })} />
            <input className="input" placeholder="Alt yazı" value={sideForm.subtitle} onChange={(e) => setSideForm({ ...sideForm, subtitle: e.target.value })} />
            <input className="input" placeholder="Vitrin buton" value={sideForm.ctaOutline} onChange={(e) => setSideForm({ ...sideForm, ctaOutline: e.target.value })} />
            <input className="input" placeholder="Premium buton" value={sideForm.ctaPrimary} onChange={(e) => setSideForm({ ...sideForm, ctaPrimary: e.target.value })} />
            <input className="input" placeholder="Vitrin link" value={sideForm.hrefOutline} onChange={(e) => setSideForm({ ...sideForm, hrefOutline: e.target.value })} />
            <input className="input" placeholder="Premium / ana link" value={sideForm.href} onChange={(e) => setSideForm({ ...sideForm, href: e.target.value })} />
            <input className="input" type="number" placeholder="Sıra" value={sideForm.sortOrder} onChange={(e) => setSideForm({ ...sideForm, sortOrder: Number(e.target.value) })} />
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <input type="checkbox" checked={sideForm.isPublished} onChange={(e) => setSideForm({ ...sideForm, isPublished: e.target.checked })} />
              Yayında
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-orange" style={{ padding: "10px 14px" }} onClick={() => saveSlide("BANNER", sideForm)}>
              {sideForm.id ? "Güncelle" : "Slayt Ekle"}
            </button>
            {sideForm.id ? (
              <button className="btn-outline" style={{ padding: "10px 14px" }} onClick={() => setSideForm(emptySidebar())}>
                Vazgeç
              </button>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            borderTop: "1px solid var(--adm-line, #e2e8f0)",
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          <strong style={{ fontSize: 14 }}>Sağ alt banner yüksekliği / süre</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, maxWidth: 560, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Yükseklik (px)</span>
              <input
                className="input"
                type="number"
                min={40}
                max={360}
                value={sideH}
                onChange={(e) => setSideH(Number(e.target.value))}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Slayt süresi (sn)</span>
              <input
                className="input"
                type="number"
                min={2}
                max={60}
                value={sideSec}
                onChange={(e) => setSideSec(Number(e.target.value))}
              />
            </label>
            <button className="btn-orange" style={{ padding: "10px 14px" }} disabled={saving} onClick={saveDims}>
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
