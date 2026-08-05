import { redirect } from "next/navigation";

/** Eski konum → yeni Satıcı paneli menüsü */
export default function LegacySaticiPaneliAyarlariRedirect() {
  redirect("/admin/satici-paneli/ayarlar");
}
