/** Vasıta boya / değişen parça ekspertiz raporu (otomobil, SUV vb.) */

export type ExpertisePartStatus = "original" | "lokal" | "boyali" | "degisen";

export type ExpertisePartId =
  | "frontBumper"
  | "hood"
  | "roof"
  | "trunk"
  | "rearBumper"
  | "leftFrontFender"
  | "leftFrontDoor"
  | "leftRearDoor"
  | "leftRearFender"
  | "rightFrontFender"
  | "rightFrontDoor"
  | "rightRearDoor"
  | "rightRearFender";

/** Liste sütunu: ön + sol → sol; arka + sağ → sağ */
export type ExpertiseListSide = "left" | "right";

export type ExpertisePartDef = {
  id: ExpertisePartId;
  label: string;
  listSide: ExpertiseListSide;
};

export const EXPERTISE_PARTS: ExpertisePartDef[] = [
  { id: "frontBumper", label: "Ön Tampon", listSide: "left" },
  { id: "hood", label: "Motor Kaputu", listSide: "left" },
  { id: "leftFrontFender", label: "Sol Ön Çamurluk", listSide: "left" },
  { id: "leftFrontDoor", label: "Sol Ön Kapı", listSide: "left" },
  { id: "leftRearDoor", label: "Sol Arka Kapı", listSide: "left" },
  { id: "leftRearFender", label: "Sol Arka Çamurluk", listSide: "left" },
  { id: "rightFrontFender", label: "Sağ Ön Çamurluk", listSide: "right" },
  { id: "rightFrontDoor", label: "Sağ Ön Kapı", listSide: "right" },
  { id: "rightRearDoor", label: "Sağ Arka Kapı", listSide: "right" },
  { id: "rightRearFender", label: "Sağ Arka Çamurluk", listSide: "right" },
  { id: "roof", label: "Tavan", listSide: "right" },
  { id: "trunk", label: "Bagaj Kapağı", listSide: "right" },
  { id: "rearBumper", label: "Arka Tampon", listSide: "right" },
];

export const EXPERTISE_STATUS_META: Record<
  ExpertisePartStatus,
  { label: string; short: string; color: string; text: string }
> = {
  original: { label: "Orijinal", short: "", color: "#f3f4f6", text: "#64748b" },
  lokal: { label: "Lokal Boyalı", short: "LB", color: "#ff6a00", text: "#fff" },
  boyali: { label: "Boyalı", short: "B", color: "#dc2626", text: "#fff" },
  degisen: { label: "Değişen", short: "D", color: "#7f1d1d", text: "#fff" },
};

export const EXPERTISE_STATUS_CYCLE: ExpertisePartStatus[] = [
  "original",
  "lokal",
  "boyali",
  "degisen",
];

/** Raporun alındığı yer */
export const EXPERTISE_OBTAINED_AT = [
  "Yetkili ekspertiz firması",
  "Yetkili servis",
  "Galeri / satıcı",
  "Özel muayene",
  "Diğer",
] as const;

/** Yaygın ekspertiz firmaları */
export const EXPERTISE_FIRMS = [
  "Otoekspertiz",
  "Autoking",
  "Expertiz.com",
  "Orjinal Oto Ekspertiz",
  "Carwiz",
  "Diğer",
] as const;

/** Bu alt tiplerde şema gösterilir */
const BODY_SUBTYPES = new Set([
  "otomobil",
  "arazi-suv-pickup",
  "minivan-panelvan",
  "ticari-araclar",
  "kiralik-araclar",
  "hasarli-araclar",
  "klasik-araclar",
  "elektrikli-araclar",
  "engelli-plakali",
]);

export function supportsVehicleExpertiseReport(subtype?: string | null) {
  return Boolean(subtype && BODY_SUBTYPES.has(subtype));
}

export type VehicleExpertiseReport = {
  parts: Partial<Record<ExpertisePartId, ExpertisePartStatus>>;
  obtainedAt?: string;
  firm?: string;
};

export function emptyExpertiseParts(): Record<ExpertisePartId, ExpertisePartStatus> {
  return Object.fromEntries(EXPERTISE_PARTS.map((p) => [p.id, "original" as const])) as Record<
    ExpertisePartId,
    ExpertisePartStatus
  >;
}

export function parseExpertiseReport(raw: unknown): VehicleExpertiseReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const partsIn = o.parts && typeof o.parts === "object" && !Array.isArray(o.parts) ? (o.parts as Record<string, unknown>) : {};
  const parts: Partial<Record<ExpertisePartId, ExpertisePartStatus>> = {};
  for (const p of EXPERTISE_PARTS) {
    const v = String(partsIn[p.id] || "");
    if (v === "lokal" || v === "boyali" || v === "degisen" || v === "original") {
      parts[p.id] = v;
    }
  }
  const obtainedAt = String(o.obtainedAt || "").trim();
  const firm = String(o.firm || "").trim();
  if (!Object.keys(parts).length && !obtainedAt && !firm) return null;
  return {
    parts,
    ...(obtainedAt ? { obtainedAt } : {}),
    ...(firm ? { firm } : {}),
  };
}

export function expertiseReportHasDamage(report: VehicleExpertiseReport | null | undefined) {
  if (!report?.parts) return false;
  return Object.values(report.parts).some((s) => s && s !== "original");
}

export function serializeExpertiseReport(
  parts: Record<ExpertisePartId, ExpertisePartStatus>,
  obtainedAt: string,
  firm: string
): VehicleExpertiseReport | null {
  const slim: Partial<Record<ExpertisePartId, ExpertisePartStatus>> = {};
  for (const p of EXPERTISE_PARTS) {
    if (parts[p.id] && parts[p.id] !== "original") slim[p.id] = parts[p.id];
  }
  const oa = obtainedAt.trim();
  const f = firm.trim();
  if (!Object.keys(slim).length && !oa && !f) return null;
  return {
    parts: slim,
    ...(oa ? { obtainedAt: oa } : {}),
    ...(f ? { firm: f } : {}),
  };
}

export function partsByListSide(
  parts: Partial<Record<ExpertisePartId, ExpertisePartStatus>>,
  side: ExpertiseListSide
) {
  return EXPERTISE_PARTS.filter((p) => p.listSide === side && parts[p.id] && parts[p.id] !== "original").map(
    (p) => ({ ...p, status: parts[p.id]! as ExpertisePartStatus })
  );
}

export function groupPartsByStatus(
  items: Array<ExpertisePartDef & { status: ExpertisePartStatus }>
) {
  const order: ExpertisePartStatus[] = ["lokal", "boyali", "degisen"];
  return order
    .map((status) => ({
      status,
      meta: EXPERTISE_STATUS_META[status],
      items: items.filter((i) => i.status === status),
    }))
    .filter((g) => g.items.length > 0);
}

export function nextExpertiseStatus(current: ExpertisePartStatus): ExpertisePartStatus {
  const i = EXPERTISE_STATUS_CYCLE.indexOf(current);
  return EXPERTISE_STATUS_CYCLE[(i + 1) % EXPERTISE_STATUS_CYCLE.length];
}
