import { redirect } from "next/navigation";
import { getSetting } from "@/core/settings";

/** Alışveriş ilanı: Modern Tema → Hesabım formu; diğerleri → ilan-ver */
export default async function AlisverisListingCreatePage() {
  const template = String(
    (await getSetting<string>("shopping_listing_form_template", "classic")) || "classic"
  );
  if (template === "modern_v1") {
    redirect("/hesabim?s=ilan-ekle");
  }
  redirect("/ilan-ver?kind=alisveris");
}
