import { prisma } from "@/lib/db";

/** 12 haneli benzersiz ilan numarası (yalnızca rakam). */
export async function generateListingNo(): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    let no = "";
    for (let i = 0; i < 12; i++) {
      no += String(Math.floor(Math.random() * 10));
    }
    // İlk hane 0 olmasın (görünürlük / arama)
    if (no[0] === "0") no = String(1 + Math.floor(Math.random() * 9)) + no.slice(1);

    const exists = await prisma.listing.findUnique({
      where: { listingNo: no },
      select: { id: true },
    });
    if (!exists) return no;
  }
  throw new Error("İlan numarası üretilemedi");
}

export function normalizeListingNoQuery(raw: string) {
  return String(raw || "").replace(/\D/g, "");
}

export function isListingNoQuery(raw: string) {
  const digits = normalizeListingNoQuery(raw);
  return digits.length === 12;
}

export function formatListingNo(no?: string | null) {
  const d = normalizeListingNoQuery(no || "");
  if (d.length !== 12) return no || "—";
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)}`;
}
