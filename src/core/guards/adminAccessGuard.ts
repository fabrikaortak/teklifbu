import {
  canAccessAdminPanel,
  hasAdminAction,
  hasAdminMenu,
  hasAdminVertical,
  hasSettingGroup,
  isFullAdminRole,
  normalizeAdminPermissions,
  type AdminActionKey,
  type AdminMenuKey,
  type AdminPermissions,
  ADMIN_API_ACTION_PERMISSION,
  ADMIN_GET_VIEW_PERMISSION,
} from "@/lib/adminPermissions";
import { requireUser, type SessionUser } from "@/lib/auth";

export type AdminActor = {
  id: string;
  phone: string;
  name: string | null;
  role: string;
  permissions: AdminPermissions;
  isSuperAdmin: boolean;
};

export async function requireAdminAccess(): Promise<AdminActor> {
  const user = await requireUser();
  if (!canAccessAdminPanel(user.role)) throw new Error("FORBIDDEN");
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    permissions: isFullAdminRole(user.role)
      ? { menus: [], verticals: [], actions: [], settingGroups: [] }
      : normalizeAdminPermissions(user.adminPermissions),
    isSuperAdmin: isFullAdminRole(user.role),
  };
}

export function assertAdminAction(actor: AdminActor, action: AdminActionKey) {
  if (actor.isSuperAdmin) return;
  if (!hasAdminAction(actor.role, actor.permissions, action)) {
    throw new Error("FORBIDDEN");
  }
}

export function assertAdminMenu(actor: AdminActor, menu: AdminMenuKey) {
  if (actor.isSuperAdmin) return;
  if (!hasAdminMenu(actor.role, actor.permissions, menu)) {
    throw new Error("FORBIDDEN");
  }
}

export function assertAdminVertical(actor: AdminActor, vertical: string | null | undefined) {
  if (actor.isSuperAdmin || !vertical) return;
  if (!hasAdminVertical(actor.role, actor.permissions, vertical)) {
    throw new Error("FORBIDDEN");
  }
}

export function assertCanSaveSettingGroup(actor: AdminActor, group: string) {
  if (actor.isSuperAdmin) return;
  assertAdminAction(actor, "settings.write");
  if (!hasSettingGroup(actor.role, actor.permissions, group)) {
    throw new Error("FORBIDDEN");
  }
}

export function assertApiActionAllowed(actor: AdminActor, apiAction: string) {
  if (actor.isSuperAdmin) return;
  const need = ADMIN_API_ACTION_PERMISSION[apiAction];
  if (!need) {
    throw new Error("FORBIDDEN");
  }
  const needs = Array.isArray(need) ? need : [need];
  const ok = needs.some((a) => hasAdminAction(actor.role, actor.permissions, a));
  if (!ok) throw new Error("FORBIDDEN");
}

export function assertGetViewAllowed(actor: AdminActor, view: string | null) {
  if (actor.isSuperAdmin || !view) return;
  const rule = ADMIN_GET_VIEW_PERMISSION[view];
  if (!rule) {
    // Bilinmeyen view: dikey listeleri vs. — en az bir menü veya işlem gerekir
    if (actor.permissions.menus.length === 0 && actor.permissions.actions.length === 0) {
      throw new Error("FORBIDDEN");
    }
    return;
  }
  if (rule.any) return;
  const menuOk = (rule.menus || []).some((m) => hasAdminMenu(actor.role, actor.permissions, m));
  const actionOk = (rule.actions || []).some((a) =>
    hasAdminAction(actor.role, actor.permissions, a)
  );
  if (!menuOk && !actionOk) throw new Error("FORBIDDEN");
}

export function filterSettingKeysForActor(
  actor: AdminActor,
  meta: Record<string, { group?: string }>
): Set<string> | null {
  if (actor.isSuperAdmin) return null;
  const allowed = new Set<string>();
  for (const [key, m] of Object.entries(meta || {})) {
    const g = String(m?.group || "");
    if (hasSettingGroup(actor.role, actor.permissions, g)) allowed.add(key);
  }
  return allowed;
}

export function actorToClient(actor: AdminActor) {
  return {
    id: actor.id,
    name: actor.name,
    role: actor.role,
    isSuperAdmin: actor.isSuperAdmin,
    permissions: actor.isSuperAdmin ? { full: true as const } : actor.permissions,
  };
}

export function sessionCanAccessAdmin(session: SessionUser | null) {
  return Boolean(session && canAccessAdminPanel(session.role));
}
