export type HomeVisibilitySlide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  ctaOutline: string;
  ctaPrimary: string;
  hrefOutline: string;
  hrefPrimary: string;
};

export function parseBannerBody(body: string): Omit<HomeVisibilitySlide, "id" | "title"> {
  const raw = String(body || "").trim();
  let imageUrl = "";
  let subtitle = "Vitrin & Premium ile ilanınızı öne çıkarın.";
  let href = "/ilan-ver";
  let ctaOutline = "Vitrin İlan";
  let ctaPrimary = "Premium İlan";
  let hrefOutline = "/ilan-ver";
  let hrefPrimary = "/ilan-ver";

  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      imageUrl = String(j.imageUrl || j.image || "");
      if (j.subtitle) subtitle = String(j.subtitle);
      if (j.href) href = String(j.href);
      if (j.ctaOutline) ctaOutline = String(j.ctaOutline);
      if (j.ctaPrimary) ctaPrimary = String(j.ctaPrimary);
      if (j.hrefOutline) hrefOutline = String(j.hrefOutline);
      if (j.hrefPrimary) hrefPrimary = String(j.hrefPrimary);
      else if (j.href) hrefPrimary = String(j.href);
    } catch {
      imageUrl = raw;
    }
  } else if (raw.startsWith("/") || raw.startsWith("http")) {
    imageUrl = raw;
  }

  return {
    subtitle,
    imageUrl,
    href,
    ctaOutline,
    ctaPrimary,
    hrefOutline,
    hrefPrimary: hrefPrimary || href,
  };
}
