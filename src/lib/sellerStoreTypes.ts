export type SellerPublicProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  memberSince: string;
  memberYearsLabel?: string | null;
  memberYears: number;
  memberSinceYear: number | null;
  identityVisible?: boolean;
  contactVisible: boolean;
  isCommercial?: boolean;
  commercialTitle?: string | null;
  yetkiBelgeNo?: string | null;
  logoUrl?: string | null;
  storeCoverUrl?: string | null;
  isPremiumSeller?: boolean;
  showPremiumBadge?: boolean;
  showYearsBadge?: boolean;
  reviewCount?: number;
  avgRating?: number | null;
  positiveReviewPercent?: number | null;
  about?: string | null;
  verifications?: {
    identity?: boolean;
    tax?: boolean;
    phone?: boolean;
    email?: boolean;
    address?: boolean;
  } | null;
  stats?: {
    totalListings?: number;
    activeListings?: number;
    successfulSales?: number;
    bidAcceptanceRate?: number | null;
    avgResponseMinutes?: number | null;
  } | null;
  commercial?: {
    companyType: string;
    companyTypeLabel: string;
    businessCity: string;
    businessDistrict: string;
    businessAddress: string;
    authorizedTitle: string;
    taxOffice: string;
    yetkiBelgeNo: string;
  } | null;
  lastActiveAt?: string | null;
  accountType: string;
  shopId?: string | null;
  shopName?: string | null;
};

export type SellerAchievement = {
  id: string;
  title: string;
  subtitle: string;
  tone: "gold" | "purple" | "green" | "orange";
};

export type SellerStoreReview = {
  id: string;
  body: string;
  rating: number | null;
  createdAt: string;
  authorName: string;
  listingId?: string | null;
  listingTitle?: string | null;
};
