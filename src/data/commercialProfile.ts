/** Ticari / işletme üyelik formu alanları ve demo veri */

export type CommercialProfile = {
  commercialTitle: string;
  companyType: string;
  taxNumber: string;
  taxOffice: string;
  tradeRegistryNo: string;
  mersisNo: string;
  yetkiBelgeNo: string;
  businessCity: string;
  businessDistrict: string;
  businessAddress: string;
  authorizedTitle: string;
  authorizedPhone: string;
  naceCode: string;
};

export const EMPTY_COMMERCIAL_PROFILE: CommercialProfile = {
  commercialTitle: "",
  companyType: "",
  taxNumber: "",
  taxOffice: "",
  tradeRegistryNo: "",
  mersisNo: "",
  yetkiBelgeNo: "",
  businessCity: "",
  businessDistrict: "",
  businessAddress: "",
  authorizedTitle: "",
  authorizedPhone: "",
  naceCode: "",
};

export const COMPANY_TYPE_OPTIONS = [
  { value: "SAHIS", label: "Şahıs Şirketi / Gerçek Kişi" },
  { value: "LIMITED", label: "Limited Şirket" },
  { value: "ANONIM", label: "Anonim Şirket" },
  { value: "KOLLEKTIF", label: "Kollektif Şirket" },
  { value: "KOMANDIT", label: "Komandit Şirket" },
  { value: "DIGER", label: "Diğer" },
] as const;

export const COMMERCIAL_FIELD_LABELS: Record<keyof CommercialProfile, string> = {
  commercialTitle: "Ticari unvan",
  companyType: "Şirket türü",
  taxNumber: "Vergi numarası",
  taxOffice: "Vergi dairesi",
  tradeRegistryNo: "Ticaret sicil no",
  mersisNo: "MERSİS no",
  yetkiBelgeNo: "Yetki belge no",
  businessCity: "İşyeri ili",
  businessDistrict: "İşyeri ilçesi",
  businessAddress: "İşyeri adresi",
  authorizedTitle: "Yetkili görevi / ünvanı",
  authorizedPhone: "Yetkili telefon",
  naceCode: "NACE / faaliyet kodu",
};

/** Zorunlu alanlar (kayıt + onay) */
export const COMMERCIAL_REQUIRED_KEYS: Array<keyof CommercialProfile> = [
  "commercialTitle",
  "companyType",
  "taxNumber",
  "taxOffice",
  "businessCity",
  "businessAddress",
  "authorizedTitle",
];

const DEMO_POOL: CommercialProfile[] = [
  {
    commercialTitle: "Anadolu Emlak Danışmanlık Ltd. Şti.",
    companyType: "LIMITED",
    taxNumber: "1234567890",
    taxOffice: "Kadıköy",
    tradeRegistryNo: "345678",
    mersisNo: "0123456789012345",
    yetkiBelgeNo: "YB-2024-1001",
    businessCity: "İstanbul",
    businessDistrict: "Kadıköy",
    businessAddress: "Caferağa Mah. Moda Cad. No:12 D:3",
    authorizedTitle: "Şirket Müdürü",
    authorizedPhone: "05321234567",
    naceCode: "68.31",
  },
  {
    commercialTitle: "Boğaziçi Oto Galeri A.Ş.",
    companyType: "ANONIM",
    taxNumber: "9876543210",
    taxOffice: "Beşiktaş",
    tradeRegistryNo: "112233",
    mersisNo: "0987654321098765",
    yetkiBelgeNo: "YB-2024-2044",
    businessCity: "İstanbul",
    businessDistrict: "Beşiktaş",
    businessAddress: "Levent Mah. Büyükdere Cad. No:45",
    authorizedTitle: "Yönetim Kurulu Üyesi",
    authorizedPhone: "05329876543",
    naceCode: "45.11",
  },
  {
    commercialTitle: "Ege Lojistik Taşımacılık Ltd. Şti.",
    companyType: "LIMITED",
    taxNumber: "1122334455",
    taxOffice: "Bornova",
    tradeRegistryNo: "556677",
    mersisNo: "0112233445566778",
    yetkiBelgeNo: "YB-2023-8890",
    businessCity: "İzmir",
    businessDistrict: "Bornova",
    businessAddress: "Kazımdirik Mah. 159. Sok. No:8",
    authorizedTitle: "Genel Müdür",
    authorizedPhone: "05335551234",
    naceCode: "49.41",
  },
  {
    commercialTitle: "Akdeniz Otel İşletmeleri Ltd. Şti.",
    companyType: "LIMITED",
    taxNumber: "5544332211",
    taxOffice: "Muratpaşa",
    tradeRegistryNo: "778899",
    mersisNo: "0554433221100998",
    yetkiBelgeNo: "YB-2022-4411",
    businessCity: "Antalya",
    businessDistrict: "Muratpaşa",
    businessAddress: "Lara Cad. No:120",
    authorizedTitle: "İşletme Müdürü",
    authorizedPhone: "05324445566",
    naceCode: "55.10",
  },
  {
    commercialTitle: "Yıldız Ticaret (Şahıs)",
    companyType: "SAHIS",
    taxNumber: "1112223334",
    taxOffice: "Çankaya",
    tradeRegistryNo: "990011",
    mersisNo: "",
    yetkiBelgeNo: "YB-2021-0101",
    businessCity: "Ankara",
    businessDistrict: "Çankaya",
    businessAddress: "Kızılay Mah. Atatürk Bulvarı No:56/4",
    authorizedTitle: "İşletme Sahibi",
    authorizedPhone: "05336667788",
    naceCode: "47.19",
  },
];

let demoCursor = 0;

const DEMO_SUBTYPES: Array<import("@/lib/accountTypes").CommercialSubtype[]> = [
  ["EMLAK_OFISI"],
  ["GALERI"],
  ["LOJISTIK"],
  ["OTEL"],
  ["MAGAZA"],
];

export function nextDemoCommercialProfile(): CommercialProfile {
  const row = DEMO_POOL[demoCursor % DEMO_POOL.length];
  demoCursor += 1;
  return { ...row };
}

/** Demo doldur: işletme + uygun faaliyet alanı */
export function nextDemoCommercialBundle(): {
  profile: CommercialProfile;
  subtypes: import("@/lib/accountTypes").CommercialSubtype[];
} {
  const idx = demoCursor % DEMO_POOL.length;
  const profile = { ...DEMO_POOL[idx] };
  const subtypes = [...(DEMO_SUBTYPES[idx] || ["MAGAZA"])];
  demoCursor += 1;
  return { profile, subtypes };
}

export function parseCommercialProfile(raw: unknown): CommercialProfile {
  const base = { ...EMPTY_COMMERCIAL_PROFILE };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  // Geriye dönük: companyName → commercialTitle
  if (o.companyName && !o.commercialTitle) o.commercialTitle = o.companyName;
  for (const key of Object.keys(base) as Array<keyof CommercialProfile>) {
    if (o[key] != null) base[key] = String(o[key]);
  }
  return base;
}

export function validateCommercialProfile(p: CommercialProfile): string | null {
  for (const key of COMMERCIAL_REQUIRED_KEYS) {
    if (!String(p[key] || "").trim()) {
      return `${COMMERCIAL_FIELD_LABELS[key]} zorunludur`;
    }
  }
  const tax = p.taxNumber.replace(/\D/g, "");
  if (tax.length < 10 || tax.length > 11) {
    return "Vergi numarası 10 veya 11 hane olmalıdır";
  }
  return null;
}

export function mergeCommercialIntoProfile(
  existing: Record<string, string>,
  commercial: CommercialProfile
): Record<string, string> {
  return {
    ...existing,
    ...commercial,
    companyName: commercial.commercialTitle,
  };
}

export type CommercialStatus = "PENDING" | "APPROVED" | "REJECTED";

export const PENDING_COMMERCIAL_KEY = "_pendingCommercial";
export const PENDING_SUBTYPES_KEY = "_pendingSubtypes";

export function commercialStatusLabel(s?: string | null) {
  switch (String(s || "").toUpperCase()) {
    case "PENDING":
      return "Onay bekliyor";
    case "APPROVED":
      return "Onaylandı";
    case "REJECTED":
      return "Reddedildi";
    default:
      return "—";
  }
}

export function getPendingCommercialFromProfile(profile: unknown): {
  profile: CommercialProfile | null;
  subtypes: string[];
} {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return { profile: null, subtypes: [] };
  }
  const o = profile as Record<string, unknown>;
  const raw = o[PENDING_COMMERCIAL_KEY];
  if (!raw) return { profile: null, subtypes: [] };
  let commercialRaw: unknown = raw;
  if (typeof raw === "string") {
    try {
      commercialRaw = JSON.parse(raw);
    } catch {
      commercialRaw = null;
    }
  }
  if (!commercialRaw) return { profile: null, subtypes: [] };
  let subtypes: string[] = [];
  const rawSubs = o[PENDING_SUBTYPES_KEY];
  if (Array.isArray(rawSubs)) subtypes = rawSubs.map(String);
  else if (typeof rawSubs === "string") {
    try {
      const parsed = JSON.parse(rawSubs);
      if (Array.isArray(parsed)) subtypes = parsed.map(String);
    } catch {
      subtypes = [];
    }
  }
  return {
    profile: parseCommercialProfile(commercialRaw),
    subtypes,
  };
}

export function stripPendingCommercialKeys(
  profile: Record<string, string>
): Record<string, string> {
  const next = { ...profile };
  delete next[PENDING_COMMERCIAL_KEY];
  delete next[PENDING_SUBTYPES_KEY];
  return next;
}

export function withPendingCommercial(
  existing: Record<string, string>,
  commercial: CommercialProfile,
  subtypes: string[]
): Record<string, string> {
  return {
    ...existing,
    [PENDING_COMMERCIAL_KEY]: JSON.stringify(commercial),
    [PENDING_SUBTYPES_KEY]: JSON.stringify(subtypes),
  };
}

/** profile JSON içinde pending alanları object olarak da tutabiliriz */
export function attachPendingCommercial(
  existing: Record<string, unknown>,
  commercial: CommercialProfile,
  subtypes: string[]
): Record<string, unknown> {
  const next = { ...existing };
  next[PENDING_COMMERCIAL_KEY] = { ...commercial };
  next[PENDING_SUBTYPES_KEY] = [...subtypes];
  return next;
}

export function applyPendingCommercialToProfile(
  profile: unknown
): { profile: Record<string, unknown>; subtypes: string[] | null } {
  const pending = getPendingCommercialFromProfile(profile);
  const base =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? { ...(profile as Record<string, unknown>) }
      : {};
  delete base[PENDING_COMMERCIAL_KEY];
  delete base[PENDING_SUBTYPES_KEY];
  if (!pending.profile) {
    return { profile: base, subtypes: null };
  }
  const merged = mergeCommercialIntoProfile(
    Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, v == null ? "" : String(v)])
    ),
    pending.profile
  );
  return { profile: merged, subtypes: pending.subtypes };
}
