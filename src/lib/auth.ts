import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "teklifbu_session";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "teklifbu-dev-secret");
}

export type SessionUser = {
  id: string;
  phone: string;
  name: string | null;
  role: "USER" | "ADMIN";
  accountType: string;
  tokenBalance: number;
  commercialSubtypes?: string[];
};

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/** Ticari onay bekleyen üye giriş yapabilir; ilan vb. ayrı guard ile kısıtlanır */
export function canAccessAccount(user: {
  isActive: boolean;
  role: string;
  accountType: string;
  commercialStatus?: string | null;
}) {
  if (user.isActive) return true;
  if (user.role === "ADMIN") return true;
  const t = String(user.accountType || "").toUpperCase();
  const st = String(user.commercialStatus || "").toUpperCase();
  return (t === "TICARI" || t === "EMLAKCI" || t === "GALERICI") && st === "PENDING";
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !canAccessAccount(user)) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
