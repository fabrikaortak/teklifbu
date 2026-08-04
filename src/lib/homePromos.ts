export type HomePromoSlide = {
  id: string;
  title: string;
  imageUrl: string;
  /** Boşsa tıklanmaz */
  href: string;
};

export function parsePromoBody(body: string): Omit<HomePromoSlide, "id" | "title"> {
  const raw = String(body || "").trim();
  let imageUrl = "";
  let href = "";

  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      imageUrl = String(j.imageUrl || j.image || "");
      const h = j.hrefPrimary ?? j.href;
      if (h != null && String(h).trim()) href = String(h).trim();
    } catch {
      imageUrl = raw;
    }
  } else if (raw.startsWith("/") || raw.startsWith("http")) {
    imageUrl = raw;
  }

  return { imageUrl, href };
}
