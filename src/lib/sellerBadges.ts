export const SELLER_REVIEW_RULES_TEXT = [
  "Küfür, hakaret, izinsiz saldırı veya aşağılayıcı / rencide edici ifadeler yasaktır.",
  "Fiyat veya satıcı hakkında küçük düşürücü, iftira niteliğinde yazılar yazılamaz.",
  "Kural ihlali durumunda yorum onaylanmaz; üyeliğiniz sonlandırılabilir.",
  "Bu durumda jeton bakiyeniz iade edilmez.",
].join(" ");

export function memberYearsLabel(memberSince: Date | string | null | undefined): string {
  if (!memberSince) return "Yeni üye";
  const start = new Date(memberSince).getTime();
  if (!Number.isFinite(start)) return "Yeni üye";
  const years = Math.floor((Date.now() - start) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return "Yeni üye";
  return `${years} yıldır üye`;
}

export function isPremiumSellerActive(user: {
  isPremiumSeller?: boolean | null;
  premiumSellerUntil?: Date | string | null;
}): boolean {
  if (!user.isPremiumSeller) return false;
  if (!user.premiumSellerUntil) return true;
  return new Date(user.premiumSellerUntil).getTime() > Date.now();
}
