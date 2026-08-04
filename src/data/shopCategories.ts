/** Sahibinden / Hepsiburada tarzı alışveriş alt kategorileri */
export const SHOP_SUBCATEGORIES: Array<{ slug: string; name: string; icon: string; sortOrder: number }> = [
  { slug: "cep-telefonu", name: "Cep Telefonu & Aksesuar", icon: "phone", sortOrder: 1 },
  { slug: "bilgisayar", name: "Bilgisayar", icon: "laptop", sortOrder: 2 },
  { slug: "tablet", name: "Tablet", icon: "tablet", sortOrder: 3 },
  { slug: "tv-goruntu-ses", name: "TV, Görüntü & Ses", icon: "tv", sortOrder: 4 },
  { slug: "beyaz-esya", name: "Beyaz Eşya", icon: "appliance", sortOrder: 5 },
  { slug: "elektrikli-ev-aletleri", name: "Elektrikli Ev Aletleri", icon: "appliance", sortOrder: 6 },
  { slug: "ev-elektronigi", name: "Ev Elektroniği", icon: "plug", sortOrder: 7 },
  { slug: "oyun-konsol", name: "Oyun & Konsol", icon: "game", sortOrder: 8 },
  { slug: "fotograf-kamera", name: "Fotoğraf & Kamera", icon: "camera", sortOrder: 9 },
  { slug: "teknik-elektronik", name: "Teknik Elektronik", icon: "chip", sortOrder: 10 },
  { slug: "giyim-aksesuar", name: "Giyim & Aksesuar", icon: "shirt", sortOrder: 11 },
  { slug: "ayakkabi-canta", name: "Ayakkabı & Çanta", icon: "bag", sortOrder: 12 },
  { slug: "saat-taki", name: "Saat, Takı & Mücevher", icon: "watch", sortOrder: 13 },
  { slug: "kisisel-bakim", name: "Kişisel Bakım & Kozmetik", icon: "spa", sortOrder: 14 },
  { slug: "anne-bebek", name: "Anne & Bebek", icon: "baby", sortOrder: 15 },
  { slug: "ev-dekorasyon", name: "Ev Dekorasyon & Mobilya", icon: "sofa", sortOrder: 16 },
  { slug: "bahce-yapi-market", name: "Bahçe & Yapı Market", icon: "garden", sortOrder: 17 },
  { slug: "spor-outdoor", name: "Spor & Outdoor", icon: "sport", sortOrder: 18 },
  { slug: "hobi-oyuncak", name: "Hobi & Oyuncak", icon: "toy", sortOrder: 19 },
  { slug: "kitap-dergi-film", name: "Kitap, Dergi & Film", icon: "book", sortOrder: 20 },
  { slug: "muzik", name: "Müzik", icon: "music", sortOrder: 21 },
  { slug: "ofis-kirtasiye", name: "Ofis & Kırtasiye", icon: "office", sortOrder: 22 },
  { slug: "antika-koleksiyon", name: "Antika & Koleksiyon", icon: "antique", sortOrder: 23 },
  { slug: "pet-shop", name: "Pet Shop", icon: "pet", sortOrder: 24 },
  { slug: "yiyecek-icecek", name: "Yiyecek & İçecek", icon: "food", sortOrder: 25 },
  { slug: "is-makinesi", name: "İş Makineleri", icon: "crane", sortOrder: 26 },
  { slug: "tarim-makinesi", name: "Tarım Makineleri", icon: "tractor", sortOrder: 27 },
  { slug: "sanayi-makinesi", name: "Sanayi Makineleri", icon: "factory", sortOrder: 28 },
  { slug: "diger-alisveris", name: "Diğer Her Şey", icon: "grid", sortOrder: 29 },
];

export const SHOP_ROOTS = [
  { slug: "ikinci-el", name: "İkinci El", icon: "used", sortOrder: 6 },
  { slug: "sifir-urun", name: "Sıfır", icon: "new", sortOrder: 7 },
] as const;

export function childSlug(rootSlug: string, subSlug: string) {
  return `${rootSlug}-${subSlug}`;
}
