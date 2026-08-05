import type { BrowseFilter } from "@/data/categoryBrowseTree";

/** Alt düğüm: ürün tipi (subtype) veya marka (brand) */
export type ShopChildDef = {
  slug: string;
  name: string;
  /** attributes.subtype */
  subtype?: string;
  /** attributes.brand — marka dalları */
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
  return { slug, name, brand: name };
}

function type(slug: string, name: string, children?: ShopChildDef[]): ShopChildDef {
  return { slug, name, subtype: slug, children };
}

/** [slug, görünen ad] listesinden marka çocukları */
function brands(list: Array<[string, string]>): ShopChildDef[] {
  return list.map(([slug, name]) => brand(slug, name));
}

/* ——— Paylaşılan marka setleri (TR pazarı / Hepsiburada–Trendyol yaygın markalar) ——— */
const PHONE_BRANDS = brands([
  ["apple", "Apple"],
  ["samsung", "Samsung"],
  ["xiaomi", "Xiaomi"],
  ["huawei", "Huawei"],
  ["oppo", "Oppo"],
  ["realme", "Realme"],
  ["google", "Google"],
  ["oneplus", "OnePlus"],
  ["motorola", "Motorola"],
  ["nokia", "Nokia"],
  ["honor", "Honor"],
  ["vivo", "Vivo"],
  ["tecno", "Tecno"],
  ["infinix", "Infinix"],
  ["nothing", "Nothing"],
  ["general-mobile", "General Mobile"],
  ["casper", "Casper"],
  ["reeder", "Reeder"],
  ["diger", "Diğer"],
]);

const WATCH_BRANDS = brands([
  ["apple", "Apple"],
  ["samsung", "Samsung"],
  ["huawei", "Huawei"],
  ["xiaomi", "Xiaomi"],
  ["garmin", "Garmin"],
  ["amazfit", "Amazfit"],
  ["fitbit", "Fitbit"],
  ["polar", "Polar"],
  ["diger", "Diğer"],
]);

const LAPTOP_BRANDS = brands([
  ["apple", "Apple"],
  ["asus", "Asus"],
  ["lenovo", "Lenovo"],
  ["hp", "HP"],
  ["dell", "Dell"],
  ["acer", "Acer"],
  ["msi", "MSI"],
  ["monster", "Monster"],
  ["casper", "Casper"],
  ["huawei", "Huawei"],
  ["samsung", "Samsung"],
  ["microsoft", "Microsoft"],
  ["gigabyte", "Gigabyte"],
  ["razer", "Razer"],
  ["diger", "Diğer"],
]);

const PC_COMPONENT_BRANDS = brands([
  ["intel", "Intel"],
  ["amd", "AMD"],
  ["nvidia", "NVIDIA"],
  ["asus", "Asus"],
  ["msi", "MSI"],
  ["gigabyte", "Gigabyte"],
  ["corsair", "Corsair"],
  ["kingston", "Kingston"],
  ["samsung", "Samsung"],
  ["western-digital", "Western Digital"],
  ["seagate", "Seagate"],
  ["logitech", "Logitech"],
  ["razer", "Razer"],
  ["diger", "Diğer"],
]);

const TABLET_BRANDS = brands([
  ["apple", "Apple"],
  ["samsung", "Samsung"],
  ["lenovo", "Lenovo"],
  ["huawei", "Huawei"],
  ["xiaomi", "Xiaomi"],
  ["amazon", "Amazon"],
  ["microsoft", "Microsoft"],
  ["casper", "Casper"],
  ["reeder", "Reeder"],
  ["alcatel", "Alcatel"],
  ["diger", "Diğer"],
]);

const TV_BRANDS = brands([
  ["samsung", "Samsung"],
  ["lg", "LG"],
  ["sony", "Sony"],
  ["philips", "Philips"],
  ["tcl", "TCL"],
  ["vestel", "Vestel"],
  ["arcelik", "Arçelik"],
  ["xiaomi", "Xiaomi"],
  ["toshiba", "Toshiba"],
  ["sharp", "Sharp"],
  ["diger", "Diğer"],
]);

const APPLIANCE_BRANDS = brands([
  ["arcelik", "Arçelik"],
  ["beko", "Beko"],
  ["vestel", "Vestel"],
  ["bosch", "Bosch"],
  ["siemens", "Siemens"],
  ["samsung", "Samsung"],
  ["lg", "LG"],
  ["profilo", "Profilo"],
  ["altus", "Altus"],
  ["regal", "Regal"],
  ["grundig", "Grundig"],
  ["whirlpool", "Whirlpool"],
  ["electrolux", "Electrolux"],
  ["hotpoint", "Hotpoint"],
  ["diger", "Diğer"],
]);

const SMALL_APPLIANCE_BRANDS = brands([
  ["philips", "Philips"],
  ["tefal", "Tefal"],
  ["arcelik", "Arçelik"],
  ["beko", "Beko"],
  ["karaca", "Karaca"],
  ["fakir", "Fakir"],
  ["dyson", "Dyson"],
  ["xiaomi", "Xiaomi"],
  ["bosch", "Bosch"],
  ["braun", "Braun"],
  ["rowenta", "Rowenta"],
  ["delonghi", "De'Longhi"],
  ["kitchenaid", "KitchenAid"],
  ["sinbo", "Sinbo"],
  ["diger", "Diğer"],
]);

const CAMERA_BRANDS = brands([
  ["canon", "Canon"],
  ["nikon", "Nikon"],
  ["sony", "Sony"],
  ["fujifilm", "Fujifilm"],
  ["olympus", "Olympus / OM System"],
  ["panasonic", "Panasonic"],
  ["gopro", "GoPro"],
  ["dji", "DJI"],
  ["leica", "Leica"],
  ["diger", "Diğer"],
]);

const CONSOLE_BRANDS = brands([
  ["sony", "Sony (PlayStation)"],
  ["microsoft", "Microsoft (Xbox)"],
  ["nintendo", "Nintendo"],
  ["steam", "Steam Deck / PC Handheld"],
  ["logitech", "Logitech"],
  ["razer", "Razer"],
  ["diger", "Diğer"],
]);

const FURNITURE_BRANDS = brands([
  ["ikea", "IKEA"],
  ["bellona", "Bellona"],
  ["istikbal", "İstikbal"],
  ["dogtas", "Doğtaş"],
  ["yatas", "Yataş"],
  ["bellona-mondial", "Mondi"],
  ["english-home", "English Home"],
  ["english-home-ev", "English Home Ev"],
  ["karaca-home", "Karaca Home"],
  ["madame-coco", "Madame Coco"],
  ["koton-home", "Koton Home"],
  ["diger", "Diğer"],
]);

const FASHION_BRANDS = brands([
  ["zara", "Zara"],
  ["hm", "H&M"],
  ["mavi", "Mavi"],
  ["lcw", "LC Waikiki"],
  ["defacto", "Defacto"],
  ["koton", "Koton"],
  ["colins", "Colin's"],
  ["pullbear", "Pull&Bear"],
  ["bershka", "Bershka"],
  ["mango", "Mango"],
  ["nike", "Nike"],
  ["adidas", "Adidas"],
  ["puma", "Puma"],
  ["under-armour", "Under Armour"],
  ["tommy", "Tommy Hilfiger"],
  ["calvin-klein", "Calvin Klein"],
  ["levis", "Levi's"],
  ["network", "Network"],
  ["ipekyol", "İpekyol"],
  ["twist", "Twist"],
  ["diger", "Diğer"],
]);

const SHOE_BRANDS = brands([
  ["nike", "Nike"],
  ["adidas", "Adidas"],
  ["puma", "Puma"],
  ["new-balance", "New Balance"],
  ["skechers", "Skechers"],
  ["converse", "Converse"],
  ["vans", "Vans"],
  ["reebok", "Reebok"],
  ["asics", "Asics"],
  ["timberland", "Timberland"],
  ["caterpillar", "Caterpillar"],
  ["flo", "FLO"],
  ["hotiç", "Hotiç"],
  ["inci", "İnci"],
  ["diger", "Diğer"],
]);

const BAG_BRANDS = brands([
  ["michael-kors", "Michael Kors"],
  ["guess", "Guess"],
  ["tommy", "Tommy Hilfiger"],
  ["samsonite", "Samsonite"],
  ["american-tourister", "American Tourister"],
  ["nike", "Nike"],
  ["adidas", "Adidas"],
  ["lcw", "LC Waikiki"],
  ["diger", "Diğer"],
]);

const WATCH_FASHION_BRANDS = brands([
  ["casio", "Casio"],
  ["seiko", "Seiko"],
  ["citizen", "Citizen"],
  ["tissot", "Tissot"],
  ["fossil", "Fossil"],
  ["michael-kors", "Michael Kors"],
  ["swatch", "Swatch"],
  ["orient", "Orient"],
  ["daniel-wellington", "Daniel Wellington"],
  ["guess", "Guess"],
  ["diger", "Diğer"],
]);

const BEAUTY_BRANDS = brands([
  ["loreal", "L'Oréal"],
  ["maybelline", "Maybelline"],
  ["nivea", "Nivea"],
  ["neutrogena", "Neutrogena"],
  ["la-roche", "La Roche-Posay"],
  ["vichy", "Vichy"],
  ["the-ordinary", "The Ordinary"],
  ["cerave", "CeraVe"],
  ["garnier", "Garnier"],
  ["flormar", "Flormar"],
  ["golden-rose", "Golden Rose"],
  ["mac", "MAC"],
  ["clinique", "Clinique"],
  ["esteelauder", "Estée Lauder"],
  ["dior", "Dior"],
  ["chanel", "Chanel"],
  ["diger", "Diğer"],
]);

const BABY_BRANDS = brands([
  ["chicco", "Chicco"],
  ["joie", "Joie"],
  ["maxi-cosi", "Maxi-Cosi"],
  ["cybex", "Cybex"],
  ["peg-perego", "Peg Perego"],
  ["inglesina", "Inglesina"],
  ["babybjorn", "BabyBjörn"],
  ["philips-avent", "Philips Avent"],
  ["mam", "MAM"],
  ["hipp", "HiPP"],
  ["prima", "Prima"],
  ["molfix", "Molfix"],
  ["diger", "Diğer"],
]);

const SPORT_BRANDS = brands([
  ["nike", "Nike"],
  ["adidas", "Adidas"],
  ["puma", "Puma"],
  ["under-armour", "Under Armour"],
  ["decathlon", "Decathlon / Quechua"],
  ["the-north-face", "The North Face"],
  ["columbia", "Columbia"],
  ["salomon", "Salomon"],
  ["asics", "Asics"],
  ["wilson", "Wilson"],
  ["diger", "Diğer"],
]);

const BIKE_BRANDS = brands([
  ["bianchi", "Bianchi"],
  ["trek", "Trek"],
  ["giant", "Giant"],
  ["merida", "Merida"],
  ["salcano", "Salcano"],
  ["kron", "Kron"],
  ["carraro", "Carraro"],
  ["btwin", "B'Twin"],
  ["diger", "Diğer"],
]);

const TOOL_BRANDS = brands([
  ["bosch", "Bosch"],
  ["makita", "Makita"],
  ["dewalt", "DeWalt"],
  ["milwaukee", "Milwaukee"],
  ["black-decker", "Black+Decker"],
  ["stanley", "Stanley"],
  ["hilti", "Hilti"],
  ["metabo", "Metabo"],
  ["dremel", "Dremel"],
  ["diger", "Diğer"],
]);

const TOY_BRANDS = brands([
  ["lego", "LEGO"],
  ["barbie", "Barbie"],
  ["hot-wheels", "Hot Wheels"],
  ["fisher-price", "Fisher-Price"],
  ["playmobil", "Playmobil"],
  ["nerf", "Nerf"],
  ["hasbro", "Hasbro"],
  ["mattel", "Mattel"],
  ["funko", "Funko"],
  ["diger", "Diğer"],
]);

const GUITAR_BRANDS = brands([
  ["fender", "Fender"],
  ["gibson", "Gibson"],
  ["yamaha", "Yamaha"],
  ["ibanez", "Ibanez"],
  ["cort", "Cort"],
  ["epiphone", "Epiphone"],
  ["squier", "Squier"],
  ["diger", "Diğer"],
]);

const MACHINE_BRANDS = brands([
  ["caterpillar", "Caterpillar"],
  ["komatsu", "Komatsu"],
  ["hitachi", "Hitachi"],
  ["volvo", "Volvo"],
  ["jcb", "JCB"],
  ["liebherr", "Liebherr"],
  ["hidromek", "Hidromek"],
  ["case", "Case"],
  ["new-holland", "New Holland"],
  ["john-deere", "John Deere"],
  ["massey", "Massey Ferguson"],
  ["diger", "Diğer"],
]);

/** Popüler telefon modelleri (ilan formu) */
export const SHOP_PHONE_MODELS: Record<string, string[]> = {
  Apple: [
    "iPhone 16 Pro Max",
    "iPhone 16 Pro",
    "iPhone 16",
    "iPhone 16e",
    "iPhone 15 Pro Max",
    "iPhone 15 Pro",
    "iPhone 15",
    "iPhone 14 Pro Max",
    "iPhone 14 Pro",
    "iPhone 14",
    "iPhone 13",
    "iPhone 12",
    "iPhone SE",
    "Diğer",
  ],
  Samsung: [
    "Galaxy S25 Ultra",
    "Galaxy S25+",
    "Galaxy S25",
    "Galaxy S24 Ultra",
    "Galaxy S24",
    "Galaxy Z Fold6",
    "Galaxy Z Flip6",
    "Galaxy A55",
    "Galaxy A35",
    "Galaxy A16",
    "Diğer",
  ],
  Xiaomi: ["14 Ultra", "14T Pro", "14T", "Redmi Note 14", "Redmi Note 13", "Poco X6", "Diğer"],
  Huawei: ["Pura 70 Ultra", "Pura 70", "nova 12", "Mate 60", "Diğer"],
  Oppo: ["Find X8", "Reno 12", "A79", "Diğer"],
  Realme: ["GT 6", "12 Pro+", "Note 50", "Diğer"],
  Google: ["Pixel 9 Pro", "Pixel 9", "Pixel 8a", "Diğer"],
  OnePlus: ["13", "12", "Nord 4", "Diğer"],
  Honor: ["Magic7", "200 Pro", "Diğer"],
  Vivo: ["X200", "V40", "Diğer"],
  Motorola: ["Edge 50", "G85", "Diğer"],
  Nokia: ["G42", "XR21", "Diğer"],
  "General Mobile": ["GM 24", "GM 23", "Diğer"],
  Casper: ["VIA F30", "VIA M40", "Diğer"],
  Reeder: ["S19 Max", "P13 Blue", "Diğer"],
  Diğer: ["Diğer"],
};

/** Sahibinden / Hepsiburada tarzı — alışveriş alt kategorisinin altındaki dallar */
export const SHOP_BROWSE_CHILDREN: Record<string, ShopChildDef[]> = {
  /* ——— ELEKTRONİK ——— */
  "cep-telefonu": [
    type("akilli-telefon", "Akıllı Telefon", PHONE_BRANDS),
    type("tuslu-telefon", "Tuşlu Telefon", [
      brand("nokia", "Nokia"),
      brand("general-mobile", "General Mobile"),
      brand("diger", "Diğer"),
    ]),
    type("akilli-saat", "Akıllı Saat & Bileklik", WATCH_BRANDS),
    type("kulaklik", "Kulaklık & Bluetooth", [
      brand("apple", "Apple"),
      brand("samsung", "Samsung"),
      brand("sony", "Sony"),
      brand("jbl", "JBL"),
      brand("xiaomi", "Xiaomi"),
      brand("huawei", "Huawei"),
      brand("bose", "Bose"),
      brand("sennheiser", "Sennheiser"),
      brand("anker", "Anker / Soundcore"),
      brand("diger", "Diğer"),
    ]),
    type("sarj-powerbank", "Şarj & Powerbank", [
      brand("anker", "Anker"),
      brand("baseus", "Baseus"),
      brand("xiaomi", "Xiaomi"),
      brand("samsung", "Samsung"),
      brand("apple", "Apple"),
      brand("diger", "Diğer"),
    ]),
    type("kilif-aksesuar", "Kılıf & Koruyucu", [
      brand("spigen", "Spigen"),
      brand("apple", "Apple"),
      brand("samsung", "Samsung"),
      brand("baseus", "Baseus"),
      brand("ugreen", "Ugreen"),
      brand("diger", "Diğer"),
    ]),
    type("diger-aksesuar", "Diğer Aksesuar", [
      brand("spigen", "Spigen"),
      brand("baseus", "Baseus"),
      brand("anker", "Anker"),
      brand("ugreen", "Ugreen"),
      brand("diger", "Diğer"),
    ]),
  ],

  bilgisayar: [
    type("dizustu", "Dizüstü (Notebook)", LAPTOP_BRANDS),
    type("masaustu", "Masaüstü", LAPTOP_BRANDS),
    type("oyun-bilgisayari", "Oyuncu Bilgisayarı", LAPTOP_BRANDS),
    type("all-in-one", "All-in-One", [
      brand("apple", "Apple"),
      brand("hp", "HP"),
      brand("lenovo", "Lenovo"),
      brand("dell", "Dell"),
      brand("asus", "Asus"),
      brand("diger", "Diğer"),
    ]),
    type("monitor", "Monitör", [
      brand("samsung", "Samsung"),
      brand("lg", "LG"),
      brand("asus", "Asus"),
      brand("benq", "BenQ"),
      brand("dell", "Dell"),
      brand("msi", "MSI"),
      brand("aoc", "AOC"),
      brand("philips", "Philips"),
      brand("diger", "Diğer"),
    ]),
    type("yazici-tarayici", "Yazıcı & Tarayıcı", [
      brand("hp", "HP"),
      brand("canon", "Canon"),
      brand("epson", "Epson"),
      brand("brother", "Brother"),
      brand("xerox", "Xerox"),
      brand("diger", "Diğer"),
    ]),
    type("bilgisayar-parcasi", "Parça (RAM, SSD, Ekran Kartı…)", PC_COMPONENT_BRANDS),
    type("cevre-birimi", "Klavye, Mouse & Çevre Birimi", [
      brand("logitech", "Logitech"),
      brand("razer", "Razer"),
      brand("corsair", "Corsair"),
      brand("steelseries", "SteelSeries"),
      brand("microsoft", "Microsoft"),
      brand("diger", "Diğer"),
    ]),
    type("network", "Network & Modem", [
      brand("tp-link", "TP-Link"),
      brand("asus", "Asus"),
      brand("huawei", "Huawei"),
      brand("xiaomi", "Xiaomi"),
      brand("netgear", "Netgear"),
      brand("diger", "Diğer"),
    ]),
    type("yazilim", "Yazılım", [
      brand("microsoft", "Microsoft"),
      brand("adobe", "Adobe"),
      brand("kaspersky", "Kaspersky"),
      brand("norton", "Norton"),
      brand("diger", "Diğer"),
    ]),
  ],

  tablet: [
    ...TABLET_BRANDS,
    type("tablet-aksesuar", "Tablet Aksesuar", [
      brand("apple", "Apple"),
      brand("samsung", "Samsung"),
      brand("logitech", "Logitech"),
      brand("diger", "Diğer"),
    ]),
  ],

  "tv-goruntu-ses": [
    type("televizyon", "Televizyon", TV_BRANDS),
    type("projeksiyon", "Projeksiyon", [
      brand("epson", "Epson"),
      brand("benq", "BenQ"),
      brand("xiaomi", "Xiaomi"),
      brand("samsung", "Samsung"),
      brand("diger", "Diğer"),
    ]),
    type("ses-sistemi", "Ses Sistemi & Soundbar", [
      brand("sony", "Sony"),
      brand("jbl", "JBL"),
      brand("samsung", "Samsung"),
      brand("lg", "LG"),
      brand("bose", "Bose"),
      brand("harman-kardon", "Harman Kardon"),
      brand("diger", "Diğer"),
    ]),
    type("ev-sinemasi", "Ev Sineması", [
      brand("samsung", "Samsung"),
      brand("lg", "LG"),
      brand("sony", "Sony"),
      brand("bose", "Bose"),
      brand("yamaha", "Yamaha"),
      brand("diger", "Diğer"),
    ]),
    type("uydu-receiver", "Uydu & Receiver", [
      brand("digiturk", "Digiturk"),
      brand("dsmart", "D-Smart"),
      brand("vestel", "Vestel"),
      brand("diger", "Diğer"),
    ]),
    type("media-player", "Media Player", [
      brand("xiaomi", "Xiaomi"),
      brand("apple", "Apple"),
      brand("nvidia", "NVIDIA Shield"),
      brand("amazon", "Amazon Fire TV"),
      brand("diger", "Diğer"),
    ]),
  ],

  "beyaz-esya": [
    type("buzdolabi", "Buzdolabı", APPLIANCE_BRANDS),
    type("camasir-makinesi", "Çamaşır Makinesi", APPLIANCE_BRANDS),
    type("bulasik-makinesi", "Bulaşık Makinesi", APPLIANCE_BRANDS),
    type("kurutma-makinesi", "Kurutma Makinesi", APPLIANCE_BRANDS),
    type("firin-ocak", "Fırın & Ocak", APPLIANCE_BRANDS),
    type("davulumba", "Davlumbaz", APPLIANCE_BRANDS),
    type("klima", "Klima", [
      ...APPLIANCE_BRANDS.filter((b) => b.slug !== "whirlpool"),
      brand("daikin", "Daikin"),
      brand("mitsubishi", "Mitsubishi"),
      brand("airfel", "Airfel"),
      brand("baymak", "Baymak"),
    ]),
    type("kombi-termosifon", "Kombi & Termosifon", [
      brand("demirdokum", "Demirdöküm"),
      brand("vaillant", "Vaillant"),
      brand("buderus", "Buderus"),
      brand("baymak", "Baymak"),
      brand("eca", "E.C.A."),
      brand("arcelik", "Arçelik"),
      brand("diger", "Diğer"),
    ]),
    type("diger-beyaz-esya", "Diğer", APPLIANCE_BRANDS),
  ],

  "elektrikli-ev-aletleri": [
    type("supurge", "Süpürge", SMALL_APPLIANCE_BRANDS),
    type("utuler", "Ütü", SMALL_APPLIANCE_BRANDS),
    type("kahve-cay", "Kahve & Çay Makinesi", SMALL_APPLIANCE_BRANDS),
    type("blender-mikser", "Blender & Mikser", SMALL_APPLIANCE_BRANDS),
    type("tost-mikrodalga", "Tost & Mikrodalga", SMALL_APPLIANCE_BRANDS),
    type("hava-fritozu", "Airfryer", SMALL_APPLIANCE_BRANDS),
    type("robot-supurge", "Robot Süpürge", [
      brand("dyson", "Dyson"),
      brand("xiaomi", "Xiaomi"),
      brand("roborock", "Roborock"),
      brand("ecovacs", "Ecovacs"),
      brand("irobot", "iRobot"),
      brand("philips", "Philips"),
      brand("diger", "Diğer"),
    ]),
    type("diger-kucuk-ev", "Diğer Küçük Ev Aleti", SMALL_APPLIANCE_BRANDS),
  ],

  "ev-elektronigi": [
    type("isiticilar", "Isıtıcı & Fan", SMALL_APPLIANCE_BRANDS),
    type("nem-alici", "Nem Alma & Hava Temizleyici", [
      brand("philips", "Philips"),
      brand("xiaomi", "Xiaomi"),
      brand("dyson", "Dyson"),
      brand("sharp", "Sharp"),
      brand("diger", "Diğer"),
    ]),
    type("utu-makinesi", "Dikiş & Ütü Makinesi", [
      brand("philips", "Philips"),
      brand("tefal", "Tefal"),
      brand("rowenta", "Rowenta"),
      brand("arcelik", "Arçelik"),
      brand("singer", "Singer"),
      brand("diger", "Diğer"),
    ]),
    type("su-aritma", "Su Arıtma", [
      brand("brita", "BRITA"),
      brand("aqua", "Aqua"),
      brand("diger", "Diğer"),
    ]),
    type("diger-ev-elektronik", "Diğer", [
      brand("philips", "Philips"),
      brand("xiaomi", "Xiaomi"),
      brand("arcelik", "Arçelik"),
      brand("diger", "Diğer"),
    ]),
  ],

  "oyun-konsol": [
    type("konsol", "Oyun Konsolu", CONSOLE_BRANDS),
    type("oyun", "Oyun (CD / Dijital)", [
      brand("sony", "Sony"),
      brand("microsoft", "Microsoft"),
      brand("nintendo", "Nintendo"),
      brand("steam", "Steam"),
      brand("diger", "Diğer"),
    ]),
    type("konsol-aksesuar", "Kol, Kulaklık & Aksesuar", CONSOLE_BRANDS),
  ],

  "fotograf-kamera": [
    type("fotograf-makinesi", "Fotoğraf Makinesi", CAMERA_BRANDS),
    type("video-kamera", "Video Kamera", CAMERA_BRANDS),
    type("drone", "Drone", [
      brand("dji", "DJI"),
      brand("autel", "Autel"),
      brand("holy-stone", "Holy Stone"),
      brand("diger", "Diğer"),
    ]),
    type("objektif", "Objektif", CAMERA_BRANDS),
    type("tripod-aksesuar", "Tripod & Aksesuar", [
      brand("manfrotto", "Manfrotto"),
      brand("joby", "Joby"),
      brand("sirui", "Sirui"),
      brand("ulanzi", "Ulanzi"),
      brand("diger", "Diğer"),
    ]),
  ],

  "teknik-elektronik": [
    type("elektronik-komponent", "Elektronik Komponent", [
      brand("arduino", "Arduino"),
      brand("sparkfun", "SparkFun"),
      brand("adafruit", "Adafruit"),
      brand("diger", "Diğer"),
    ]),
    type("arduino-raspberry", "Arduino / Raspberry / Maker", [
      brand("arduino", "Arduino"),
      brand("raspberry", "Raspberry Pi"),
      brand("esp", "ESP / NodeMCU"),
      brand("diger", "Diğer"),
    ]),
    type("olcum-cihazi", "Ölçüm Cihazı", [
      brand("fluke", "Fluke"),
      brand("uni-t", "UNI-T"),
      brand("diger", "Diğer"),
    ]),
    type("guvenlik-kamera", "Güvenlik Kamerası", [
      brand("hikvision", "Hikvision"),
      brand("dahua", "Dahua"),
      brand("xiaomi", "Xiaomi"),
      brand("tp-link", "TP-Link Tapo"),
      brand("reolink", "Reolink"),
      brand("diger", "Diğer"),
    ]),
    type("telsiz-haberlesme", "Telsiz & Haberleşme", [
      brand("motorola", "Motorola"),
      brand("baofeng", "Baofeng"),
      brand("midland", "Midland"),
      brand("diger", "Diğer"),
    ]),
    type("diger-teknik", "Diğer", [
      brand("xiaomi", "Xiaomi"),
      brand("tp-link", "TP-Link"),
      brand("diger", "Diğer"),
    ]),
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
      ...FURNITURE_BRANDS,
    ]),
    type("ev-tekstili", "Ev Tekstili", FURNITURE_BRANDS),
    type("aydinlatma", "Aydınlatma", [
      brand("philips", "Philips"),
      brand("osram", "Osram"),
      brand("ikea", "IKEA"),
      brand("diger", "Diğer"),
    ]),
    type("dekoratif", "Dekoratif Ürünler", [
      brand("ikea", "IKEA"),
      brand("english-home", "English Home"),
      brand("madame-coco", "Madame Coco"),
      brand("karaca-home", "Karaca Home"),
      brand("diger", "Diğer"),
    ]),
    type("mutfak-gerecleri", "Mutfak Gereçleri", [
      brand("karaca", "Karaca"),
      brand("pasabahce", "Paşabahçe"),
      brand("tefal", "Tefal"),
      brand("fissler", "Fissler"),
      brand("english-home", "English Home"),
      brand("diger", "Diğer"),
    ]),
    type("banyo", "Banyo Ürünleri", [
      brand("english-home", "English Home"),
      brand("madame-coco", "Madame Coco"),
      brand("karaca-home", "Karaca Home"),
      brand("diger", "Diğer"),
    ]),
    type("hali-kilim", "Halı & Kilim", [
      brand("english-home", "English Home"),
      brand("madame-coco", "Madame Coco"),
      brand("ikea", "IKEA"),
      brand("diger", "Diğer"),
    ]),
    type("perde", "Perde & Stor", [
      brand("ikea", "IKEA"),
      brand("english-home", "English Home"),
      brand("bellona", "Bellona"),
      brand("diger", "Diğer"),
    ]),
  ],

  "bahce-yapi-market": [
    type("bahce-mobilyasi", "Bahçe Mobilyası", [
      brand("ikea", "IKEA"),
      brand("decathlon", "Decathlon"),
      brand("diger", "Diğer"),
    ]),
    type("bahce-aletleri", "Bahçe Aletleri", TOOL_BRANDS),
    type("cayir-bicme", "Çim Biçme & Budama", TOOL_BRANDS),
    type("sulama", "Sulama Sistemi", [
      brand("gardena", "Gardena"),
      brand("rainbird", "Rain Bird"),
      brand("hunter", "Hunter"),
      brand("diger", "Diğer"),
    ]),
    type("yapi-malzeme", "Yapı Malzemesi", [
      brand("kale", "Kale"),
      brand("seranit", "Seranit"),
      brand("vitra", "VitrA"),
      brand("ewe", "EWE"),
      brand("diger", "Diğer"),
    ]),
    type("el-aleti", "El Aleti & Takım", TOOL_BRANDS),
    type("elektrikli-el-aleti", "Elektrikli El Aleti", TOOL_BRANDS),
    type("boya-yalitim", "Boya & Yalıtım", [
      brand("marshall", "Marshall"),
      brand("filli-boya", "Filli Boya"),
      brand("polisan", "Polisan"),
      brand("diger", "Diğer"),
    ]),
    type("tesisat", "Tesisat Malzemesi", [
      brand("ewe", "EWE"),
      brand("vito", "Vito"),
      brand("firat", "Fırat"),
      brand("pilsa", "Pilsa"),
      brand("diger", "Diğer"),
    ]),
  ],

  "pet-shop": [
    type("kopek", "Köpek Ürünleri", [
      brand("royal-canin", "Royal Canin"),
      brand("pro-plan", "Pro Plan"),
      brand("pedigree", "Pedigree"),
      brand("hills", "Hill's"),
      brand("diger", "Diğer"),
    ]),
    type("kedi", "Kedi Ürünleri", [
      brand("royal-canin", "Royal Canin"),
      brand("whiskas", "Whiskas"),
      brand("pro-plan", "Pro Plan"),
      brand("hills", "Hill's"),
      brand("diger", "Diğer"),
    ]),
    type("kus", "Kuş Ürünleri", [
      brand("vitakraft", "Vitakraft"),
      brand("versele", "Versele-Laga"),
      brand("diger", "Diğer"),
    ]),
    type("akvaryum", "Akvaryum", [
      brand("sera", "Sera"),
      brand("tetra", "Tetra"),
      brand("eheim", "Eheim"),
      brand("diger", "Diğer"),
    ]),
    type("kemirgen", "Kemirgen & Diğer", [
      brand("versele", "Versele-Laga"),
      brand("vitakraft", "Vitakraft"),
      brand("diger", "Diğer"),
    ]),
    type("mama-kumu", "Mama & Kum", [
      brand("royal-canin", "Royal Canin"),
      brand("pro-plan", "Pro Plan"),
      brand("hills", "Hill's"),
      brand("diger", "Diğer"),
    ]),
  ],

  "yiyecek-icecek": [
    type("gida", "Gıda", [
      brand("ulker", "Ülker"),
      brand("eti", "Eti"),
      brand("pinar", "Pınar"),
      brand("sutas", "Sütaş"),
      brand("diger", "Diğer"),
    ]),
    type("icecek", "İçecek", [
      brand("coca-cola", "Coca-Cola"),
      brand("pepsi", "Pepsi"),
      brand("nescafe", "Nescafé"),
      brand("caykur", "Çaykur"),
      brand("diger", "Diğer"),
    ]),
    type("organik", "Organik / Doğal", [
      brand("torku", "Torku"),
      brand("city-farm", "City Farm"),
      brand("anavarza", "Anavarza"),
      brand("diger", "Diğer"),
    ]),
    type("vitamin-takviye", "Vitamin & Takviye", [
      brand("solgar", "Solgar"),
      brand("dynavit", "Dynavit"),
      brand("ocean", "Ocean / Ocean Naturel"),
      brand("diger", "Diğer"),
    ]),
  ],

  "ofis-kirtasiye": [
    type("kirtasiye", "Kırtasiye", [
      brand("stabilo", "Stabilo"),
      brand("faber", "Faber-Castell"),
      brand("pilot", "Pilot"),
      brand("bic", "BIC"),
      brand("diger", "Diğer"),
    ]),
    type("ofis-mobilya", "Ofis Mobilyası", [
      brand("ikea", "IKEA"),
      brand("nurus", "Nurus"),
      brand("koleksiyon", "Koleksiyon"),
      brand("diger", "Diğer"),
    ]),
    type("yazici-malzeme", "Toner & Kartuş", [
      brand("hp", "HP"),
      brand("canon", "Canon"),
      brand("epson", "Epson"),
      brand("diger", "Diğer"),
    ]),
    type("organizasyon", "Dosyalama & Organizasyon", [
      brand("leitz", "Leitz"),
      brand("durable", "Durable"),
      brand("maped", "Maped"),
      brand("diger", "Diğer"),
    ]),
  ],

  /* ——— MODA ——— */
  "giyim-aksesuar": [
    type("kadin-giyim", "Kadın Giyim", FASHION_BRANDS),
    type("erkek-giyim", "Erkek Giyim", FASHION_BRANDS),
    type("cocuk-giyim", "Çocuk Giyim", FASHION_BRANDS),
    type("ust-giyim", "Mont, Ceket & Kaban", FASHION_BRANDS),
    type("alt-giyim", "Pantolon & Etek", FASHION_BRANDS),
    type("elbise", "Elbise", FASHION_BRANDS),
    type("spor-giyim", "Spor Giyim", SPORT_BRANDS),
    type("ic-giyim", "İç Giyim & Pijama", [
      brand("penti", "Penti"),
      brand("lcw", "LC Waikiki"),
      brand("defacto", "Defacto"),
      brand("calvin-klein", "Calvin Klein"),
      brand("diger", "Diğer"),
    ]),
    type("aksesuar-giyim", "Şapka, Atkı & Kemer", [
      brand("nike", "Nike"),
      brand("adidas", "Adidas"),
      brand("tommy", "Tommy Hilfiger"),
      brand("lcw", "LC Waikiki"),
      brand("diger", "Diğer"),
    ]),
  ],

  "ayakkabi-canta": [
    type("kadin-ayakkabi", "Kadın Ayakkabı", SHOE_BRANDS),
    type("erkek-ayakkabi", "Erkek Ayakkabı", SHOE_BRANDS),
    type("cocuk-ayakkabi", "Çocuk Ayakkabı", SHOE_BRANDS),
    type("spor-ayakkabi", "Spor Ayakkabı", SHOE_BRANDS),
    type("bot-cizme", "Bot & Çizme", SHOE_BRANDS),
    type("canta", "Çanta & Bavul", BAG_BRANDS),
    type("cüzdan", "Cüzdan & Kartlık", [
      brand("tommy", "Tommy Hilfiger"),
      brand("guess", "Guess"),
      brand("michael-kors", "Michael Kors"),
      brand("diger", "Diğer"),
    ]),
  ],

  "saat-taki": [
    type("kol-saati", "Kol Saati", WATCH_FASHION_BRANDS),
    type("akilli-saat-moda", "Akıllı Saat", WATCH_BRANDS),
    type("yuzuk", "Yüzük", [
      brand("pandora", "Pandora"),
      brand("swarovski", "Swarovski"),
      brand("altinbas", "Altınbaş"),
      brand("atasay", "Atasay"),
      brand("diger", "Diğer"),
    ]),
    type("kolye", "Kolye", [
      brand("pandora", "Pandora"),
      brand("swarovski", "Swarovski"),
      brand("altinbas", "Altınbaş"),
      brand("atasay", "Atasay"),
      brand("diger", "Diğer"),
    ]),
    type("kupe", "Küpe", [
      brand("pandora", "Pandora"),
      brand("swarovski", "Swarovski"),
      brand("altinbas", "Altınbaş"),
      brand("atasay", "Atasay"),
      brand("diger", "Diğer"),
    ]),
    type("bileklik", "Bileklik", [
      brand("pandora", "Pandora"),
      brand("swarovski", "Swarovski"),
      brand("altinbas", "Altınbaş"),
      brand("atasay", "Atasay"),
      brand("diger", "Diğer"),
    ]),
    type("set-taki", "Takı Seti", [
      brand("pandora", "Pandora"),
      brand("swarovski", "Swarovski"),
      brand("altinbas", "Altınbaş"),
      brand("atasay", "Atasay"),
      brand("diger", "Diğer"),
    ]),
  ],

  "kisisel-bakim": [
    type("cilt-bakim", "Cilt Bakım", BEAUTY_BRANDS),
    type("makyaj", "Makyaj", BEAUTY_BRANDS),
    type("sac-bakim", "Saç Bakım", BEAUTY_BRANDS),
    type("parfum", "Parfüm", [
      brand("dior", "Dior"),
      brand("chanel", "Chanel"),
      brand("calvin-klein", "Calvin Klein"),
      brand("versace", "Versace"),
      brand("hugo-boss", "Hugo Boss"),
      brand("lacoste", "Lacoste"),
      brand("diger", "Diğer"),
    ]),
    type("tiras-epilasyon", "Tıraş & Epilasyon", [
      brand("braun", "Braun"),
      brand("philips", "Philips"),
      brand("gillette", "Gillette"),
      brand("remington", "Remington"),
      brand("diger", "Diğer"),
    ]),
    type("agiz-bakim", "Ağız Bakım", [
      brand("oral-b", "Oral-B"),
      brand("colgate", "Colgate"),
      brand("philips", "Philips Sonicare"),
      brand("listerine", "Listerine"),
      brand("diger", "Diğer"),
    ]),
    type("erkek-bakim", "Erkek Bakım", [
      brand("nivea", "Nivea Men"),
      brand("gillette", "Gillette"),
      brand("old-spice", "Old Spice"),
      brand("axe", "Axe"),
      brand("diger", "Diğer"),
    ]),
  ],

  "anne-bebek": [
    type("bebek-arabasi", "Bebek Arabası", BABY_BRANDS),
    type("oto-koltugu", "Oto Koltuğu", BABY_BRANDS),
    type("mama-sandalyesi", "Mama Sandalyesi", BABY_BRANDS),
    type("bebek-giyim", "Bebek Giyim", [
      brand("lcw", "LC Waikiki"),
      brand("defacto", "Defacto"),
      brand("koton", "Koton"),
      brand("mothercare", "Mothercare"),
      brand("diger", "Diğer"),
    ]),
    type("bebek-bakim", "Bebek Bakım", BABY_BRANDS),
    type("oyuncak-bebek", "Bebek Oyuncak", TOY_BRANDS),
    type("emzirme", "Emzirme & Beslenme", BABY_BRANDS),
    type("hamile", "Hamile Giyim", [
      brand("lcw", "LC Waikiki"),
      brand("defacto", "Defacto"),
      brand("koton", "Koton"),
      brand("mothercare", "Mothercare"),
      brand("diger", "Diğer"),
    ]),
  ],

  /* ——— HOBİ & SPOR ——— */
  "spor-outdoor": [
    type("fitness", "Fitness & Kondisyon", SPORT_BRANDS),
    type("bisiklet", "Bisiklet", BIKE_BRANDS),
    type("kamp-outdoor", "Kamp & Outdoor", SPORT_BRANDS),
    type("yuruyus-kosu", "Yürüyüş & Koşu", SPORT_BRANDS),
    type("futbol", "Futbol", SPORT_BRANDS),
    type("basketbol", "Basketbol", SPORT_BRANDS),
    type("raket-sporlari", "Tenis / Badminton / Masa Tenisi", [
      brand("wilson", "Wilson"),
      brand("babolat", "Babolat"),
      brand("yonex", "Yonex"),
      brand("diger", "Diğer"),
    ]),
    type("su-sporlari", "Su Sporları", [
      brand("decathlon", "Decathlon"),
      brand("speedo", "Speedo"),
      brand("arena", "Arena"),
      brand("diger", "Diğer"),
    ]),
    type("kis-sporlari", "Kış Sporları", [
      brand("salomon", "Salomon"),
      brand("burton", "Burton"),
      brand("rossignol", "Rossignol"),
      brand("atomic", "Atomic"),
      brand("diger", "Diğer"),
    ]),
    type("dalis-balik", "Dalış & Balıkçılık", [
      brand("shimano", "Shimano"),
      brand("daiwa", "Daiwa"),
      brand("okuma", "Okuma"),
      brand("cressi", "Cressi"),
      brand("diger", "Diğer"),
    ]),
    type("diger-spor", "Diğer Spor", SPORT_BRANDS),
  ],

  "hobi-oyuncak": [
    type("lego-yapboz", "LEGO & Yapboz", TOY_BRANDS),
    type("modelcilik", "Modelcilik & RC", [
      brand("tamiya", "Tamiya"),
      brand("revell", "Revell"),
      brand("traxxas", "Traxxas"),
      brand("hpi", "HPI"),
      brand("diger", "Diğer"),
    ]),
    type("koleksiyon-figur", "Figür & Koleksiyon", TOY_BRANDS),
    type("egitici-oyuncak", "Eğitici Oyuncak", TOY_BRANDS),
    type("pelus", "Pelüş", [
      brand("disney", "Disney"),
      brand("ty", "TY"),
      brand("jellycat", "Jellycat"),
      brand("diger", "Diğer"),
    ]),
    type("board-game", "Kutu Oyunu", [
      brand("hasbro", "Hasbro"),
      brand("ravensburger", "Ravensburger"),
      brand("asmodee", "Asmodee"),
      brand("diger", "Diğer"),
    ]),
    type("hobi-malzeme", "Hobi Malzemesi", [
      brand("faber", "Faber-Castell"),
      brand("stabilo", "Stabilo"),
      brand("canson", "Canson"),
      brand("diger", "Diğer"),
    ]),
    type("diger-hobi", "Diğer", [
      brand("lego", "LEGO"),
      brand("hasbro", "Hasbro"),
      brand("diger", "Diğer"),
    ]),
  ],

  "kitap-dergi-film": [
    type("kitap", "Kitap", [
      brand("yapikredi", "Yapı Kredi"),
      brand("isbank", "İş Bankası Kültür"),
      brand("can", "Can"),
      brand("dogan", "Doğan Kitap"),
      brand("diger", "Diğer"),
    ]),
    type("ders-kitabi", "Ders Kitabı & Sınav", [
      brand("pegem", "Pegem"),
      brand("deniz", "Deniz"),
      brand("tonguc", "Tonguç"),
      brand("limit", "Limit"),
      brand("diger", "Diğer"),
    ]),
    type("dergi", "Dergi", [
      brand("dogan-burda", "Doğan Burda"),
      brand("hurriyet", "Hürriyet"),
      brand("diger", "Diğer"),
    ]),
    type("dvd-bluray", "DVD / Blu-ray", [
      brand("warner", "Warner"),
      brand("disney", "Disney"),
      brand("universal", "Universal"),
      brand("diger", "Diğer"),
    ]),
    type("vinyl-cd", "Plak & CD", [
      brand("universal", "Universal"),
      brand("sony-music", "Sony Music"),
      brand("warner", "Warner"),
      brand("diger", "Diğer"),
    ]),
  ],

  muzik: [
    type("gitar", "Gitar", GUITAR_BRANDS),
    type("piyano-klavye", "Piyano & Klavye", [
      brand("yamaha", "Yamaha"),
      brand("casio", "Casio"),
      brand("roland", "Roland"),
      brand("korg", "Korg"),
      brand("diger", "Diğer"),
    ]),
    type("bateri-perkusyon", "Bateri & Perküsyon", [
      brand("pearl", "Pearl"),
      brand("tama", "Tama"),
      brand("yamaha", "Yamaha"),
      brand("roland", "Roland"),
      brand("diger", "Diğer"),
    ]),
    type("yayli", "Yaylı Çalgılar", [
      brand("yamaha", "Yamaha"),
      brand("stentor", "Stentor"),
      brand("strunal", "Strunal"),
      brand("diger", "Diğer"),
    ]),
    type("uflemeli", "Üflemeli", [
      brand("yamaha", "Yamaha"),
      brand("buffet", "Buffet Crampon"),
      brand("selmer", "Selmer"),
      brand("diger", "Diğer"),
    ]),
    type("dj-studio", "DJ & Stüdyo", [
      brand("pioneer", "Pioneer DJ"),
      brand("native", "Native Instruments"),
      brand("akai", "Akai"),
      brand("behringer", "Behringer"),
      brand("diger", "Diğer"),
    ]),
    type("ampli-efekt", "Amfi & Efekt", [
      brand("marshall", "Marshall"),
      brand("fender", "Fender"),
      brand("boss", "BOSS"),
      brand("orange", "Orange"),
      brand("diger", "Diğer"),
    ]),
    type("muzik-aksesuar", "Aksesuar & Nota", [
      brand("daddario", "D'Addario"),
      brand("ernie-ball", "Ernie Ball"),
      brand("planet-waves", "Planet Waves"),
      brand("diger", "Diğer"),
    ]),
  ],

  "antika-koleksiyon": [
    type("antika-mobilya", "Antika Mobilya", [
      brand("diger", "Diğer"),
    ]),
    type("eski-para", "Eski Para & Pul", [
      brand("diger", "Diğer"),
    ]),
    type("plak-koleksiyon", "Plak Koleksiyon", [
      brand("diger", "Diğer"),
    ]),
    type("oyuncak-koleksiyon", "Oyuncak Koleksiyon", [
      brand("hot-wheels", "Hot Wheels"),
      brand("lego", "LEGO"),
      brand("funko", "Funko"),
      brand("diger", "Diğer"),
    ]),
    type("sanat-eseri", "Tablo & Sanat", [
      brand("diger", "Diğer"),
    ]),
    type("diger-koleksiyon", "Diğer Koleksiyon", [
      brand("diger", "Diğer"),
    ]),
  ],

  "is-makinesi": [
    type("ekskavator", "Ekskavatör", MACHINE_BRANDS),
    type("beko-loder", "Beko Loder (Kazıcı-Yükleyici)", MACHINE_BRANDS),
    type("loder", "Loder (Yükleyici)", MACHINE_BRANDS),
    type("dozer", "Dozer", MACHINE_BRANDS),
    type("greyder", "Greyder", MACHINE_BRANDS),
    type("silindir", "Silindir", MACHINE_BRANDS),
    type("forklift", "Forklift", MACHINE_BRANDS),
    type("teleskopik", "Teleskopik Yükleyici", MACHINE_BRANDS),
    type("mobil-vinc", "Mobil Vinç", MACHINE_BRANDS),
    type("beton-pompasi", "Beton Pompası", [
      brand("putzmeister", "Putzmeister"),
      brand("schwing", "Schwing"),
      brand("cifa", "CIFA"),
      brand("diger", "Diğer"),
    ]),
    type("asfalt", "Asfalt Makinesi", [
      brand("bomag", "BOMAG"),
      brand("wirtgen", "Wirtgen"),
      brand("dynapac", "Dynapac"),
      brand("diger", "Diğer"),
    ]),
    type("sondaj", "Sondaj Makinesi", [
      brand("sandvik", "Sandvik"),
      brand("atlas", "Atlas Copco"),
      brand("caterpillar", "Caterpillar"),
      brand("diger", "Diğer"),
    ]),
    type("diger-is-makinesi", "Diğer İş Makinesi", MACHINE_BRANDS),
  ],

  "tarim-makinesi": [
    type("traktor", "Traktör", MACHINE_BRANDS),
    type("bicerdover", "Biçerdöver", MACHINE_BRANDS),
    type("pulluk-ekim", "Pulluk & Ekim", [
      brand("new-holland", "New Holland"),
      brand("john-deere", "John Deere"),
      brand("massey", "Massey Ferguson"),
      brand("diger", "Diğer"),
    ]),
    type("sulama-tarim", "Sulama", [
      brand("netafim", "Netafim"),
      brand("rainbird", "Rain Bird"),
      brand("hunter", "Hunter"),
      brand("diger", "Diğer"),
    ]),
    type("balya", "Balya & Silaj", [
      brand("new-holland", "New Holland"),
      brand("john-deere", "John Deere"),
      brand("claas", "Claas"),
      brand("diger", "Diğer"),
    ]),
    type("diger-tarim", "Diğer Tarım Makinesi", [
      brand("new-holland", "New Holland"),
      brand("john-deere", "John Deere"),
      brand("massey", "Massey Ferguson"),
      brand("diger", "Diğer"),
    ]),
  ],

  "sanayi-makinesi": [
    type("torna-freze", "Torna / Freze", [
      brand("haas", "Haas"),
      brand("dmg", "DMG Mori"),
      brand("mazak", "Mazak"),
      brand("diger", "Diğer"),
    ]),
    type("pres-kaynak", "Pres & Kaynak", [
      brand("lincoln", "Lincoln Electric"),
      brand("kemppi", "Kemppi"),
      brand("esab", "ESAB"),
      brand("diger", "Diğer"),
    ]),
    type("kompresor", "Kompresör", [
      brand("atlas", "Atlas Copco"),
      brand("ingersoll", "Ingersoll Rand"),
      brand("kaeser", "Kaeser"),
      brand("diger", "Diğer"),
    ]),
    type("jenerator", "Jeneratör", [
      brand("caterpillar", "Caterpillar"),
      brand("cummins", "Cummins"),
      brand("perkins", "Perkins"),
      brand("teksan", "Teksan"),
      brand("diger", "Diğer"),
    ]),
    type("pompa", "Pompa", [
      brand("grundfos", "Grundfos"),
      brand("wilo", "Wilo"),
      brand("ksb", "KSB"),
      brand("pedrollo", "Pedrollo"),
      brand("diger", "Diğer"),
    ]),
    type("diger-sanayi", "Diğer Sanayi", [
      brand("siemens", "Siemens"),
      brand("abb", "ABB"),
      brand("schneider", "Schneider"),
      brand("diger", "Diğer"),
    ]),
  ],

  "diger-alisveris": [
    type("diger", "Diğer", [
      brand("diger", "Diğer"),
    ]),
  ],
};

/** Seçilen alt kategori + opsiyonel subtype için marka adları */
export function shopBrandNamesFor(subSlug: string, subtype?: string | null): string[] {
  const defs = SHOP_BROWSE_CHILDREN[subSlug];
  if (!defs?.length) return [];
  const names = new Set<string>();

  function walk(list: ShopChildDef[]) {
    for (const d of list) {
      if (d.brand) names.add(d.brand);
      if (d.children?.length) walk(d.children);
    }
  }

  if (subtype) {
    const node = defs.find((d) => d.subtype === subtype);
    if (node?.children?.length) walk(node.children);
    else if (node?.brand) names.add(node.brand);
    // tablet gibi kökte doğrudan marka olanlar
    for (const d of defs) {
      if (d.brand) names.add(d.brand);
    }
  } else {
    walk(defs);
  }

  return Array.from(names).filter((n) => n && n !== "undefined");
}

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
