import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";

export async function createAndSendOtp(phone: string, userId?: string) {
  const provider = await getSetting<string>("otp_provider", "dev");
  const devCode = await getSetting<string>("otp_dev_code", "1234");
  const code = provider === "dev" ? devCode : String(Math.floor(1000 + Math.random() * 9000));

  await prisma.otpCode.updateMany({
    where: { phone, consumed: false },
    data: { consumed: true },
  });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpCode.create({
    data: { phone, code, expiresAt, userId },
  });

  // SMS provider hook (later): if provider === 'sms' call gateway
  return {
    ok: true,
    provider,
    // Dev only: UI can show hint; production SMS won't return code
    previewCode: provider === "dev" ? code : undefined,
  };
}

export async function verifyOtp(phone: string, code: string) {
  const row = await prisma.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.code !== code) return { ok: false as const, error: "Geçersiz veya süresi dolmuş kod" };
  await prisma.otpCode.update({ where: { id: row.id }, data: { consumed: true } });
  return { ok: true as const };
}
