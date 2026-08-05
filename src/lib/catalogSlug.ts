/** Türkçe-dostu slug */
export function catalogSlugify(input: string): string {
  return String(input || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isShoppingCategorySlug(slug: string): boolean {
  if (!slug) return false;
  return (
    slug === "ikinci-el" ||
    slug === "sifir-urun" ||
    slug.startsWith("ikinci-el-") ||
    slug.startsWith("sifir-urun-") ||
    slug.startsWith("ikinci-el__") ||
    slug.startsWith("sifir-urun__")
  );
}

/** Alışveriş leaf veya ürün tipi (parent__type) */
export function isShoppingCatalogNodeSlug(slug: string): boolean {
  return isShoppingCategorySlug(slug);
}
