import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  normalizeAdminPermissions,
  type AdminPermissions,
} from "@/lib/adminPermissions";
import { writeAuditLog } from "@/core/services/tenantService";

export type StaffListRow = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  adminPermissions: AdminPermissions;
  memberSince: Date;
  updatedAt: Date;
};

export async function listStaffUsers(): Promise<StaffListRow[]> {
  const rows = await prisma.user.findMany({
    where: { role: UserRole.STAFF },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      adminPermissions: true,
      memberSince: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    role: String(r.role),
    adminPermissions: normalizeAdminPermissions(r.adminPermissions),
  }));
}

export async function searchUsersForStaffAssign(q: string, take = 20) {
  const term = String(q || "").trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  return prisma.user.findMany({
    where: {
      role: { in: [UserRole.USER, UserRole.STAFF] },
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    take,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      adminPermissions: true,
    },
  });
}

export async function saveStaffUser(input: {
  userId: string;
  permissions: unknown;
  actorId: string;
  tenantId: string;
}) {
  const userId = String(input.userId || "").trim();
  if (!userId) throw new Error("userId gerekli");
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new Error("Kullanıcı bulunamadı");
  if (existing.role === UserRole.ADMIN) {
    throw new Error("Süper admin rolü bu ekrandan değiştirilemez");
  }
  const permissions = normalizeAdminPermissions(input.permissions);
  if (
    permissions.menus.length === 0 &&
    permissions.actions.length === 0 &&
    permissions.verticals.length === 0
  ) {
    throw new Error("En az bir menü, dikey veya işlem yetkisi seçin");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: UserRole.STAFF,
      adminPermissions: permissions as object,
      isActive: true,
    },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      adminPermissions: true,
    },
  });
  await writeAuditLog({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "staff.save",
    entity: "User",
    entityId: userId,
    meta: {
      menus: permissions.menus,
      verticals: permissions.verticals,
      actions: permissions.actions,
      settingGroups: permissions.settingGroups,
    },
  });
  return {
    ...updated,
    role: String(updated.role),
    adminPermissions: normalizeAdminPermissions(updated.adminPermissions),
  };
}

export async function revokeStaffUser(input: {
  userId: string;
  actorId: string;
  tenantId: string;
}) {
  const userId = String(input.userId || "").trim();
  if (!userId) throw new Error("userId gerekli");
  if (userId === input.actorId) throw new Error("Kendi yetkinizi kaldıramazsınız");
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new Error("Kullanıcı bulunamadı");
  if (existing.role !== UserRole.STAFF) {
    throw new Error("Kullanıcı alt yönetici değil");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: UserRole.USER,
      adminPermissions: null,
    },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
  await writeAuditLog({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "staff.revoke",
    entity: "User",
    entityId: userId,
  });
  return { ...updated, role: String(updated.role) };
}
