import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const DEFAULT_TENANT_SLUG = "teklifbu";

/** Ensure default SaaS tenant exists and backfill orphan users/listings. */
export async function ensureDefaultTenant(ownerId?: string) {
  let tenant = await prisma.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });

  if (!tenant) {
    let owner =
      (ownerId && (await prisma.user.findUnique({ where: { id: ownerId } }))) ||
      (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ||
      (await prisma.user.findFirst());

    if (!owner) {
      throw new Error("Tenant oluşturulamadı: kullanıcı yok");
    }

    tenant = await prisma.tenant.create({
      data: {
        name: "TeklifBu",
        slug: DEFAULT_TENANT_SLUG,
        ownerId: owner.id,
        plan: "standard",
        isActive: true,
      },
    });
  }

  // Sadece gerçekten tenant’sız kayıt varsa backfill — her istekte full tablo updateMany yapma
  const [orphanUser, orphanListing, orphanPayment] = await Promise.all([
    prisma.user.findFirst({ where: { tenantId: null }, select: { id: true } }),
    prisma.listing.findFirst({ where: { tenantId: null }, select: { id: true } }),
    prisma.payment.findFirst({ where: { tenantId: null }, select: { id: true } }),
  ]);
  if (orphanUser) {
    await prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
  }
  if (orphanListing) {
    await prisma.listing.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
  }
  if (orphanPayment) {
    await prisma.payment.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
  }

  return tenant;
}

export async function getTenantBySlug(slug = DEFAULT_TENANT_SLUG) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (tenant) return tenant;
  return ensureDefaultTenant();
}

export async function getTenantContextForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      ownedShops: { include: { subscription: { include: { package: true } } } },
      shopSubscription: { include: { package: true, shop: true } },
    },
  });
  if (!user) return null;

  const tenant = user.tenant || (await ensureDefaultTenant(user.id));
  if (!user.tenantId) {
    await prisma.user.update({ where: { id: user.id }, data: { tenantId: tenant.id } });
  }

  return { user, tenant, shops: user.ownedShops };
}

/** Create or return corporate shop for TICARI under tenant. */
export async function ensureUserShop(userId: string) {
  const ctx = await getTenantContextForUser(userId);
  if (!ctx) throw new Error("USER_NOT_FOUND");
  const { user, tenant } = ctx;

  const { isCorporateAccount } = await import("@/lib/accountTypes");
  if (!isCorporateAccount(user.accountType)) {
    return { shop: null, tenant, user };
  }

  const desiredName = resolveCorporateShopName(user);

  let shop = await prisma.shop.findUnique({
    where: { tenantId_ownerId: { tenantId: tenant.id, ownerId: user.id } },
    include: { subscription: { include: { package: true } } },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        tenantId: tenant.id,
        ownerId: user.id,
        accountType:
          user.accountType === "TICARI" || user.accountType === "BIREYSEL_TICARI"
            ? user.accountType
            : "TICARI",
        name: desiredName,
        phone: user.phone,
        isActive: true,
      },
      include: { subscription: { include: { package: true } } },
    });
  } else if (shouldReplaceAutoShopName(shop.name, user, desiredName) && shop.name !== desiredName) {
    shop = await prisma.shop.update({
      where: { id: shop.id },
      data: { name: desiredName },
      include: { subscription: { include: { package: true } } },
    });
  }

  return { shop, tenant, user };
}

/** Ticari unvan / şirket adı → mağaza adı */
export function resolveCorporateShopName(user: {
  name?: string | null;
  profile?: unknown;
}): string {
  const profile =
    user.profile && typeof user.profile === "object" && !Array.isArray(user.profile)
      ? (user.profile as Record<string, unknown>)
      : {};
  const title = String(profile.commercialTitle || profile.companyName || "").trim();
  if (title) return title;
  const personal = String(user.name || "").trim();
  if (personal) return `${personal} Ofisi`;
  return "Ticari Mağaza";
}

/** Otomatik üretilmiş mağaza adı mı? (şirket adı ile değiştirilebilir) */
function shouldReplaceAutoShopName(
  currentName: string,
  user: { name?: string | null },
  desiredName: string
): boolean {
  const cur = String(currentName || "").trim();
  const desired = String(desiredName || "").trim();
  if (!desired || cur === desired) return false;
  if (cur === "Ticari Mağaza" || !cur) return true;
  const personal = String(user.name || "").trim();
  if (personal && cur === `${personal} Ofisi`) return true;
  // "... Ofisi" kalıbı + şirket adı farklıysa güncelle
  if (cur.endsWith(" Ofisi") && desired !== cur && !desired.endsWith(" Ofisi")) return true;
  return false;
}

/** Profildeki şirket adını mağazaya yansıt (ticari onay / form kaydı sonrası) */
export async function syncShopNameFromUserProfile(userId: string) {
  try {
    await ensureUserShop(userId);
  } catch {
    /* bireysel vb. */
  }
}

export async function writeAuditLog(input: {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId || undefined,
        actorId: input.actorId || undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || undefined,
        meta: (input.meta as Prisma.InputJsonValue) || undefined,
      },
    });
  } catch {
    /* never block business flow on audit failure */
  }
}
