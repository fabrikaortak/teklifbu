export type TrustScoreTarget = "seller" | "buyer" | "user";

export type TrustScoreEventRule = {
  key: string;
  label: string;
  description: string;
  target: TrustScoreTarget;
  points: number;
  enabled: boolean;
  delayDays?: number;
};

export type TrustScoreEngineConfig = {
  enabled: boolean;
  startingScore: number;
  minScore: number;
  maxScore: number;
  blockListingBelow: number;
  blockBidBelow: number;
  republishDelayHoursOnDispute: number;
  events: TrustScoreEventRule[];
};

export const TRUST_SCORE_POINT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30, label: "+30" },
  { value: 25, label: "+25" },
  { value: 20, label: "+20" },
  { value: 15, label: "+15" },
  { value: 10, label: "+10" },
  { value: 5, label: "+5" },
  { value: 2, label: "+2" },
  { value: 0, label: "0 (nötr)" },
  { value: -2, label: "−2" },
  { value: -5, label: "−5" },
  { value: -10, label: "−10" },
  { value: -15, label: "−15" },
  { value: -20, label: "−20" },
  { value: -25, label: "−25" },
  { value: -30, label: "−30" },
];

export const TRUST_SCORE_THRESHOLD_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Kapalı (engel yok)" },
  { value: 20, label: "20 altı" },
  { value: 30, label: "30 altı" },
  { value: 40, label: "40 altı" },
  { value: 50, label: "50 altı" },
  { value: 60, label: "60 altı" },
  { value: 70, label: "70 altı" },
];

export const TRUST_SCORE_DELAY_HOUR_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Ek süre yok" },
  { value: 12, label: "12 saat" },
  { value: 24, label: "24 saat" },
  { value: 48, label: "48 saat" },
  { value: 72, label: "72 saat" },
  { value: 168, label: "7 gün" },
];

export const DEFAULT_TRUST_SCORE_EVENTS: TrustScoreEventRule[] = [
  {
    key: "republish_winner_confirmed",
    label: "Yeniden yayın — alıcı onayladı",
    description:
      "Kazanan teklif sahibi, satıcının yeniden yayın gerekçesini onayladığında satıcıya uygulanır.",
    target: "seller",
    points: 2,
    enabled: true,
  },
  {
    key: "republish_winner_disputed",
    label: "Yeniden yayın — alıcı onaylamadı",
    description:
      "Kazanan teklif sahibi satıcının gerekçesini reddettiğinde satıcıdan puan düşülür. Ek bekleme süresi ayrıca genel ayardan uygulanır.",
    target: "seller",
    points: -15,
    enabled: true,
  },
  {
    key: "buyer_backed_out_confirmed",
    label: "Alıcı caydı (doğrulandı)",
    description:
      "Satıcı sebebi «Alıcı caydı» ve kazanan alıcı bunu onayladığında alıcıdan puan düşülür.",
    target: "buyer",
    points: -20,
    enabled: true,
  },
  {
    key: "republish_winner_no_response",
    label: "Yeniden yayın — alıcı yanıt vermedi",
    description:
      "Belirlenen gün içinde alıcı yanıt vermezse satıcıya uygulanır (ileride zamanlayıcı ile). Şimdilik manuel/test için hazır.",
    target: "seller",
    points: -5,
    enabled: false,
    delayDays: 7,
  },
  {
    key: "listing_admin_rejected",
    label: "İlan yönetici tarafından reddedildi",
    description: "Yönetici ilanı reddettiğinde satıcıya uygulanabilir (bağlantı sonraki adım).",
    target: "seller",
    points: -5,
    enabled: false,
  },
  {
    key: "positive_review_received",
    label: "Olumlu yorum alındı",
    description: "Onaylı olumlu satıcı yorumunda satıcıya puan (bağlantı sonraki adım).",
    target: "seller",
    points: 5,
    enabled: false,
  },
  {
    key: "escrow_cancelled_by_buyer",
    label: "Güvenli Öde — alıcı iptali",
    description: "Escrow’u alıcı haksız iptal ederse (bağlantı sonraki adım).",
    target: "buyer",
    points: -15,
    enabled: false,
  },
  {
    key: "escrow_cancelled_by_seller",
    label: "Güvenli Öde — satıcı iptali",
    description: "Escrow’u satıcı haksız iptal ederse (bağlantı sonraki adım).",
    target: "seller",
    points: -15,
    enabled: false,
  },
  {
    key: "fake_listing_confirmed",
    label: "Sahte / yanıltıcı ilan (tespit)",
    description: "Yönetici veya sistem sahte ilan tespitinde satıcıya ağır ceza.",
    target: "seller",
    points: -30,
    enabled: false,
  },
  {
    key: "message_abuse",
    label: "Mesaj / iletişim suistimali",
    description: "Şikâyet sonucu onaylanan iletişim suistimalinde ilgili kullanıcıya uygulanır.",
    target: "user",
    points: -10,
    enabled: false,
  },
];

export const DEFAULT_TRUST_SCORE_ENGINE: TrustScoreEngineConfig = {
  enabled: true,
  startingScore: 100,
  minScore: 0,
  maxScore: 200,
  blockListingBelow: 40,
  blockBidBelow: 0,
  republishDelayHoursOnDispute: 48,
  events: DEFAULT_TRUST_SCORE_EVENTS.map((e) => ({ ...e })),
};

export function normalizeTrustScoreEngine(raw: unknown): TrustScoreEngineConfig {
  const base = DEFAULT_TRUST_SCORE_ENGINE;
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      events: DEFAULT_TRUST_SCORE_EVENTS.map((e) => ({ ...e })),
    };
  }
  const o = raw as Record<string, unknown>;
  const byKey = new Map(
    (Array.isArray(o.events) ? o.events : [])
      .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
      .map((e) => [String(e.key || ""), e])
  );
  const events = DEFAULT_TRUST_SCORE_EVENTS.map((def) => {
    const row = byKey.get(def.key);
    if (!row) return { ...def };
    const points = Number(row.points);
    const delayDays = row.delayDays != null ? Number(row.delayDays) : def.delayDays;
    return {
      ...def,
      label: String(row.label || def.label).trim() || def.label,
      description: String(row.description || def.description).trim() || def.description,
      points: Number.isFinite(points) ? Math.round(points) : def.points,
      enabled: row.enabled === undefined ? def.enabled : Boolean(row.enabled),
      delayDays: Number.isFinite(delayDays as number)
        ? Math.max(0, Math.round(delayDays as number))
        : def.delayDays,
    };
  });
  for (const [key, row] of byKey) {
    if (!key || events.some((e) => e.key === key)) continue;
    const points = Number(row.points);
    events.push({
      key,
      label: String(row.label || key),
      description: String(row.description || ""),
      target: (["seller", "buyer", "user"].includes(String(row.target))
        ? String(row.target)
        : "user") as TrustScoreTarget,
      points: Number.isFinite(points) ? Math.round(points) : 0,
      enabled: Boolean(row.enabled),
      delayDays: row.delayDays != null ? Number(row.delayDays) || 0 : undefined,
    });
  }
  const startingScore = Number(o.startingScore);
  const minScore = Number(o.minScore);
  const maxScore = Number(o.maxScore);
  const blockListingBelow = Number(o.blockListingBelow);
  const blockBidBelow = Number(o.blockBidBelow);
  const republishDelayHoursOnDispute = Number(o.republishDelayHoursOnDispute);
  return {
    enabled: o.enabled === undefined ? true : Boolean(o.enabled),
    startingScore: Number.isFinite(startingScore) ? Math.round(startingScore) : base.startingScore,
    minScore: Number.isFinite(minScore) ? Math.round(minScore) : base.minScore,
    maxScore: Number.isFinite(maxScore) ? Math.round(maxScore) : base.maxScore,
    blockListingBelow: Number.isFinite(blockListingBelow)
      ? Math.max(0, Math.round(blockListingBelow))
      : base.blockListingBelow,
    blockBidBelow: Number.isFinite(blockBidBelow)
      ? Math.max(0, Math.round(blockBidBelow))
      : base.blockBidBelow,
    republishDelayHoursOnDispute: Number.isFinite(republishDelayHoursOnDispute)
      ? Math.max(0, Math.round(republishDelayHoursOnDispute))
      : base.republishDelayHoursOnDispute,
    events,
  };
}
