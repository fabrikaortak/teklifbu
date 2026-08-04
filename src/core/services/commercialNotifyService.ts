import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { notifyUser } from "@/core/notify";
import { writeAuditLog } from "@/core/services/tenantService";

type NotifyKind = "approved" | "rejected";

/** Ticari onay/red sonrası e-posta + SMS altyapısı (demo veya gerçek). */
export async function sendCommercialApprovalNotify(
  userId: string,
  kind: NotifyKind,
  note?: string | null
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, email: true, name: true, tenantId: true },
  });
  if (!user) return { ok: false as const, error: "Kullanıcı yok" };

  const [demoMode, emailOn, smsOn] = await Promise.all([
    getSetting<boolean>("commercial_notify_demo_mode", true),
    getSetting<boolean>("commercial_approval_notify_email", true),
    getSetting<boolean>("commercial_approval_notify_sms", true),
  ]);

  const title =
    kind === "approved" ? "Ticari üyeliğiniz onaylandı" : "Ticari üyelik başvurunuz reddedildi";
  const body =
    kind === "approved"
      ? "Ticari hesabınız yönetici tarafından onaylandı. İlan verebilir ve premium dikeyleri kullanabilirsiniz."
      : `Ticari üyelik başvurunuz reddedildi.${note ? ` Not: ${note}` : ""}`;

  // Uygulama içi bildirim (aktif olmasa da onayda isActive true olacak)
  try {
    await notifyUser(user.id, {
      title,
      body,
      eventKey: kind === "approved" ? "commercial_approved" : "commercial_rejected",
      link: "/hesabim?s=ayarlar",
    });
  } catch (e) {
    console.warn("commercial in-app notify", e);
  }

  const channels: string[] = [];
  if (emailOn && user.email) channels.push("EMAIL");
  if (smsOn && user.phone) channels.push("SMS");

  if (demoMode) {
    console.info("[commercial-notify:DEMO]", {
      userId: user.id,
      phone: user.phone,
      email: user.email,
      kind,
      channels,
      title,
      body,
    });
    await writeAuditLog({
      tenantId: user.tenantId,
      actorId: null,
      action: `commercial_notify_demo_${kind}`,
      entity: "User",
      entityId: user.id,
      meta: { channels, title, demo: true },
    });
    return { ok: true as const, demo: true, channels };
  }

  // Gerçek sağlayıcı kancaları (şimdilik log + audit — SMS/e-posta provider bağlanınca buraya)
  if (emailOn && user.email) {
    console.info("[commercial-notify:EMAIL]", { to: user.email, title, body });
    // TODO: integrate mail provider
  }
  if (smsOn && user.phone) {
    console.info("[commercial-notify:SMS]", { to: user.phone, body });
    // TODO: integrate SMS provider
  }

  await writeAuditLog({
    tenantId: user.tenantId,
    actorId: null,
    action: `commercial_notify_${kind}`,
    entity: "User",
    entityId: user.id,
    meta: { channels, title, demo: false },
  });

  return { ok: true as const, demo: false, channels };
}
