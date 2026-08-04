/** Sahibinden tarzı konut ek özellikleri (işaretlenebilir) */

export type HousingExtraGroup = {
  id: string;
  label: string;
  items: Array<{ id: string; label: string }>;
};

export const HOUSING_EXTRA_GROUPS: HousingExtraGroup[] = [
  {
    id: "cephe",
    label: "Cephe",
    items: [
      { id: "cephe_kuzey", label: "Kuzey" },
      { id: "cephe_guney", label: "Güney" },
      { id: "cephe_dogu", label: "Doğu" },
      { id: "cephe_bati", label: "Batı" },
    ],
  },
  {
    id: "ic",
    label: "İç Özellikler",
    items: [
      { id: "adsl", label: "ADSL" },
      { id: "fiber", label: "Fiber İnternet" },
      { id: "wifi", label: "Wi-Fi" },
      { id: "ankastre", label: "Ankastre Mutfak" },
      { id: "amerikan_mutfak", label: "Amerikan Mutfak" },
      { id: "beyaz_esya", label: "Beyaz Eşya" },
      { id: "boyali", label: "Boyalı" },
      { id: "bulasik", label: "Bulaşık Makinesi" },
      { id: "buzdolabi", label: "Buzdolabı" },
      { id: "camasir", label: "Çamaşır Makinesi" },
      { id: "camasir_odasi", label: "Çamaşır Odası" },
      { id: "celik_kapi", label: "Çelik Kapı" },
      { id: "amerikan_kapi", label: "Amerikan Kapı" },
      { id: "dusakabin", label: "Duşakabin" },
      { id: "ebeveyn_banyo", label: "Ebeveyn Banyosu" },
      { id: "giyinme", label: "Giyinme Odası" },
      { id: "gomme_dolap", label: "Gömme Dolap" },
      { id: "goruntulu_diafon", label: "Görüntülü Diafon" },
      { id: "hilton_banyo", label: "Hilton Banyo" },
      { id: "isicam", label: "Isıcam" },
      { id: "jakuzi", label: "Jakuzi" },
      { id: "cam_balkon", label: "Kapalı / Cam Balkon" },
      { id: "kartonpiyer", label: "Kartonpiyer" },
      { id: "kiler", label: "Kiler" },
      { id: "klima", label: "Klima" },
      { id: "mutfak_dogalgazi", label: "Mutfak Doğalgazı" },
      { id: "parke", label: "Parke Zemin" },
      { id: "laminat", label: "Laminat Zemin" },
      { id: "pvc_dograma", label: "PVC Doğrama" },
      { id: "ahsap_dograma", label: "Ahşap Doğrama" },
      { id: "aluminyum_dograma", label: "Alüminyum Doğrama" },
      { id: "seramik", label: "Seramik Zemin" },
      { id: "spot", label: "Spot Aydınlatma" },
      { id: "teras", label: "Teras" },
      { id: "vestiyer", label: "Vestiyer" },
      { id: "sofben", label: "Şofben" },
      { id: "somine", label: "Şömine" },
      { id: "duvar_kagidi", label: "Duvar Kağıdı" },
      { id: "mobilya", label: "Mobilya" },
      { id: "firin", label: "Fırın" },
      { id: "set_ustu_ocak", label: "Set Üstü Ocak" },
      { id: "akilli_ev", label: "Akıllı Ev" },
      { id: "alarm_hirsiz", label: "Alarm (Hırsız)" },
      { id: "alarm_yangin", label: "Alarm (Yangın)" },
    ],
  },
  {
    id: "dis",
    label: "Dış Özellikler",
    items: [
      { id: "asansor", label: "Asansör" },
      { id: "guvenlik", label: "Güvenlik" },
      { id: "kamera", label: "Kamera Sistemi" },
      { id: "kapici", label: "Kapıcı / Görevli" },
      { id: "otopark", label: "Otopark" },
      { id: "kapali_otopark", label: "Kapalı Otopark" },
      { id: "jenerator", label: "Jeneratör" },
      { id: "hidrofor", label: "Hidrofor" },
      { id: "su_deposu", label: "Su Deposu" },
      { id: "isi_yalitim", label: "Isı Yalıtımı" },
      { id: "ses_yalitim", label: "Ses Yalıtımı" },
      { id: "yangin_merdiven", label: "Yangın Merdiveni" },
      { id: "oyun_parki", label: "Çocuk Oyun Parkı" },
      { id: "spor_alani", label: "Spor Alanı" },
      { id: "yuzme_acik", label: "Yüzme Havuzu (Açık)" },
      { id: "yuzme_kapali", label: "Yüzme Havuzu (Kapalı)" },
      { id: "mustakil_havuz", label: "Müstakil Havuzlu" },
      { id: "tenis", label: "Tenis Kortu" },
      { id: "engelli", label: "Engelliye Uygun" },
      { id: "kablo_tv", label: "Kablo TV / Uydu" },
      { id: "site_ici", label: "Site İçerisinde" },
      { id: "arac_sarj", label: "Araç Şarj İstasyonu" },
      { id: "hamam", label: "Hamam" },
      { id: "sauna", label: "Sauna" },
      { id: "buhar_odasi", label: "Buhar Odası" },
      { id: "kopek_parki", label: "Köpek Parkı" },
      { id: "siding", label: "Siding" },
    ],
  },
  {
    id: "ulasim",
    label: "Ulaşım",
    items: [
      { id: "anayol", label: "Anayol" },
      { id: "caddeye_yakin", label: "Caddeye Yakın" },
      { id: "otobus", label: "Otobüs Durağı" },
      { id: "minibus", label: "Minibüs" },
      { id: "dolmus", label: "Dolmuş" },
      { id: "metro", label: "Metro" },
      { id: "metrobus", label: "Metrobüs" },
      { id: "marmaray", label: "Marmaray" },
      { id: "tramvay", label: "Tramvay" },
      { id: "tren", label: "Tren İstasyonu" },
      { id: "iskele", label: "İskele" },
      { id: "havaalani", label: "Havaalanı" },
      { id: "e5", label: "E-5" },
      { id: "tem", label: "TEM" },
      { id: "sahil", label: "Sahil" },
      { id: "ulasima_yakin", label: "Ulaşıma Yakın" },
    ],
  },
  {
    id: "cevre",
    label: "Çevre / Konum",
    items: [
      { id: "okul", label: "Okula Yakın" },
      { id: "hastane", label: "Hastaneye Yakın" },
      { id: "market", label: "Markete Yakın" },
      { id: "park", label: "Park / Yeşil Alan" },
      { id: "avm", label: "AVM'ye Yakın" },
      { id: "sehir_merkezi", label: "Şehir Merkezi" },
      { id: "denize_yakin", label: "Denize Yakın" },
      { id: "eczane", label: "Eczane" },
      { id: "cami", label: "Cami" },
      { id: "polis", label: "Polis Merkezi" },
      { id: "itfaiye", label: "İtfaiye" },
      { id: "belediye", label: "Belediye" },
      { id: "universite", label: "Üniversite" },
      { id: "spor_salonu", label: "Spor Salonu" },
      { id: "plaj", label: "Plaj" },
      { id: "semt_pazari", label: "Semt Pazarı" },
      { id: "eglence", label: "Eğlence Merkezi" },
      { id: "fuar", label: "Fuar" },
      { id: "havra", label: "Havra" },
      { id: "kilise", label: "Kilise" },
      { id: "cemevi", label: "Cemevi" },
      { id: "gole_sifir", label: "Göle Sıfır" },
      { id: "saglik_ocagi", label: "Sağlık Ocağı" },
    ],
  },
  {
    id: "manzara",
    label: "Manzara",
    items: [
      { id: "manzara_doga", label: "Doğa" },
      { id: "manzara_park", label: "Park & Yeşil Alan" },
      { id: "manzara_sehir", label: "Şehir" },
      { id: "manzara_deniz", label: "Deniz" },
      { id: "manzara_gol", label: "Göl" },
      { id: "manzara_bogaz", label: "Boğaz" },
    ],
  },
  {
    id: "konut_tipi",
    label: "Konut Tipi",
    items: [
      { id: "tip_dubleks", label: "Dubleks" },
      { id: "tip_ara_kat_dubleks", label: "Ara Kat Dubleks" },
      { id: "tip_bahce_dubleks", label: "Bahçe Dubleksi" },
      { id: "tip_ters_dubleks", label: "Ters Dubleks" },
      { id: "tip_tripleks", label: "Tripleks" },
      { id: "tip_cati_dubleks", label: "Çatı Dubleks" },
    ],
  },
];

const LABEL_BY_ID = new Map(
  HOUSING_EXTRA_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label] as const))
);

export function housingExtraLabel(id: string) {
  return LABEL_BY_ID.get(id) || id;
}

export function groupHousingExtras(ids: string[]) {
  const set = new Set(ids);
  return HOUSING_EXTRA_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => set.has(i.id)),
  })).filter((g) => g.items.length > 0);
}

export function parseHousingExtras(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(LABEL_BY_ID.keys());
  return raw.filter((x): x is string => typeof x === "string" && valid.has(x));
}

function normExtra(s: string) {
  return String(s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sahibinden etiketleri → id (uzun anahtarlar önce eşlensin) */
const SYNONYMS: Array<{ id: string; keys: string[] }> = [
  // Cephe
  { id: "cephe_kuzey", keys: ["kuzey", "cephe kuzey"] },
  { id: "cephe_guney", keys: ["guney", "cephe guney"] },
  { id: "cephe_dogu", keys: ["dogu", "cephe dogu"] },
  { id: "cephe_bati", keys: ["bati", "cephe bati"] },
  // İç
  { id: "adsl", keys: ["adsl"] },
  { id: "fiber", keys: ["fiber internet", "fiber"] },
  { id: "wifi", keys: ["wifi", "wi fi", "wireless"] },
  {
    id: "ankastre",
    keys: ["mutfak ankastre", "ankastre mutfak", "ankastre firin", "ankastre ocak", "ankastre"],
  },
  { id: "amerikan_mutfak", keys: ["amerikan mutfak"] },
  { id: "amerikan_kapi", keys: ["amerikan kapi"] },
  { id: "beyaz_esya", keys: ["beyaz esya"] },
  { id: "boyali", keys: ["boyali"] },
  { id: "bulasik", keys: ["bulasik makinesi"] },
  { id: "buzdolabi", keys: ["buzdolabi"] },
  { id: "camasir", keys: ["camasir makinesi"] },
  { id: "camasir_odasi", keys: ["camasir odasi"] },
  { id: "celik_kapi", keys: ["celik kapi"] },
  { id: "dusakabin", keys: ["dusakabin"] },
  { id: "ebeveyn_banyo", keys: ["ebeveyn banyosu", "ebeveyn banyo"] },
  { id: "giyinme", keys: ["giyinme odasi"] },
  { id: "gomme_dolap", keys: ["gomme dolap"] },
  {
    id: "goruntulu_diafon",
    keys: ["goruntulu diafon", "goruntulu diyafon", "diyafon", "diafon", "intercom sistemi", "intercom"],
  },
  { id: "hilton_banyo", keys: ["hilton banyo"] },
  { id: "isicam", keys: ["isicam"] },
  { id: "jakuzi", keys: ["jakuzi"] },
  { id: "cam_balkon", keys: ["kapali / cam balkon", "kapali cam balkon", "cam balkon"] },
  { id: "kartonpiyer", keys: ["kartonpiyer"] },
  { id: "kiler", keys: ["kiler"] },
  { id: "klima", keys: ["klima"] },
  { id: "mutfak_dogalgazi", keys: ["mutfak dogalgazi"] },
  { id: "parke", keys: ["parke zemin"] },
  { id: "laminat", keys: ["laminat zemin", "laminat", "mutfak laminat"] },
  { id: "pvc_dograma", keys: ["pvc dograma"] },
  { id: "ahsap_dograma", keys: ["ahsap dograma"] },
  { id: "aluminyum_dograma", keys: ["aluminyum dograma"] },
  { id: "seramik", keys: ["seramik zemin"] },
  { id: "spot", keys: ["spot aydinlatma"] },
  { id: "teras", keys: ["teras"] },
  { id: "vestiyer", keys: ["vestiyer"] },
  { id: "sofben", keys: ["sofben"] },
  { id: "somine", keys: ["somine"] },
  { id: "duvar_kagidi", keys: ["duvar kagidi"] },
  { id: "mobilya", keys: ["mobilya"] },
  { id: "firin", keys: ["firin"] },
  { id: "set_ustu_ocak", keys: ["set ustu ocak"] },
  { id: "akilli_ev", keys: ["akilli ev"] },
  { id: "alarm_hirsiz", keys: ["alarm hirsiz", "hirsiz alarm"] },
  { id: "alarm_yangin", keys: ["alarm yangin", "yangin alarm"] },
  // Dış
  { id: "asansor", keys: ["asansor"] },
  { id: "guvenlik", keys: ["24 saat guvenlik", "guvenlik"] },
  { id: "kamera", keys: ["kamera sistemi", "guvenlik kameralari", "kamera"] },
  { id: "kapici", keys: ["apartman gorevlisi", "kapici / gorevli", "kapici"] },
  { id: "kapali_otopark", keys: ["kapali otopark"] },
  { id: "otopark", keys: ["otopark"] },
  { id: "jenerator", keys: ["jenerator"] },
  { id: "hidrofor", keys: ["hidrofor"] },
  { id: "su_deposu", keys: ["su deposu"] },
  { id: "isi_yalitim", keys: ["isi yalitimi"] },
  { id: "ses_yalitim", keys: ["ses yalitimi"] },
  { id: "yangin_merdiven", keys: ["yangin merdiveni"] },
  { id: "oyun_parki", keys: ["cocuk oyun parki", "oyun parki"] },
  { id: "spor_alani", keys: ["spor alani"] },
  { id: "yuzme_kapali", keys: ["yuzme havuzu kapali", "yuzme havuzu (kapali)"] },
  { id: "yuzme_acik", keys: ["yuzme havuzu acik", "yuzme havuzu (acik)"] },
  { id: "mustakil_havuz", keys: ["mustakil havuzlu", "mustakil havuz"] },
  { id: "tenis", keys: ["tenis kortu"] },
  { id: "engelli", keys: ["engelliye uygun"] },
  { id: "kablo_tv", keys: ["kablo tv / uydu", "kablo tv", "uydu"] },
  { id: "site_ici", keys: ["site icerisinde", "site icinde"] },
  { id: "arac_sarj", keys: ["arac sarj istasyonu", "arac sarj"] },
  { id: "hamam", keys: ["hamam"] },
  { id: "sauna", keys: ["sauna"] },
  { id: "buhar_odasi", keys: ["buhar odasi"] },
  { id: "kopek_parki", keys: ["kopek parki"] },
  { id: "siding", keys: ["siding"] },
  // Ulaşım
  { id: "anayol", keys: ["anayol"] },
  { id: "caddeye_yakin", keys: ["caddeye yakin", "cadde"] },
  { id: "otobus", keys: ["otobus duragi", "otobus"] },
  { id: "minibus", keys: ["minibus"] },
  { id: "dolmus", keys: ["dolmus"] },
  { id: "metro", keys: ["metro"] },
  { id: "metrobus", keys: ["metrobus"] },
  { id: "marmaray", keys: ["marmaray"] },
  { id: "tramvay", keys: ["tramvay"] },
  { id: "tren", keys: ["tren istasyonu", "tren"] },
  { id: "iskele", keys: ["iskele"] },
  { id: "havaalani", keys: ["havaalani"] },
  { id: "e5", keys: ["e 5", "e5"] },
  { id: "tem", keys: ["tem"] },
  { id: "sahil", keys: ["sahil"] },
  { id: "ulasima_yakin", keys: ["ulasima yakin"] },
  // Muhit / çevre
  { id: "okul", keys: ["okula yakin", "ilkokul ortaokul", "ilkokul", "lise", "okul"] },
  { id: "hastane", keys: ["hastaneye yakin", "hastane"] },
  { id: "market", keys: ["markete yakin", "market"] },
  { id: "park", keys: ["park / yesil alan", "yesil alan", "park"] },
  { id: "avm", keys: ["alisveris merkezi", "avm ye yakin", "avm"] },
  { id: "sehir_merkezi", keys: ["sehir merkezi"] },
  { id: "denize_yakin", keys: ["denize sifir", "denize yakin", "deniz sifir"] },
  { id: "eczane", keys: ["eczane"] },
  { id: "cami", keys: ["cami"] },
  { id: "polis", keys: ["polis merkezi", "polis"] },
  { id: "itfaiye", keys: ["itfaiye"] },
  { id: "belediye", keys: ["belediye"] },
  { id: "universite", keys: ["universite"] },
  { id: "spor_salonu", keys: ["spor salonu"] },
  { id: "plaj", keys: ["plaj"] },
  { id: "semt_pazari", keys: ["semt pazari"] },
  { id: "eglence", keys: ["eglence merkezi"] },
  { id: "fuar", keys: ["fuar"] },
  { id: "havra", keys: ["havra"] },
  { id: "kilise", keys: ["kilise"] },
  { id: "cemevi", keys: ["cemevi"] },
  { id: "gole_sifir", keys: ["gole sifir"] },
  { id: "saglik_ocagi", keys: ["saglik ocagi"] },
  { id: "manzara_doga", keys: ["doga", "manzara doga"] },
  { id: "manzara_park", keys: ["park yesil alan", "park & yesil alan", "manzara park"] },
  { id: "manzara_sehir", keys: ["manzara sehir", "sehir manzarasi"] },
  { id: "manzara_deniz", keys: ["manzara deniz", "deniz manzarasi"] },
  { id: "manzara_gol", keys: ["manzara gol", "gol manzarasi"] },
  { id: "manzara_bogaz", keys: ["manzara bogaz", "bogaz manzarasi"] },
  { id: "tip_dubleks", keys: ["dubleks", "konut tipi dubleks"] },
  { id: "tip_ara_kat_dubleks", keys: ["ara kat dubleks"] },
  { id: "tip_bahce_dubleks", keys: ["bahce dubleksi", "bahce dubleks"] },
  { id: "tip_ters_dubleks", keys: ["ters dubleks"] },
  { id: "tip_tripleks", keys: ["tripleks"] },
  { id: "tip_cati_dubleks", keys: ["cati dubleks"] },
];

const SYNONYMS_SORTED = SYNONYMS.map((row) => ({
  id: row.id,
  keys: [...row.keys].map(normExtra).filter(Boolean).sort((a, b) => b.length - a.length),
})).sort((a, b) => (b.keys[0]?.length || 0) - (a.keys[0]?.length || 0));

export function housingExtraChecklistForPrompt(): string {
  return HOUSING_EXTRA_GROUPS.map(
    (g) => `${g.label}: ${g.items.map((i) => `${i.id}=${i.label}`).join(" | ")}`
  ).join("\n");
}

/** Yalnızca tam / neredeyse-tam etiket — includes yok (yanlış pozitif üretmesin) */
function matchOneLabel(label: string): string | null {
  const n = normExtra(label);
  if (!n || n.length < 2) return null;
  if (n === "yok" || n === "hayir" || n.includes("belirtilmemis") || n.includes("secilmedi")) return null;

  for (const [id, lab] of LABEL_BY_ID) {
    if (n === normExtra(lab) || n === normExtra(id)) return id;
  }

  // "Park" ≠ "Otopark"
  if (n === "park" || n === "park yesil alan" || n === "park / yesil alan") return "park";
  if (n === "kapali otopark" || n === "kapali / otopark") return "kapali_otopark";
  if (n === "otopark" || n === "acik otopark") return "otopark";

  for (const row of SYNONYMS_SORTED) {
    for (const k of row.keys) {
      if (!k) continue;
      if (n === k) return row.id;
    }
  }
  return null;
}

/**
 * AI'nın verdiği işaretli etiket listesinden id çıkar.
 * Serbest açıklama metninde arama YAPMA.
 */
export function matchHousingExtrasFromText(...chunks: string[]): string[] {
  const labels = chunks
    .flatMap((c) => String(c || "").split(/[,;\n|]+/))
    .map((c) => c.trim())
    .filter(Boolean);
  if (!labels.length) return [];
  const found = new Set<string>();
  for (const label of labels) {
    const id = matchOneLabel(label);
    if (id) found.add(id);
  }
  return [...found];
}

/** Tablo satırı: "Cephe Kuzey, Güney" / "Cephe: Batı" */
export function matchHousingCepheFromText(...chunks: unknown[]): string[] {
  const blob = chunks.map((x) => String(x ?? "")).join("\n");
  const found = new Set<string>();
  const line = blob.match(/cephe\s*[:：]?\s*([^\n]+)/i)?.[1] || "";
  const hay = normExtra(`${line} ${blob}`);
  if (/\bkuzey\b/.test(hay) || hay.includes("kuzey")) found.add("cephe_kuzey");
  if (/\bguney\b/.test(hay) || hay.includes("guney")) found.add("cephe_guney");
  if (/\bdogu\b/.test(hay) || hay.includes("dogu")) found.add("cephe_dogu");
  if (/\bbati\b/.test(hay) || hay.includes("bati")) found.add("cephe_bati");
  // Yanlış pozitif: "batı" yoksa ama "sabatı" gibi — yukarıdaki includes yeterli; "isınma" içinde yok
  return [...found];
}
