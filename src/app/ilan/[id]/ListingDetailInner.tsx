"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatTl, formatNumberTr, parseNumberTr, maskName, remainingLabel, formatPhoneTr } from "@/lib/format";
import { formatListingNo } from "@/lib/listingNo";
import { dealTypeLabel } from "@/lib/dealType";
import { listingStatusLabel, bidStatusLabel } from "@/lib/listingStatus";
import { expectedAttrKeysForCategory, fieldLabel, formatListingAttributeRows, isBidderReviseOpen } from "@/lib/listingEditFields";
import { buildingAgeLabel } from "@/data/housingMatch";
import { DEFAULT_HOUSING_FORM_FIELDS_ENABLED } from "@/data/housingFormFields";
import { formatPremiumTitle } from "@/lib/listingPremiumDisplay";
import { groupHousingExtras, parseHousingExtras } from "@/data/housingExtras";
import { groupVehicleExtras, parseVehicleExtras } from "@/data/vehicleExtras";
import {
  expertiseReportHasDamage,
  parseExpertiseReport,
  supportsVehicleExpertiseReport,
} from "@/data/vehicleExpertiseReport";
import { VehicleExpertiseReportPanel } from "@/components/VehicleExpertiseReport";
import {
  browseFilterToSearchPatch,
  findBrowseNode,
  matchBrowsePath,
} from "@/data/categoryBrowseTree";
import { brandName, modelName, trimName } from "@/data/vehicleCatalog";
import { buildSearchHref, EMPTY_SEARCH_FILTERS } from "@/components/SearchPanel";
import { CountdownBadge } from "@/components/CountdownBadge";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { AuthModal } from "@/components/AuthModal";
import { TokenBuyModal } from "@/components/TokenBuyModal";
import { BidTipsCard, bidTipsHidden, BID_TIPS_STORAGE_KEY } from "@/components/BidTipsCard";
import { SellerOwnerCard } from "@/components/SellerOwnerCard";
import { SellerReviewsPanel } from "@/components/SellerReviewsPanel";
import { BidSentModal } from "@/components/BidSentModal";
import { SimilarListingsStrip } from "@/components/SimilarListingsStrip";
import { ListingQuestionsBlock } from "@/components/ListingQuestionsBlock";
import { RecentSalesStrip } from "@/components/RecentSalesStrip";
import { EidsBadge } from "@/components/EidsBadge";
import { ListingDescriptionHtml } from "@/components/ListingDescriptionHtml";
import { useTheme } from "@/components/ThemeProvider";
import { ShoppingProductDetail } from "@/components/shopping/ShoppingProductDetail";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";
import dynamic from "next/dynamic";
import {
  Heart,
  Share2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  BedDouble,
  Maximize2,
  Building2,
  Layers,
  CalendarDays,
  Flame,
  MapPin,
  Gavel,
  Flag,
  ChevronDown,
} from "lucide-react";

const ListingMap = dynamic(() => import("@/components/ListingMapView").then((m) => m.ListingMapView), {
  ssr: false,
  loading: () => <div style={{ height: 260, borderRadius: 14, background: "#e8eef5" }} />,
});

type Listing = {
  id: string;
  listingNo?: string | null;
  title: string;
  description: string;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  dealType?: "SATILIK" | "KIRALIK" | string;
  askPrice: number;
  highestBid: number;
  bidCount: number;
  endsAt?: string;
  coverImage?: string | null;
  images: string[];
  attributes?: Record<string, string | number> | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: { name: string; slug?: string; isPremium?: boolean; premiumVertical?: string | null };
  eidsBadge?: string | null;
  seller: {
    id: string;
    name: string | null;
    phone: string | null;
    memberSince: string;
    memberYearsLabel?: string | null;
    contactVisible: boolean;
    identityVisible?: boolean;
    messagingAllowed?: boolean;
    accountType: string;
    isCommercial?: boolean;
    commercialTitle?: string | null;
    yetkiBelgeNo?: string | null;
    logoUrl?: string | null;
    isPremiumSeller?: boolean;
    showPremiumBadge?: boolean;
    showPremiumStoreBadge?: boolean;
    showYearsBadge?: boolean;
    reviewCount?: number;
    avgRating?: number | null;
    shopId?: string | null;
    shopName?: string | null;
    isSellerFavorited?: boolean;
    verifications?: {
      identity?: boolean;
      tax?: boolean;
      phone?: boolean;
      email?: boolean;
    } | null;
    stats?: {
      totalListings?: number;
      successfulSales?: number;
      bidAcceptanceRate?: number | null;
      avgResponseMinutes?: number | null;
    } | null;
    lastActiveAt?: string | null;
  };
  accessRule?: { identity?: string; contact?: string; messaging?: string };
  topCategorySlug?: string | null;
  reviewsEnabled?: boolean;
  status: string;
  rejectionReason?: string | null;
  canEdit?: boolean;
  isFavorited?: boolean;
  approvedBidId?: string | null;
  isFeatured?: boolean;
  titleBold?: boolean;
  titleLarge?: boolean;
  isColored?: boolean;
  lastChangeDiff?: Record<string, { from: unknown; to: unknown }> | null;
  lastChangeAt?: string | null;
  bidderReviseUntil?: string | null;
  escrowEligible?: boolean;
  escrowAvailable?: boolean;
  escrowSettings?: {
    buttonLabel: string;
    shipDaysOptions: number[];
    defaultShipDays: number;
    requireSellerIban: boolean;
    commissionPercent: number;
  } | null;
};

type Bid = {
  id: string;
  rank: number;
  amount: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  bidderName: string | null;
  bidderId: string;
};

const ATTR_META: Array<{
  keys: string[];
  label: string;
  icon: ReactNode;
  suffix?: string;
}> = [
  { keys: ["rooms", "oda"], label: "Oda Sayısı", icon: <BedDouble size={20} strokeWidth={1.75} /> },
  { keys: ["netM2", "net"], label: "Net Alan", icon: <Maximize2 size={20} strokeWidth={1.75} />, suffix: " m²" },
  { keys: ["m2", "brut"], label: "Brüt / Alan", icon: <Maximize2 size={20} strokeWidth={1.75} />, suffix: " m²" },
  { keys: ["floor", "bulundugu"], label: "Bulunduğu Kat", icon: <Layers size={20} strokeWidth={1.75} /> },
  { keys: ["totalFloors", "katSayisi"], label: "Kat Sayısı", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["buildingAge"], label: "Bina Yaşı", icon: <CalendarDays size={20} strokeWidth={1.75} /> },
  { keys: ["heating", "isinma"], label: "Isınma", icon: <Flame size={20} strokeWidth={1.75} /> },
  { keys: ["bathrooms", "banyo"], label: "Banyo", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["balcony", "balkon"], label: "Balkon", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["kitchen", "mutfak"], label: "Mutfak", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["usageStatus", "kullanim"], label: "Kullanım", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["inSite", "siteIci"], label: "Site İçinde", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["siteName", "siteAdi"], label: "Site Adı", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["creditEligible", "kredi"], label: "Krediye Uygun", icon: <Flame size={20} strokeWidth={1.75} /> },
  { keys: ["energyCertificate", "enerji"], label: "Enerji Kimlik", icon: <Flame size={20} strokeWidth={1.75} /> },
  { keys: ["sellerType", "satici"], label: "Satıcı", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["swap", "takas"], label: "Takas", icon: <Layers size={20} strokeWidth={1.75} /> },
  { keys: ["furnished", "esya"], label: "Eşya", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["dues", "aidat"], label: "Aidat", icon: <Flame size={20} strokeWidth={1.75} />, suffix: " TL" },
  { keys: ["deedStatus", "tapu"], label: "Tapu", icon: <Building2 size={20} strokeWidth={1.75} /> },
  { keys: ["zoning", "imar"], label: "İmar", icon: <Maximize2 size={20} strokeWidth={1.75} /> },
  { keys: ["year"], label: "Model Yılı", icon: <CalendarDays size={20} strokeWidth={1.75} /> },
  { keys: ["km"], label: "Kilometre", icon: <Maximize2 size={20} strokeWidth={1.75} /> },
  { keys: ["fuel", "yakit"], label: "Yakıt", icon: <Flame size={20} strokeWidth={1.75} /> },
  { keys: ["gear", "vites"], label: "Vites", icon: <Layers size={20} strokeWidth={1.75} /> },
];

function attrEntries(
  attributes?: Record<string, string | number> | null,
  categorySlug?: string | null,
  housingFieldsEnabled?: Record<string, boolean> | null
) {
  const attrs = attributes || {};
  const entries = Object.entries(attrs);
  const used = new Set<string>();
  const expected = new Set(
    expectedAttrKeysForCategory(categorySlug, { housingFieldsEnabled })
  );

  const rows = ATTR_META.map((meta) => {
    const found = entries.find(
      ([k]) =>
        !used.has(k) &&
        meta.keys.some((key) => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().includes(key.toLowerCase()))
    );
    const primaryKey = meta.keys[0];
    if (!found) {
      if (!expected.has(primaryKey)) return null;
      return { ...meta, value: "Belirtilmedi" };
    }
    used.add(found[0]);
    let text = String(found[1] ?? "").trim();
    if (!text) return { ...meta, value: "Belirtilmedi" };
    if (primaryKey === "buildingAge") text = buildingAgeLabel(text) || text;
    if (meta.suffix && text !== "Belirtilmedi") text = `${text}${meta.suffix}`;
    return { ...meta, value: text };
  }).filter(Boolean) as Array<{ label: string; icon: ReactNode; value: string }>;

  return rows;
}

/** Ana Sayfa › Emlak › Satılık › Daire — tekrarlayan Kiralık › Kiralık olmasın */
function listingCategoryCrumbs(listing: Listing): Array<{ label: string; href: string }> {
  const slug = String(listing.category?.slug || "");
  const attrs = (listing.attributes || {}) as Record<string, unknown>;
  const subtype = String(attrs.subtype || "").trim();
  const rentalRaw = String(attrs.rentalPeriod || attrs.rental || "").trim();
  const rental = rentalRaw === "gunluk" ? "gunluk" : "";
  const brand = String(attrs.brand || "").trim();
  const model = String(attrs.model || "").trim();
  const trim = String(attrs.trim || "").trim();
  const dealType = String(listing.dealType || "").trim();

  const pathIds = matchBrowsePath({
    category: slug,
    dealType,
    subtype,
    rental,
  });

  const crumbs: Array<{ label: string; href: string }> = [];
  const push = (label: string, href: string) => {
    if (!label) return;
    if (crumbs.length && crumbs[crumbs.length - 1].label === label) return;
    crumbs.push({ label, href });
  };

  for (const id of pathIds) {
    const node = findBrowseNode(id);
    if (!node) continue;
    const patch = browseFilterToSearchPatch(node.filter);
    push(
      node.name,
      buildSearchHref({
        ...EMPTY_SEARCH_FILTERS,
        category: patch.category,
        dealType: patch.dealType,
        subtype: patch.subtype,
        rental: patch.rental,
        brand: patch.brand,
        model: patch.model,
        trim: patch.trim,
      })
    );
  }

  if (!crumbs.length && listing.category?.name) {
    push(listing.category.name, `/ilanlar?category=${encodeURIComponent(slug)}`);
  }

  // Vasıta: marka › model › paket
  if (slug === "arac" && brand) {
    const bLabel = brandName(subtype, brand) || brand;
    push(
      bLabel,
      buildSearchHref({
        ...EMPTY_SEARCH_FILTERS,
        category: "arac",
        subtype,
        brand,
      })
    );
    if (model) {
      const mLabel = modelName(subtype, brand, model) || model;
      push(
        mLabel,
        buildSearchHref({
          ...EMPTY_SEARCH_FILTERS,
          category: "arac",
          subtype,
          brand,
          model,
        })
      );
      if (trim) {
        const tLabel = trimName(subtype, brand, model, trim) || trim;
        push(
          tLabel,
          buildSearchHref({
            ...EMPTY_SEARCH_FILTERS,
            category: "arac",
            subtype,
            brand,
            model,
            trim,
          })
        );
      }
    }
  }

  // Yol bulunamadıysa en azından deal type (kategori adından farklıysa)
  if (crumbs.length <= 1 && dealType) {
    const dl = dealTypeLabel(dealType);
    if (dl && dl !== crumbs[0]?.label) {
      push(dl, `/ilanlar?category=${encodeURIComponent(slug)}&type=${encodeURIComponent(dealType)}`);
    }
    if (subtype) {
      push(subtype.replace(/-/g, " "), `/ilanlar?category=${encodeURIComponent(slug)}&subtype=${encodeURIComponent(subtype)}`);
    }
  }

  return crumbs;
}

export default function ListingDetailInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { offersEnabled } = useTheme();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [tab, setTab] = useState(
    search.get("tab") === "teklifler"
      ? "teklifler"
      : search.get("tab") === "yorumlar"
        ? "yorumlar"
        : search.get("tab") === "satici"
          ? "satici"
          : "detay"
  );
  const [amountRaw, setAmountRaw] = useState(0);
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [durations] = useState([1, 3, 7]);
  const [msg, setMsg] = useState("");
  const [bidSentOpen, setBidSentOpen] = useState(false);
  const [bidSentAmount, setBidSentAmount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState<{ id: string; phoneVerified?: boolean } | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [favOk, setFavOk] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [shareOk, setShareOk] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [bidsOpen, setBidsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<"bid" | "favorite">("bid");
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenNeed, setTokenNeed] = useState(1);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [reviseBusy, setReviseBusy] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [messagingAccess, setMessagingAccess] = useState<"approved" | "everyone" | "logged_in">("approved");
  const [sellerFav, setSellerFav] = useState(false);
  const [shopCrumbs, setShopCrumbs] = useState<Array<{ label: string; href: string }> | null>(null);
  const [housingFieldsEnabled, setHousingFieldsEnabled] = useState(DEFAULT_HOUSING_FORM_FIELDS_ENABLED);
  const [detailLayout, setDetailLayout] = useState<"classic" | "sahibinden">("classic");
  const [premiumDetailLayout, setPremiumDetailLayout] = useState<"premium" | "sahibinden" | "classic">("premium");
  const [shoppingDetailTemplate, setShoppingDetailTemplate] = useState<"classic" | "ecommerce_v1">("classic");
  const [shoppingOffersEnabled, setShoppingOffersEnabled] = useState(true);
  const [bidTipsOpen, setBidTipsOpen] = useState(false);
  const [maxBidsPerListing, setMaxBidsPerListing] = useState(4);
  const [escrowOpen, setEscrowOpen] = useState(false);
  const [escrowShipDays, setEscrowShipDays] = useState<number | null>(null);
  const [escrowBusy, setEscrowBusy] = useState(false);
  const [escrowError, setEscrowError] = useState("");
  const { confirm, alert } = useDialog();

  useEffect(() => {
    fetch("/api/housing-form-fields")
      .then((r) => r.json())
      .then((d) => {
        if (d?.enabled && typeof d.enabled === "object") setHousingFieldsEnabled(d.enabled);
      })
      .catch(() => {});
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        setDetailLayout(d?.listingDetailLayout === "sahibinden" ? "sahibinden" : "classic");
        const p = d?.listingDetailLayoutPremium;
        setPremiumDetailLayout(p === "sahibinden" || p === "classic" ? p : "premium");
        setShoppingDetailTemplate(
          d?.shoppingListingDetailTemplate === "ecommerce_v1" ? "ecommerce_v1" : "classic"
        );
        setShoppingOffersEnabled(d?.shoppingOffersEnabled !== false);
        const maxB = Number(d?.maxBidsPerListing);
        if (Number.isFinite(maxB) && maxB >= 1) setMaxBidsPerListing(maxB);
      })
      .catch(() => {});
  }, []);

  function openBidTipsIfNeeded() {
    if (bidTipsHidden()) return;
    setBidTipsOpen(true);
  }

  function dontRemindBidTips() {
    try {
      localStorage.setItem(BID_TIPS_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setBidTipsOpen(false);
  }

  function requireAuth(intent: "bid" | "favorite") {
    setAuthIntent(intent);
    setAuthOpen(true);
  }

  async function load() {
    const [l, b, auth] = await Promise.all([
      fetch(`/api/listings?id=${params.id}`).then(async (r) => ({ ok: r.ok, status: r.status, ...(await r.json()) })),
      fetch(`/api/bids?listingId=${params.id}`).then((r) => r.json()),
      fetch("/api/auth").then((r) => r.json()),
    ]);
    if (!l.ok || !l.listing) {
      setListing(null);
      setError(l.error || "İlan yüklenemedi");
      return;
    }
    setListing(l.listing);
    setFavorited(Boolean(l.listing.isFavorited));
    setSellerFav(Boolean(l.listing.seller?.isSellerFavorited));
    setBids(b.bids || []);
    setMe(auth.user);
    if (l.listing.accessRule?.messaging) {
      setMessagingAccess(
        l.listing.accessRule.messaging === "logged_in" ? "logged_in" : "approved"
      );
    }
    if (auth.user) {
      fetch(`/api/messages?listingId=${encodeURIComponent(l.listing.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) {
            setCanMessage(Boolean(l.listing.seller?.messagingAllowed));
            return;
          }
          setCanMessage(Boolean(d.canSend));
          setMessagingAccess(
            d.access === "everyone" || d.access === "logged_in" ? d.access : "approved"
          );
        })
        .catch(() => {
          setCanMessage(Boolean(l.listing.seller?.messagingAllowed));
        });
    } else {
      setCanMessage(false);
    }
    if (l.listing?.highestBid) setAmountRaw(Number(l.listing.highestBid) + 10000);
    else if (l.listing?.askPrice) setAmountRaw(Number(l.listing.askPrice));
    if (l.listing?.escrowSettings?.defaultShipDays) {
      setEscrowShipDays(l.listing.escrowSettings.defaultShipDays);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const slugForCrumb = String(listing?.category?.slug || "");
  const shoppingSlug = isAlisverisCategorySlug(slugForCrumb);
  useEffect(() => {
    if (!shoppingSlug || !slugForCrumb) {
      setShopCrumbs(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/catalog/breadcrumb?categorySlug=${encodeURIComponent(slugForCrumb)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok && Array.isArray(d.crumbs) && d.crumbs.length) {
          setShopCrumbs(
            d.crumbs.map((c: { name: string; href: string; slug: string }) => ({
              label: c.name,
              href: c.href || `/alisveris?category=${encodeURIComponent(c.slug)}`,
            }))
          );
        } else {
          console.warn("[listing-breadcrumb] empty DB chain → TS fallback");
          setShopCrumbs(null);
        }
      })
      .catch((e) => {
        console.warn("[listing-breadcrumb] API fail → TS fallback", e);
        if (!cancelled) setShopCrumbs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shoppingSlug, slugForCrumb]);

  useEffect(() => {
    if (search.get("revise") === "1") {
      setBidsOpen(true);
      setTab("detay");
    }
  }, [search]);

  // İlan sahibi kendi ilanına girince önce teklifleri görsün
  useEffect(() => {
    if (!listing || !me?.id || !offersEnabled) return;
    if (search.get("tab") || search.get("revise") === "1") return;
    if (me.id === listing.seller.id) setTab("teklifler");
  }, [listing?.id, listing?.seller?.id, me?.id, search, offersEnabled]);

  // Klasik modda kapalıysa teklifler sekmesinde kalınmasın
  useEffect(() => {
    if (!offersEnabled && tab === "teklifler") setTab("detay");
  }, [offersEnabled, tab]);

  const images = useMemo(() => {
    if (!listing) return [] as string[];
    return listing.images?.length ? listing.images : listing.coverImage ? [listing.coverImage] : [];
  }, [listing]);

  const features = useMemo(
    () => attrEntries(listing?.attributes as any, listing?.category?.slug, housingFieldsEnabled),
    [listing, housingFieldsEnabled]
  );
  const isPremiumListing = Boolean(
    (listing?.category as { isPremium?: boolean; slug?: string } | null)?.isPremium ||
      (listing?.category?.slug && listing.category.slug.startsWith("premium-"))
  );
  const effectiveLayout: "classic" | "sahibinden" | "premium" = isPremiumListing
    ? premiumDetailLayout
    : detailLayout;
  const isSahibindenLayout = effectiveLayout === "sahibinden" || effectiveLayout === "premium";
  const isPremiumLayout = effectiveLayout === "premium";
  const midSpecs = useMemo(() => {
    if (!listing) return [] as Array<{ label: string; value: string }>;
    const base: Array<{ label: string; value: string }> = [];
    if (listing.listingNo) {
      base.push({ label: "İlan No", value: formatListingNo(listing.listingNo) });
    }
    if (listing.dealType) {
      base.push({ label: "İlan Tipi", value: dealTypeLabel(listing.dealType) });
    }
    const locParts = [listing.neighborhood, listing.district, listing.city].filter(Boolean);
    if (locParts.length) {
      base.push({ label: "Konum", value: locParts.join(" / ") });
    }

    const skipKeys = new Set(["extras", "expertiseReport"]);
    const attrRows = formatListingAttributeRows(listing.attributes, listing.category?.slug, {
      showEmptyAsBelirtilmedi: true,
      housingFieldsEnabled,
    }).filter((r) => {
      if (skipKeys.has(r.key)) return false;
      // Nesne / dizi değerleri ek özellik veya ekspertiz — orta kolona alma
      const raw = (listing.attributes as Record<string, unknown> | null)?.[r.key];
      if (raw != null && typeof raw === "object") return false;
      return true;
    });

    return [...base, ...attrRows.map((r) => ({ label: r.label, value: r.value }))];
  }, [listing, housingFieldsEnabled]);
  const extrasGrouped = useMemo(() => {
    const raw = (listing?.attributes as any)?.extras;
    if (listing?.category?.slug === "arac") return groupVehicleExtras(parseVehicleExtras(raw));
    return groupHousingExtras(parseHousingExtras(raw));
  }, [listing]);

  const expertiseReport = useMemo(() => {
    if (listing?.category?.slug !== "arac") return null;
    const attrs = listing.attributes as Record<string, unknown> | null | undefined;
    if (!supportsVehicleExpertiseReport(String(attrs?.subtype || ""))) return null;
    return parseExpertiseReport(attrs?.expertiseReport);
  }, [listing]);

  const showExpertise =
    Boolean(expertiseReport) &&
    (expertiseReportHasDamage(expertiseReport) ||
      Boolean(expertiseReport?.obtainedAt) ||
      Boolean(expertiseReport?.firm));

  async function placeBid() {
    setError("");
    setMsg("");
    if (!me) {
      requireAuth("bid");
      return;
    }
    if (!durationDays) return setError("Teklif geçerlilik süresi seçiniz");
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "place",
        listingId: params.id,
        amount: amountRaw,
        durationDays,
      }),
    });
    const data = await res.json();
    if (res.status === 401) {
      requireAuth("bid");
      return;
    }
    if (res.status === 402 || data.code === "INSUFFICIENT_TOKENS") {
      setTokenNeed(Number(data.requiredTokens || 1));
      setTokenBalance(Number(data.balance || 0));
      setTokenModalOpen(true);
      return;
    }
    if (!res.ok) return setError(data.error || "Teklif verilemedi");
    setBidSentAmount(Number(amountRaw) || null);
    setBidSentOpen(true);
    setAmountRaw(0);
    await load();
  }

  async function approve(bidId: string) {
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", listingId: params.id, bidId }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Onaylanamadı");
    setMsg(data.approvalMode === "sale" ? "Satış onaylandı" : "Görüşmeye açıldı");
    await load();
  }

  async function toggleFavorite() {
    if (!me) {
      requireAuth("favorite");
      return;
    }
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing?.id }),
    });
    if (res.status === 401) {
      requireAuth("favorite");
      return;
    }
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const next = Boolean(data.favorited);
    setFavorited(next);
    setListing((prev) => (prev ? { ...prev, isFavorited: next } : prev));
    setFavOk(true);
    setTimeout(() => setFavOk(false), 1500);
    window.dispatchEvent(new Event("teklifbu:favorites"));
  }

  async function shareListing() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing?.title, url });
      else await navigator.clipboard?.writeText(url);
      setShareOk(true);
      setTimeout(() => setShareOk(false), 1500);
    } catch {
      await navigator.clipboard?.writeText(url);
      setShareOk(true);
      setTimeout(() => setShareOk(false), 1500);
    }
  }

  async function submitReport() {
    setReportMsg("");
    if (!reportReason) {
      setReportMsg("Lütfen bir neden seçin");
      return;
    }
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: listing?.id,
        reason: reportReason,
        note: reportNote,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setReportMsg(data.error || "Gönderilemedi");
      return;
    }
    setReportMsg("Şikayetiniz alındı. Teşekkürler.");
    setTimeout(() => {
      setReportOpen(false);
      setReportReason("");
      setReportNote("");
      setReportMsg("");
    }, 1200);
  }

  function openEscrowModal() {
    if (!me) {
      router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing?.id}`)}`);
      return;
    }
    setEscrowError("");
    setEscrowOpen(true);
  }

  async function startEscrowCheckout() {
    if (!listing || !escrowShipDays) {
      setEscrowError("Kargo süresi seçin");
      return;
    }
    setEscrowBusy(true);
    setEscrowError("");
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          listingId: listing.id,
          shipDays: escrowShipDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEscrowError(data.error || "Güvenli Öde başlatılamadı");
        setEscrowBusy(false);
        return;
      }
      window.location.assign(data.payUrl || "/hesabim?s=guvenli-ode");
    } catch {
      setEscrowError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setEscrowBusy(false);
    }
  }

  function toggleBidsPanel() {
    const next = !bidsOpen;
    setBidsOpen(next);
    if (next) {
      setTab("teklifler");
      requestAnimationFrame(() => {
        document.getElementById("teklifler-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  if (!listing) {
    return (
      <div className="page-shell" style={{ marginTop: 40, marginBottom: 40, paddingTop: 20, paddingBottom: 20 }}>
        {error ? (
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>İlan açılamadı</h2>
            <p style={{ color: "var(--muted)" }}>{error}</p>
            <Link
              href={offersEnabled ? "/hesabim?s=tekliflerim" : "/ilanlar"}
              className="btn-orange"
              style={{ display: "inline-block", padding: "10px 14px" }}
            >
              {offersEnabled ? "Tekliflerime Dön" : "İlanlara Dön"}
            </Link>
          </div>
        ) : (
          "Yükleniyor..."
        )}
      </div>
    );
  }

  const isSeller = Boolean(me?.id && me.id === listing.seller.id);
  const isCompleted = listing.status === "APPROVED";
  const canPlaceBid = listing.status === "ACTIVE" && !isSeller;
  const reviseOpen = isBidderReviseOpen(listing.bidderReviseUntil);
  const myActiveBid = me
    ? bids.find((b) => b.bidderId === me.id && b.status === "ACTIVE")
    : undefined;
  const changeDiff = listing.lastChangeDiff || null;
  const changedKeys = changeDiff ? Object.keys(changeDiff) : [];

  async function withdrawMyBid() {
    if (!myActiveBid) return;
    if (!listing) return;
    const ok = await confirm({
      title: "Teklifi sil",
      message: "Teklifiniz silinecek ve harcadığınız jeton hesabınıza iade edilecek.",
      confirmLabel: "Sil ve jetonu iade et",
      tone: "danger",
    });
    if (!ok) return;
    setReviseBusy(true);
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "withdraw-after-change",
        listingId: listing.id,
        bidId: myActiveBid.id,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setReviseBusy(false);
    if (!res.ok) {
      await alert({ title: "İşlem başarısız", message: d.error || "Teklif silinemedi", tone: "danger" });
      return;
    }
    await alert({
      title: "Teklif silindi",
      message: `${d.refundedTokens || 0} jeton hesabınıza iade edildi.`,
      tone: "success",
    });
    await load();
  }

  async function reviseMyBid() {
    if (!myActiveBid) return;
    if (!listing) return;
    if (!durationDays) {
      setError("Teklif geçerlilik süresi seçiniz");
      return;
    }
    setReviseBusy(true);
    setError("");
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "revise-after-change",
        listingId: listing.id,
        bidId: myActiveBid.id,
        amount: amountRaw,
        durationDays,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setReviseBusy(false);
    if (!res.ok) {
      if (d.code === "INSUFFICIENT_TOKENS") {
        setTokenNeed(d.requiredTokens || 1);
        setTokenBalance(d.balance || 0);
        setTokenModalOpen(true);
        return;
      }
      setError(d.error || "Teklif güncellenemedi");
      return;
    }
    setMsg(`Teklif güncellendi. Eski tekliften ${d.refundedTokens || 0} jeton iade edildi.`);
    await load();
  }

  function formatDiffVal(v: unknown) {
    if (v == null) return "—";
    if (typeof v === "number") return formatTl(v);
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  const location = [listing.neighborhood, listing.district, listing.city].filter(Boolean).join(", ");
  const isShoppingCategory = shoppingSlug;
  const categoryCrumbs = shopCrumbs?.length ? shopCrumbs : listingCategoryCrumbs(listing);
  const memberLabel = new Date(listing.seller.memberSince).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  const useEcommerceDetail = isShoppingCategory && shoppingDetailTemplate === "ecommerce_v1";

  if (useEcommerceDetail) {
    const attrSpecs = formatListingAttributeRows(listing.attributes, listing.category?.slug, {
      showEmptyAsBelirtilmedi: false,
      housingFieldsEnabled,
    })
      .filter((r) => {
        if (["highlights", "installments", "installmentNote", "videoUrl", "viewAngle360", "badgeText", "promoBadge"].includes(r.key)) {
          return false;
        }
        const raw = (listing.attributes as Record<string, unknown> | null)?.[r.key];
        if (raw != null && typeof raw === "object") return false;
        return true;
      })
      .map((r) => ({ label: r.label, value: r.value }));

    const statusParts: ReactNode[] = [];
    if (isCompleted) {
      statusParts.push(
        <div
          key="done"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Sonuçlandı — Bu ürün ilanı artık satılmıyor.
        </div>
      );
    }
    if (isSeller && listing.canEdit) {
      statusParts.push(
        <div key="edit" style={{ marginBottom: 14, display: "flex", justifyContent: "flex-end" }}>
          <Link href={`/ilan-ver?edit=${listing.id}`} className="btn-outline" style={{ padding: "8px 12px" }}>
            Düzenle
          </Link>
        </div>
      );
    }

    const shoppingOffersOn = offersEnabled && shoppingOffersEnabled;
    const handleBuyNow = async () => {
      if (!me) {
        router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing.id}`)}`);
        return;
      }
      if (!listing.escrowAvailable && !isShoppingCategory) {
        await alert({
          title: "Hemen Al kullanılamıyor",
          message:
            "Bu ilan için Güvenli Öde / Hemen Al kapalı. İlanın escrow uygun olduğundan ve modülün açık olduğundan emin olun.",
          tone: "danger",
        });
        return;
      }
      const shipDays =
        Number(listing.escrowSettings?.defaultShipDays) ||
        Number(listing.escrowSettings?.shipDaysOptions?.[0]) ||
        7;
      setEscrowBusy(true);
      setEscrowError("");
      try {
        const res = await fetch("/api/escrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checkout",
            listingId: listing.id,
            shipDays,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setEscrowBusy(false);
          await alert({
            title: "Hemen Al kullanılamıyor",
            message:
              data?.error ||
              "Bu ilan için Güvenli Öde / Hemen Al kapalı. Admin’de Güvenli Öde ve Demo POS’un açık olduğundan emin olun.",
            tone: "danger",
          });
          return;
        }
        const payUrl = String(data.payUrl || "");
        if (!payUrl) {
          setEscrowBusy(false);
          await alert({
            title: "Ödeme adresi yok",
            message: "Demo POS yönlendirme adresi alınamadı.",
            tone: "danger",
          });
          return;
        }
        window.location.assign(payUrl);
      } catch {
        setEscrowBusy(false);
        await alert({
          title: "Bağlantı hatası",
          message: "Lütfen tekrar deneyin.",
          tone: "danger",
        });
      }
    };
    const handleOffer = () => {
      if (!shoppingOffersOn || !canPlaceBid) return;
    };

    const placeShoppingOffer = async (amountTl: number) => {
      setError("");
      setMsg("");
      if (!me) {
        requireAuth("bid");
        return false;
      }
      const days = durationDays || 7;
      if (!durationDays) setDurationDays(7);
      const amount = Math.round(Number(amountTl) * 100) / 100;
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "place",
          listingId: params.id,
          amount,
          durationDays: days,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        requireAuth("bid");
        return false;
      }
      if (res.status === 402 || data.code === "INSUFFICIENT_TOKENS") {
        setTokenNeed(Number(data.requiredTokens || 1));
        setTokenBalance(Number(data.balance || 0));
        setTokenModalOpen(true);
        return false;
      }
      if (!res.ok) {
        setError(data.error || "Teklif verilemedi");
        return false;
      }
      setBidSentAmount(amount);
      setBidSentOpen(true);
      setAmountRaw(0);
      await load();
      return true;
    };

    return (
      <>
        <ShoppingProductDetail
          listing={listing}
          crumbs={categoryCrumbs}
          specs={attrSpecs.length ? attrSpecs : midSpecs}
          favorited={favorited}
          isSeller={isSeller}
          onFavorite={toggleFavorite}
          onShare={shareListing}
          onBuy={handleBuyNow}
          onOffer={handleOffer}
          onSubmitOffer={async (amount) => {
            const ok = await placeShoppingOffer(amount);
            return ok;
          }}
          buyDisabled={isCompleted || isSeller || escrowBusy}
          offerDisabled={!shoppingOffersOn || !canPlaceBid}
          buyLabel={escrowBusy ? "Ödemeye yönlendiriliyor…" : "Hemen Al"}
          offerLabel="Teklif Ver"
          statusBanner={statusParts.length ? <>{statusParts}</> : null}
          afterActions={
            error || msg ? (
              <div style={{ fontSize: 13 }}>
                {error && <div style={{ color: "#dc2626" }}>{error}</div>}
                {msg && <div style={{ color: "var(--green)" }}>{msg}</div>}
              </div>
            ) : null
          }
        />

        {false && shoppingOffersOn && canPlaceBid && (
          <div id="teklifler-panel" className="page-shell" style={{ paddingBottom: 40 }}>
            <div className="card" style={{ padding: 16, borderRadius: 14 }}>
              <div style={{ fontWeight: 850, marginBottom: 10 }}>Teklif ver</div>
              <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
                <input
                  className="input"
                  inputMode="numeric"
                  value={amountRaw ? formatNumberTr(amountRaw) : ""}
                  onChange={(e) => setAmountRaw(parseNumberTr(e.target.value) || 0)}
                  placeholder="Teklif tutarı (TL)"
                />
                <select
                  className="select"
                  value={durationDays || ""}
                  onChange={(e) => setDurationDays(Number(e.target.value) || 0)}
                >
                  <option value="">Süre seçin</option>
                  {[1, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>
                      {d} gün
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-orange" onClick={placeBid} style={{ padding: 12 }}>
                  Teklif Bu
                </button>
              </div>
            </div>
          </div>
        )}

        {escrowOpen && (
          <div
            role="dialog"
            aria-modal
            onClick={() => !escrowBusy && setEscrowOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 70,
              background: "rgba(15,23,42,.55)",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <div
              className="card"
              onClick={(e) => e.stopPropagation()}
              style={{ width: "min(420px, 100%)", padding: 20, borderRadius: 16, display: "grid", gap: 12 }}
            >
              <div style={{ fontWeight: 900, fontSize: 17 }}>
                {listing.escrowSettings?.buttonLabel || "Güvenli Öde"}
              </div>
              <div style={{ fontSize: 14, color: "#64748b" }}>
                Tutar: <strong style={{ color: "#0f172a" }}>{formatTl(listing.askPrice)}</strong>
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Kargo süresi</span>
                <select
                  className="select"
                  value={escrowShipDays ?? ""}
                  onChange={(e) => setEscrowShipDays(Number(e.target.value) || null)}
                  disabled={escrowBusy}
                >
                  {(listing.escrowSettings?.shipDaysOptions || [3, 7, 10]).map((d) => (
                    <option key={d} value={d}>
                      {d} gün
                    </option>
                  ))}
                </select>
              </label>
              {escrowError && <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>{escrowError}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn-outline" disabled={escrowBusy} onClick={() => setEscrowOpen(false)}>
                  Vazgeç
                </button>
                <button type="button" className="btn-orange" disabled={escrowBusy} onClick={startEscrowCheckout}>
                  {escrowBusy ? "Yönlendiriliyor..." : "Ödemeye Geç"}
                </button>
              </div>
            </div>
          </div>
        )}

        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onSuccess={() => {
            setAuthOpen(false);
            load();
          }}
        />
        <TokenBuyModal
          open={tokenModalOpen}
          onClose={() => setTokenModalOpen(false)}
          requiredTokens={tokenNeed}
          balance={tokenBalance}
        />
      </>
    );
  }

  return (
    <div className="page-shell" style={{ paddingTop: 18, paddingBottom: 48 }}>
      {/* Breadcrumb + actions — butonlar her zaman sağda (uzun breadcrumb sarmalanınca sola düşmesin) */}
      <div className="detail-top-bar">
        <nav style={{ fontSize: 13, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
          <Link href="/">Ana Sayfa</Link>
          {categoryCrumbs.map((c) => (
            <span key={`${c.href}-${c.label}`} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span>›</span>
              <Link href={c.href}>{c.label}</Link>
            </span>
          ))}
        </nav>
        <div className="detail-top-actions">
          <button type="button" className="detail-action-btn" onClick={toggleFavorite}>
            <Heart
              size={16}
              strokeWidth={favorited ? 1.5 : 2}
              color="#ef4444"
              fill={favorited ? "#ef4444" : "none"}
            />
            <span>
              {favOk
                ? favorited
                  ? "Favoriye eklendi"
                  : "Favoriden çıkarıldı"
                : favorited
                  ? "Favorilerden Çıkar"
                  : "Favorilere Ekle"}
            </span>
          </button>
          <button type="button" className="detail-action-btn" onClick={shareListing}>
            <Share2 size={16} strokeWidth={2} />
            <span>{shareOk ? "Kopyalandı" : "Paylaş"}</span>
          </button>
          <button type="button" className="detail-action-btn" onClick={() => setReportOpen(true)}>
            <Flag size={16} strokeWidth={2} />
            <span>Şikayet</span>
          </button>
        </div>
      </div>

      {offersEnabled && changedKeys.length > 0 && reviseOpen && (
        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 14,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900, color: "#991b1b", fontSize: 15 }}>
            Teklif verdiğiniz ilanda düzenleme ve değişiklik olmuştur
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d" }}>
            Değişen bölümler kırmızı. Teklifinizi güncelleyebilir veya silebilirsiniz; jeton
            haklarınız iade edilir.
            {listing.bidderReviseUntil
              ? ` Süre: ${new Date(listing.bidderReviseUntil).toLocaleString("tr-TR")}`
              : ""}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {changedKeys.map((k) => (
              <div
                key={k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 1fr",
                  gap: 8,
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "white",
                  border: "1px solid #fecaca",
                }}
              >
                <strong style={{ color: "#b91c1c" }}>{fieldLabel(k)}</strong>
                <span style={{ color: "#64748b", wordBreak: "break-word" }}>
                  {formatDiffVal(changeDiff![k].from)}
                </span>
                <span style={{ color: "#b91c1c", fontWeight: 800, wordBreak: "break-word" }}>
                  {formatDiffVal(changeDiff![k].to)}
                </span>
              </div>
            ))}
          </div>
          {myActiveBid && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button
                type="button"
                className="btn-orange"
                disabled={reviseBusy}
                onClick={reviseMyBid}
                style={{ padding: "10px 14px" }}
              >
                Teklifimi güncelle
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={reviseBusy}
                onClick={withdrawMyBid}
                style={{ padding: "10px 14px", color: "#b91c1c", borderColor: "#fecaca" }}
              >
                Teklifi sil (jeton iade)
              </button>
            </div>
          )}
        </div>
      )}

      {isCompleted && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {offersEnabled
            ? "Sonuçlandı — Bu ilanda teklif süreci tamamlandı. Yeni teklif kabul edilmiyor."
            : "Sonuçlandı — Bu ilan artık yayında değil."}
        </div>
      )}

      {isSeller && listing.status !== "ACTIVE" && listing.status !== "SELECTION" && listing.status !== "APPROVED" && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 12,
            background: listing.status === "REJECTED" ? "#fef2f2" : "#fff7ed",
            border: `1px solid ${listing.status === "REJECTED" ? "#fecaca" : "#fed7aa"}`,
            color: listing.status === "REJECTED" ? "#991b1b" : "#9a3412",
            fontSize: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <strong>{listingStatusLabel(listing.status)}</strong>
            {listing.status === "PENDING_REVIEW" && " — Yönetici onayından sonra yayınlanacaktır."}
            {listing.status === "REJECTED" && listing.rejectionReason
              ? ` — Sebep: ${listing.rejectionReason}`
              : null}
          </div>
          {listing.canEdit && (
            <Link href={`/ilan-ver?edit=${listing.id}`} className="btn-outline" style={{ padding: "8px 12px" }}>
              Düzenle
            </Link>
          )}
        </div>
      )}

      {isSeller && listing.canEdit && (listing.status === "ACTIVE" || listing.status === "SELECTION" || listing.status === "APPROVED") && (
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "flex-end" }}>
          <Link href={`/ilan-ver?edit=${listing.id}`} className="btn-outline" style={{ padding: "8px 12px" }}>
            Düzenle
          </Link>
        </div>
      )}

      <div
        className={`detail-layout${isSahibindenLayout ? " detail-layout--sahibinden" : ""}${isPremiumLayout ? " detail-layout--premium" : ""}`}
        style={
          isSahibindenLayout
            ? undefined
            : {
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.65fr) minmax(260px, 0.82fr)",
                gap: 18,
                alignItems: "start",
              }
        }
      >
        {/* LEFT */}
        <div>
          <div className="card" style={{ overflow: "hidden", borderRadius: 16 }}>
            <div style={{ position: "relative", aspectRatio: "16/10", background: "#e5e7eb" }}>
              {images[imageIdx] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[imageIdx]} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 14,
                  background: "rgba(15,23,42,.72)",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "5px 10px",
                  borderRadius: 8,
                }}
              >
                {images.length ? `${imageIdx + 1}/${images.length}` : "0/0"}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12 }}>
              <button
                type="button"
                className="thumb-nav"
                onClick={() => setImageIdx((i) => (i - 1 + images.length) % Math.max(images.length, 1))}
                aria-label="Önceki"
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", flex: 1 }}>
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => setImageIdx(i)}
                    style={{
                      width: 84,
                      height: 60,
                      borderRadius: 10,
                      overflow: "hidden",
                      border: i === imageIdx ? "2px solid var(--orange)" : "1px solid var(--line)",
                      padding: 0,
                      cursor: "pointer",
                      flexShrink: 0,
                      background: "#fff",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="thumb-nav"
                onClick={() => setImageIdx((i) => (i + 1) % Math.max(images.length, 1))}
                aria-label="Sonraki"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Quick features — klasik düzen */}
          {!isSahibindenLayout && features.length > 0 && (
            <div
              className="card"
              style={{
                marginTop: 14,
                padding: "16px 10px",
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(features.length, 6)}, minmax(0,1fr))`,
                gap: 8,
                background: "#f8fafc",
                borderColor: "#e8edf3",
              }}
            >
              {features.map((f) => (
                <div key={f.label} style={{ textAlign: "center", padding: "4px 6px" }}>
                  <div style={{ color: "#c2410c", display: "flex", justifyContent: "center", marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{f.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{f.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ORTA — Sahibinden: başlık + tüm özellikler (ek özellikler hariç) */}
        {isSahibindenLayout && (
          <div className="detail-specs-mid" aria-label="İlan özellikleri">
            {isPremiumLayout && (
              <div className="detail-premium-chip">
                {listing.category?.premiumVertical === "logistics"
                  ? "Lojistik Taşıma"
                  : listing.category?.premiumVertical === "rideshare"
                    ? "Yolculuk Paylaşımı"
                    : listing.category?.premiumVertical === "hotel"
                      ? "Otel Konaklama"
                      : "Premium"}
              </div>
            )}
            <h1
              className="detail-specs-title"
              style={{
                margin: "8px 2px 8px",
                fontSize: listing.titleLarge ? 16 : 15,
                fontWeight: listing.titleBold ? 900 : 800,
                letterSpacing: "-0.02em",
                color: listing.isColored ? "#c2410c" : "#0f172a",
                lineHeight: 1.3,
              }}
            >
              {formatPremiumTitle(listing.title, listing)}
            </h1>
            {midSpecs.length === 0 ? (
              <div style={{ padding: "12px 4px", fontSize: 13, color: "#94a3b8" }}>Özellik belirtilmemiş.</div>
            ) : (
              midSpecs.map((row, i) => (
                <div key={`${row.label}-${i}`} className="detail-spec-row">
                  <span className="lbl">{row.label}</span>
                  <span className={`val${row.value === "Belirtilmedi" ? " muted" : ""}`}>{row.value}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* RIGHT SIDEBAR */}
        <aside className="detail-bid-aside" style={{ position: "sticky", top: 16 }}>
          <div className="card detail-bid-card" style={{ padding: 28, borderRadius: 18, boxShadow: "0 12px 36px rgba(15,23,42,.08)" }}>
            {isSahibindenLayout ? (
              isCompleted ? (
                <div className="cd-panel cd-panel--done">
                  <div className="cd-panel__top">
                    <span className="cd-panel__icon">
                      <Clock3 size={14} strokeWidth={2.25} />
                    </span>
                    <span>Kalan Süre</span>
                  </div>
                  <div className="cd-panel__box">
                    <span className="cd-panel__done-msg">Sonuçlandı</span>
                  </div>
                </div>
              ) : (
                <CountdownBadge endsAt={listing.endsAt} variant="panel" />
              )
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: listing.titleLarge ? 20 : 18,
                      fontWeight: listing.titleBold ? 900 : 800,
                      letterSpacing: "-0.02em",
                      color: listing.isColored ? "#c2410c" : "#0f172a",
                      lineHeight: 1.3,
                    }}
                  >
                    {formatPremiumTitle(listing.title, listing)}
                  </h1>
                  {listing.listingNo && (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                      İlan No: {formatListingNo(listing.listingNo)}
                    </div>
                  )}
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={14} /> {location}
                  </div>
                  <EidsBadge text={listing.eidsBadge} />
                </div>
                {isCompleted ? (
                  <div
                    style={{
                      flexShrink: 0,
                      background: "#065f46",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "8px 12px",
                      borderRadius: 999,
                    }}
                  >
                    Sonuçlandı
                  </div>
                ) : (
                  <CountdownBadge endsAt={listing.endsAt} />
                )}
              </div>
            )}
            {isSahibindenLayout && <EidsBadge text={listing.eidsBadge} />}

            <div
              style={{
                marginTop: isSahibindenLayout ? (listing.eidsBadge ? 18 : 20) : 18,
                display: "grid",
                gridTemplateColumns: offersEnabled ? "1fr 1fr" : "1fr",
                gap: 16,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>İlan Fiyatı</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{formatTl(listing.askPrice)}</div>
              </div>
              {offersEnabled && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 700, marginBottom: 12 }}>En Yüksek Teklif</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                    {listing.highestBid ? formatTl(listing.highestBid) : "—"}
                  </div>
                </div>
              )}
            </div>

            {!isSeller && listing.escrowAvailable && (
              <button
                type="button"
                className="btn-orange"
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: 14,
                  fontSize: 15,
                  fontWeight: 800,
                  borderRadius: 12,
                }}
                onClick={openEscrowModal}
              >
                {listing.escrowSettings?.buttonLabel || "Güvenli Öde"}
              </button>
            )}

            {offersEnabled && (
              <button
                type="button"
                onClick={toggleBidsPanel}
                style={{
                  marginTop: 14,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 4px",
                  border: "none",
                  borderTop: "1px solid #eef2f7",
                  borderBottom: "1px solid #eef2f7",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Teklif Sayısı</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{formatNumberTr(listing.bidCount)}</span>
                  <ChevronDown
                    size={20}
                    style={{
                      color: "#64748b",
                      transform: bidsOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform .15s ease",
                    }}
                  />
                </span>
              </button>
            )}

            {offersEnabled && bidsOpen && (
              <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto", display: "grid", gap: 8 }}>
                {bids.length === 0 && <div style={{ fontSize: 13, color: "#64748b", padding: "8px 0" }}>Henüz teklif yok.</div>}
                {bids.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px solid #eef2f7",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>#{b.rank} · {maskName(b.bidderName)}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {b.status === "ACTIVE" ? remainingLabel(b.expiresAt) : bidStatusLabel(b.status)}
                      </div>
                    </div>
                    <div className="price-bid" style={{ fontSize: 14 }}>{formatTl(b.amount)}</div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: 10, fontSize: 13 }}
                  onClick={() => {
                    setTab("teklifler");
                    document.getElementById("teklifler-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Tüm teklifleri tabloda gör
                </button>
              </div>
            )}

            {isCompleted ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 12,
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#065f46",
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                {offersEnabled ? "Bu ilan sonuçlandı. Yeni teklif verilemez." : "Bu ilan sonuçlandı."}
              </div>
            ) : isSeller ? (
              <div style={{ marginTop: 18, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                {offersEnabled
                  ? "Kendi ilanınıza teklif veremezsiniz. Gelen teklifleri tablodan onaylayabilirsiniz."
                  : "Bu ilanın sahibisiniz. Gelen mesajları hesabım üzerinden takip edebilirsiniz."}
              </div>
            ) : !offersEnabled ? (
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                  İlan sahibiyle doğrudan iletişime geçebilir veya mesaj gönderebilirsiniz.
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Teklifiniz (TL)</label>
                <input
                  className="input"
                  value={amountRaw ? formatNumberTr(amountRaw) : ""}
                  onChange={(e) => setAmountRaw(parseNumberTr(e.target.value))}
                  onFocus={openBidTipsIfNeeded}
                  onClick={openBidTipsIfNeeded}
                  placeholder="Örn: 9.260.000"
                  inputMode="numeric"
                  style={{ fontSize: 16, fontWeight: 700, padding: "12px 14px" }}
                  disabled={!canPlaceBid}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Teklif Geçerlilik Süresi</label>
                  <select
                    className="select"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value ? Number(e.target.value) : "")}
                    style={{ maxWidth: 140 }}
                    disabled={!canPlaceBid}
                  >
                    <option value="">Seçiniz</option>
                    {durations.map((d) => (
                      <option key={d} value={d}>
                        {d} Gün
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="btn-orange"
                  style={{ padding: 15, fontSize: 16, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  onClick={placeBid}
                  disabled={!canPlaceBid}
                >
                  <Gavel size={18} /> Teklif Bu
                </button>

                <div style={{ fontSize: 12, color: "#94a3b8" }}>1 teklif jeton harcar. Tutarlar 10.000 TL katları olmalıdır.</div>
              </div>
            )}

            {!isSeller && (
              <button
                type="button"
                className="btn-outline"
                style={{
                  marginTop: 12,
                  padding: 13,
                  textAlign: "center",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  width: "100%",
                  opacity: me && !canMessage ? 0.7 : 1,
                }}
                onClick={async () => {
                  if (!me) {
                    router.push(
                      `/giris?next=${encodeURIComponent(
                        `/ilan/${listing.id}`
                      )}`
                    );
                    return;
                  }
                  if (!canMessage) {
                    const mode =
                      listing.accessRule?.messaging ||
                      messagingAccess ||
                      "approved";
                    await alert({
                      title: "Mesaj gönderilemez",
                      message:
                        mode === "approved"
                          ? "İlan sahibine mesaj göndermek için bu ilandaki teklifinizin onaylanmış olması gerekir."
                          : "Mesaj göndermek için giriş yapmanız gerekir.",
                      tone: "warning",
                    });
                    return;
                  }
                  const q = new URLSearchParams({
                    s: "mesajlar",
                    to: listing.seller.id,
                    listingId: listing.id,
                  });
                  router.push(`/hesabim?${q}`);
                }}
              >
                İlan Sahibine Mesaj Gönder
              </button>
            )}

            {error && <div style={{ color: "#dc2626", marginTop: 12, fontSize: 13 }}>{error}</div>}
            {msg && <div style={{ color: "var(--green)", marginTop: 12, fontSize: 13 }}>{msg}</div>}

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)", display: "grid", gap: 12 }}>
              <SellerOwnerCard
                seller={listing.seller}
                memberLabel={memberLabel}
                sellerFav={sellerFav}
                isSeller={isSeller}
                compact
                onNeedLogin={() =>
                  router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing.id}`)}`)
                }
                onToggleFavorite={async () => {
                  if (!me) {
                    router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing.id}`)}`);
                    return;
                  }
                  const res = await fetch("/api/favorite-sellers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sellerId: listing.seller.id,
                      action: sellerFav ? "remove" : "add",
                    }),
                  });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) setSellerFav(Boolean(d.favorited));
                }}
              />
              {!isSeller && offersEnabled && listing.seller.contactVisible && listing.seller.phone && (
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "#065f46",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  {listing.accessRule?.contact === "logged_in"
                    ? "Bu kategoride satıcı iletişim bilgileri açıktır."
                    : "Teklifiniz onaylandı. Satıcı telefonu açıldı — arayabilir veya mesaj gönderebilirsiniz."}
                </div>
              )}
              {!isSeller && !listing.seller.contactVisible && !listing.seller.identityVisible && (
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "#9a3412",
                    background: "linear-gradient(180deg, #fff7ed, #fffcf8)",
                    border: "1px solid #fed7aa",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  Bu kategoride ilan sahibi bilgileri teklif onayından sonra açılır.
                </div>
              )}
              {!isSeller && !listing.seller.contactVisible && listing.seller.identityVisible && (
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "#9a3412",
                    background: "linear-gradient(180deg, #fff7ed, #fffcf8)",
                    border: "1px solid #fed7aa",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  Telefon bilgisi teklif onayından sonra açılır.
                </div>
              )}
            </div>
          </div>
          {offersEnabled && (
            <BidTipsCard
              open={bidTipsOpen && canPlaceBid}
              maxBids={maxBidsPerListing}
              onClose={() => setBidTipsOpen(false)}
              onDontRemind={dontRemindBidTips}
            />
          )}
          <SimilarListingsStrip
            listingId={listing.id}
            categorySlug={listing.category?.slug}
            city={listing.city}
          />
        </aside>
      </div>

      <RecentSalesStrip placement="listing_detail" shellClassName="page-shell" className="recent-sales--compact" />

      {/* Sekmeler — tam genişlik (klasik düzen) */}
      <div className="detail-below-full">
        <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(
            (
              isSeller
                ? ([
                    ["teklifler", `Teklifler (${listing.bidCount})`],
                    ["detay", "İlan Detayları"],
                    ...(extrasGrouped.length || showExpertise ? [["ek", "Ek Özellikler"] as const] : []),
                    ["konum", "Konum"],
                    ["satici", "İlan Sahibi"],
                    ["yorumlar", "Yorumlar"],
                  ] as Array<[string, string]>)
                : ([
                    ["detay", "İlan Detayları"],
                    ...(extrasGrouped.length || showExpertise ? [["ek", "Ek Özellikler"] as const] : []),
                    ["konum", "Konum"],
                    ["teklifler", `Teklifler (${listing.bidCount})`],
                    ["satici", "İlan Sahibi"],
                    ["yorumlar", "Yorumlar"],
                  ] as Array<[string, string]>)
            )
          )
            .filter(([k]) => offersEnabled || k !== "teklifler")
            .map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                padding: "12px 14px",
                border: "none",
                borderBottom: tab === k ? "2.5px solid var(--orange)" : "2.5px solid transparent",
                background: "transparent",
                color: tab === k ? "var(--orange)" : "#64748b",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          {tab === "detay" && (
            <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
              <EidsBadge text={listing.eidsBadge} />
              <ListingDescriptionHtml text={listing.description} />
              <ListingQuestionsBlock listingId={listing.id} />
              {showExpertise && (
                <div style={{ display: "grid", gap: 10, borderTop: "1px solid #eef2f7", paddingTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Boyalı veya Değişen Parça</div>
                  <VehicleExpertiseReportPanel value={expertiseReport} editable={false} />
                </div>
              )}
              {extrasGrouped.length > 0 && (
                <div style={{ display: "grid", gap: 12, borderTop: "1px solid #eef2f7", paddingTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Ek özellikler</div>
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
                              padding: "5px 10px",
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
            </div>
          )}

          {tab === "ek" && (extrasGrouped.length > 0 || showExpertise) && (
            <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
              {showExpertise && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Boyalı veya Değişen Parça</div>
                  <VehicleExpertiseReportPanel value={expertiseReport} editable={false} />
                </div>
              )}
              {extrasGrouped.map((g) => (
                <div key={g.id}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{g.label}</div>
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
                          padding: "5px 10px",
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

          {tab === "konum" && (
            <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={18} color="#ff6a00" />
                <span style={{ fontWeight: 600 }}>{location || "Konum belirtilmemiş"}</span>
              </div>
              {listing.latitude != null && listing.longitude != null && (
                <ListingMap lat={listing.latitude} lng={listing.longitude} />
              )}
            </div>
          )}

          {tab === "teklifler" && offersEnabled && (
            <div id="teklifler-panel" className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead style={{ background: "#f8fafc", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Sıra</th>
                    <th>Teklif Veren</th>
                    <th>Tutar</th>
                    <th>Tarih</th>
                    <th>Geçerlilik</th>
                    {isSeller && <th>İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b) => (
                    <tr key={b.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: 12 }}>#{b.rank}</td>
                      <td>{maskName(b.bidderName)}</td>
                      <td className="price-bid">{formatTl(b.amount)}</td>
                      <td>{new Date(b.createdAt).toLocaleString("tr-TR")}</td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background:
                                b.status === "ACTIVE"
                                  ? "var(--green)"
                                  : b.status === "APPROVED"
                                    ? "#16a34a"
                                    : b.status === "REJECTED" || b.status === "EXPIRED"
                                      ? "#94a3b8"
                                      : "#f59e0b",
                            }}
                          />
                          {b.status === "ACTIVE" ? remainingLabel(b.expiresAt) : bidStatusLabel(b.status)}
                        </span>
                      </td>
                      {isSeller && (
                        <td>
                          {b.status === "ACTIVE" && (
                            <button type="button" className="btn-orange" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => approve(b.id)}>
                              Onayla
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {!bids.length && (
                    <tr>
                      <td colSpan={isSeller ? 6 : 5} style={{ padding: 16, color: "#64748b" }}>
                        Henüz teklif yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "satici" && (
            <div className="card" style={{ padding: 18 }}>
              <SellerOwnerCard
                seller={listing.seller}
                memberLabel={memberLabel}
                sellerFav={sellerFav}
                isSeller={isSeller}
                onNeedLogin={() =>
                  router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing.id}`)}`)
                }
                onToggleFavorite={async () => {
                  if (!me) {
                    router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing.id}`)}`);
                    return;
                  }
                  const res = await fetch("/api/favorite-sellers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sellerId: listing.seller.id,
                      action: sellerFav ? "remove" : "add",
                    }),
                  });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) setSellerFav(Boolean(d.favorited));
                }}
              />
            </div>
          )}

          {tab === "yorumlar" && (
            <SellerReviewsPanel
              sellerId={listing.seller.id}
              listingId={listing.id}
              enabled={Boolean(listing.reviewsEnabled)}
              isSeller={isSeller}
              me={me}
              onNeedLogin={() =>
                router.push(`/giris?next=${encodeURIComponent(`/ilan/${listing.id}?tab=yorumlar`)}`)
              }
            />
          )}
        </div>
      </div>

      {reportOpen && (
        <div className="modal-backdrop" onClick={() => setReportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>İlanı Şikayet Et</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Uygunsuz içerik veya şüpheli ilanları bize bildirin.</p>
            <select className="select" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
              <option value="">Şikayet nedeni seçin</option>
              <option value="yanlis_bilgi">Yanlış / yanıltıcı bilgi</option>
              <option value="sahte_ilan">Sahte ilan şüphesi</option>
              <option value="uygunsuz">Uygunsuz içerik</option>
              <option value="spam">Spam / tekrar ilan</option>
              <option value="diger">Diğer</option>
            </select>
            <textarea
              className="input"
              style={{ minHeight: 90, resize: "vertical" }}
              placeholder="Açıklama (opsiyonel)"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
            />
            {reportMsg && (
              <div style={{ fontSize: 13, color: reportMsg.includes("alındı") ? "var(--green)" : "#dc2626" }}>{reportMsg}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn-outline" style={{ padding: "10px 14px" }} onClick={() => setReportOpen(false)}>
                İptal
              </button>
              <button type="button" className="btn-orange" style={{ padding: "10px 14px" }} onClick={submitReport}>
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {escrowOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !escrowBusy && setEscrowOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              {listing.escrowSettings?.buttonLabel || "Güvenli Öde"}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Ödemeniz TeklifBu Güvenli Öde havuzunda tutulur; satıcı ürünü kargoya verdikten ve siz
              teslim aldığınızı onayladıktan sonra satıcıya aktarılır.
            </p>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span style={{ color: "#64748b" }}>Tutar</span>
              <strong>{formatTl(listing.askPrice)}</strong>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Satıcının kargoya verme süresi</span>
              <select
                className="select"
                value={escrowShipDays ?? ""}
                onChange={(e) => setEscrowShipDays(Number(e.target.value))}
                disabled={escrowBusy}
              >
                {(listing.escrowSettings?.shipDaysOptions || [3, 7, 10]).map((d) => (
                  <option key={d} value={d}>
                    {d} gün
                  </option>
                ))}
              </select>
            </label>
            {escrowError && (
              <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>{escrowError}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "10px 14px" }}
                disabled={escrowBusy}
                onClick={() => setEscrowOpen(false)}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn-orange"
                style={{ padding: "10px 14px" }}
                disabled={escrowBusy}
                onClick={startEscrowCheckout}
              >
                {escrowBusy ? "Yönlendiriliyor..." : "Ödemeye Geç"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BidSentModal
        open={bidSentOpen}
        amountTl={bidSentAmount}
        onClose={() => {
          setBidSentOpen(false);
          setBidSentAmount(null);
        }}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title={
          authIntent === "favorite"
            ? "Üye olmadan favori ekleyemezsiniz"
            : "Üye olmadan teklif veremezsiniz"
        }
        subtitle={
          authIntent === "favorite"
            ? "Favorilere eklemek için telefon/e-posta ve şifrenizle giriş yapın veya üye olun."
            : "Teklif vermek için üye girişi yapın (telefon/e-posta + şifre) veya yeni üyelikte OTP ile doğrulanın."
        }
        onSuccess={async () => {
          await load();
          if (authIntent === "favorite" && params.id) {
            const check = await fetch(`/api/listings?id=${params.id}`).then((r) => r.json());
            const already = Boolean(check.listing?.isFavorited);
            if (!already) {
              const res = await fetch("/api/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ listingId: params.id }),
              });
              if (res.ok) {
                setFavorited(true);
                setListing((prev) => (prev ? { ...prev, isFavorited: true } : prev));
                setMsg("Favorilere eklendi.");
                window.dispatchEvent(new Event("teklifbu:favorites"));
              }
            } else {
              setFavorited(true);
              setMsg("Bu ilan zaten favorilerinizde.");
            }
          } else if (authIntent !== "favorite") {
            setMsg("Giriş başarılı. Şimdi teklif verebilirsiniz.");
          }
        }}
      />

      <TokenBuyModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        requiredTokens={tokenNeed}
        balance={tokenBalance}
        continueLabel="Teklife Dön"
        title="Teklif için jeton gerekli"
        description="Her teklif jeton harcar. Bakiyeniz yetersiz olduğu için teklifiniz gönderilemedi. Jeton yükledikten sonra tekrar Teklif Bu’ya basabilirsiniz."
        onPurchased={(bal) => {
          setTokenBalance(bal);
          setMsg("Jeton eklendi. Tekrar Teklif Bu’ya basabilirsiniz.");
        }}
      />
    </div>
  );
}
