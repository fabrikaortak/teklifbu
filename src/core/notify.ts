import { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettingsMap } from "@/core/settings";
import { isNotificationEventEnabled, mergeNotificationPrefs } from "@/lib/notificationPrefs";

export async function notifyUser(
  userId: string,
  payload: { title: string; body: string; eventKey: string; link?: string }
) {
  const settings = await getSettingsMap();
  const events = (settings.notification_events as Record<string, boolean>) || {};
  if (events[payload.eventKey] === false) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true, isActive: true },
  });
  if (!user || user.isActive === false) return;

  const prefs = mergeNotificationPrefs(user.notificationPrefs);
  if (!isNotificationEventEnabled(prefs, payload.eventKey)) return;

  const channels = (settings.notification_channels as Record<string, boolean>) || {};
  if (channels.IN_APP !== false) {
    await prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        eventKey: payload.eventKey,
        link: payload.link,
        channel: NotificationChannel.IN_APP,
      },
    });
  }
  // EMAIL / SMS / PUSH hooks reserved for later providers
}
