export type DealTypeValue = "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK" | string;

export const DEAL_TYPE_OPTIONS = [
  { value: "SATILIK", label: "Satılık" },
  { value: "KIRALIK", label: "Kiralık" },
  { value: "DEVREN_SATILIK", label: "Devren Satılık" },
  { value: "DEVREN_KIRALIK", label: "Devren Kiralık" },
] as const;

export function dealTypeLabel(dealType?: DealTypeValue | null) {
  const found = DEAL_TYPE_OPTIONS.find((o) => o.value === dealType);
  return found?.label || "Satılık";
}

export function isRentDeal(dealType?: DealTypeValue | null) {
  return dealType === "KIRALIK" || dealType === "DEVREN_KIRALIK";
}

export function parseDealType(raw: string, categorySlug?: string): "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK" {
  const v = String(raw || "").toUpperCase();
  if (categorySlug === "kiralik" && v !== "DEVREN_KIRALIK") return "KIRALIK";
  if (v === "KIRALIK" || v === "DEVREN_SATILIK" || v === "DEVREN_KIRALIK" || v === "SATILIK") return v;
  return "SATILIK";
}
