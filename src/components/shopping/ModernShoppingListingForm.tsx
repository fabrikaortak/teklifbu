"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  Check,
  Gem,
  Italic,
  Megaphone,
  Save,
  Strikethrough,
  Underline,
} from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { LocationSelect } from "@/components/LocationSelect";
import { CITY_NAMES, getDistricts } from "@/data/turkey-locations";
import { ALISVERIS_BROWSE_TREE } from "@/data/classicBrowseTree";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { SHOP_PHONE_MODELS, shopBrandNamesFor } from "@/data/shopBrowseChildren";
import { validateListingDescription } from "@/lib/listingDescription";
import { formatMoneyTr, parseMoneyTr } from "@/lib/format";
import {
  clearListingDraft,
  readListingDraft,
  writeListingDraft,
} from "@/lib/listingDraft";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { useAlisverisBrowseTree } from "@/hooks/useAlisverisBrowseTree";
import { CatalogOfferWizard } from "@/components/shopping/CatalogOfferWizard";

const STEPS = [
  { id: 1, label: "Temel Bilgiler" },
  { id: 2, label: "Ürün Detayları" },
  { id: 3, label: "Fotoğraflar" },
  { id: 4, label: "Fiyat & Teslimat" },
  { id: 5, label: "Önizleme & Yayınla" },
] as const;

const CONDITIONS = [
  { key: "sifir", label: "Sıfır", root: "sifir-urun" as const },
  { key: "ikinci", label: "İkinci El", root: "ikinci-el" as const },
  { key: "yenilenmis", label: "Yenilenmiş", root: "ikinci-el" as const },
];

const STORAGE_OPTS = ["128 GB", "256 GB", "512 GB", "1 TB"];
const COLOR_OPTS = [
  { id: "space-black", label: "Uzay Siyahı", hex: "#1c1c1e" },
  { id: "silver", label: "Gümüş", hex: "#c0c0c5" },
  { id: "gold", label: "Altın", hex: "#d4af37" },
  { id: "purple", label: "Mor", hex: "#5e5ce6" },
];

function shoppingPathMeta(path: BrowseNode[]) {
  let categorySlug = "";
  let subSlug = "";
  let subtype: string | null = null;
  let brandFromPath = "";
  for (const n of path) {
    const cat = String(n.filter.category || "");
    if (cat && !cat.includes(",")) {
      categorySlug = cat;
      const m = cat.match(/^(?:ikinci-el|sifir-urun)-(.+)$/);
      if (m) subSlug = m[1];
    }
    if (n.filter.subtype) subtype = String(n.filter.subtype);
    if (n.filter.brand) brandFromPath = String(n.filter.brand);
  }
  return { categorySlug, subSlug, subtype, brandFromPath };
}

type Promote = "standard" | "feature3" | "premium7";

function isPhoneCategory(slug: string, subSlug: string) {
  return /cep-telefonu|telefon/i.test(slug) || subSlug === "cep-telefonu";
}

export function ModernShoppingListingForm() {
  const router = useRouter();
  const { alert } = useDialog();
  const [step, setStep] = useState(1);
  const [path, setPath] = useState<BrowseNode[]>([]);
  const [condition, setCondition] = useState<"sifir" | "ikinci" | "yenilenmis">("ikinci");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("256 GB");
  const [colorId, setColorId] = useState("space-black");
  const [sku, setSku] = useState("");
  const [stockQty, setStockQty] = useState("1");
  const [warranty, setWarranty] = useState("");
  const [highlights, setHighlights] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [askPrice, setAskPrice] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [city, setCity] = useState("İstanbul");
  const [district, setDistrict] = useState("Kadıköy");
  const [shippingFree, setShippingFree] = useState(true);
  const [days, setDays] = useState("30");
  const [promote, setPromote] = useState<Promote>("standard");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const { tree: alisverisTree, meta: browseMeta } = useAlisverisBrowseTree();
  if (browseMeta.source === "fallback-ts" && browseMeta.warning !== "loading") {
    // already logged in hook
  }

  const levels = useMemo(() => {
    const root = alisverisTree.length ? alisverisTree : ALISVERIS_BROWSE_TREE;
    const out: Array<{ options: BrowseNode[]; selectedId: string }> = [
      { options: root, selectedId: path[0]?.id || "" },
    ];
    for (let i = 0; i < path.length; i++) {
      const children = path[i].children;
      if (children?.length) {
        out.push({ options: children, selectedId: path[i + 1]?.id || "" });
      }
    }
    return out;
  }, [path, alisverisTree]);

  const { categorySlug, subSlug, subtype, brandFromPath } = useMemo(
    () => shoppingPathMeta(path),
    [path]
  );
  const phoneMode = isPhoneCategory(categorySlug, subSlug);
  const color = COLOR_OPTS.find((c) => c.id === colorId) || COLOR_OPTS[0];
  const [categoryId, setCategoryId] = useState("");
  const [modelMode, setModelMode] = useState<"REQUIRED" | "OPTIONAL" | "DISABLED">("OPTIONAL");
  const [dbBrands, setDbBrands] = useState<string[]>([]);
  const [dbModels, setDbModels] = useState<string[]>([]);
  const [dbAttrs, setDbAttrs] = useState<
    Array<{
      slug: string;
      name: string;
      type: string;
      isVariant: boolean;
      options: Array<{ label: string; value: string }>;
    }>
  >([]);
  const [apiBrandsOk, setApiBrandsOk] = useState(false);
  const [apiModelsOk, setApiModelsOk] = useState(false);
  const [sellMode, setSellMode] = useState<"listing" | "catalog">("listing");
  const [brandId, setBrandId] = useState("");
  const [brandRows, setBrandRows] = useState<Array<{ id: string; name: string }>>([]);
  const [modelId, setModelId] = useState("");
  const [modelRows, setModelRows] = useState<Array<{ id: string; name: string }>>([]);

  const catalogBrands = useMemo(() => {
    if (apiBrandsOk) return dbBrands.length ? dbBrands : ["Diğer"];
    if (!subSlug) return ["Diğer"];
    const names = shopBrandNamesFor(subSlug, subtype);
    return names.length ? names : ["Diğer"];
  }, [apiBrandsOk, dbBrands, subSlug, subtype]);

  const models = useMemo(() => {
    if (apiModelsOk) return dbModels;
    return SHOP_PHONE_MODELS[brand] || [];
  }, [apiModelsOk, dbModels, brand]);

  const showModelField = modelMode !== "DISABLED";

  useEffect(() => {
    let cancelled = false;
    async function loadBrands() {
      if (!subSlug && !categorySlug) {
        setDbBrands([]);
        setCategoryId("");
        setApiBrandsOk(false);
        return;
      }
      try {
        const qs = categorySlug
          ? `categorySlug=${encodeURIComponent(categorySlug)}`
          : `subSlug=${encodeURIComponent(subSlug)}`;
        const res = await fetch(`/api/catalog/brands?${qs}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setApiBrandsOk(false);
          return;
        }
        setApiBrandsOk(true);
        const list = (data.brands || []) as Array<{ id: string; name: string }>;
        setBrandRows(list);
        const names = list.map((b) => b.name).filter(Boolean);
        setDbBrands(names);
        if (data.categoryId) setCategoryId(String(data.categoryId));
        if (data.modelMode === "REQUIRED" || data.modelMode === "OPTIONAL" || data.modelMode === "DISABLED") {
          setModelMode(data.modelMode);
        }
      } catch {
        if (!cancelled) {
          setDbBrands([]);
          setApiBrandsOk(false);
        }
      }
    }
    void loadBrands();
    return () => {
      cancelled = true;
    };
  }, [categorySlug, subSlug]);

  useEffect(() => {
    let cancelled = false;
    async function loadModelsAndAttrs() {
      if (!categorySlug && !categoryId) {
        setDbModels([]);
        setDbAttrs([]);
        setApiModelsOk(false);
        return;
      }
      try {
        const catQs = categoryId
          ? `categoryId=${encodeURIComponent(categoryId)}`
          : `categorySlug=${encodeURIComponent(categorySlug)}`;
        const brandQs = brand ? `&brand=${encodeURIComponent(brand)}` : "";
        const [mRes, aRes] = await Promise.all([
          fetch(`/api/catalog/models?${catQs}${brandQs}`),
          fetch(`/api/catalog/attributes?${catQs}`),
        ]);
        const mData = await mRes.json();
        const aData = await aRes.json();
        if (cancelled) return;
        if (mData.ok) {
          setApiModelsOk(true);
          const list = (mData.models || []) as Array<{ id: string; name: string }>;
          setModelRows(list);
          setDbModels(list.map((m) => m.name).filter(Boolean));
          if (mData.modelMode === "REQUIRED" || mData.modelMode === "OPTIONAL" || mData.modelMode === "DISABLED") {
            setModelMode(mData.modelMode);
          }
        } else {
          setApiModelsOk(false);
        }
        if (aData.ok) {
          setDbAttrs(
            (aData.attributes || [])
              .filter((a: { formVisible?: boolean }) => a.formVisible !== false)
              .map(
                (a: {
                  slug: string;
                  name: string;
                  type: string;
                  isVariant: boolean;
                  options: Array<{ label: string; value: string }>;
                }) => ({
                  slug: a.slug,
                  name: a.name,
                  type: a.type,
                  isVariant: Boolean(a.isVariant),
                  options: a.options || [],
                })
              )
          );
          if (aData.modelMode === "REQUIRED" || aData.modelMode === "OPTIONAL" || aData.modelMode === "DISABLED") {
            setModelMode(aData.modelMode);
          }
        }
      } catch {
        if (!cancelled) {
          setApiModelsOk(false);
          setDbModels([]);
        }
      }
    }
    void loadModelsAndAttrs();
    return () => {
      cancelled = true;
    };
  }, [categorySlug, categoryId, brand]);

  useEffect(() => {
    if (brandFromPath && brandFromPath !== brand) {
      setBrand(brandFromPath);
      setModel("");
    }
  }, [brandFromPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const d = readListingDraft();
    if (!d || !d.form?.title) return;
    // soft restore title/desc/images if draft exists
    if (d.form.title) setTitle(d.form.title);
    if (d.form.description) setDescription(d.form.description);
    if (d.form.askPrice) setAskPrice(d.form.askPrice);
    if (d.form.city) setCity(d.form.city);
    if (d.form.district) setDistrict(d.form.district);
    if (d.form.days) setDays(d.form.days);
    if (d.images?.length) setImages(d.images);
    if (d.attrs?.brand) setBrand(d.attrs.brand);
    if (d.attrs?.model) setModel(d.attrs.model);
    if (d.attrs?.color) {
      const hit = COLOR_OPTS.find((c) => c.label === d.attrs.color);
      if (hit) setColorId(hit.id);
    }
    if (d.premium?.featuredDays === 7) setPromote("premium7");
    else if (d.premium?.featuredDays === 3) setPromote("feature3");
  }, []);

  const saveDraft = useCallback(() => {
    const featuredDays = promote === "premium7" ? 7 : promote === "feature3" ? 3 : 0;
    writeListingDraft({
      savedAt: Date.now(),
      form: {
        title,
        description,
        city,
        district,
        neighborhood: "",
        dealType: "SATILIK",
        askPrice,
        categorySlug: categorySlug || "ikinci-el-cep-telefonu",
        days,
      },
      attrs: {
        brand,
        model,
        condition:
          condition === "sifir" ? "Sıfır" : condition === "yenilenmis" ? "Yenilenmiş" : "İyi",
        color: color.label,
        sku,
        stockQty,
        warranty,
        highlights,
        listPrice,
        storage,
        shippingFree: shippingFree ? "1" : "0",
      },
      housingExtras: [],
      vehicleExtras: [],
      images,
      mapPoint: null,
      premium: {
        titleBold: promote !== "standard",
        titleLarge: promote === "premium7",
        isColored: promote === "premium7",
        featuredDays: featuredDays as 0 | 3 | 7,
      },
      mode: "edit",
    });
    setMsg("Taslak kaydedildi");
    setTimeout(() => setMsg(""), 2200);
  }, [
    title,
    description,
    city,
    district,
    askPrice,
    categorySlug,
    days,
    brand,
    model,
    condition,
    color.label,
    sku,
    stockQty,
    warranty,
    highlights,
    listPrice,
    storage,
    shippingFree,
    images,
    promote,
  ]);

  function pickLevel(idx: number, nodeId: string) {
    if (!nodeId) {
      setPath((p) => p.slice(0, idx));
      return;
    }
    const options = levels[idx]?.options || [];
    const node = options.find((o) => o.id === nodeId);
    if (!node) return;
    setPath((p) => [...p.slice(0, idx), node]);
  }

  function applyCondition(key: "sifir" | "ikinci" | "yenilenmis") {
    setCondition(key);
    const root = CONDITIONS.find((c) => c.key === key)?.root;
    if (!root || path.length < 2) return;
    // Try switch second level to matching Sıfır / İkinci El under same group
    const group = path[0];
    const match = group.children?.find((c) => c.id.endsWith(`/${root}`) || c.id.includes(root));
    if (match) {
      setPath([group, match]);
    }
  }

  async function publish() {
    if (!categorySlug) {
      await alert({ title: "Kategori", message: "Kategori seçimini tamamlayın.", tone: "warning" });
      setStep(1);
      return;
    }
    if (!title.trim()) {
      await alert({ title: "Başlık", message: "İlan başlığı gerekli.", tone: "warning" });
      setStep(1);
      return;
    }
    const desc = validateListingDescription(description);
    if (!desc.ok) {
      await alert({ title: "Açıklama", message: desc.error || "Açıklama geçersiz", tone: "warning" });
      setStep(1);
      return;
    }
    if (!images.length) {
      await alert({ title: "Fotoğraf", message: "En az bir fotoğraf ekleyin.", tone: "warning" });
      setStep(3);
      return;
    }
    const price = parseMoneyTr(askPrice);
    if (!price) {
      await alert({ title: "Fiyat", message: "Geçerli bir satış fiyatı girin.", tone: "warning" });
      setStep(4);
      return;
    }

    const featuredDays = promote === "premium7" ? 7 : promote === "feature3" ? 3 : 0;
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        city,
        district,
        neighborhood: "",
        dealType: "SATILIK",
        askPrice: Math.round(price * 100) / 100,
        categorySlug,
        days: Number(days) || 30,
        coverImage: images[0],
        images,
        attributes: {
          brand,
          model: phoneMode && storage ? `${model}${model ? " · " : ""}${storage}` : model,
          condition:
            condition === "sifir" ? "Sıfır" : condition === "yenilenmis" ? "Yenilenmiş" : "İyi",
          color: color.label,
          sku,
          stockQty,
          warranty,
          highlights,
          listPrice,
          shippingFree: shippingFree ? "1" : "0",
          storage,
          ...(subtype ? { subtype } : {}),
        },
        titleBold: promote !== "standard",
        titleLarge: promote === "premium7",
        isColored: promote === "premium7",
        featuredDays,
        escrowEligible: true,
      };

      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 402 && data.code === "LISTING_FEE_REQUIRED") {
        // Ücretli ilan → klasik akışa taslakla aktar
        saveDraft();
        setBusy(false);
        await alert({
          title: "Ücretli ilan",
          message:
            data.error ||
            "Bu ilan ücretlidir. Ödeme için klasik yayın ekranına yönlendiriliyorsunuz.",
          tone: "info",
        });
        router.push("/ilan-ver?kind=alisveris&resume=1");
        return;
      }

      if (!res.ok) {
        setBusy(false);
        await alert({
          title: "Yayınlanamadı",
          message: data.error || "İlan kaydedilemedi.",
          tone: "danger",
        });
        return;
      }

      clearListingDraft();
      setBusy(false);
      await alert({
        title: "İlan gönderildi",
        message:
          typeof data.message === "string"
            ? data.message
            : "İlanınız yönetici onayına gönderildi.",
        tone: "success",
      });
      router.push("/hesabim?s=ilanlarim");
    } catch {
      setBusy(false);
      await alert({ title: "Hata", message: "Bağlantı hatası. Tekrar deneyin.", tone: "danger" });
    }
  }

  function Stepper() {
    return (
      <div className="msf-stepper" aria-label="İlan adımları">
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className={`msf-step${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
              {i > 0 ? <span className="msf-step__line" aria-hidden /> : null}
              <button
                type="button"
                className="msf-step__btn"
                onClick={() => setStep(s.id)}
                aria-current={active ? "step" : undefined}
              >
                <span className="msf-step__num">{done ? <Check size={14} strokeWidth={3} /> : s.id}</span>
                <span className="msf-step__label">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
    return (
      <div className="msf-label">
        <span>{children}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
    );
  }

  return (
    <div className="msf">
      <header className="msf-head">
        <div>
          <Link href="/hesabim?s=ozet" className="msf-back">
            <ArrowLeft size={15} strokeWidth={2.4} /> Hesabıma dön
          </Link>
          <h1>Yeni Alışveriş İlanı Oluştur</h1>
          <p>Ürününüzü adım adım ekleyin; kategori, durum ve görselleri eksiksiz doldurun.</p>
        </div>
        <button type="button" className="msf-draft-btn" onClick={saveDraft}>
          <Save size={16} strokeWidth={2.2} />
          Taslak Olarak Kaydet
        </button>
      </header>

      {msg ? <div className="msf-toast">{msg}</div> : null}

      <Stepper />

      {step === 1 ? (
        <div className="msf-card">
          <h2>Temel Bilgiler</h2>
          <div className="msf-seg" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`msf-seg__btn${sellMode === "listing" ? " is-on" : ""}`}
              onClick={() => setSellMode("listing")}
            >
              Klasik ilan (Listing)
            </button>
            <button
              type="button"
              className={`msf-seg__btn${sellMode === "catalog" ? " is-on" : ""}`}
              onClick={() => setSellMode("catalog")}
            >
              Katalog teklifi (SellerOffer)
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Kategori</FieldLabel>
            <div className="msf-cat-row">
              {levels.map((level, idx) => (
                <select
                  key={`cat-top-${idx}`}
                  className="msf-select"
                  value={level.selectedId}
                  onChange={(e) => pickLevel(idx, e.target.value)}
                >
                  <option value="">{idx === 0 ? "Ana kategori" : "Seçin…"}</option>
                  {level.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>

          {sellMode === "catalog" ? (
            <CatalogOfferWizard
              categoryId={categoryId || undefined}
              brandId={brandId || brandRows.find((b) => b.name === brand)?.id || undefined}
              modelId={modelId || modelRows.find((m) => m.name === model)?.id || undefined}
              city={city}
              district={district}
            />
          ) : (
            <>
          <div className="msf-grid-2">
            <div className="msf-col">
              <FieldLabel hint="Kısa, net ve aranabilir bir başlık yazın.">İlan Başlığı</FieldLabel>
              <div className="msf-input-wrap">
                <input
                  className="msf-input"
                  value={title}
                  maxLength={90}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: iPhone 14 Pro Max 256 GB Uzay Siyahı"
                />
                <span className="msf-counter">
                  {title.length} / 90
                </span>
              </div>

              <FieldLabel>İlan Açıklaması</FieldLabel>
              <div className="msf-editor">
                <div className="msf-editor__bar">
                  <div className="msf-editor__tools">
                    <button type="button" className="msf-ico" title="Kalın" onClick={() => setDescription((d) => `**${d}**`)}>
                      <Bold size={14} />
                    </button>
                    <button type="button" className="msf-ico" title="İtalik">
                      <Italic size={14} />
                    </button>
                    <button type="button" className="msf-ico" title="Altı çizili">
                      <Underline size={14} />
                    </button>
                    <button type="button" className="msf-ico" title="Üstü çizili">
                      <Strikethrough size={14} />
                    </button>
                  </div>
                  <span className="msf-editor__tpl">Şablonlar ▾</span>
                </div>
                <textarea
                  className="msf-textarea"
                  value={description}
                  maxLength={4000}
                  rows={8}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ürünün durumunu, kutusunu, aksesuarlarını ve varsa kusurlarını yazın…"
                />
                <span className="msf-counter msf-counter--editor">{description.length} / 4000</span>
              </div>
            </div>

            <div className="msf-col">
              <FieldLabel>Ürün Durumu</FieldLabel>
              <div className="msf-seg">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`msf-seg__btn${condition === c.key ? " is-on" : ""}`}
                    onClick={() => applyCondition(c.key as "sifir" | "ikinci" | "yenilenmis")}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <FieldLabel>Marka</FieldLabel>
              <select
                className="msf-select msf-select--full"
                value={brand}
                onChange={(e) => {
                  const name = e.target.value;
                  setBrand(name);
                  setBrandId(brandRows.find((b) => b.name === name)?.id || "");
                  setModel("");
                  setModelId("");
                }}
              >
                <option value="">Marka seçin</option>
                {catalogBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              {showModelField ? (
                <>
                  <FieldLabel hint={modelMode === "REQUIRED" ? "Zorunlu" : "Opsiyonel"}>Model</FieldLabel>
                  {(apiModelsOk ? models.length > 0 : phoneMode && models.length > 0) ? (
                    <select
                      className="msf-select msf-select--full"
                      value={model}
                      onChange={(e) => {
                        const name = e.target.value;
                        setModel(name);
                        setModelId(modelRows.find((m) => m.name === name)?.id || "");
                      }}
                      required={modelMode === "REQUIRED"}
                    >
                      <option value="">Model seçin</option>
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="msf-input"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Model"
                      required={modelMode === "REQUIRED"}
                    />
                  )}
                </>
              ) : null}

              {phoneMode ? (
                <>
                  <FieldLabel>Depolama Kapasitesi</FieldLabel>
                  <div className="msf-seg msf-seg--wrap">
                    {(
                      dbAttrs.find((a) => a.slug === "depolama")?.options.map((o) => o.label) ||
                      STORAGE_OPTS
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`msf-seg__btn${storage === s ? " is-on" : ""}`}
                        onClick={() => setStorage(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <FieldLabel>Renk</FieldLabel>
                  <div className="msf-colors">
                    {COLOR_OPTS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        className={`msf-swatch${colorId === c.id ? " is-on" : ""}`}
                        style={{ background: c.hex }}
                        onClick={() => setColorId(c.id)}
                        aria-label={c.label}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="msf-promote">
            <h3>Öne Çıkar <span>(isteğe bağlı)</span></h3>
            <div className="msf-promote__row">
              {(
                [
                  { id: "standard" as const, title: "Standart", price: "Ücretsiz", icon: null },
                  { id: "feature3" as const, title: "Öne Çıkar", price: "79 Jeton", icon: <Megaphone size={18} /> },
                  { id: "premium7" as const, title: "Premium", price: "159 Jeton", icon: <Gem size={18} /> },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`msf-promote__card${promote === p.id ? " is-on" : ""}`}
                  onClick={() => setPromote(p.id)}
                >
                  <span className={`msf-radio${promote === p.id ? " is-on" : ""}`} />
                  <span className="msf-promote__body">
                    {p.icon}
                    <strong>{p.title}</strong>
                    <em>{p.price}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>
            </>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="msf-card">
          <h2>Ürün Detayları</h2>
          <div className="msf-grid-2">
            <div className="msf-col">
              <FieldLabel>Stok kodu (SKU)</FieldLabel>
              <input className="msf-input" value={sku} onChange={(e) => setSku(e.target.value)} />
              <FieldLabel>Stok adedi</FieldLabel>
              <input
                className="msf-input"
                inputMode="numeric"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="msf-col">
              <FieldLabel>Garanti</FieldLabel>
              <input
                className="msf-input"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="Örn: 6 ay satıcı garantisi"
              />
              <FieldLabel>Öne çıkan özellikler</FieldLabel>
              <textarea
                className="msf-textarea msf-textarea--plain"
                rows={5}
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                placeholder="Her satıra bir özellik"
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="msf-card">
          <h2>Fotoğraflar</h2>
          <p className="msf-hint">İlk fotoğraf kapak olur. En az 1, en fazla 12 görsel.</p>
          <ImageUploader images={images} onChange={setImages} max={12} />
        </div>
      ) : null}

      {step === 4 ? (
        <div className="msf-card">
          <h2>Fiyat &amp; Teslimat</h2>
          <div className="msf-grid-2">
            <div className="msf-col">
              <FieldLabel>Satış fiyatı (TL)</FieldLabel>
              <input
                className="msf-input"
                value={askPrice}
                onChange={(e) => setAskPrice(e.target.value)}
                placeholder="0,00"
              />
              <FieldLabel hint="Üstü çizili gösterilir">Liste fiyatı (opsiyonel)</FieldLabel>
              <input
                className="msf-input"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0,00"
              />
              <FieldLabel>İlan süresi</FieldLabel>
              <select className="msf-select msf-select--full" value={days} onChange={(e) => setDays(e.target.value)}>
                {[7, 14, 21, 30].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} gün
                  </option>
                ))}
              </select>
            </div>
            <div className="msf-col">
              <FieldLabel>İl</FieldLabel>
              <LocationSelect
                label="İl"
                placeholder="İl seçin"
                value={city}
                options={CITY_NAMES}
                onChange={(v) => {
                  setCity(v);
                  setDistrict("");
                }}
              />
              <FieldLabel>İlçe</FieldLabel>
              <LocationSelect
                label="İlçe"
                placeholder="İlçe seçin"
                value={district}
                options={getDistricts(city)}
                onChange={setDistrict}
              />
              <label className="msf-check">
                <input
                  type="checkbox"
                  checked={shippingFree}
                  onChange={(e) => setShippingFree(e.target.checked)}
                />
                Ücretsiz kargo
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="msf-card">
          <h2>Önizleme &amp; Yayınla</h2>
          <div className="msf-preview">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt="" className="msf-preview__img" />
            ) : (
              <div className="msf-preview__ph">Fotoğraf yok</div>
            )}
            <div>
              <div className="msf-preview__ Cond">{CONDITIONS.find((c) => c.key === condition)?.label}</div>
              <h3>{title || "Başlıksız ilan"}</h3>
              <p className="msf-preview__price">
                {askPrice ? formatMoneyTr(parseMoneyTr(askPrice) || 0) + " TL" : "—"}
              </p>
              <p className="msf-preview__meta">
                {[brand, model, storage, color.label].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="msf-preview__loc">
                {city}
                {district ? ` / ${district}` : ""} · {days} gün
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {sellMode === "listing" ? (
      <div className="msf-footer">
        <button
          type="button"
          className="msf-btn msf-btn--ghost"
          disabled={step <= 1 || busy}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          Geri
        </button>
        {step < 5 ? (
          <button type="button" className="msf-btn msf-btn--primary" onClick={() => setStep((s) => Math.min(5, s + 1))}>
            Devam Et
          </button>
        ) : (
          <button type="button" className="msf-btn msf-btn--primary" disabled={busy} onClick={() => void publish()}>
            {busy ? "Gönderiliyor…" : "İlanı Yayınla"}
          </button>
        )}
      </div>
      ) : null}
    </div>
  );
}
