import type { MapPoint } from "@/components/LocationMapPicker";
import type { VehicleExpertiseReport } from "@/data/vehicleExpertiseReport";
import { expertiseReportHasDamage, parseExpertiseReport } from "@/data/vehicleExpertiseReport";

export const LISTING_DRAFT_KEY = "teklifbu:listing-create-draft:v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ListingCreateDraft = {
  savedAt: number;
  form: {
    title: string;
    description: string;
    city: string;
    district: string;
    neighborhood: string;
    dealType: string;
    askPrice: string;
    categorySlug: string;
    days: string;
  };
  attrs: Record<string, string>;
  housingExtras: string[];
  /** Vasıta güvenlik / iç-dış / multimedya id listesi */
  vehicleExtras: string[];
  /** Otomobil / SUV boya-değişen şeması */
  expertiseReport?: VehicleExpertiseReport | null;
  images: string[];
  /** AI ile okunan geçici SS URL’leri — ilan kaydından sonra sunucudan silinir */
  aiSourceImages?: string[];
  mapPoint: MapPoint | null;
  premium: {
    titleBold: boolean;
    titleLarge: boolean;
    isColored: boolean;
    featuredDays: 0 | 3 | 7;
  };
  mode?: "edit" | "preview";
};

/** Aynı sayfa oturumunda çift popup engeli (React Strict Mode dahil). */
let resumePromptHandled = false;

export function wasResumePromptHandled() {
  return resumePromptHandled;
}

export function markResumePromptHandled() {
  resumePromptHandled = true;
}

export function readListingDraft(): ListingCreateDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LISTING_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ListingCreateDraft;
    if (!data?.savedAt || !data.form) return null;
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      clearListingDraft();
      return null;
    }
    const days = Number(data.premium?.featuredDays || 0);
    return {
      ...data,
      attrs: data.attrs || {},
      housingExtras: Array.isArray(data.housingExtras) ? data.housingExtras : [],
      vehicleExtras: Array.isArray(data.vehicleExtras) ? data.vehicleExtras : [],
      expertiseReport: parseExpertiseReport(data.expertiseReport),
      images: Array.isArray(data.images) ? data.images : [],
      aiSourceImages: Array.isArray(data.aiSourceImages)
        ? data.aiSourceImages.map((u) => String(u || "").trim()).filter(Boolean)
        : [],
      mapPoint: data.mapPoint ?? null,
      premium: {
        titleBold: Boolean(data.premium?.titleBold),
        titleLarge: Boolean(data.premium?.titleLarge),
        isColored: Boolean(data.premium?.isColored),
        featuredDays: days === 7 || days === 3 ? days : 0,
      },
      mode: data.mode === "preview" ? "preview" : "edit",
    };
  } catch {
    return null;
  }
}

export function isMeaningfulListingDraft(draft: ListingCreateDraft | null | undefined): boolean {
  if (!draft) return false;
  const f = draft.form;
  if (f.title?.trim()) return true;
  if (f.description?.trim()) return true;
  if (f.categorySlug?.trim()) return true;
  if (f.days?.trim()) return true;
  if (f.dealType?.trim()) return true;
  if (draft.images?.length) return true;
  if (draft.housingExtras?.length) return true;
  if (draft.vehicleExtras?.length) return true;
  if (
    expertiseReportHasDamage(draft.expertiseReport) ||
    draft.expertiseReport?.obtainedAt ||
    draft.expertiseReport?.firm
  ) {
    return true;
  }
  if (draft.mapPoint) return true;
  if (draft.premium?.titleBold || draft.premium?.titleLarge || draft.premium?.isColored) return true;
  if (draft.premium?.featuredDays) return true;
  if (Object.values(draft.attrs || {}).some((v) => String(v || "").trim())) return true;
  return false;
}

export function writeListingDraft(
  draft: Omit<ListingCreateDraft, "savedAt"> & { savedAt?: number }
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: ListingCreateDraft = {
      ...draft,
      savedAt: Date.now(),
    };
    localStorage.setItem(LISTING_DRAFT_KEY, JSON.stringify(payload));
    return true;
  } catch {
    // Kota doluysa sessizce geç (sistemi yormaz)
    return false;
  }
}

export function clearListingDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LISTING_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function formatDraftSavedAt(savedAt: number) {
  try {
    return new Date(savedAt).toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
