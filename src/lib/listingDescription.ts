/** İlan açıklaması: hafif biçim (B/I/U) + iletişim/link engeli */

const ALLOWED_LINK_HOSTS = new Set(["teklifbu.com", "www.teklifbu.com"]);

export type DescriptionViolation =
  | "phone"
  | "email"
  | "link";

export type DescriptionCheckResult = {
  ok: boolean;
  error?: string;
  violations: DescriptionViolation[];
};

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Textarea seçimine ** / * / __ sarar */
export function wrapDescriptionSelection(
  value: string,
  start: number,
  end: number,
  kind: "bold" | "italic" | "underline"
): { value: string; selectionStart: number; selectionEnd: number } {
  const before = value.slice(0, start);
  const selected = value.slice(start, end) || "metin";
  const after = value.slice(end);
  const [open, close] =
    kind === "bold" ? ["**", "**"] : kind === "italic" ? ["*", "*"] : ["__", "__"];
  const next = `${before}${open}${selected}${close}${after}`;
  const selectionStart = before.length + open.length;
  const selectionEnd = selectionStart + selected.length;
  return { value: next, selectionStart, selectionEnd };
}

/**
 * Saklanan metni güvenli HTML’e çevir (**kalın** *italik* __altı çizili__).
 * Başka HTML etiketleri kaçışlanır.
 */
export function renderListingDescriptionHtml(raw: string): string {
  let s = escapeHtml(String(raw || ""));
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<u>$1</u>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/\r\n|\r|\n/g, "<br/>");
  return s;
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

/** Boşluk/tire ile yazılmış TR telefonları da yakalar */
export function descriptionHasPhone(text: string): boolean {
  const s = String(text || "");
  // +90 / 0xxx … toplam ≥10 rakam, arada boşluk/işaret olabilir
  const chunks = s.match(/(?:\+?\d[\d\s().\-]{7,}\d)/g) || [];
  for (const c of chunks) {
    const d = digitsOnly(c);
    if (d.length < 10) continue;
    // TR cep/sabit: 05…, 5…, 90…, 0… 
    if (/^(90)?0?5\d{9}$/.test(d)) return true;
    if (/^(90)?0?[2-4]\d{8,}$/.test(d) && d.length >= 10 && d.length <= 13) return true;
    if (d.length >= 10 && d.length <= 13) return true;
  }
  // "0 5 3 2 …" gibi tek tek rakamlar
  const spaced = s.match(/(?:(?:\+?\d)[\s().\-]*){10,}/g) || [];
  for (const c of spaced) {
    const d = digitsOnly(c);
    if (d.length >= 10 && d.length <= 15) return true;
  }
  return false;
}

export function descriptionHasEmail(text: string): boolean {
  return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(String(text || ""));
}

function hostFromUrlLike(raw: string): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    return u.hostname.toLowerCase().replace(/^www\./, "") === "teklifbu.com"
      ? u.hostname.toLowerCase()
      : u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedTeklifbuHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  if (ALLOWED_LINK_HOSTS.has(h)) return true;
  // www’siz kontrol
  const bare = h.replace(/^www\./, "");
  return bare === "teklifbu.com";
}

/** http(s), www, domain.tld — teklifbu dışında yasak */
export function descriptionHasBlockedLink(text: string): boolean {
  const s = String(text || "");
  const candidates = new Set<string>();

  for (const m of s.match(/https?:\/\/[^\s<>"']+/gi) || []) candidates.add(m);
  for (const m of s.match(/\bwww\.[^\s<>"']+/gi) || []) candidates.add(m);
  // çıplak domain (mail @ kısmını atlamak için @ öncesi bakma)
  for (const m of s.match(/(?<![@\w])(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|me|tv|xyz|app|dev|tr|com\.tr|net\.tr)(?:\/[^\s<>"']*)?/gi) || []) {
    candidates.add(m);
  }

  for (const c of candidates) {
    if (/[a-zA-Z0-9._%+-]+@/.test(c)) continue; // e-posta parçası
    const host = hostFromUrlLike(c);
    if (!host) continue;
    if (!isAllowedTeklifbuHost(host)) return true;
  }
  return false;
}

/** AI’dan gelen açıklamadaki telefon/mail/dış linkleri temizle (import için) */
export function stripContactFromAiDescription(text: string): string {
  let s = String(text || "");
  s = s.replace(/(?:\+?\d[\d\s().\-]{7,}\d)/g, " ");
  s = s.replace(/(?:(?:\+?\d)[\s().\-]*){10,}/g, " ");
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ");
  s = s.replace(/https?:\/\/[^\s<>"']+/gi, (m) =>
    /teklifbu\.com/i.test(m) ? m : " "
  );
  s = s.replace(/\bwww\.(?!teklifbu\.com)[^\s<>"']+/gi, " ");
  s = s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

export function validateListingDescription(text: string): DescriptionCheckResult {
  const violations: DescriptionViolation[] = [];
  if (descriptionHasPhone(text)) violations.push("phone");
  if (descriptionHasEmail(text)) violations.push("email");
  if (descriptionHasBlockedLink(text)) violations.push("link");

  if (!violations.length) return { ok: true, violations };

  const parts: string[] = [];
  if (violations.includes("phone")) parts.push("telefon numarası");
  if (violations.includes("email")) parts.push("e-posta adresi");
  if (violations.includes("link")) parts.push("TeklifBu dışı link");
  return {
    ok: false,
    violations,
    error: `Açıklamada ${parts.join(", ")} kullanılamaz. İletişim teklif sonrası platform üzerinden açılır.`,
  };
}
