import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/core/settings";
import { writeAuditLog } from "@/core/services/tenantService";
import {
  DEFAULT_TRUST_SCORE_ENGINE,
  normalizeTrustScoreEngine,
  type TrustScoreEngineConfig,
} from "@/lib/trustScoreConfig";

export * from "@/lib/trustScoreConfig";

export async function getTrustScoreEngineConfig(): Promise<TrustScoreEngineConfig> {
  const raw = await getSetting<unknown>("trust_score_engine", DEFAULT_TRUST_SCORE_ENGINE);
  return normalizeTrustScoreEngine(raw);
}

export async function saveTrustScoreEngineConfig(config: TrustScoreEngineConfig) {
  const normalized = normalizeTrustScoreEngine(config);
  await setSetting("trust_score_engine", normalized, "Puanlama motoru", "trust");
  return normalized;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function applyTrustScoreEvent(input: {
  userId: string;
  eventKey: string;
  listingId?: string | null;
  actorUserId?: string | null;
  note?: string | null;
  meta?: Record<string, unknown>;
  force?: boolean;
}) {
  const config = await getTrustScoreEngineConfig();
  if (!config.enabled && !input.force) {
    return { ok: false as const, skipped: true as const, reason: "engine_disabled" };
  }
  const rule = config.events.find((e) => e.key === input.eventKey);
  if (!rule) {
    return { ok: false as const, skipped: true as const, reason: "unknown_event" };
  }
  if (!rule.enabled && !input.force) {
    return { ok: false as const, skipped: true as const, reason: "event_disabled" };
  }
  if (rule.points === 0) {
    return { ok: true as const, skipped: true as const, reason: "zero_points", points: 0 };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, trustScore: true, role: true },
  });
  if (!user) return { ok: false as const, error: "Kullanıcı yok" };
  if (user.role === "ADMIN") {
    return { ok: true as const, skipped: true as const, reason: "admin_user" };
  }

  const before = user.trustScore ?? config.startingScore;
  const after = clamp(before + rule.points, config.minScore, config.maxScore);
  if (after === before) {
    await prisma.trustScoreLedger.create({
      data: {
        userId: user.id,
        eventKey: rule.key,
        points: rule.points,
        scoreBefore: before,
        scoreAfter: after,
        listingId: input.listingId || null,
        actorUserId: input.actorUserId || null,
        note: input.note || "Skor sınırında; değişiklik yok",
        meta: input.meta || undefined,
      },
    });
    return {
      ok: true as const,
      scoreBefore: before,
      scoreAfter: after,
      points: rule.points,
      clamped: true,
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { trustScore: after },
    }),
    prisma.trustScoreLedger.create({
      data: {
        userId: user.id,
        eventKey: rule.key,
        points: rule.points,
        scoreBefore: before,
        scoreAfter: after,
        listingId: input.listingId || null,
        actorUserId: input.actorUserId || null,
        note: input.note || null,
        meta: input.meta || undefined,
      },
    }),
  ]);

  await writeAuditLog({
    actorId: input.actorUserId || null,
    action: "trust_score.apply",
    entity: "User",
    entityId: user.id,
    meta: {
      eventKey: rule.key,
      points: rule.points,
      scoreBefore: before,
      scoreAfter: after,
      listingId: input.listingId || null,
    },
  });

  return { ok: true as const, scoreBefore: before, scoreAfter: after, points: rule.points };
}

export async function applyListingCooldown(userId: string, hours: number) {
  if (!hours || hours <= 0) return null;
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { listingCooldownUntil: true },
  });
  const current = user?.listingCooldownUntil;
  const next = current && current > until ? current : until;
  await prisma.user.update({
    where: { id: userId },
    data: { listingCooldownUntil: next },
  });
  return next;
}

export async function assertTrustAllowsListing(userId: string) {
  const config = await getTrustScoreEngineConfig();
  if (!config.enabled) return { ok: true as const };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustScore: true, listingCooldownUntil: true, role: true },
  });
  if (!user || user.role === "ADMIN") return { ok: true as const };

  if (user.listingCooldownUntil && user.listingCooldownUntil > new Date()) {
    return {
      ok: false as const,
      code: "TRUST_COOLDOWN",
      error: `Puanlama / yeniden yayın bekleme süresi ${user.listingCooldownUntil.toLocaleString("tr-TR")} tarihine kadar devam ediyor.`,
      until: user.listingCooldownUntil,
    };
  }

  if (
    config.blockListingBelow > 0 &&
    (user.trustScore ?? config.startingScore) < config.blockListingBelow
  ) {
    return {
      ok: false as const,
      code: "TRUST_SCORE_LOW",
      error: `Güven puanınız (${user.trustScore}) ilan vermek için yetersiz. Minimum: ${config.blockListingBelow}.`,
      score: user.trustScore,
      threshold: config.blockListingBelow,
    };
  }
  return { ok: true as const };
}

export async function assertTrustAllowsBid(userId: string) {
  const config = await getTrustScoreEngineConfig();
  if (!config.enabled || config.blockBidBelow <= 0) return { ok: true as const };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustScore: true, role: true },
  });
  if (!user || user.role === "ADMIN") return { ok: true as const };
  if ((user.trustScore ?? config.startingScore) < config.blockBidBelow) {
    return {
      ok: false as const,
      code: "TRUST_SCORE_LOW",
      error: `Güven puanınız (${user.trustScore}) teklif vermek için yetersiz. Minimum: ${config.blockBidBelow}.`,
      score: user.trustScore,
      threshold: config.blockBidBelow,
    };
  }
  return { ok: true as const };
}

export async function listRecentTrustLedger(limit = 30) {
  const rows = await prisma.trustScoreLedger.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
  });
  return rows;
}
