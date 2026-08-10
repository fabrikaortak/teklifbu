"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CITY_NAMES, getDistricts } from "@/data/turkey-locations";
import { LocationSelect } from "@/components/LocationSelect";
import { ImageUploader } from "@/components/ImageUploader";
import { ListingDescriptionField } from "@/components/ListingDescriptionField";
import { ListingDescriptionHtml } from "@/components/ListingDescriptionHtml";
import { validateListingDescription } from "@/lib/listingDescription";
import type { MapPoint } from "@/components/LocationMapPicker";
import { formatNumberTr, parseNumberTr, formatTl, formatMoneyTr, parseMoneyTr } from "@/lib/format";
import { dealTypeLabel, isRentDeal } from "@/lib/dealType";
import { findBrowseNode, matchBrowsePath, CATEGORY_BROWSE_TREE } from "@/data/categoryBrowseTree";
import { brandLabel, modelLabel, trimLabel } from "@/lib/vasitaLabels";
import { CategoryLadderPicker, isCategoryLadderComplete } from "@/components/CategoryLadderPicker";
import {
  PremiumCategoryLadderPicker,
  isPremiumCategoryLadderComplete,
} from "@/components/PremiumCategoryLadderPicker";
import { ListingKindChooser } from "@/components/ListingKindChooser";
import { needsListingKindChoice, normalizeAccountType } from "@/lib/accountTypes";
import { isPremiumCategorySlug, anyPremiumVerticalEnabled } from "@/data/premiumCategories";
import { ALISVERIS_BROWSE_TREE, isAlisverisCategorySlug } from "@/data/classicBrowseTree";
import { useAlisverisBrowseTree } from "@/hooks/useAlisverisBrowseTree";
import { useVasitaBrowseTree } from "@/hooks/useVasitaBrowseTree";
import { useVasitaFormAttributes, visibleVasitaFormFields, legacyAttrKeyFor, attributeTemplateForSubtype } from "@/lib/vasitaFormAttributes";
import { resolveElectricListingAttrs } from "@/lib/vasitaElectric";
import { HousingExtrasPicker } from "@/components/HousingExtrasPicker";
import { VehicleExtrasPicker } from "@/components/VehicleExtrasPicker";
import { VehicleExpertiseReportPanel } from "@/components/VehicleExpertiseReport";
import { listingHasBids } from "@/lib/listingStatus";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { ListingFeeInvoiceModal } from "@/components/ListingFeeInvoiceModal";
import { ShopPackageBuyModal } from "@/components/ShopPackageBuyModal";
import { buildListingFeeInvoice, type ListingFeeInvoice } from "@/lib/listingFeeInvoice";
import { Sparkles, X } from "lucide-react";
import { groupHousingExtras, parseHousingExtras } from "@/data/housingExtras";
import { groupVehicleExtras, parseVehicleExtras } from "@/data/vehicleExtras";
import {
  expertiseReportHasDamage,
  parseExpertiseReport,
  supportsVehicleExpertiseReport,
  type VehicleExpertiseReport,
} from "@/data/vehicleExpertiseReport";
import { formatListingAttributeRows } from "@/lib/listingEditFields";
import { BUILDING_AGE_OPTIONS } from "@/data/housingMatch";
import { SHOPPING_PRODUCT_ATTR_KEYS, parseInstallments } from "@/data/shoppingProductAttrs";
import { ShoppingProductFormFields } from "@/components/shopping/ShoppingProductFormFields";
import {
  DEFAULT_HOUSING_FORM_FIELDS_ENABLED,
  HOUSING_ENERGY_CERT_OPTIONS,
  HOUSING_FLOOR_OPTIONS,
  HOUSING_KITCHEN_OPTIONS,
  HOUSING_SELLER_TYPE_OPTIONS,
  HOUSING_TOTAL_FLOOR_OPTIONS,
  HOUSING_USAGE_STATUS_OPTIONS,
  HOUSING_YES_NO_OPTIONS,
  isHousingOptionalFieldEnabled,
  normalizeFloorOption,
  type HousingOptionalFieldKey,
} from "@/data/housingFormFields";
import { formatPremiumTitle, shouldShowPremiumBadge } from "@/lib/listingPremiumDisplay";
import {
  clearListingDraft,
  formatDraftSavedAt,
  isMeaningfulListingDraft,
  markResumePromptHandled,
  readListingDraft,
  wasResumePromptHandled,
  writeListingDraft,
} from "@/lib/listingDraft";
import dynamic from "next/dynamic";

const MapPicker = dynamic(
  () => import("@/components/LocationMapPicker").then((m) => m.LocationMapPicker),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 280, borderRadius: 14, background: "#e8eef5", border: "1px solid var(--line)" }} />
    ),
  }
);

type Attrs = Record<string, string>;

const emptyAttrs: Attrs = {
  subtype: "",
  rentalPeriod: "",
  brand: "",
  model: "",
  condition: "",
  warranty: "",
  trim: "",
  version: "",
  generation: "",
  m2: "",
  netM2: "",
  rooms: "",
  buildingAge: "",
  floor: "",
  totalFloors: "",
  heating: "",
  bathrooms: "",
  balcony: "",
  kitchen: "",
  usageStatus: "",
  inSite: "",
  siteName: "",
  elevator: "",
  creditEligible: "",
  energyCertificate: "",
  sellerType: "",
  swap: "",
  furnished: "",
  dues: "",
  deedStatus: "",
  zoning: "",
  frontage: "",
  year: "",
  km: "",
  fuel: "",
  gear: "",
  color: "",
  series: "",
  vehicleStatus: "",
  bodyType: "",
  chassis: "",
  enginePower: "",
  engineSize: "",
  drive: "",
  seats: "",
  licenseRecord: "",
  heavyDamage: "",
  plateOrigin: "",
  tramer: "",
  boyaDurumu: "",
  degisenDurumu: "",
  hasarDurumu: "",
  sku: "",
  barcode: "",
  listPrice: "",
  premiumPrice: "",
  stockQty: "",
  shippingFree: "",
  sameDayShipping: "",
  shippingLabel: "",
  badgeText: "",
  promoBadge: "",
  highlights: "",
  videoUrl: "",
  viewAngle360: "",
  installmentNote: "",
  installments: "",
  returnDays: "",
  originCountry: "",
  gtin: "",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 12, paddingTop: 4 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: "-0.01em" }}>{title}</h2>
        {desc && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{desc}</p>}
      </div>
      {children}
    </section>
  );
}

const divider: CSSProperties = { height: 1, background: "var(--line)", margin: "4px 0" };

function CreateListingInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { tree: dbAlisverisTree } = useAlisverisBrowseTree();
  const shopBrowseTree = dbAlisverisTree.length ? dbAlisverisTree : ALISVERIS_BROWSE_TREE;
  // Genel form (emlak + vasıta): Emlak dalı statik (CATEGORY_BROWSE_TREE), Vasıta dalı DB'den
  // (useVasitaBrowseTree → /api/catalog/tree?format=vasita-browse; API/DB down → JSON fallback).
  const { root: vasitaRoot } = useVasitaBrowseTree();
  const genelBrowseTree = useMemo(
    () => [CATEGORY_BROWSE_TREE[0], vasitaRoot],
    [vasitaRoot]
  );
  const editId = search.get("edit");
  const fromAi = search.get("from") === "ai";
  const kindParam = search.get("kind");
  const listingKind =
    kindParam === "premium" || kindParam === "genel" || kindParam === "alisveris" ? kindParam : null;
  const silentResume =
    search.get("resume") === "1" || search.get("from") === "pos" || fromAi;
  const [accountType, setAccountType] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<{
    accountType?: string | null;
    commercialSubtypes?: string[] | null;
    profile?: unknown;
  } | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string; group?: string | null }>>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Caferağa",
    dealType: "",
    askPrice: "1000000",
    categorySlug: "",
    days: "",
  });
  const [attrs, setAttrs] = useState<Attrs>({ ...emptyAttrs });
  const [housingExtras, setHousingExtras] = useState<string[]>([]);
  const [vehicleExtras, setVehicleExtras] = useState<string[]>([]);
  const [expertiseReport, setExpertiseReport] = useState<VehicleExpertiseReport | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [aiSourceImages, setAiSourceImages] = useState<string[]>([]);
  const [mapPoint, setMapPoint] = useState<MapPoint | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [mode, setMode] = useState<"edit" | "preview" | "done">("edit");
  const [doneMessage, setDoneMessage] = useState("");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [editListingStatus, setEditListingStatus] = useState<string | null>(null);
  const [editBlockedByBids, setEditBlockedByBids] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [premiumVerticalsReady, setPremiumVerticalsReady] = useState(false);
  /** Auth/taslak hızlıysa boş geç; yavaşsa spinner (metin flash yok) */
  const [showBootSpinner, setShowBootSpinner] = useState(false);
  const [anyPremiumOpen, setAnyPremiumOpen] = useState(true);
  const [alisverisVerticalOpen, setAlisverisVerticalOpen] = useState(true);
  const [premium, setPremium] = useState({
    titleBold: false,
    titleLarge: false,
    isColored: false,
    featuredDays: 0 as 0 | 3 | 7,
  });
  const [premiumPrices, setPremiumPrices] = useState({
    titleBoldTl: 49,
    titleLargeTl: 49,
    coloredTl: 79,
    feature3dTl: 149,
    feature7dTl: 249,
  });
  const [premiumTokenPrices, setPremiumTokenPrices] = useState({
    titleBoldTokens: 0,
    titleLargeTokens: 0,
    coloredTokens: 0,
    feature3dTokens: 0,
    feature7dTokens: 0,
  });
  const [premiumPayWithTokens, setPremiumPayWithTokens] = useState(false);
  const [premiumBadgeRule, setPremiumBadgeRule] = useState("premium_3");
  const [draftReady, setDraftReady] = useState(Boolean(editId));
  const [housingFieldsEnabled, setHousingFieldsEnabled] = useState(DEFAULT_HOUSING_FORM_FIELDS_ENABLED);
  const [escrowEligible, setEscrowEligible] = useState(false);
  const [escrowUiEnabled, setEscrowUiEnabled] = useState(false);
  const [shoppingFormTemplate, setShoppingFormTemplate] = useState<
    "classic" | "ecommerce_v1" | "modern_v1"
  >("classic");
  const [askPriceFocused, setAskPriceFocused] = useState(false);
  const [escrowButtonLabel, setEscrowButtonLabel] = useState("Güvenli Öde");
  const [aiOfferOpen, setAiOfferOpen] = useState(false);
  const [aiImportEnabled, setAiImportEnabled] = useState(false);
  const [aiOfferPopupEnabled, setAiOfferPopupEnabled] = useState(false);
  const [aiTokenCost, setAiTokenCost] = useState(2);
  const [feeInvoiceModal, setFeeInvoiceModal] = useState<{
    intro: string;
    invoice: ListingFeeInvoice;
    premiumFeeTokens?: number;
    totalFeeTokens?: number;
    tokensOnly?: boolean;
  } | null>(null);
  const [feeInvoiceBusy, setFeeInvoiceBusy] = useState(false);
  const feeInvoiceResolveRef = useRef<((ok: boolean | "tokens") => void) | null>(null);
  const [shopPackageModal, setShopPackageModal] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const { alert, confirm } = useDialog();

  function askFeeInvoice(
    intro: string,
    invoice: ListingFeeInvoice,
    opts?: { premiumFeeTokens?: number; totalFeeTokens?: number; tokensOnly?: boolean }
  ): Promise<boolean | "tokens"> {
    return new Promise((resolve) => {
      feeInvoiceResolveRef.current = resolve;
      setFeeInvoiceBusy(false);
      setFeeInvoiceModal({
        intro,
        invoice,
        premiumFeeTokens: opts?.premiumFeeTokens,
        totalFeeTokens: opts?.totalFeeTokens,
        tokensOnly: opts?.tokensOnly,
      });
    });
  }

  function cancelFeeInvoice() {
    const resolve = feeInvoiceResolveRef.current;
    feeInvoiceResolveRef.current = null;
    setFeeInvoiceModal(null);
    setFeeInvoiceBusy(false);
    resolve?.(false);
  }

  function confirmFeeInvoice() {
    setFeeInvoiceBusy(true);
    const resolve = feeInvoiceResolveRef.current;
    feeInvoiceResolveRef.current = null;
    resolve?.(true);
  }

  function confirmFeeInvoiceTokens() {
    setFeeInvoiceBusy(true);
    const resolve = feeInvoiceResolveRef.current;
    feeInvoiceResolveRef.current = null;
    resolve?.("tokens");
  }

  const feeTokenAmount =
    feeInvoiceModal?.tokensOnly && feeInvoiceModal.totalFeeTokens
      ? feeInvoiceModal.totalFeeTokens
      : feeInvoiceModal?.premiumFeeTokens || 0;

  const feeInvoiceModalEl = feeInvoiceModal ? (
    <ListingFeeInvoiceModal
      open
      intro={feeInvoiceModal.intro}
      invoice={feeInvoiceModal.invoice}
      busy={feeInvoiceBusy}
      tokensOnly={feeInvoiceModal.tokensOnly}
      tokensOption={
        feeTokenAmount > 0
          ? { tokens: feeTokenAmount, label: `${feeTokenAmount} jeton` }
          : null
      }
      onCancel={cancelFeeInvoice}
      onConfirm={confirmFeeInvoice}
      onPayWithTokens={feeTokenAmount > 0 ? confirmFeeInvoiceTokens : undefined}
    />
  ) : null;

  const shopPackageModalEl = (
    <ShopPackageBuyModal
      open={Boolean(shopPackageModal)}
      title={shopPackageModal?.title}
      description={shopPackageModal?.description}
      onClose={() => setShopPackageModal(null)}
      onPurchased={() => {
        setShopPackageModal(null);
        setError("");
        void alert({
          title: "Paket aktif",
          message: "Kurumsal paketiniz aktifleştirildi. İlanı tekrar yayınlayabilirsiniz.",
          tone: "success",
        });
      }}
    />
  );

  const housingFieldOn = (key: HousingOptionalFieldKey) =>
    isHousingOptionalFieldEnabled(housingFieldsEnabled, key);

  useEffect(() => {
    fetch("/api/housing-form-fields")
      .then((r) => r.json())
      .then((d) => {
        if (d?.enabled && typeof d.enabled === "object") setHousingFieldsEnabled(d.enabled);
      })
      .catch(() => {});
  }, []);

  // Önizleme ekranı her açılışta üstten başlasın (form altındaki butondan gelince scroll kalmasın)
  useEffect(() => {
    if (mode !== "preview") return;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [mode]);

  useEffect(() => {
    if (editId || fromAi) return;
    fetch("/api/ai/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAiImportEnabled(Boolean(d.enabled));
        setAiOfferPopupEnabled(Boolean(d.offerPopupEnabled));
        setAiTokenCost(Math.max(0, Math.floor(Number(d.tokenCost) || 2)));
      })
      .catch(() => {});
  }, [editId, fromAi]);

  useEffect(() => {
    if (!draftReady || !authChecked || editId || fromAi || !aiImportEnabled || !aiOfferPopupEnabled)
      return;
    setAiOfferOpen(true);
  }, [draftReady, authChecked, editId, fromAi, aiImportEnabled, aiOfferPopupEnabled]);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace(`/giris?next=${encodeURIComponent(editId ? `/ilan-ver?edit=${editId}` : "/ilan-ver")}`);
          return;
        }
        setAccountType(normalizeAccountType(d.user.accountType));
        setAuthUser({
          accountType: d.user.accountType,
          commercialSubtypes: d.user.commercialSubtypes || [],
          profile: d.user.profile || null,
        });
        setAuthChecked(true);
      })
      .catch(() => router.replace(`/giris?next=${encodeURIComponent("/ilan-ver")}`));
    fetch("/api/listing-premium")
      .then((r) => r.json())
      .then((d) => {
        if (d.prices) setPremiumPrices(d.prices);
        if (d.tokenPrices) setPremiumTokenPrices(d.tokenPrices);
        setPremiumPayWithTokens(d.payWithTokensEnabled === true);
        if (d.badgeRule) setPremiumBadgeRule(String(d.badgeRule));
      })
      .catch(() => {});
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        const open = anyPremiumVerticalEnabled(d?.premiumVerticals);
        setAnyPremiumOpen(open);
        const shopOpen = d?.alisverisEnabled !== false;
        setAlisverisVerticalOpen(shopOpen);
        setPremiumVerticalsReady(true);
        if (!open && listingKind === "premium" && !editId) {
          router.replace("/ilan-ver?kind=genel");
        }
        if (!shopOpen && listingKind === "alisveris" && !editId) {
          router.replace("/ilan-ver?kind=genel");
        }
        setEscrowUiEnabled(Boolean(d?.escrow?.enabled));
        if (d?.escrow?.buttonLabel) setEscrowButtonLabel(String(d.escrow.buttonLabel));
        const formTpl = String(d?.shoppingListingFormTemplate || "classic");
        const normalized =
          formTpl === "ecommerce_v1" || formTpl === "modern_v1" ? formTpl : "classic";
        setShoppingFormTemplate(normalized as "classic" | "ecommerce_v1" | "modern_v1");
        if (normalized === "modern_v1" && listingKind === "alisveris" && !editId && shopOpen) {
          router.replace("/hesabim?s=ilan-ekle");
        }
      })
      .catch(() => {
        setAnyPremiumOpen(true);
        setAlisverisVerticalOpen(true);
        setPremiumVerticalsReady(true);
      });
  }, [router, editId, listingKind]);

  useEffect(() => {
    const bootDone = authChecked && draftReady && premiumVerticalsReady;
    if (bootDone) {
      setShowBootSpinner(false);
      return;
    }
    const t = window.setTimeout(() => setShowBootSpinner(true), 300);
    return () => window.clearTimeout(t);
  }, [authChecked, draftReady, premiumVerticalsReady]);

  useEffect(() => {
    if (!authChecked || editId) return;

    const draft = readListingDraft();

    // AI aktarımı → normal ilan formu (düzenleme); POS vazgeç → önizleme
    if (silentResume && isMeaningfulListingDraft(draft)) {
      markResumePromptHandled();
      setForm({
        title: draft!.form.title || "",
        description: draft!.form.description || "",
        city: draft!.form.city || "",
        district: draft!.form.district || "",
        neighborhood: draft!.form.neighborhood || "",
        dealType: draft!.form.dealType || "",
        askPrice: draft!.form.askPrice || "",
        categorySlug: draft!.form.categorySlug || "",
        days: draft!.form.days || "",
      });
      setAttrs({ ...emptyAttrs, ...(draft!.attrs || {}) });
      setHousingExtras(draft!.housingExtras || []);
      setVehicleExtras(draft!.vehicleExtras || []);
      setExpertiseReport(parseExpertiseReport(draft!.expertiseReport));
      setImages(draft!.images || []);
      setAiSourceImages(draft!.aiSourceImages || []);
      setMapPoint(draft!.mapPoint || null);
      setPremium(draft!.premium);
      setMode(fromAi ? "edit" : "preview");
      setDraftReady(true);
      return;
    }

    if (wasResumePromptHandled()) {
      setDraftReady(true);
      return;
    }
    markResumePromptHandled();

    if (!isMeaningfulListingDraft(draft)) {
      setDraftReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const when = formatDraftSavedAt(draft!.savedAt);
      const resume = await confirm({
        title: "Yarım kalan ilan",
        message: `Daha önce başladığınız bir ilan taslağı var${when ? ` (${when})` : ""}.\n\nKaldığınız yerden devam etmek ister misiniz? Yazılarınız ve seçimleriniz korunur.`,
        tone: "info",
        confirmLabel: "Devam et",
        cancelLabel: "Yeni başla",
      });
      if (cancelled) return;
      if (resume && draft) {
        setForm({
          title: draft.form.title || "",
          description: draft.form.description || "",
          city: draft.form.city || "",
          district: draft.form.district || "",
          neighborhood: draft.form.neighborhood || "",
          dealType: draft.form.dealType || "",
          askPrice: draft.form.askPrice || "",
          categorySlug: draft.form.categorySlug || "",
          days: draft.form.days || "",
        });
        setAttrs({ ...emptyAttrs, ...(draft.attrs || {}) });
        setHousingExtras(draft.housingExtras || []);
        setVehicleExtras(draft.vehicleExtras || []);
        setExpertiseReport(parseExpertiseReport(draft.expertiseReport));
        setImages(draft.images || []);
        setAiSourceImages(draft.aiSourceImages || []);
        setMapPoint(draft.mapPoint || null);
        setPremium(draft.premium);
        setMode(draft.mode === "preview" ? "preview" : "edit");
      } else {
        clearListingDraft();
        setAiSourceImages([]);
      }
      setDraftReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked, editId, confirm, silentResume, fromAi]);

  useEffect(() => {
    if (!draftReady || editId || !authChecked) return;
    if (mode === "done") return;
    const timer = window.setTimeout(() => {
      writeListingDraft({
        form,
        attrs,
        housingExtras,
        vehicleExtras,
        expertiseReport,
        images,
        aiSourceImages,
        mapPoint,
        premium,
        mode: mode === "preview" ? "preview" : "edit",
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    editId,
    authChecked,
    form,
    attrs,
    housingExtras,
    vehicleExtras,
    expertiseReport,
    images,
    aiSourceImages,
    mapPoint,
    premium,
    mode,
  ]);

  const districts = useMemo(() => getDistricts(form.city), [form.city]);
  const slug = form.categorySlug || "";
  const isShop = isAlisverisCategorySlug(slug) || slug.startsWith("ikinci-el") || slug.startsWith("sifir-urun");
  const effectiveKind =
    listingKind ||
    (editId
      ? isPremiumCategorySlug(slug)
        ? "premium"
        : isShop
          ? "alisveris"
          : "genel"
      : "genel");
  const useEcommerceForm = isShop && shoppingFormTemplate === "ecommerce_v1";

  const premiumEstimate = useMemo(() => {
    const breakdown: Array<{ key: string; label: string; amountTl: number }> = [];
    if (premium.titleBold && premiumPrices.titleBoldTl > 0) {
      breakdown.push({ key: "titleBold", label: "Kalın başlık", amountTl: premiumPrices.titleBoldTl });
    }
    if (premium.titleLarge && premiumPrices.titleLargeTl > 0) {
      breakdown.push({ key: "titleLarge", label: "Büyük harf başlık", amountTl: premiumPrices.titleLargeTl });
    }
    if (premium.isColored && premiumPrices.coloredTl > 0) {
      breakdown.push({ key: "isColored", label: "Renkli ilan", amountTl: premiumPrices.coloredTl });
    }
    if (premium.featuredDays === 3 && premiumPrices.feature3dTl > 0) {
      breakdown.push({ key: "feature3d", label: "3 gün ana sayfa", amountTl: premiumPrices.feature3dTl });
    }
    if (premium.featuredDays === 7 && premiumPrices.feature7dTl > 0) {
      breakdown.push({ key: "feature7d", label: "7 gün ana sayfa", amountTl: premiumPrices.feature7dTl });
    }
    return {
      breakdown,
      totalTl: breakdown.reduce((s, x) => s + x.amountTl, 0),
    };
  }, [premium, premiumPrices]);
  const isRealty = ["konut", "isyeri", "arsa", "kiralik"].includes(slug);
  const isVehicle = slug === "arac";
  // DB-backed attribute fields (Stage1) — visibility/order/options from CategoryAttribute.
  // Hardcoded block below is emergency fallback when API returns no fields.
  const { fields: vasitaAttrFields, loaded: vasitaAttrsLoaded } = useVasitaFormAttributes(
    isVehicle ? attrs.subtype : ""
  );
  const vasitaVisibleFields = useMemo(
    () => visibleVasitaFormFields(vasitaAttrFields),
    [vasitaAttrFields]
  );
  const useDbVehicleFields = vasitaAttrsLoaded && vasitaVisibleFields.length > 0;
  const isLand = slug === "arsa";
  const isHomeLike = slug === "konut" || slug === "kiralik";
  const isWorkplace = slug === "isyeri";
  const showAttrFields = Boolean(slug) && (isHomeLike || isWorkplace || isLand || isVehicle || isShop);
  const categoryPathLabel = useMemo(() => {
    const path = matchBrowsePath({
      category: form.categorySlug,
      dealType: form.dealType,
      subtype: attrs.subtype,
      rental: attrs.rentalPeriod,
    });
    if (!path.length) return categories.find((c) => c.slug === slug)?.name || slug || "—";
    const labels = path.map((id) => findBrowseNode(id)?.name).filter(Boolean) as string[];
    if (slug === "arac" && attrs.brand) {
      labels.push(brandLabel(attrs.brand));
      if (attrs.model) labels.push(modelLabel(attrs.model));
      if (attrs.version) labels.push(trimLabel(attrs.version));
      if (attrs.trim) labels.push(trimLabel(attrs.trim));
    }
    return labels.join(" › ");
  }, [form.categorySlug, form.dealType, attrs.subtype, attrs.rentalPeriod, attrs.brand, attrs.model, attrs.version, attrs.trim, categories, slug]);
  const categoryName = categoryPathLabel;

  useEffect(() => {
    if (!form.city || !form.district) {
      setNeighborhoods([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/locations?city=${encodeURIComponent(form.city)}&district=${encodeURIComponent(form.district)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setNeighborhoods(d.neighborhoods || []);
      })
      .catch(() => {
        if (!cancelled) setNeighborhoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.city, form.district]);

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((d) => {
        const list = d.listingCategories?.length ? d.listingCategories : d.categories || [];
        setCategories(list);
      });
  }, [editId]);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/listings/${editId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("load");
        return r.json();
      })
      .then((d) => {
        const l = d.listing;
        if (!l) return;
        setForm({
          title: l.title || "",
          description: l.description || "",
          city: l.city || "",
          district: l.district || "",
          neighborhood: l.neighborhood || "",
          dealType: l.dealType || "SATILIK",
          askPrice: (() => {
            const a0 = (l.attributes || {}) as Record<string, unknown>;
            const tl = a0.askPriceTl != null ? Number(a0.askPriceTl) : NaN;
            if (Number.isFinite(tl) && tl > 0) return String(tl);
            return String(l.askPrice || "");
          })(),
          categorySlug: l.category?.slug || "",
          days: l.durationDays ? String(l.durationDays) : "",
        });
        const a = (l.attributes || {}) as Record<string, string | number | string[] | object>;
        const nextAttrs = { ...emptyAttrs };
        for (const key of Object.keys(emptyAttrs)) {
          if (a[key] == null) continue;
          if (key === "installments") {
            const raw = a[key];
            nextAttrs[key] =
              typeof raw === "string" ? raw : JSON.stringify(raw);
            continue;
          }
          if (Array.isArray(a[key])) {
            nextAttrs[key] = (a[key] as string[]).map(String).join("\n");
            continue;
          }
          if (typeof a[key] === "object") {
            nextAttrs[key] = JSON.stringify(a[key]);
            continue;
          }
          let v = String(a[key]);
          if (key === "floor") v = normalizeFloorOption(v) || v;
          if (key === "listPrice" || key === "premiumPrice") {
            const n = Number(a[key]);
            if (Number.isFinite(n)) v = String(n);
          }
          nextAttrs[key] = v;
        }
        setAttrs(nextAttrs);
        const catSlug = String(l.category?.slug || "");
        if (catSlug === "arac") {
          setVehicleExtras(parseVehicleExtras(a.extras));
          setHousingExtras([]);
          setExpertiseReport(parseExpertiseReport((a as { expertiseReport?: unknown }).expertiseReport));
        } else {
          setHousingExtras(parseHousingExtras(a.extras));
          setVehicleExtras([]);
          setExpertiseReport(null);
        }
        setImages(l.images?.length ? l.images : l.coverImage ? [l.coverImage] : []);
        if (l.latitude != null && l.longitude != null) {
          setMapPoint({ lat: l.latitude, lng: l.longitude });
        }
        setRejectionReason(l.rejectionReason || null);
        setEditListingStatus(l.status || null);
        setEditBlockedByBids(listingHasBids(l));
        setEscrowEligible(Boolean(l.escrowEligible));
        setPremium({
          titleBold: Boolean(l.titleBold),
          titleLarge: Boolean(l.titleLarge),
          isColored: Boolean(l.isColored),
          featuredDays: l.featuredDays === 7 || l.featuredDays === 3 ? l.featuredDays : 0,
        });
      })
      .catch(() => setError("Düzenlenecek ilan yüklenemedi"));
  }, [editId]);

  useEffect(() => {
    if (slug === "kiralik") setForm((f) => ({ ...f, dealType: "KIRALIK" }));
  }, [slug]);

  useEffect(() => {
    if (!supportsVehicleExpertiseReport(attrs.subtype)) setExpertiseReport(null);
  }, [attrs.subtype]);

  function setAttr(key: string, value: string) {
    setAttrs((a) => ({ ...a, [key]: value }));
  }

  function buildAttributes() {
    const out: Record<string, string | number | string[] | object | VehicleExpertiseReport> = {};
    if (attrs.subtype?.trim()) {
      const electric = resolveElectricListingAttrs(attrs.subtype.trim());
      if (electric) {
        out.subtype = electric.subtype;
        out.fuel = electric.fuel;
        if (electric.electricVehicleType) out.electricVehicleType = electric.electricVehicleType;
      } else {
        out.subtype = attrs.subtype.trim();
      }
    }
    if (attrs.rentalPeriod?.trim()) out.rentalPeriod = attrs.rentalPeriod.trim();
    for (const key of ["brand", "model", "version", "trim", "condition", "warranty"] as const) {
      const v = attrs[key]?.trim();
      if (v) out[key] = v;
    }
    if (isShop && useEcommerceForm) {
      for (const key of SHOPPING_PRODUCT_ATTR_KEYS) {
        if (key === "brand" || key === "model" || key === "condition" || key === "warranty") continue;
        if (key === "installmentNote") continue;
        if (key === "askPriceTl") continue;
        const v = attrs[key]?.trim();
        if (!v) continue;
        if (key === "installments") {
          const plans = parseInstallments(v);
          if (plans.length) out.installments = plans;
          continue;
        }
        if (["listPrice", "premiumPrice", "stockQty", "returnDays"].includes(key)) {
          const n = parseMoneyTr(v);
          out[key] = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : v;
        } else {
          out[key] = v;
        }
      }
      const saleTl = parseMoneyTr(form.askPrice);
      if (saleTl > 0) out.askPriceTl = Math.round(saleTl * 100) / 100;
    }
    const map: Array<[string, string]> = [];
    if (isHomeLike || isWorkplace) {
      map.push(
        ["m2", "Brüt m²"],
        ["netM2", "Net m²"],
        ["rooms", "Oda sayısı"],
        ["buildingAge", "Bina yaşı"],
        ["floor", "Bulunduğu kat"],
        ["totalFloors", "Kat sayısı"],
        ["heating", "Isıtma"],
        ["bathrooms", "Banyo"],
        ["balcony", "Balkon"],
        ["dues", "Aidat (TL)"]
      );
      if (isHomeLike) {
        const opt: Array<[HousingOptionalFieldKey, string]> = [
          ["kitchen", "Mutfak"],
          ["usageStatus", "Kullanım durumu"],
          ["inSite", "Site içinde"],
          ["siteName", "Site adı"],
          ["elevator", "Asansör"],
          ["creditEligible", "Krediye uygun"],
          ["energyCertificate", "Enerji kimlik belgesi"],
          ["sellerType", "Satıcı"],
          ["swap", "Takas"],
        ];
        for (const [key, label] of opt) {
          if (housingFieldOn(key)) map.push([key, label]);
        }
      }
      if (isRentDeal(form.dealType) || slug === "kiralik") map.push(["furnished", "Eşyalı"]);
      if (isRealty) map.push(["deedStatus", "Tapu durumu"]);
    }
    if (isLand) {
      map.push(["m2", "m²"], ["zoning", "İmar durumu"], ["deedStatus", "Tapu durumu"], ["frontage", "Cephe"]);
    }
    if (isVehicle) {
      map.push(
        ["series", "Seri"],
        ["year", "Model yılı"],
        ["km", "Kilometre"],
        ["fuel", "Yakıt"],
        ["gear", "Vites"],
        ["vehicleStatus", "Araç durumu"],
        ["bodyType", "Kasa tipi"],
        ["chassis", "Şasi"],
        ["enginePower", "Motor gücü"],
        ["engineSize", "Motor hacmi"],
        ["drive", "Çekiş"],
        ["seats", "Koltuk sayısı"],
        ["color", "Renk"],
        ["licenseRecord", "Ruhsat kaydı"],
        ["heavyDamage", "Ağır hasar kayıtlı"],
        ["sellerType", "Kimden"],
        ["plateOrigin", "Plaka / uyruk"],
        ["swap", "Takas"],
        ["tramer", "Tramer"],
        ["boyaDurumu", "Boya durumu"],
        ["degisenDurumu", "Değişen durumu"],
        ["hasarDurumu", "Hasar durumu"]
      );
    }
    for (const [key] of map) {
      const v = attrs[key]?.trim();
      if (!v) continue;
      // Electric overlay listings always store fuel=ELECTRIC (canonical).
      if (key === "fuel" && attrs.subtype && resolveElectricListingAttrs(attrs.subtype.trim())) continue;
      if (key === "buildingAge" || key === "floor") {
        out[key] = v; // "0"/"Giriş Kat"/metin — sayıya zorlama
      } else if (["m2", "netM2", "totalFloors", "bathrooms", "dues", "year", "km"].includes(key)) {
        out[key] = Number(v) || v;
      } else {
        out[key] = v;
      }
    }
    if (isHomeLike && housingExtras.length) {
      out.extras = housingExtras;
    }
    if (isVehicle && vehicleExtras.length) {
      out.extras = vehicleExtras;
    }
    if (isVehicle && supportsVehicleExpertiseReport(attrs.subtype) && expertiseReport) {
      out.expertiseReport = expertiseReport;
    }
    return out;
  }

  function validate() {
    const ladderValue = {
      categorySlug: form.categorySlug,
      dealType: form.dealType,
      subtype: attrs.subtype,
      rentalPeriod: attrs.rentalPeriod,
      brand: attrs.brand,
      model: attrs.model,
      trim: attrs.trim,
    };
    if (effectiveKind === "premium") {
      if (!isPremiumCategoryLadderComplete(ladderValue)) {
        return "Premium dikey ve alt kategoriyi seçin (ör. Otel Konaklama › Suit).";
      }
    } else if (
      !isCategoryLadderComplete(
        ladderValue,
        effectiveKind === "alisveris" ? shopBrowseTree : genelBrowseTree
      )
    ) {
      return effectiveKind === "alisveris"
        ? "Alışveriş kategorisini tamamlayın (ör. Elektronik › İkinci El › Cep Telefonu)."
        : "Kategoriyi merdiven gibi tamamlayın (ör. Vasıta › Otomobil › BMW › 3 Serisi › 320d). Kategori seçilmeden ilan yayınlanamaz.";
    }
    if (effectiveKind === "premium" && !isPremiumCategorySlug(form.categorySlug)) {
      return "Premium ilan için premium kategori seçmelisiniz.";
    }
    if (effectiveKind === "alisveris" && !isAlisverisCategorySlug(form.categorySlug)) {
      return "Alışveriş ilanı için alışveriş kategorisi seçmelisiniz.";
    }
    if (effectiveKind === "genel" && isAlisverisCategorySlug(form.categorySlug)) {
      return "Alışveriş kategorisi bu formda kullanılamaz. Alışveriş kategori ilanı yolunu seçin.";
    }
    if (effectiveKind !== "premium" && isPremiumCategorySlug(form.categorySlug)) {
      return "Genel ilan formunda premium kategori kullanılamaz. Premium ilan ekle yolunu seçin.";
    }
    if (!form.title.trim()) return "İlan başlığı gerekli";
    const descErr = validateListingDescription(form.description);
    if (!descErr.ok) return descErr.error || "Açıklama geçersiz";
    if (!form.city) return "İl seçin";
    if (!form.district) return "İlçe seçin";
    if (!form.days) return "İlan süresi seçmelisiniz. Tüm ilanlarda süre zorunludur.";
    const daysNum = Number(form.days);
    if (![3, 5, 7, 10, 14, 21, 30].includes(daysNum)) {
      return "Geçerli bir ilan süresi seçin";
    }
    if (!images.length) return "En az bir fotoğraf ekleyin";
    if (!parseNumberTr(form.askPrice) && !parseMoneyTr(form.askPrice)) return "Geçerli bir fiyat girin";
    return "";
  }

  async function showValidationError(err: string) {
    setError(err);
    await alert({
      title: "Eksik bilgi",
      message: err,
      tone: "warning",
      confirmLabel: "Tamam",
    });
  }

  async function openPreview() {
    const err = validate();
    if (err) {
      await showValidationError(err);
      return;
    }
    setError("");
    setMode("preview");
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }

  async function publish() {
    setError("");
    const err = validate();
    if (err) {
      await showValidationError(err);
      return;
    }
    if (editId) {
      // Düzenlemede ücret yok
    }
    const price = useEcommerceForm ? parseMoneyTr(form.askPrice) : parseNumberTr(form.askPrice);
    if (!price) {
      await showValidationError("Geçerli bir fiyat girin");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        askPrice: useEcommerceForm ? Math.round(price * 100) / 100 : price,
        days: Number(form.days),
        coverImage: images[0],
        images,
        attributes: buildAttributes(),
        latitude: mapPoint?.lat ?? null,
        longitude: mapPoint?.lng ?? null,
        titleBold: premium.titleBold,
        titleLarge: premium.titleLarge,
        isColored: premium.isColored,
        featuredDays: premium.featuredDays,
        escrowEligible: escrowUiEnabled ? escrowEligible : false,
        aiSourceImages: aiSourceImages.length ? aiSourceImages : undefined,
      };

      async function send(confirmListingFee = false) {
        const res = await fetch(editId ? `/api/listings/${editId}` : "/api/listings", {
          method: editId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, confirmListingFee }),
        });
        const text = await res.text();
        let data: Record<string, unknown> = {};
        if (text) {
          try {
            data = JSON.parse(text) as Record<string, unknown>;
          } catch {
            data = { error: text.slice(0, 200) || "Sunucu yanıtı okunamadı" };
          }
        } else if (!res.ok) {
          data = { error: `Sunucu hatası (${res.status})` };
        }
        return { res, data };
      }

      let { res, data } = await send(false);

      if (!editId && res.status === 402 && data.code === "LISTING_FEE_REQUIRED") {
        setLoading(false);
        const typeLabel =
          data.accountType === "TICARI" || data.accountType === "EMLAKCI" || data.accountType === "GALERICI"
            ? "Ticari üyeler"
            : "Bireysel üyeler";
        const quota = Number(data.quota);
        const baseFeeTl = Number(data.baseFeeTl) || 0;
        const premiumLines = Array.isArray(data.premiumBreakdown)
          ? (data.premiumBreakdown as Array<{ key?: string; label: string; amountTl: number }>)
          : [];
        const intro =
          data.mode === "freemium" && Number.isFinite(quota) && baseFeeTl > 0
            ? `${typeLabel} yalnızca ${quota} adet ilanı ücretsiz yayınlayabilir.`
            : premiumLines.length && baseFeeTl <= 0
              ? "Seçtiğiniz premium özellikler ücretlidir."
              : "İlanınızı yayınlamak için ücret ödemeniz gerekmektedir.";

        const invoice: ListingFeeInvoice =
          data.invoice && typeof data.invoice === "object"
            ? (data.invoice as ListingFeeInvoice)
            : buildListingFeeInvoice({
                baseFeeTl,
                premiumBreakdown: premiumLines.map((row, i) => ({
                  key: row.key || `line_${i}`,
                  label: row.label,
                  amountTl: Number(row.amountTl) || 0,
                })),
              });

        const premiumFeeTokens =
          data.payWithTokensEnabled && Number(data.premiumFeeTokens) > 0
            ? Number(data.premiumFeeTokens)
            : 0;
        const totalFeeTokens = Number(data.totalFeeTokens) > 0 ? Number(data.totalFeeTokens) : 0;
        const tokensOnly = data.tokensOnly === true;

        const pay = await askFeeInvoice(intro, invoice, {
          premiumFeeTokens: premiumFeeTokens || undefined,
          totalFeeTokens: totalFeeTokens || undefined,
          tokensOnly,
        });
        if (!pay) return;

        if (pay === "tokens") {
          setFeeInvoiceBusy(true);
          setLoading(true);
          const tokenPayload = { ...payload, payWithTokens: true };
          const tokenRes = await fetch("/api/listings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tokenPayload),
          });
          const tokenText = await tokenRes.text();
          let tokenData: Record<string, unknown> = {};
          try {
            tokenData = tokenText ? (JSON.parse(tokenText) as Record<string, unknown>) : {};
          } catch {
            tokenData = { error: "Yanıt okunamadı" };
          }

          // Yalnızca jeton yetti (temel ücret yok) veya tokensOnly tam ödeme
          if (tokenRes.ok) {
            setFeeInvoiceBusy(false);
            setFeeInvoiceModal(null);
            setDoneMessage(
              typeof tokenData.message === "string"
                ? tokenData.message
                : "İlanınız yönetici onayına gönderildi. Onaylandıktan sonra yayınlanacaktır."
            );
            clearListingDraft();
            setAiSourceImages([]);
            setMode("done");
            return;
          }

          // Jeton + kalan TL → POS (base only) — tokensOnly iken olmamalı
          if (
            !tokensOnly &&
            tokenRes.status === 402 &&
            tokenData.code === "LISTING_FEE_REQUIRED"
          ) {
            if (tokenData.demoPosEnabled === false) {
              setFeeInvoiceModal(null);
              setFeeInvoiceBusy(false);
              setError("Kalan ilan ücreti için demo POS kapalı.");
              return;
            }
            const intentRes = await fetch("/api/payments/demo-pos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "intent", listing: tokenPayload }),
            });
            const intentData = await intentRes.json();
            setFeeInvoiceBusy(false);
            setFeeInvoiceModal(null);
            setLoading(false);
            if (!intentRes.ok) {
              setError(intentData.error || "Ödeme oturumu oluşturulamadı");
              return;
            }
            writeListingDraft({
              form,
              attrs,
              housingExtras,
              vehicleExtras,
              expertiseReport,
              images,
              aiSourceImages,
              mapPoint,
              premium,
              mode: "preview",
            });
            router.push(intentData.payUrl || `/odeme/demo-pos?intent=${intentData.intentId}`);
            return;
          }

          setFeeInvoiceBusy(false);
          setFeeInvoiceModal(null);
          setError(
            typeof tokenData.error === "string" ? tokenData.error : "Jeton ödemesi başarısız"
          );
          return;
        }

        if (tokensOnly) {
          setFeeInvoiceModal(null);
          setFeeInvoiceBusy(false);
          setError("POS kapalı. Lütfen jeton ile ödeyin.");
          return;
        }

        if (data.demoPosEnabled === false) {
          setFeeInvoiceModal(null);
          setFeeInvoiceBusy(false);
          setError("Ödeme (demo POS) şu an kapalı. Lütfen daha sonra tekrar deneyin.");
          return;
        }

        setFeeInvoiceBusy(true);
        setLoading(true);
        const intentRes = await fetch("/api/payments/demo-pos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "intent", listing: payload }),
        });
        const intentData = await intentRes.json();
        setFeeInvoiceBusy(false);
        setFeeInvoiceModal(null);
        setLoading(false);
        if (!intentRes.ok) {
          setError(intentData.error || "Ödeme oturumu oluşturulamadı");
          return;
        }
        writeListingDraft({
          form,
          attrs,
          housingExtras,
          vehicleExtras,
          expertiseReport,
          images,
          aiSourceImages,
          mapPoint,
          premium,
          mode: "preview",
        });
        router.push(intentData.payUrl || `/odeme/demo-pos?intent=${intentData.intentId}`);
        return;
      }

      if (!res.ok) {
        if (res.status === 401) return router.push("/giris");
        const code = typeof data.code === "string" ? data.code : "";
        const buyPopup =
          data.buyPopupEnabled !== false &&
          (code === "SHOP_PACKAGE_REQUIRED" || code === "SHOP_PACKAGE_LIMIT");
        if (buyPopup) {
          setShopPackageModal({
            title: code === "SHOP_PACKAGE_LIMIT" ? "İlan limiti doldu" : "Kurumsal paket gerekli",
            description:
              typeof data.error === "string"
                ? `${data.error} Aşağıdan paket seçip satın alabilirsiniz.`
                : "İlan vermek için kurumsal paket alın.",
          });
          return;
        }
        return setError(typeof data.error === "string" ? data.error : "Kayıt başarısız");
      }
      setDoneMessage(
        typeof data.message === "string"
          ? data.message
          : "İlanınız yönetici onayına gönderildi. Onaylandıktan sonra yayınlanacaktır."
      );
      clearListingDraft();
      setAiSourceImages([]);
      setMode("done");
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked || !draftReady || !premiumVerticalsReady) {
    if (!showBootSpinner) return null;
    return (
      <div
        className="page-shell"
        style={{
          maxWidth: 560,
          marginTop: 80,
          marginBottom: 48,
          display: "grid",
          placeItems: "center",
          minHeight: 120,
        }}
        aria-busy
        aria-label="Yükleniyor"
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid #e2e8f0",
            borderTopColor: "var(--orange, #ea580c)",
            animation: "ilan-ver-boot-spin 0.7s linear infinite",
            display: "inline-block",
          }}
        />
        <style>{`@keyframes ilan-ver-boot-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Ticari üye: Genel / Alışveriş / Premium seçim
  if (
    !editId &&
    !fromAi &&
    !silentResume &&
    !listingKind &&
    accountType &&
    needsListingKindChoice(accountType)
  ) {
    return (
      <ListingKindChooser
        showPremium={anyPremiumOpen}
        showAlisveris={alisverisVerticalOpen}
        user={authUser}
      />
    );
  }

  if (mode === "done") {
    const isLiveUpdate = doneMessage.includes("eski haliyle");
    const isDirectUpdate = doneMessage.includes("güncellendi") && !isLiveUpdate;
    return (
      <div className="page-shell" style={{ maxWidth: 560, marginTop: 48, marginBottom: 48 }}>
        <div className="card" style={{ padding: 28, display: "grid", gap: 14, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
            {isDirectUpdate
              ? "İlan güncellendi"
              : isLiveUpdate
                ? "Düzenleme talebi gönderildi"
                : "Onaya gönderildi"}
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>{doneMessage}</p>
          {!isDirectUpdate && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            {isLiveUpdate
              ? "Yönetici onaylarsa yeni içerik yayınlanır; reddedilirse ilan eski haliyle devam eder."
              : "Yönetici onaylarsa ilanınız yayına alınır; reddedilirse sebep size bildirim olarak gelir."}
          </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
            <button className="btn-orange" style={{ padding: "12px 18px" }} onClick={() => router.push("/hesabim?s=ilanlarim")}>
              İlanlarıma Git
            </button>
            <button className="btn-outline" style={{ padding: "12px 18px" }} onClick={() => router.push("/")}>
              Ana Sayfa
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editId && editBlockedByBids) {
    return (
      <div className="page-shell" style={{ maxWidth: 560, marginTop: 48, marginBottom: 48 }}>
        <div className="card" style={{ padding: 28, display: "grid", gap: 14, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Düzenleme yapılamaz</h1>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>
            İlanınıza teklif geldiği için düzenleme yapamazsınız. Değişiklik için İlanlarım
            ekranından yönetici ile iletişime geçebilirsiniz.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
            <button
              className="btn-orange"
              style={{ padding: "12px 18px" }}
              onClick={() => router.push("/hesabim?s=ilanlarim")}
            >
              İlanlarıma Git
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "preview") {
    const attrsPreview = buildAttributes();
    const previewRows = formatListingAttributeRows(attrsPreview, form.categorySlug, {
      showEmptyAsBelirtilmedi: true,
      housingFieldsEnabled,
    }).filter((r) => r.key !== "extras");
    const extrasGrouped = isVehicle
      ? groupVehicleExtras(parseVehicleExtras(attrsPreview.extras))
      : groupHousingExtras(parseHousingExtras(attrsPreview.extras));
    const previewTitle = formatPremiumTitle(form.title, premium);
    const showPremiumBadgePreview = shouldShowPremiumBadge(premium, premiumBadgeRule, {
      isPaid: false,
      isStore: false,
    });
    const titleStyle: CSSProperties = {
      margin: "4px 0 0",
      fontSize: premium.titleLarge ? 28 : 26,
      fontWeight: premium.titleBold ? 900 : 800,
      color: premium.isColored ? "#c2410c" : "#0f172a",
      lineHeight: 1.25,
    };
    const homeCardClass = [
      "listing-card",
      premium.isColored ? "is-colored" : "",
      premium.featuredDays > 0 ? "is-featured" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const homeCardStyle: CSSProperties = {
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      pointerEvents: "none",
      background: premium.isColored ? "#ecfdf5" : "#fff",
      borderRadius: 12,
      border: premium.isColored
        ? "1px solid #86efac"
        : premium.featuredDays > 0
          ? "1px solid #86efac"
          : "1px solid #eeeeee",
      boxShadow: premium.isColored
        ? "0 0 0 1px rgba(22, 163, 74, 0.12)"
        : premium.featuredDays > 0
          ? "0 0 0 2px rgba(22, 163, 74, 0.14)"
          : "0 1px 3px rgba(15, 23, 42, 0.06)",
    };
    const homeTitleClass = [
      "listing-card-title",
      premium.titleBold ? "is-title-bold" : "",
      premium.titleLarge ? "is-title-large" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const locHome = [form.city, form.district].filter(Boolean).join(" ") || form.city || "—";
    const showPremiumPicker = !editId;

    const premiumOptionStyle = (on: boolean, accent: "orange" | "green" = "orange"): CSSProperties => ({
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: on
        ? accent === "green"
          ? "1.5px solid #16a34a"
          : "1.5px solid #fb923c"
        : "1px solid var(--line)",
      background: on ? (accent === "green" ? "#f0fdf4" : "#fff7ed") : "#fff",
      cursor: "pointer",
    });

    return (
      <div className="page-shell" style={{ maxWidth: 760, marginTop: 28, paddingBottom: 48 }}>
        {feeInvoiceModalEl}
        {shopPackageModalEl}
        <div className="card" style={{ padding: 24, display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              {categoryName} / {dealTypeLabel(form.dealType)} · Önizleme
            </div>
            <h1 style={titleStyle}>{previewTitle}</h1>
            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
              {[form.neighborhood, form.district, form.city].filter(Boolean).join(", ")}
            </div>
          </div>

          {showPremiumPicker && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 14,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Premium özellikler</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Seçtikçe sağdaki ana sayfa kartı anında güncellenir. Ücret yayınlamada alınır.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(180px, 220px)",
                  gap: 14,
                  alignItems: "start",
                }}
                className="premium-preview-grid"
              >
                <div style={{ display: "grid", gap: 8 }}>
                  {(
                    [
                      {
                        key: "titleBold" as const,
                        label: "Kalın başlık",
                        hint: "Başlık otomatik kalın görünür",
                        price: premiumPrices.titleBoldTl,
                        tokens: premiumTokenPrices.titleBoldTokens,
                      },
                      {
                        key: "titleLarge" as const,
                        label: "Büyük harf başlık",
                        hint: "Başlık otomatik BÜYÜK HARF olur",
                        price: premiumPrices.titleLargeTl,
                        tokens: premiumTokenPrices.titleLargeTokens,
                      },
                      {
                        key: "isColored" as const,
                        label: "Renkli ilan",
                        hint: "Kartta turuncu vurgu / çerçeve",
                        price: premiumPrices.coloredTl,
                        tokens: premiumTokenPrices.coloredTokens,
                      },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.key} style={premiumOptionStyle(premium[opt.key])}>
                      <input
                        type="checkbox"
                        checked={premium[opt.key]}
                        onChange={(e) => setPremium((p) => ({ ...p, [opt.key]: e.target.checked }))}
                        style={{ marginTop: 3 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>{opt.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {opt.hint}
                        </span>
                      </span>
                      <strong style={{ fontSize: 12, color: "#c2410c", whiteSpace: "nowrap", textAlign: "right" }}>
                        {formatTl(opt.price)}
                        {premiumPayWithTokens && opt.tokens > 0 ? (
                          <span style={{ display: "block", fontWeight: 700, fontSize: 11 }}>
                            veya {opt.tokens} jeton
                          </span>
                        ) : null}
                      </strong>
                    </label>
                  ))}

                  <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>Ana sayfada öne çıkarma</div>
                  {(
                    [
                      { days: 0 as const, label: "Yok", price: 0, tokens: 0 },
                      {
                        days: 3 as const,
                        label: "3 gün ana sayfada kalır",
                        price: premiumPrices.feature3dTl,
                        tokens: premiumTokenPrices.feature3dTokens,
                      },
                      {
                        days: 7 as const,
                        label: "7 gün (1 hafta) ana sayfada kalır",
                        price: premiumPrices.feature7dTl,
                        tokens: premiumTokenPrices.feature7dTokens,
                      },
                    ] as const
                  ).map((opt) => (
                    <label key={String(opt.days)} style={premiumOptionStyle(premium.featuredDays === opt.days, "green")}>
                      <input
                        type="radio"
                        name="featuredDaysPreview"
                        checked={premium.featuredDays === opt.days}
                        onChange={() => setPremium((p) => ({ ...p, featuredDays: opt.days }))}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{opt.label}</span>
                      <strong
                        style={{
                          fontSize: 12,
                          color: opt.days ? "#15803d" : "var(--muted)",
                          whiteSpace: "nowrap",
                          textAlign: "right",
                        }}
                      >
                        {opt.days ? formatTl(opt.price) : "Ücretsiz"}
                        {opt.days && premiumPayWithTokens && opt.tokens > 0 ? (
                          <span style={{ display: "block", fontWeight: 700, fontSize: 11 }}>
                            veya {opt.tokens} jeton
                          </span>
                        ) : null}
                      </strong>
                    </label>
                  ))}

                  {premiumEstimate.totalTl > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#9a3412", textAlign: "right" }}>
                      Premium ara toplam: {formatTl(premiumEstimate.totalTl)}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                    Ana sayfa önizlemesi
                  </div>
                  <article
                    key={`preview-card-${premium.isColored ? 1 : 0}-${premium.featuredDays}-${premium.titleBold ? 1 : 0}-${premium.titleLarge ? 1 : 0}`}
                    className={homeCardClass}
                    style={homeCardStyle}
                  >
                    <div
                      className="listing-card-media"
                      style={{ position: "relative", aspectRatio: "1 / 1", background: "#e5e7eb" }}
                    >
                      {images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                      {showPremiumBadgePreview ? <span className="badge-premium">Premium</span> : null}
                    </div>
                    <div className="listing-card-body" style={{ padding: "10px 12px 12px", display: "grid", gap: 5 }}>
                      <div className={homeTitleClass}>{previewTitle || "Başlık"}</div>
                      <div className="price-ask" style={{ fontWeight: 800, color: "var(--orange)" }}>
                        {formatTl(useEcommerceForm ? parseMoneyTr(form.askPrice) : parseNumberTr(form.askPrice), {
                          fractionDigits: useEcommerceForm ? 2 : 0,
                        })}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>En yüksek teklif: —</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{locHome}</div>
                    </div>
                  </article>
                  {premium.featuredDays > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#15803d", lineHeight: 1.4 }}>
                      Onaydan sonra {premium.featuredDays} gün ana sayfa Premium bölümünde kalır.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0]} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 14 }} />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {isRentDeal(form.dealType) ? "Aylık bedel" : "Talep fiyatı"}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--orange)" }}>
                {formatTl(useEcommerceForm ? parseMoneyTr(form.askPrice) : parseNumberTr(form.askPrice), {
                  fractionDigits: useEcommerceForm ? 2 : 0,
                })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>İlan süresi</div>
              <div style={{ fontWeight: 800 }}>{form.days} gün</div>
            </div>
          </div>
          <ListingDescriptionHtml text={form.description} style={{ lineHeight: 1.55 }} />
          {previewRows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {previewRows.map((row) => (
                <div key={row.key} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>{row.label}</div>
                  <strong style={{ color: row.value === "Belirtilmedi" ? "#94a3b8" : undefined, fontWeight: row.value === "Belirtilmedi" ? 600 : 800 }}>
                    {row.value}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {extrasGrouped.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>İlan ek özellikleri</div>
              {extrasGrouped.map((g) => (
                <div key={g.id}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>{g.label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.items.map((i) => (
                      <span
                        key={i.id}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          color: "#9a3412",
                          borderRadius: 99,
                          padding: "4px 10px",
                        }}
                      >
                        {i.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(expertiseReportHasDamage(expertiseReport) ||
            expertiseReport?.obtainedAt ||
            expertiseReport?.firm) && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Boyalı / değişen parça</div>
              <VehicleExpertiseReportPanel value={expertiseReport} editable={false} />
            </div>
          )}

          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: "#9a3412",
              lineHeight: 1.5,
            }}
          >
            Yayınla dendiğinde ilanınız doğrudan yayına girmez; yönetici onayından sonra yayınlanır.
            Ana sayfa süresi onay anından itibaren başlar.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn-outline" style={{ padding: "12px 18px", flex: 1 }} disabled={loading} onClick={() => setMode("edit")}>
              Düzenle
            </button>
            <button className="btn-orange" style={{ padding: "12px 18px", flex: 1 }} disabled={loading} onClick={publish}>
              {loading ? "Gönderiliyor..." : "Yayınla"}
            </button>
          </div>
          {error && <div style={{ color: "#dc2626", fontWeight: 600 }}>{error}</div>}
        </div>
        <style>{`
          @media (max-width: 640px) {
            .premium-preview-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ maxWidth: 760, marginTop: 28, paddingBottom: 48 }}>
      {feeInvoiceModalEl}
      {shopPackageModalEl}
      {aiOfferOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-offer-title"
          onClick={() => setAiOfferOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(8, 15, 30, 0.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              minHeight: 520,
              padding: 0,
              overflow: "hidden",
              borderRadius: 22,
              border: "1px solid rgba(255,138,61,.35)",
              boxShadow: "0 28px 80px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.06) inset",
              background: "#0b1f3a",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                position: "relative",
                padding: "36px 28px 28px",
                color: "#fff",
                flex: 1,
                background:
                  "radial-gradient(ellipse 90% 70% at 10% 0%, rgba(255,102,0,.45) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 100% 20%, rgba(56,189,248,.18) 0%, transparent 50%), linear-gradient(165deg, #0b1f3a 0%, #132f52 42%, #0a1628 100%)",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.12,
                  backgroundImage:
                    "repeating-linear-gradient(-18deg, transparent, transparent 12px, rgba(255,255,255,.35) 12px, rgba(255,255,255,.35) 13px)",
                  pointerEvents: "none",
                }}
              />
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setAiOfferOpen(false)}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  border: "none",
                  background: "rgba(255,255,255,.12)",
                  color: "#fff",
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <X size={17} />
              </button>

              <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 22 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    width: "fit-content",
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #ff6600, #ff8a3d)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    boxShadow: "0 8px 20px rgba(255,102,0,.4)",
                  }}
                >
                  <Sparkles size={14} /> Hızlı başlangıç
                </div>

                <div style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center", paddingTop: 4 }}>
                  <span
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      background: "linear-gradient(145deg, rgba(255,102,0,.35), rgba(255,138,61,.15))",
                      border: "1px solid rgba(255,138,61,.5)",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 12px 32px rgba(255,102,0,.25)",
                    }}
                  >
                    <Sparkles size={34} color="#ffb080" />
                  </span>
                  <h2
                    id="ai-offer-title"
                    style={{
                      margin: 0,
                      fontSize: "clamp(26px, 5vw, 32px)",
                      fontWeight: 900,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.15,
                    }}
                  >
                    AI ile hızlıca
                    <br />
                    <span style={{ color: "#ff8a3d" }}>ilan ekle</span>
                  </h2>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, opacity: 0.9, maxWidth: 380 }}>
                    sahibinden.com ilan sayfanızın ekran görüntüsünü (tek tam sayfa veya 2 parça) yükleyin; AI forma
                    aktarsın. Bilgileri mutlaka kontrol edin — AI %100 doğruluk garanti etmez.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.1)",
                    fontSize: 13.5,
                    lineHeight: 1.45,
                  }}
                >
                  {[
                    "Tek SS yeterli — sistem dilimleyip okur",
                    "Form alanları otomatik dolar",
                    "Ek özellikleri sen seçersin",
                  ].map((line) => (
                    <div key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: "#ff8a3d", fontWeight: 900, lineHeight: 1.2 }}>✓</span>
                      <span style={{ opacity: 0.95 }}>{line}</span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "14px 18px",
                    borderRadius: 14,
                    background: "linear-gradient(90deg, rgba(255,102,0,.22), rgba(255,138,61,.12))",
                    border: "1px dashed rgba(255,138,61,.55)",
                  }}
                >
                  <span style={{ fontSize: 13, opacity: 0.85 }}>Bu özellik</span>
                  <strong
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: "#ffb080",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {aiTokenCost} jeton
                  </strong>
                  <span style={{ fontSize: 13, opacity: 0.85 }}>karşılığında</span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "20px 24px 24px",
                background: "#fff",
                display: "grid",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="btn-orange"
                style={{
                  padding: "15px 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontWeight: 900,
                  fontSize: 15.5,
                  borderRadius: 12,
                }}
                onClick={() => router.push("/hesabim?s=ai-ilan")}
              >
                <Sparkles size={19} />
                AI ile ilan ekle · {aiTokenCost} jeton
              </button>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "13px 16px", fontWeight: 700, borderRadius: 12 }}
                onClick={() => setAiOfferOpen(false)}
              >
                Manuel devam et
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24, display: "grid", gap: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: 26 }}>{editId ? "İlanı Düzenle" : "İlan Ver"}</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {editId && (editListingStatus === "ACTIVE" || editListingStatus === "SELECTION")
              ? "Yayındaki ilanda yaptığınız değişiklikler yönetici onayına düşer. Onaylanana kadar eski hali yayında kalır."
              : "Önizleyin — premium seçenekleri orada seçin; ilan yönetici onayından sonra yayına alınır."}
          </p>
        </div>

        {editId && (editListingStatus === "ACTIVE" || editListingStatus === "SELECTION") && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 12,
              padding: 12,
              color: "#9a3412",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Bu ilan şu an yayında. Kaydettiğinizde değişiklikler <strong>düzenleme talebi</strong> olarak
            yöneticiye gider. Reddedilirse ilan eski haliyle yayınlanmaya devam eder.
          </div>
        )}

        {rejectionReason && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 12,
              color: "#991b1b",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>Red sebebi:</strong> {rejectionReason}
          </div>
        )}

        <Section title="1) Temel bilgiler" desc="Alıcının ilk gördüğü başlık ve açıklama.">
          <Field label="İlan başlığı" hint="Örn: Cadde üzeri 3+1 daire, deniz manzaralı">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Başlık yazın"
            />
          </Field>
          <Field label="Açıklama" hint="Enter ile alt satır. Telefon / e-posta / dış link yasak.">
            <ListingDescriptionField
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              disabled={editBlockedByBids}
            />
          </Field>
          <Field
            label="Kategori seçimi *"
            hint={
              effectiveKind === "premium"
                ? "Premium dikey → alt kategori (zorunlu)."
                : effectiveKind === "alisveris"
                  ? "Alışveriş grubu → ikinci el / sıfır → ürün kategorisi (zorunlu)."
                  : "Ana kategori → tür → marka / model (zorunlu)."
            }
          >
            {effectiveKind === "premium" ? (
              <PremiumCategoryLadderPicker
                disabled={editBlockedByBids}
                value={{
                  categorySlug: form.categorySlug,
                  dealType: form.dealType,
                  subtype: attrs.subtype,
                  rentalPeriod: attrs.rentalPeriod,
                  brand: attrs.brand,
                  model: attrs.model,
                  trim: attrs.trim,
                }}
                onChange={(next) => {
                  setForm((f) => ({
                    ...f,
                    categorySlug: next.categorySlug,
                    dealType: next.dealType || "SATILIK",
                  }));
                  setAttrs((a) => ({
                    ...a,
                    subtype: next.subtype,
                    rentalPeriod: next.rentalPeriod,
                    brand: next.brand,
                    model: next.model,
                    trim: next.trim,
                  }));
                }}
              />
            ) : (
              <CategoryLadderPicker
                disabled={editBlockedByBids}
                tree={effectiveKind === "alisveris" ? shopBrowseTree : genelBrowseTree}
                hint={
                  effectiveKind === "alisveris" ? (
                    <>
                      Alışveriş kategorisini adım adım seçin. Örn: <strong>Elektronik</strong> →{" "}
                      <strong>İkinci El</strong> → <strong>Cep Telefonu</strong>
                    </>
                  ) : undefined
                }
                value={{
                  categorySlug: form.categorySlug,
                  dealType: form.dealType,
                  subtype: attrs.subtype,
                  rentalPeriod: attrs.rentalPeriod,
                  brand: attrs.brand,
                  model: attrs.model,
                  // Legacy: attributes.trim held engine code when version was absent.
                  version: attrs.version || (!attrs.version && attrs.trim ? attrs.trim : ""),
                  trim: attrs.version ? attrs.trim : "",
                  generation: attrs.generation,
                  modelYear: attrs.year,
                }}
                onChange={(next) => {
                  setForm((f) => ({
                    ...f,
                    categorySlug: next.categorySlug,
                    dealType:
                      next.dealType ||
                      (effectiveKind === "alisveris"
                        ? "SATILIK"
                        : next.categorySlug === "kiralik"
                          ? "KIRALIK"
                          : ""),
                  }));
                  setAttrs((a) => ({
                    ...a,
                    subtype: next.subtype,
                    rentalPeriod: next.rentalPeriod || next.extraAttrs?.rentalPeriod || "",
                    brand: next.brand,
                    model: next.model,
                    version: next.version || "",
                    trim: next.trim,
                    generation: next.generation || "",
                    ...(next.modelYear ? { year: next.modelYear } : {}),
                    ...(next.extraAttrs || {}),
                  }));
                }}
              />
            )}
          </Field>
        </Section>

        <div style={divider} />

        <Section title="2) Konum" desc="İl, ilçe ve mahalle seçimi (Türkiye standart adres).">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="İl">
              <LocationSelect
                label="İl"
                value={form.city}
                options={CITY_NAMES}
                placeholder="İl Seçin"
                onChange={(city) => setForm({ ...form, city, district: "", neighborhood: "" })}
              />
            </Field>
            <Field label="İlçe">
              <LocationSelect
                label="İlçe"
                value={form.district}
                options={districts}
                placeholder="İlçe Seçin"
                disabled={!form.city}
                onChange={(district) => setForm({ ...form, district, neighborhood: "" })}
              />
            </Field>
          </div>
          <Field label="Mahalle">
            <LocationSelect
              label="Mahalle"
              value={form.neighborhood}
              options={neighborhoods}
              placeholder="Mahalle Seçin"
              disabled={!form.district}
              onChange={(neighborhood) => setForm({ ...form, neighborhood })}
            />
          </Field>
          <Field
            label="Haritada konum"
            hint="İl / ilçe / mahalle seçince harita yaklaşık konuma gider. Daha net işaretlemek için tıklayın veya pini sürükleyin."
          >
            <MapPicker
              city={form.city}
              district={form.district}
              neighborhood={form.neighborhood}
              value={mapPoint}
              onChange={setMapPoint}
            />
          </Field>
        </Section>

        <div style={divider} />

        <Section
          title="3) İlan özellikleri"
          desc={
            !slug
              ? "Özellik alanları, kategori seçildikten sonra açılır."
              : isVehicle
                ? "Araç detayları (yıl, km, yakıt, vites, ekspertiz) ve donanım özellikleri."
                : isLand
                  ? "Arsa m², imar ve tapu bilgileri."
                  : isShop
                    ? useEcommerceForm
                      ? "Ürün detayları (marka, stok, fiyat katmanları, kargo, özellikler)."
                      : "Ürün detayları (marka, model, durum)."
                    : "Konut/işyeri detayları — m², oda, kat, ısınma vb."
          }
        >
          {!slug && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                fontSize: 13,
                color: "#9a3412",
                fontWeight: 600,
              }}
            >
              Önce yukarıdan kategori merdivenini tamamlayın (ör. Konut › Satılık › Villa). Ardından özellik alanları burada görünür.
            </div>
          )}

          {(isHomeLike || isWorkplace) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Brüt m²">
                <input className="input" inputMode="numeric" value={attrs.m2} onChange={(e) => setAttr("m2", e.target.value)} placeholder="Örn: 145" />
              </Field>
              <Field label="Net m²">
                <input className="input" inputMode="numeric" value={attrs.netM2} onChange={(e) => setAttr("netM2", e.target.value)} placeholder="Örn: 125" />
              </Field>
              {isHomeLike && (
                <Field label="Oda sayısı">
                  <select className="select" value={attrs.rooms} onChange={(e) => setAttr("rooms", e.target.value)}>
                    <option value="">Seçin</option>
                    {["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+"].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Bina yaşı">
                <select className="select" value={attrs.buildingAge} onChange={(e) => setAttr("buildingAge", e.target.value)}>
                  <option value="">Seçin</option>
                  {BUILDING_AGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bulunduğu kat">
                <select className="select" value={attrs.floor} onChange={(e) => setAttr("floor", e.target.value)}>
                  <option value="">Seçin</option>
                  {HOUSING_FLOOR_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bina kat sayısı">
                <select
                  className="select"
                  value={attrs.totalFloors}
                  onChange={(e) => setAttr("totalFloors", e.target.value)}
                >
                  <option value="">Seçin</option>
                  {HOUSING_TOTAL_FLOOR_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Isıtma">
                <select className="select" value={attrs.heating} onChange={(e) => setAttr("heating", e.target.value)}>
                  <option value="">Seçin</option>
                  {["Doğalgaz (Kombi)", "Merkezi", "Klima", "Soba", "Yerden Isıtma", "Yok"].map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Banyo sayısı">
                <input className="input" inputMode="numeric" value={attrs.bathrooms} onChange={(e) => setAttr("bathrooms", e.target.value)} placeholder="Örn: 1" />
              </Field>
              <Field label="Balkon">
                <select className="select" value={attrs.balcony} onChange={(e) => setAttr("balcony", e.target.value)}>
                  <option value="">Seçin</option>
                  <option value="Var">Var</option>
                  <option value="Yok">Yok</option>
                </select>
              </Field>
              {isHomeLike && housingFieldOn("kitchen") && (
                <Field label="Mutfak">
                  <select className="select" value={attrs.kitchen} onChange={(e) => setAttr("kitchen", e.target.value)}>
                    <option value="">Seçin</option>
                    {HOUSING_KITCHEN_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("usageStatus") && (
                <Field label="Kullanım durumu">
                  <select
                    className="select"
                    value={attrs.usageStatus}
                    onChange={(e) => setAttr("usageStatus", e.target.value)}
                  >
                    <option value="">Seçin</option>
                    {HOUSING_USAGE_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("inSite") && (
                <Field label="Site içinde mi?">
                  <select
                    className="select"
                    value={attrs.inSite}
                    onChange={(e) => {
                      setAttr("inSite", e.target.value);
                      if (e.target.value !== "Evet") setAttr("siteName", "");
                    }}
                  >
                    <option value="">Seçin</option>
                    {HOUSING_YES_NO_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("siteName") && attrs.inSite === "Evet" && (
                <Field label="Site adı">
                  <input
                    className="input"
                    value={attrs.siteName}
                    onChange={(e) => setAttr("siteName", e.target.value)}
                    placeholder="Örn: Yeşil Vadi Sitesi"
                  />
                </Field>
              )}
              {isHomeLike && housingFieldOn("elevator") && (
                <Field label="Asansör">
                  <select
                    className="select"
                    value={attrs.elevator}
                    onChange={(e) => setAttr("elevator", e.target.value)}
                  >
                    <option value="">Seçin</option>
                    {HOUSING_YES_NO_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("creditEligible") && (
                <Field label="Krediye uygun">
                  <select
                    className="select"
                    value={attrs.creditEligible}
                    onChange={(e) => setAttr("creditEligible", e.target.value)}
                  >
                    <option value="">Seçin</option>
                    {HOUSING_YES_NO_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("energyCertificate") && (
                <Field label="Enerji kimlik belgesi">
                  <select
                    className="select"
                    value={attrs.energyCertificate}
                    onChange={(e) => setAttr("energyCertificate", e.target.value)}
                  >
                    <option value="">Seçin</option>
                    {HOUSING_ENERGY_CERT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("sellerType") && (
                <Field label="Satıcı">
                  <select
                    className="select"
                    value={attrs.sellerType}
                    onChange={(e) => setAttr("sellerType", e.target.value)}
                  >
                    <option value="">Seçin</option>
                    {HOUSING_SELLER_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isHomeLike && housingFieldOn("swap") && (
                <Field label="Takas">
                  <select className="select" value={attrs.swap} onChange={(e) => setAttr("swap", e.target.value)}>
                    <option value="">Seçin</option>
                    {HOUSING_YES_NO_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Aidat (TL / ay)" hint="Belirtilmeyecekse boş bırakın — önizlemede “Belirtilmedi” görünür.">
                <input className="input" inputMode="numeric" value={attrs.dues} onChange={(e) => setAttr("dues", e.target.value)} placeholder="Örn: 1500" />
              </Field>
              {(isRentDeal(form.dealType) || slug === "kiralik") && (
                <Field label="Eşyalı mı?">
                  <select className="select" value={attrs.furnished} onChange={(e) => setAttr("furnished", e.target.value)}>
                    <option value="">Seçin</option>
                    <option value="Eşyalı">Eşyalı</option>
                    <option value="Eşyasız">Eşyasız</option>
                    <option value="Yarı Eşyalı">Yarı Eşyalı</option>
                  </select>
                </Field>
              )}
              <Field label="Tapu durumu" hint="Sahibinden tarzı tapu bilgisi.">
                <select className="select" value={attrs.deedStatus} onChange={(e) => setAttr("deedStatus", e.target.value)}>
                  <option value="">Seçin</option>
                  {["Kat Mülkiyeti", "Kat İrtifakı", "Hisseli Tapu", "Müstakil Tapulu", "Tahsis", "Bilinmiyor"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {isHomeLike && slug && (
            <>
              <div style={{ ...divider, marginTop: 8 }} />
              <Section
                title="İlan ek özellikleri"
                desc="Sahibinden tarzı iç/dış özellikler, ulaşım ve çevre seçenekleri. İstediğinizi işaretleyin."
              >
                <HousingExtrasPicker value={housingExtras} onChange={setHousingExtras} />
              </Section>
            </>
          )}

          {isLand && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Alan (m²)">
                <input className="input" inputMode="numeric" value={attrs.m2} onChange={(e) => setAttr("m2", e.target.value)} placeholder="Örn: 500" />
              </Field>
              <Field label="İmar durumu">
                <select className="select" value={attrs.zoning} onChange={(e) => setAttr("zoning", e.target.value)}>
                  <option value="">Seçin</option>
                  {["Konut", "Ticari", "Tarla", "Bağ / Bahçe", "Sanayi", "Turizm", "Diğer"].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tapu durumu">
                <select className="select" value={attrs.deedStatus} onChange={(e) => setAttr("deedStatus", e.target.value)}>
                  <option value="">Seçin</option>
                  {["Müstakil Tapulu", "Hisseli Tapu", "Tahsis", "Bilinmiyor"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cephe / yol">
                <input className="input" value={attrs.frontage} onChange={(e) => setAttr("frontage", e.target.value)} placeholder="Örn: Ana cadde cepheli" />
              </Field>
            </div>
          )}

          {isVehicle && useDbVehicleFields && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {vasitaVisibleFields.map((field) => {
                const legacyKey = legacyAttrKeyFor(field.key);
                const value = String((attrs as Record<string, string>)[legacyKey] || "");
                const label = field.required ? `${field.label} *` : field.label;
                const unitHint = field.unit ? ` (${field.unit})` : "";
                if (field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT" || field.options?.length) {
                  return (
                    <Field key={field.key} label={`${label}${unitHint}`}>
                      <select
                        className="select"
                        value={value}
                        required={field.required}
                        onChange={(e) => setAttr(legacyKey, e.target.value)}
                      >
                        <option value="">Seçin</option>
                        {(field.options || []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label || o.value}
                          </option>
                        ))}
                      </select>
                    </Field>
                  );
                }
                if (field.type === "BOOLEAN") {
                  return (
                    <Field key={field.key} label={label}>
                      <select
                        className="select"
                        value={value}
                        required={field.required}
                        onChange={(e) => setAttr(legacyKey, e.target.value)}
                      >
                        <option value="">Seçin</option>
                        <option value="Evet">Evet</option>
                        <option value="Hayır">Hayır</option>
                      </select>
                    </Field>
                  );
                }
                return (
                  <Field key={field.key} label={`${label}${unitHint}`}>
                    <input
                      className="input"
                      type={field.type === "DATE" ? "date" : "text"}
                      inputMode={field.type === "NUMBER" ? "numeric" : undefined}
                      value={value}
                      required={field.required}
                      onChange={(e) => setAttr(legacyKey, e.target.value)}
                      placeholder={field.unit ? `Örn: ${field.unit}` : undefined}
                    />
                  </Field>
                );
              })}
            </div>
          )}


          {isVehicle && supportsVehicleExpertiseReport(attrs.subtype) && (
            <>
              <div style={{ ...divider, marginTop: 8 }} />
              <Section
                title="Boyalı / değişen parça ekspertiz"
                desc="Şema üzerinden parçalara tıklayın. Sol/ön hasarlar solda, sağ/arka hasarlar sağda listelenir."
              >
                <VehicleExpertiseReportPanel
                  value={expertiseReport}
                  onChange={setExpertiseReport}
                  editable
                />
              </Section>
            </>
          )}

          {isVehicle && slug && (
            <>
              <div style={{ ...divider, marginTop: 8 }} />
              <Section
                title="Araç donanım özellikleri"
                desc="Güvenlik, iç/dış donanım ve multimedya. Sahibinden tarzı seçenekler — istediğinizi işaretleyin."
              >
                <VehicleExtrasPicker
                  value={vehicleExtras}
                  onChange={setVehicleExtras}
                  attributeTemplate={attributeTemplateForSubtype(attrs.subtype || "otomobil")}
                />
              </Section>
            </>
          )}

          {isShop && useEcommerceForm && (
            <ShoppingProductFormFields attrs={attrs} setAttr={setAttr} askPrice={form.askPrice} />
          )}

          {isShop && !useEcommerceForm && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Marka">
                <input className="input" value={attrs.brand || ""} onChange={(e) => setAttr("brand", e.target.value)} placeholder="Örn: Apple, Samsung" disabled={slug === "arac"} />
              </Field>
              <Field label="Model">
                <input className="input" value={attrs.model || ""} onChange={(e) => setAttr("model", e.target.value)} placeholder="Örn: iPhone 14" disabled={slug === "arac"} />
              </Field>
              <Field label="Durum">
                <select className="select" value={attrs.condition || ""} onChange={(e) => setAttr("condition", e.target.value)}>
                  <option value="">Seçin</option>
                  {["Sıfır", "Sıfır Ayarında", "Çok İyi", "İyi", "Orta", "Yıpranmış"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Garanti">
                <select className="select" value={attrs.warranty || ""} onChange={(e) => setAttr("warranty", e.target.value)}>
                  <option value="">Seçin</option>
                  <option value="Var">Var</option>
                  <option value="Yok">Yok</option>
                </select>
              </Field>
            </div>
          )}

          {slug && !showAttrFields && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Bu kategori için ek özellik alanları yok; detayları açıklamada belirtebilirsiniz.
            </div>
          )}
        </Section>

        <div style={divider} />

        <Section
          title="4) Fiyat ve süre"
          desc="Talep fiyatınız ve ilanın teklif toplama süresi."
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field
              label={isRentDeal(form.dealType) ? "Aylık kira / bedel (TL)" : "İlan / talep fiyatı (TL)"}
              hint={
                useEcommerceForm
                  ? "Kuruşlu yazın (örn. 1.458,99). Detayda kuruş üstte yarım boyutta gösterilir."
                  : "Alıcıların göreceği başlangıç fiyatı."
              }
            >
              <input
                className="input"
                inputMode={useEcommerceForm ? "decimal" : "numeric"}
                value={
                  useEcommerceForm
                    ? askPriceFocused
                      ? form.askPrice
                      : form.askPrice
                        ? formatMoneyTr(parseMoneyTr(form.askPrice))
                        : ""
                    : form.askPrice
                      ? formatNumberTr(parseNumberTr(form.askPrice))
                      : ""
                }
                onFocus={() => {
                  if (useEcommerceForm) setAskPriceFocused(true);
                }}
                onBlur={() => {
                  if (!useEcommerceForm) return;
                  setAskPriceFocused(false);
                  const n = parseMoneyTr(form.askPrice);
                  setForm({ ...form, askPrice: n > 0 ? String(Math.round(n * 100) / 100) : "" });
                }}
                onChange={(e) => {
                  if (useEcommerceForm) {
                    const raw = e.target.value.replace(/[^\d.,]/g, "");
                    setForm({ ...form, askPrice: raw });
                    return;
                  }
                  setForm({ ...form, askPrice: String(parseNumberTr(e.target.value) || "") });
                }}
                placeholder={useEcommerceForm ? "Örn: 1.458,99" : "Örn: 1.000.000"}
              />
            </Field>
            <Field
              label="İlan süresi (gün) *"
              hint="Zorunlu. Bu süre boyunca teklif toplanır."
            >
              <select
                className="select"
                value={form.days}
                onChange={(e) => setForm({ ...form, days: e.target.value })}
                required
              >
                <option value="">Süre seçin</option>
                {[3, 5, 7, 10, 14, 21, 30].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} gün
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {escrowUiEnabled && (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: escrowEligible ? "1.5px solid #16a34a" : "1px solid var(--line)",
                background: escrowEligible ? "#f0fdf4" : "#fff",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={escrowEligible}
                onChange={(e) => setEscrowEligible(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>
                  {escrowButtonLabel} ödemeye uygun
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                  Alıcı, ödemesini TeklifBu Güvenli Öde havuzuna yatırıp ürünü teslim aldıktan sonra
                  onaylayabilir. Bu ilan için {escrowButtonLabel.toLowerCase()} seçeneği alıcıya gösterilir.
                </span>
              </span>
            </label>
          )}
        </Section>

        <div style={divider} />

        <Section title="5) Fotoğraflar" desc="Galeriden seçin; URL yapıştırmaya gerek yok. İlk fotoğraf kapaktır.">
          <ImageUploader images={images} onChange={setImages} max={12} />
        </Section>

        <button className="btn-orange" style={{ padding: 14, fontSize: 15 }} onClick={openPreview}>
          Önizleme Gör
        </button>
        {error && <div style={{ color: "#dc2626", fontWeight: 600 }}>{error}</div>}
      </div>
    </div>
  );
}

export default function CreateListingPage() {
  return (
    <Suspense fallback={<div className="page-shell" style={{ maxWidth: 760, marginTop: 28, paddingTop: 40, paddingBottom: 40 }}>Yükleniyor...</div>}>
      <CreateListingInner />
    </Suspense>
  );
}
