import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createAndSendOtp, verifyOtp } from "@/core/otp";
import { createSessionToken, setSessionCookie, clearSessionCookie, getSession } from "@/lib/auth";

function normalizePhone(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `0${d}`;
  return d;
}

function isEmail(value: string) {
  return value.includes("@");
}

async function issueSession(user: {
  id: string;
  phone: string;
  name: string | null;
  role: "USER" | "ADMIN";
  accountType: string;
  tokenBalance: number;
  commercialSubtypes?: string[];
}) {
  const token = await createSessionToken({
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    accountType: user.accountType,
    tokenBalance: user.tokenBalance,
    commercialSubtypes: user.commercialSubtypes || [],
  });
  await setSessionCookie(token);
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    accountType: user.accountType,
    tokenBalance: user.tokenBalance,
    commercialSubtypes: user.commercialSubtypes || [],
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      accountType: true,
      commercialSubtypes: true,
      commercialStatus: true,
      tokenBalance: true,
      avatarUrl: true,
      phoneVerified: true,
      memberSince: true,
      profile: true,
    },
  });
  return NextResponse.json({ user });
}

const registerSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  name: z.string().min(2, "Ad soyad gerekli"),
  email: z.string().optional(),
  accountType: z.enum(["BIREYSEL_TICARI", "TICARI"]).optional(),
  commercialSubtypes: z.array(z.string().min(1).max(40)).optional(),
  commercialProfile: z.record(z.string(), z.string()).optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const action = body.action as string;

  if (action === "logout") {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }

  // Yeni üyelik: OTP gönder (üye olmayanlar için)
  if (action === "register-request-otp" || action === "request-otp") {
    try {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Geçersiz bilgi" },
          { status: 400 }
        );
      }

      const phone = normalizePhone(parsed.data.phone);
      const emailRaw = parsed.data.email?.trim() || "";
      if (emailRaw && !emailRaw.includes("@")) {
        return NextResponse.json({ error: "Geçersiz e-posta" }, { status: 400 });
      }
      const email = emailRaw ? emailRaw.toLowerCase() : null;
      const passwordHash = await bcrypt.hash(parsed.data.password, 10);

      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing?.phoneVerified && existing.passwordHash) {
        return NextResponse.json(
          { error: "Bu telefon zaten kayıtlı. Lütfen giriş yapın." },
          { status: 409 }
        );
      }

      if (email) {
        const emailOwner = await prisma.user.findFirst({ where: { email } });
        if (emailOwner && emailOwner.phone !== phone) {
          return NextResponse.json({ error: "Bu e-posta başka bir hesaba ait" }, { status: 409 });
        }
      }

      const accountType = parsed.data.accountType || "BIREYSEL_TICARI";
      const { getSetting } = await import("@/core/settings");
      const { parseCommercialSubtypes } = await import("@/lib/accountTypes");
      const {
        COMMERCIAL_BUSINESS_TYPES_SETTING_KEY,
        allowedBusinessTypeKeys,
      } = await import("@/lib/commercialBusinessTypes");
      const bizRaw = await getSetting(COMMERCIAL_BUSINESS_TYPES_SETTING_KEY, null);
      const allowedKeys = allowedBusinessTypeKeys(bizRaw, true);
      const commercialSubtypes =
        accountType === "TICARI"
          ? parseCommercialSubtypes(parsed.data.commercialSubtypes || [], allowedKeys)
          : [];
      if (accountType === "TICARI" && commercialSubtypes.length === 0) {
        return NextResponse.json(
          { error: "Ticari üyelikte en az bir faaliyet alanı seçmelisiniz." },
          { status: 400 }
        );
      }

      let profileData: Record<string, string> | undefined;
      let commercialStatus: string | null = null;
      let isActive = true;
      if (accountType === "TICARI") {
        const { parseCommercialProfile, validateCommercialProfile, mergeCommercialIntoProfile } =
          await import("@/data/commercialProfile");
        const commercial = parseCommercialProfile(parsed.data.commercialProfile || {});
        const cerr = validateCommercialProfile(commercial);
        if (cerr) return NextResponse.json({ error: cerr }, { status: 400 });
        profileData = mergeCommercialIntoProfile({}, commercial);
        const { getSetting } = await import("@/core/settings");
        const approvalRequired =
          (await getSetting<boolean>("commercial_approval_required", true)) !== false;
        commercialStatus = approvalRequired ? "PENDING" : "APPROVED";
        isActive = !approvalRequired;
      }

      const user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: parsed.data.name,
              email,
              passwordHash,
              accountType,
              commercialSubtypes,
              commercialStatus,
              isActive,
              ...(profileData ? { profile: profileData } : { profile: undefined }),
              phoneVerified: false,
            },
          })
        : await prisma.user.create({
            data: {
              phone,
              name: parsed.data.name,
              email,
              passwordHash,
              accountType,
              commercialSubtypes,
              commercialStatus,
              isActive,
              ...(profileData ? { profile: profileData } : {}),
              phoneVerified: false,
            },
          });

      const otp = await createAndSendOtp(phone, user.id);
      return NextResponse.json({
        ok: true,
        previewCode: otp.previewCode,
        message:
          otp.provider === "dev"
            ? `Geliştirme OTP: ${otp.previewCode}`
            : "Doğrulama kodu gönderildi",
      });
    } catch (e) {
      console.error("register-request-otp failed", e);
      const msg = e instanceof Error ? e.message : "Kod gönderilemedi";
      return NextResponse.json(
        {
          error: msg.includes("Unique")
            ? "Bu telefon veya e-posta zaten kayıtlı"
            : "Kod gönderilirken sunucu hatası",
        },
        { status: 500 }
      );
    }
  }

  // Yeni üyelik: OTP doğrula → oturum aç
  if (action === "register-verify-otp" || action === "verify-otp") {
    const phone = normalizePhone(String(body.phone || ""));
    const code = String(body.code || "");
    const result = await verifyOtp(phone, code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Kayıt bulunamadı. Üye ol adımını tekrarlayın." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });

    const sessionUser = await issueSession(updated);
    return NextResponse.json({ ok: true, user: sessionUser });
  }

  // Mevcut üye girişi: telefon veya e-posta + şifre (OTP yok)
  if (action === "login" || action === "admin-login") {
    const parsed = loginSchema.safeParse({
      identifier: body.identifier ?? body.phone ?? body.email,
      password: body.password,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Telefon/e-posta ve şifre gerekli" }, { status: 400 });
    }

    try {
      const raw = parsed.data.identifier.trim();
      const user = isEmail(raw)
        ? await prisma.user.findFirst({ where: { email: raw.toLowerCase() } })
        : await prisma.user.findUnique({ where: { phone: normalizePhone(raw) } });

      if (!user || !user.passwordHash) {
        return NextResponse.json(
          { error: "Bu bilgilerle kayıtlı üye bulunamadı. Önce üye olun." },
          { status: 401 }
        );
      }

      if (!user.phoneVerified) {
        return NextResponse.json(
          {
            error:
              "Telefon doğrulaması tamamlanmamış. Üye ol sekmesinden OTP ile doğrulayın.",
          },
          { status: 403 }
        );
      }

      if (!user.isActive) {
        const t = String(user.accountType || "").toUpperCase();
        const st = String(user.commercialStatus || "").toUpperCase();
        const pendingCommercial =
          (t === "TICARI" || t === "EMLAKCI" || t === "GALERICI") && st === "PENDING";
        if (!pendingCommercial) {
          const { getSetting } = await import("@/core/settings");
          const footer = (await getSetting<Record<string, unknown>>("site_footer", {})) || {};
          const phone = String(footer.phone || "0216 606 60 00").trim();
          const phoneLabel = String(footer.phoneLabel || "Müşteri Hizmetleri").trim();
          return NextResponse.json(
            {
              error: "Hesabınız yönetici tarafından pasifleştirilmiştir.",
              code: "ACCOUNT_DISABLED",
              contact: { phone, phoneLabel },
            },
            { status: 403 }
          );
        }
      }

      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "Hatalı şifre" }, { status: 401 });

      const sessionUser = await issueSession(user);
      return NextResponse.json({ ok: true, user: sessionUser });
    } catch (e) {
      console.error("login failed", e);
      const msg = e instanceof Error ? e.message : "Giriş başarısız";
      if (msg.includes("AccountType") || msg.includes("BIREYSEL_TICARI") || msg.includes("TICARI")) {
        return NextResponse.json(
          {
            error:
              "Sunucu şema güncellemesi bekliyor. Lütfen geliştirme sunucusunu yeniden başlatın (prisma generate).",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Giriş sırasında sunucu hatası" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Bilinmeyen aksiyon" }, { status: 400 });
}
