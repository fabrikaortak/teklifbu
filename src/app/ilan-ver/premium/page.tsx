import { redirect } from "next/navigation";

/** Premium kapasite ilan formu — genel ilan-ver akışına kind=premium ile bağlanır */
export default function PremiumListingCreatePage() {
  redirect("/ilan-ver?kind=premium");
}
