import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

function asMeta(meta?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;
  return meta as Prisma.InputJsonValue;
}

/** Kullanıcıdan jeton düşer; yetersizse hata döner. */
export async function spendTokens(input: {
  userId: string;
  amount: number;
  reason: string;
  meta?: Record<string, unknown>;
}): Promise<{ ok: true; balanceAfter: number } | { ok: false; error: string; balance: number }> {
  const amount = Math.max(0, Math.floor(Number(input.amount) || 0));
  if (amount <= 0) {
    const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { tokenBalance: true } });
    return { ok: true, balanceAfter: u?.tokenBalance ?? 0 };
  }

  try {
    const balanceAfter = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { tokenBalance: true },
      });
      if (!user || user.tokenBalance < amount) {
        throw new Error("INSUFFICIENT");
      }
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: { tokenBalance: { decrement: amount } },
      });
      await tx.tokenLedger.create({
        data: {
          userId: input.userId,
          delta: -amount,
          balanceAfter: updated.tokenBalance,
          reason: input.reason,
          meta: asMeta(input.meta),
        },
      });
      return updated.tokenBalance;
    });
    return { ok: true, balanceAfter };
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT") {
      const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { tokenBalance: true } });
      return {
        ok: false,
        error: "Yetersiz jeton. Jeton yükleyip tekrar deneyin.",
        balance: u?.tokenBalance ?? 0,
      };
    }
    throw e;
  }
}

export async function refundTokens(input: {
  userId: string;
  amount: number;
  reason: string;
  meta?: Record<string, unknown>;
}) {
  const amount = Math.max(0, Math.floor(Number(input.amount) || 0));
  if (amount <= 0) return;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { tokenBalance: { increment: amount } },
    });
    await tx.tokenLedger.create({
      data: {
        userId: input.userId,
        delta: amount,
        balanceAfter: updated.tokenBalance,
        reason: input.reason,
        meta: asMeta(input.meta),
      },
    });
  });
}
