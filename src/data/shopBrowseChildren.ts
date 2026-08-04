import type { BrowseFilter } from "@/data/categoryBrowseTree";

/** Alt düğüm: ürün tipi (subtype) veya marka (brand) */
export type ShopChildDef = {
  slug: string;
  name: string;
  /** attributes.subtype */
  subtype?: string;
  /** attributes.brand — elektronik marka dalları */
  brand?: string;
  children?: ShopChildDef[];
};

function leaf(
  slug: string,
  name: string,
  extra?: Partial<Pick<ShopChildDef, "subtype" | "brand">>
): ShopChildDef {
  return { slug, name, ...extra };
}

function brand(slug: string, name: string): ShopChildDef {
  // attributes.brand genelde görünen adla tutulur (Apple, Samsung…)
  return { slug, name, brand: name };
}

function type(slug: string, name: string, children?: ShopChildDef[]): ShopChildDef {
  return { slug, name, subtype: slug, children };
}

/** Sahibinden / Hepsiburada tarzı — alışveriş alt kategorisinin altındaki dallar */
export const SHOP_BROWSE_CHILDREN: Record<string, ShopChildDef[]> = {
  /* ——— ELEKTRONİK ——— */
  "cep-telefonu": [
    type("akilli-telefon", "Akıllı Telefon", [
      brand("apple", "Apple"),
      brand("samsung", "Samsung"),
      brand("xiaomi", "Xiaomi"),
      brand("huawei", "Huawei"),
      brand("oppo", "Oppo"),
      brand("realme", "Realme"),
      brand("google", "Google"),
      brand("oneplus", "OnePlus"),
      brand("motorola", "Motorola"),
      brand("nokia", "Nokia"),
      brand("honor", "Honor"),
      brand("vivo", "Vivo"),
      brand("tecno", "Tecno"),
      brand("infinix", "Infinix"),
      brand("general-mobile", "General Mobile"),
      brand("casper", "Casper"),
      brand("reeder", "Reeder"),
      brand("diger", "Diğer"),
    ]),
    type("tuslu-telefon", "Tuşlu Telefon"),
    type("akilli-saat", "Akıllı Saat & Bileklik", [
      brand("apple", "Apple"),
      brand("samsung", "Samsung"),
      brand("huawei", "Huawei"),
      brand("xiaomi", "Xiaomi"),
      brand("garmin", "Garmin"),
      brand("amazfit", "Amazfit"),
      brand("diger", "Diğer"),
    ]),
    type("kulaklik", "Kulaklık & Bluetooth"),
    type("sarj-powerbank", "Şarj & Powerbank"),
    type("kilif-aksesuar", "Kılıf & Koruyucu"),
    type("diger-aksesuar", "Diğer Aksesuar"),
  ],

  bilgisayar: [
    type("dizustu", "Dizüstü (Notebook)", [
      brand("apple", "Apple"),
      brand("asus", "Asus"),
      brand("lenovo", "Lenovo"),
      brand("hp", "HP"),
      brand("dell", "Dell"),
      brand("acer", "Acer"),
      brand("msi", "MSI"),
      brand("monster", "Monster"),
      brand("casper", "Casper"),
      brand("huawei", "Huawei"),
      brand("samsung", "Samsung"),
      brand("microsoft", "Microsoft"),
      brand("diger", "Diğer"),
    ]),
    type("masaustu", "Masaüstü"),
    type("oyun-bilgisayari", "Oyuncu Bilgisayarı"),
    type("all-in-one", "All-in-One"),
    type("monitor", "Monitör"),
    type("yazici-tarayici", "Yazıcı & Tarayıcı"),
    type("bilgisayar-parcasi", "Parça (RAM, SSD, Ekran Kartı…)"),
    type("cevre-birimi", "Klavye, Mouse & Çevre Birimi"),
    type("network", "Network & Modem"),
    type("yazilim", "Yazılım"),
  ],

  tablet: [
    brand("apple", "Apple"),
    brand("samsung", "Samsung"),
    brand("lenovo", "Lenovo"),
    brand("huawei", "Huawei"),
    brand("xiaomi", "Xiaomi"),
    brand("amazon", "Amazon"),
    brand("microsoft", "Microsoft"),
    brand("casper", "Casper"),
    brand("reeder", "Reeder"),
    brand("diger", "Diğer"),
    type("tablet-aksesuar", "Tablet Aksesuar"),
  ],

  "tv-goruntu-ses": [
    type("televizyon", "Televizyon", [
      brand("samsung", "Samsung"),
      brand("lg", "LG"),
      brand("sony", "Sony"),
      brand("philips", "Philips"),
      brand("tcl", "TCL"),
      brand("vestel", "Vestel"),
      brand("arcelik", "Arçelik"),
      brand("xiaomi", "Xiaomi"),
      brand("diger", "Diğer"),
    ]),
    type("projeksiyon", "Projeksiyon"),
    type("ses-sistemi", "Ses Sistemi & Soundbar"),
    type("ev-sinemasi", "Ev Sineması"),
    type("uydu-receiver", "Uydu & Receiver"),
    type("media-player", "Media Player"),
  ],

  "beyaz-esya": [
    type("buzdolabi", "Buzdolabı"),
    type("camasir-makinesi", "Çamaşır Makinesi"),
    type("bulasik-makinesi", "Bulaşık Makinesi"),
    type("kurutma-makinesi", "Kurutma Makinesi"),
    type("firin-ocak", "Fırın & Ocak"),
    type("davulumba", "Davlumbaz"),
    type("klima", "Klima"),
    type("kombi-termosifon", "Kombi & Termosifon"),
    type("diger-beyaz-esya", "Diğer"),
  ],

  "elektrikli-ev-aletleri": [
    type("supurge", "Süpürge"),
    type("utuler", "Ütü"),
    type("kahve-cay", "Kahve & Çay Makinesi"),
    type("blender-mikser", "Blender & Mikser"),
    type("tost-mikrodalga", "Tost & Mikrodalga"),
    type("hava-fritozu", "Airfryer"),
    type("diger-kucuk-ev", "Diğer Küçük Ev Aleti"),
  ],

  "ev-elektronigi": [
    type("isiticilar", "Isıtıcı & Fan"),
    type("nem-alici", "Nem Alma & Hava Temizleyici"),
    type("utu-makinesi", "Dikiş & Ütü Makinesi"),
    type("diger-ev-elektronik", "Diğer"),
  ],

  "oyun-konsol": [
    type("konsol", "Oyun Konsolu", [
      brand("sony", "Sony (PlayStation)"),
      brand("microsoft", "Microsoft (Xbox)"),
      brand("nintendo", "Nintendo"),
      brand("steam", "Steam Deck / PC Handheld"),
      brand("diger", "Diğer"),
    ]),
    type("oyun", "Oyun (CD / Dijital)"),
    type("konsol-aksesuar", "Kol, Kulaklık & Aksesuar"),
  ],

  "fotograf-kamera": [
    type("fotograf-makinesi", "Fotoğraf Makinesi", [
      brand("canon", "Canon"),
      brand("nikon", "Nikon"),
      brand("sony", "Sony"),
      brand("fujifilm", "Fujifilm"),
      brand("olympus", "Olympus / OM System"),
      brand("panasonic", "Panasonic"),
      brand("gopro", "GoPro"),
      brand("diger", "Diğer"),
    ]),
    type("video-kamera", "Video Kamera"),
    type("drone", "Drone"),
    type("objektif", "Objektif"),
    type("tripod-aksesuar", "Tripod & Aksesuar"),
  ],

  "teknik-elektronik": [
    type("elektronik-komponent", "Elektronik Komponent"),
    type("arduino-raspberry", "Arduino / Raspberry / Maker"),
    type("olcum-cihazi", "Ölçüm Cihazı"),
    type("guvenlik-kamera", "Güvenlik Kamerası"),
    type("telsiz-haberlesme", "Telsiz & Haberleşme"),
    type("diger-teknik", "Diğer"),
  ],

  /* ——— EV & YAŞAM ——— */
  "ev-dekorasyon": [
    type("mobilya", "Mobilya", [
      leaf("oturma-grubu", "Oturma Grubu", { subtype: "oturma-grubu" }),
      leaf("yatak-odasi", "Yatak Odası", { subtype: "yatak-odasi" }),
      leaf("yemek-odasi", "Yemek Odası", { subtype: "yemek-odasi" }),
      leaf("calisma-masasi", "Çalışma / Ofis Mobilyası", { subtype: "calisma-masasi" }),
      leaf("dolap-raf", "Dolap & Raf", { subtype: "dolap-raf" }),
      leaf("cocuk-odasi", "Çocuk Odası", { subtype: "cocuk-odasi" }),
    ]),
    type("ev-tekstili", "Ev Tekstili"),
    type("aydinlatma", "Aydınlatma"),
    type("dekoratif", "Dekoratif Ürünler"),
    type("mutfak-gerecleri", "Mutfak Gereçleri"),
    type("banyo", "Banyo Ürünleri"),
    type("hali-kilim", "Halı & Kilim"),
    type("perde", "Perde & Stor"),
  ],

  "bahce-yapi-market": [
    type("bahce-mobilyasi", "Bahçe Mobilyası"),
    type("bahce-aletleri", "Bahçe Aletleri"),
    type("cayir-bicme", "Çim Biçme & Budama"),
    type("sulama", "Sulama Sistemi"),
    type("yapi-malzeme", "Yapı Malzemesi"),
    type("el-aleti", "El Aleti & Takım"),
    type("elektrikli-el-aleti", "Elektrikli El Aleti"),
    type("boya-yalitim", "Boya & Yalıtım"),
    type("tesisat", "Tesisat Malzemesi"),
  ],

  "pet-shop": [
    type("kopek", "Köpek Ürünleri"),
    type("kedi", "Kedi Ürünleri"),
    type("kus", "Kuş Ürünleri"),
    type("akvaryum", "Akvaryum"),
    type("kemirgen", "Kemirgen & Diğer"),
    type("mama-kumu", "Mama & Kum"),
  ],

  "yiyecek-icecek": [
    type("gida", "Gıda"),
    type("icecek", "İçecek"),
    type("organik", "Organik / Doğal"),
    type("vitamin-takviye", "Vitamin & Takviye"),
  ],

  "ofis-kirtasiye": [
    type("kirtasiye", "Kırtasiye"),
    type("ofis-mobilya", "Ofis Mobilyası"),
    type("yazici-malzeme", "Toner & Kartuş"),
    type("organizasyon", "Dosyalama & Organizasyon"),
  ],

  /* ——— MODA & AKSESUAR ——— */
  "giyim-aksesuar": [
    type("kadin-giyim", "Kadın Giyim"),
    type("erkek-giyim", "Erkek Giyim"),
    type("cocuk-giyim", "Çocuk Giyim"),
    type("ust-giyim", "Mont, Ceket & Kaban"),
    type("alt-giyim", "Pantolon & Etek"),
    type("elbise", "Elbise"),
    type("spor-giyim", "Spor Giyim"),
    type("ic-giyim", "İç Giyim & Pijama"),
    type("aksesuar-giyim", "Şapka, Atkı & Kemer"),
  ],

  "ayakkabi-canta": [
    type("kadin-ayakkabi", "Kadın Ayakkabı"),
    type("erkek-ayakkabi", "Erkek Ayakkabı"),
    type("cocuk-ayakkabi", "Çocuk Ayakkabı"),
    type("spor-ayakkabi", "Spor Ayakkabı", [
      brand("nike", "Nike"),
      brand("adidas", "Adidas"),
      brand("puma", "Puma"),
      brand("new-balance", "New Balance"),
      brand("skechers", "Skechers"),
      brand("converse", "Converse"),
      brand("vans", "Vans"),
      brand("diger", "Diğer"),
    ]),
    type("bot-cizme", "Bot & Çizme"),
    type("canta", "Çanta & Bavul"),
    type("cüzdan", "Cüzdan & Kartlık"),
  ],

  "saat-taki": [
    type("kol-saati", "Kol Saati", [
      brand("casio", "Casio"),
      brand("seiko", "Seiko"),
      brand("citizen", "Citizen"),
      brand("tissot", "Tissot"),
      brand("fossil", "Fossil"),
      brand("michael-kors", "Michael Kors"),
      brand("swatch", "Swatch"),
      brand("diger", "Diğer"),
    ]),
    type("akilli-saat-moda", "Akıllı Saat"),
    type("yuzuk", "Yüzük"),
    type("kolye", "Kolye"),
    type("kupe", "Küpe"),
    type("bileklik", "Bileklik"),
    type("set-taki", "Takı Seti"),
  ],

  "kisisel-bakim": [
    type("cilt-bakim", "Cilt Bakım"),
    type("makyaj", "Makyaj"),
    type("sac-bakim", "Saç Bakım"),
    type("parfum", "Parfüm"),
    type("tiras-epilasyon", "Tıraş & Epilasyon"),
    type("agiz-bakim", "Ağız Bakım"),
    type("erkek-bakim", "Erkek Bakım"),
  ],

  "anne-bebek": [
    type("bebek-arabasi", "Bebek Arabası"),
    type("oto-koltugu", "Oto Koltuğu"),
    type("mama-sandalyesi", "Mama Sandalyesi"),
    type("bebek-giyim", "Bebek Giyim"),
    type("bebek-bakim", "Bebek Bakım"),
    type("oyuncak-bebek", "Bebek Oyuncak"),
    type("emzirme", "Emzirme & Beslenme"),
    type("hamile", "Hamile Giyim"),
  ],

  /* ——— HOBİ & SPOR ——— */
  "spor-outdoor": [
    type("fitness", "Fitness & Kondisyon"),
    type("bisiklet", "Bisiklet", [
      brand("bianchi", "Bianchi"),
      brand("trek", "Trek"),
      brand("giant", "Giant"),
      brand("merida", "Merida"),
      brand("salcano", "Salcano"),
      brand("kron", "Kron"),
      brand("diger", "Diğer"),
    ]),
    type("kamp-outdoor", "Kamp & Outdoor"),
    type("yuruyus-kosu", "Yürüyüş & Koşu"),
    type("futbol", "Futbol"),
    type("basketbol", "Basketbol"),
    type("raket-sporlari", "Tenis / Badminton / Masa Tenisi"),
    type("su-sporlari", "Su Sporları"),
    type("kis-sporlari", "Kış Sporları"),
    type("dalis-balik", "Dalış & Balıkçılık"),
    type("diger-spor", "Diğer Spor"),
  ],

  "hobi-oyuncak": [
    type("lego-yapboz", "LEGO & Yapboz"),
    type("modelcilik", "Modelcilik & RC"),
    type("koleksiyon-figur", "Figür & Koleksiyon"),
    type("egitici-oyuncak", "Eğitici Oyuncak"),
    type("pelus", "Pelüş"),
    type("board-game", "Kutu Oyunu"),
    type("hobi-malzeme", "Hobi Malzemesi"),
    type("diger-hobi", "Diğer"),
  ],

  "kitap-dergi-film": [
    type("kitap", "Kitap"),
    type("ders-kitabi", "Ders Kitabı & Sınav"),
    type("dergi", "Dergi"),
    type("dvd-bluray", "DVD / Blu-ray"),
    type("vinyl-cd", "Plak & CD"),
  ],

  muzik: [
    type("gitar", "Gitar", [
      brand("fender", "Fender"),
      brand("gibson", "Gibson"),
      brand("yamaha", "Yamaha"),
      brand("ibanez", "Ibanez"),
      brand("cort", "Cort"),
      brand("diger", "Diğer"),
    ]),
    type("piyano-klavye", "Piyano & Klavye"),
    type("bateri-perkusyon", "Bateri & Perküsyon"),
    type("yayli", "Yaylı Çalgılar"),
    type("uflemeli", "Üflemeli"),
    type("dj-studio", "DJ & Stüdyo"),
    type("ampli-efekt", "Amfi & Efekt"),
    type("muzik-aksesuar", "Aksesuar & Nota"),
  ],

  "antika-koleksiyon": [
    type("antika-mobilya", "Antika Mobilya"),
    type("eski-para", "Eski Para & Pul"),
    type("plak-koleksiyon", "Plak Koleksiyon"),
    type("oyuncak-koleksiyon", "Oyuncak Koleksiyon"),
    type("sanat-eseri", "Tablo & Sanat"),
    type("diger-koleksiyon", "Diğer Koleksiyon"),
  ],

  /* ——— İŞ MAKİNELERİ (ürün tipleri; grup genişletmesi classicBrowseTree’de) ——— */
  "is-makinesi": [
    type("ekskavator", "Ekskavatör"),
    type("beko-loder", "Beko Loder (Kazıcı-Yükleyici)"),
    type("loder", "Loder (Yükleyici)"),
    type("dozer", "Dozer"),
    type("greyder", "Greyder"),
    type("silindir", "Silindir"),
    type("forklift", "Forklift"),
    type("teleskopik", "Teleskopik Yükleyici"),
    type("mobil-vinc", "Mobil Vinç"),
    type("beton-pompasi", "Beton Pompası"),
    type("asfalt", "Asfalt Makinesi"),
    type("sondaj", "Sondaj Makinesi"),
    type("diger-is-makinesi", "Diğer İş Makinesi"),
  ],

  "tarim-makinesi": [
    type("traktor", "Traktör"),
    type("bicerdover", "Biçerdöver"),
    type("pulluk-ekim", "Pulluk & Ekim"),
    type("sulama-tarim", "Sulama"),
    type("balya", "Balya & Silaj"),
    type("diger-tarim", "Diğer Tarım Makinesi"),
  ],

  "sanayi-makinesi": [
    type("torna-freze", "Torna / Freze"),
    type("pres-kaynak", "Pres & Kaynak"),
    type("kompresor", "Kompresör"),
    type("jenerator", "Jeneratör"),
    type("pompa", "Pompa"),
    type("diger-sanayi", "Diğer Sanayi"),
  ],

  "diger-alisveris": [
    type("diger", "Diğer"),
  ],
};

export function shopChildrenFor(
  rootSlug: string,
  subSlug: string,
  parentId: string
): Array<{ id: string; name: string; filter: BrowseFilter; children?: ReturnType<typeof shopChildrenFor> }> {
  const defs = SHOP_BROWSE_CHILDREN[subSlug];
  if (!defs?.length) return [];

  const category = `${rootSlug}-${subSlug}`;

  function mapDef(def: ShopChildDef, pid: string): {
    id: string;
    name: string;
    filter: BrowseFilter;
    children?: ReturnType<typeof mapDef>[];
  } {
    const id = `${pid}/${def.slug}`;
    const filter: BrowseFilter = { category };
    if (def.subtype) filter.subtype = def.subtype;
    if (def.brand) filter.brand = def.brand;
    const children = def.children?.map((c) => {
      const child = mapDef(c, id);
      // Marka çocuğu: üst subtype’ı miras al (örn. akıllı telefon > Apple)
      if (def.subtype && !c.subtype) {
        child.filter = { ...child.filter, subtype: def.subtype };
      }
      if (def.brand && !c.brand && c.subtype) {
        child.filter = { ...child.filter, brand: def.brand };
      }
      return child;
    });
    return { id, name: def.name, filter, children };
  }

  return defs.map((d) => mapDef(d, parentId));
}
