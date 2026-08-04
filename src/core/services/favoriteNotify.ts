import { prisma } from "@/lib/db";
import { notifyUser } from "@/core/notify";

/** İlanı favorileyen kullanıcılara bildirim (satıcı hariç). */
export async function notifyListingFavoriters(
  listingId: string,
  payload: { title: string; body: string; eventKey: string; link?: string },
  opts?: { excludeUserIds?: string[] }
) {
  const favs = await prisma.favorite.findMany({
    where: { listingId },
    select: { userId: true },
  });
  const exclude = new Set(opts?.excludeUserIds || []);
  const userIds = [...new Set(favs.map((f) => f.userId).filter((id) => !exclude.has(id)))];
  await Promise.all(userIds.map((userId) => notifyUser(userId, payload)));
  return userIds.length;
}
