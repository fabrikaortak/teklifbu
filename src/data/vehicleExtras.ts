/** Sahibinden tarzı vasıta donanım / güvenlik özellikleri */

export type VehicleExtraGroup = {
  id: string;
  label: string;
  items: Array<{ id: string; label: string }>;
};

export const VEHICLE_EXTRA_GROUPS: VehicleExtraGroup[] = [
  {
    id: "guvenlik",
    label: "Güvenlik",
    items: [
      { id: "abs", label: "ABS" },
      { id: "esp", label: "ESP / VSC" },
      { id: "asr", label: "ASR / TCS" },
      { id: "ebd", label: "EBD" },
      { id: "airbag_surucu", label: "Hava Yastığı (Sürücü)" },
      { id: "airbag_yolcu", label: "Hava Yastığı (Yolcu)" },
      { id: "airbag_yan", label: "Yan Hava Yastıkları" },
      { id: "airbag_perde", label: "Perde Hava Yastıkları" },
      { id: "isofix", label: "ISOFIX" },
      { id: "alarm", label: "Alarm" },
      { id: "immobilizer", label: "Immobilizer" },
      { id: "merkezi_kilit", label: "Merkezi Kilit" },
      { id: "serit_takip", label: "Şerit Takip Sistemi" },
      { id: "kor_nokta", label: "Kör Nokta Uyarı" },
      { id: "yokus_kalkis", label: "Yokuş Kalkış Destek" },
      { id: "yorgunluk", label: "Yorgunluk Algılama" },
      { id: "gece_gorus", label: "Gece Görüş" },
      { id: "cekis_4x4", label: "4x4 / 4WD" },
    ],
  },
  {
    id: "ic",
    label: "İç Donanım",
    items: [
      { id: "deri_koltuk", label: "Deri Koltuk" },
      { id: "kumas_koltuk", label: "Kumaş Koltuk" },
      { id: "alcantara", label: "Alcantara / Spor Koltuk" },
      { id: "elektrikli_koltuk", label: "Elektrikli Koltuk" },
      { id: "isitmali_koltuk", label: "Isıtmalı Koltuk" },
      { id: "sogutmali_koltuk", label: "Soğutmalı Koltuk" },
      { id: "masaj_koltuk", label: "Masajlı Koltuk" },
      { id: "memory_koltuk", label: "Memory Koltuk" },
      { id: "klima", label: "Klima" },
      { id: "otomatik_klima", label: "Otomatik Klima" },
      { id: "sunroof", label: "Sunroof" },
      { id: "panoramik_tavan", label: "Panoramik Tavan" },
      { id: "elektrikli_cam", label: "Elektrikli Camlar" },
      { id: "ayarli_direksiyon", label: "Ayarlanabilir Direksiyon" },
      { id: "isitmali_direksiyon", label: "Isıtmalı Direksiyon" },
      { id: "derin_direksiyon", label: "Deri Direksiyon" },
      { id: "yagmur_sensor", label: "Yağmur Sensörü" },
      { id: "isik_sensor", label: "Işık Sensörü" },
      { id: "start_stop", label: "Start / Stop" },
      { id: "anahtarsiz_giris", label: "Anahtarsız Giriş" },
      { id: "keyless_go", label: "Keyless Go" },
      { id: "cruise", label: "Hız Sabitleyici" },
      { id: "adaptif_cruise", label: "Adaptif Cruise Control" },
      { id: "head_up", label: "Head-Up Display" },
      { id: "dijital_gosterg", label: "Dijital Gösterge" },
      { id: "kol_dayama", label: "Kol Dayama" },
      { id: "arka_koltuk_katlanir", label: "Katlanır Arka Koltuk" },
    ],
  },
  {
    id: "dis",
    label: "Dış Donanım",
    items: [
      { id: "alloy", label: "Çelik / Alaşım Jant" },
      { id: "led_far", label: "LED Far" },
      { id: "xenon_far", label: "Xenon Far" },
      { id: "adaptive_far", label: "Adaptif Far" },
      { id: "sis_fari", label: "Sis Farı" },
      { id: "gun_isigi", label: "Gündüz Farları" },
      { id: "park_sensor_on", label: "Park Sensörü (Ön)" },
      { id: "park_sensor_arka", label: "Park Sensörü (Arka)" },
      { id: "kamera_arka", label: "Geri Görüş Kamerası" },
      { id: "kamera_360", label: "360° Kamera" },
      { id: "park_asistani", label: "Park Asistanı" },
      { id: "elektrikli_ayna", label: "Elektrikli Ayna" },
      { id: "isitmali_ayna", label: "Isıtmalı Ayna" },
      { id: "katlanir_ayna", label: "Katlanır Ayna" },
      { id: "romork_cekme", label: "Römork Çeki Demiri" },
      { id: "spoiler", label: "Spoiler" },
      { id: "cam_tavan", label: "Cam Tavan" },
      { id: "night_package", label: "Night Package" },
      { id: "carbon", label: "Karbon / Carbon Paket" },
    ],
  },
  {
    id: "multimedya",
    label: "Multimedya",
    items: [
      { id: "bluetooth", label: "Bluetooth" },
      { id: "usb", label: "USB" },
      { id: "aux", label: "Aux" },
      { id: "navigasyon", label: "Navigasyon" },
      { id: "apple_carplay", label: "Apple CarPlay" },
      { id: "android_auto", label: "Android Auto" },
      { id: "ekran", label: "Dokunmatik Ekran" },
      { id: "tv", label: "TV" },
      { id: "cd_dvd", label: "CD / DVD" },
      { id: "premium_ses", label: "Premium Ses Sistemi" },
      { id: "burmester", label: "Burmester / Hi-Fi" },
      { id: "wireless_charge", label: "Kablosuz Şarj" },
      { id: "wifi_hotspot", label: "Wi-Fi Hotspot" },
    ],
  },
];

const LABEL_BY_ID = new Map(
  VEHICLE_EXTRA_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label] as const))
);

/** Sahibinden / serbest metin → bizim id */
const SYNONYMS: Array<{ id: string; keys: string[] }> = [
  { id: "abs", keys: ["abs"] },
  { id: "esp", keys: ["esp", "vsc", "elektronik stabilite", "stability"] },
  { id: "asr", keys: ["asr", "tcs", "patinaj"] },
  { id: "ebd", keys: ["ebd"] },
  { id: "airbag_surucu", keys: ["sürücü hava", "surucu hava", "driver airbag", "hava yastığı (sürücü)", "hava yastigi (surucu)"] },
  { id: "airbag_yolcu", keys: ["yolcu hava", "passenger airbag", "hava yastığı (yolcu)"] },
  { id: "airbag_yan", keys: ["yan hava", "side airbag", "yan hava yast"] },
  { id: "airbag_perde", keys: ["perde hava", "curtain", "perde hava yast"] },
  { id: "isofix", keys: ["isofix"] },
  { id: "alarm", keys: ["alarm"] },
  { id: "immobilizer", keys: ["immobilizer", "immobiliser"] },
  { id: "merkezi_kilit", keys: ["merkezi kilit"] },
  { id: "serit_takip", keys: ["şerit takip", "serit takip", "lane keep", "lane assist", "şerit destek"] },
  { id: "kor_nokta", keys: ["kör nokta", "kor nokta", "blind spot"] },
  { id: "yokus_kalkis", keys: ["yokuş kalkış", "yokus kalkis", "hill hold", "hill start"] },
  { id: "yorgunluk", keys: ["yorgunluk"] },
  { id: "gece_gorus", keys: ["gece görüş", "gece gorus", "night view"] },
  { id: "cekis_4x4", keys: ["4x4", "4wd", "awd", "çift çeker", "cift ceker", "all wheel"] },
  { id: "deri_koltuk", keys: ["deri koltuk", "leather", "deri döşeme", "deri doseme"] },
  { id: "kumas_koltuk", keys: ["kumaş koltuk", "kumas koltuk"] },
  { id: "alcantara", keys: ["alcantara", "spor koltuk"] },
  { id: "elektrikli_koltuk", keys: ["elektrikli koltuk", "elektrikli ön koltuk", "elektrikli on koltuk", "elektrikli koltuklar"] },
  { id: "isitmali_koltuk", keys: ["ısıtmalı koltuk", "isitmali koltuk", "heated seat", "koltuk ısıtma"] },
  { id: "sogutmali_koltuk", keys: ["soğutmalı koltuk", "sogutmali koltuk", "ventilated", "koltuk soğutma"] },
  { id: "masaj_koltuk", keys: ["masaj", "masajlı", "masajli", "dinamik koltuk"] },
  { id: "memory_koltuk", keys: ["memory", "hafızalı koltuk", "hafizali koltuk"] },
  { id: "klima", keys: ["klima"] },
  { id: "otomatik_klima", keys: ["otomatik klima", "climate", "çift bölgeli klima", "cift bolgeli"] },
  { id: "sunroof", keys: ["sunroof", "sun roof", "açılır tavan", "acilir tavan"] },
  { id: "panoramik_tavan", keys: ["panoramik", "panoramic"] },
  { id: "elektrikli_cam", keys: ["elektrikli cam"] },
  { id: "ayarli_direksiyon", keys: ["ayarlanabilir direksiyon", "ayarlı direksiyon"] },
  { id: "isitmali_direksiyon", keys: ["ısıtmalı direksiyon", "isitmali direksiyon"] },
  { id: "derin_direksiyon", keys: ["deri direksiyon"] },
  { id: "yagmur_sensor", keys: ["yağmur sensör", "yagmur sensor"] },
  { id: "isik_sensor", keys: ["ışık sensör", "isik sensor"] },
  { id: "start_stop", keys: ["start / stop", "start-stop", "start stop"] },
  { id: "cruise", keys: ["hız sabitleyici", "hiz sabitleyici"] },
  { id: "adaptif_cruise", keys: ["adaptif cruise", "adaptive cruise", "distronic", "adaptif hız"] },
  { id: "anahtarsiz_giris", keys: ["anahtarsız giriş", "anahtarsiz giris", "keyless entry"] },
  { id: "keyless_go", keys: ["keyless go", "anahtarsız çalıştırma", "anahtarsiz calistirma"] },
  { id: "dijital_gosterg", keys: ["dijital gösterge", "dijital gosterge", "digital cockpit", "mbux"] },
  { id: "head_up", keys: ["head-up", "head up", "hud"] },
  { id: "kol_dayama", keys: ["kol dayama"] },
  { id: "arka_koltuk_katlanir", keys: ["katlanır arka", "katlanir arka"] },
  { id: "alloy", keys: ["alaşım jant", "alasim jant", "alloy", "çelik jant", "celik jant"] },
  { id: "led_far", keys: ["led far", "led light"] },
  { id: "xenon_far", keys: ["xenon"] },
  { id: "adaptive_far", keys: ["adaptif far"] },
  { id: "sis_fari", keys: ["sis far"] },
  { id: "gun_isigi", keys: ["gündüz far", "gunduz far", "daytime"] },
  { id: "park_sensor_on", keys: ["ön park", "park sensörü (ön)", "park sensoru (on)"] },
  { id: "park_sensor_arka", keys: ["arka park", "park sensörü (arka)", "park sensör", "park sensor"] },
  { id: "kamera_arka", keys: ["geri görüş", "geri gorus", "arka kamera", "rear camera"] },
  { id: "kamera_360", keys: ["360 kamera", "360°", "surround", "kuş bakışı", "kus bakisi"] },
  { id: "park_asistani", keys: ["park asistan", "parking assist"] },
  { id: "elektrikli_ayna", keys: ["elektrikli ayna"] },
  { id: "isitmali_ayna", keys: ["ısıtmalı ayna", "isitmali ayna"] },
  { id: "katlanir_ayna", keys: ["katlanır ayna", "katlanir ayna"] },
  { id: "romork_cekme", keys: ["römork", "romork", "çeki demiri"] },
  { id: "spoiler", keys: ["spoiler"] },
  { id: "cam_tavan", keys: ["cam tavan"] },
  { id: "night_package", keys: ["night package", "night paket"] },
  { id: "carbon", keys: ["carbon", "karbon"] },
  { id: "bluetooth", keys: ["bluetooth"] },
  { id: "usb", keys: ["usb"] },
  { id: "aux", keys: ["aux"] },
  { id: "navigasyon", keys: ["navigasyon", "navigation", "navi"] },
  { id: "apple_carplay", keys: ["carplay", "apple car"] },
  { id: "android_auto", keys: ["android auto"] },
  { id: "ekran", keys: ["dokunmatik ekran", "multimedya ekran"] },
  { id: "premium_ses", keys: ["premium ses", "hi-fi", "hifi"] },
  { id: "burmester", keys: ["burmester", "harman", "bose", "bang"] },
  { id: "wireless_charge", keys: ["kablosuz şarj", "kablosuz sarj", "wireless charg"] },
  { id: "wifi_hotspot", keys: ["wifi", "wi-fi", "hotspot"] },
  { id: "tv", keys: ["televizyon"] },
  { id: "cd_dvd", keys: ["cd / dvd", "cd/dvd", "dvd"] },
];

export function vehicleExtraLabel(id: string) {
  return LABEL_BY_ID.get(id) || id;
}

export function groupVehicleExtras(ids: string[]) {
  const set = new Set(ids);
  return VEHICLE_EXTRA_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => set.has(i.id)),
  })).filter((g) => g.items.length > 0);
}

export function parseVehicleExtras(raw: unknown): string[] {
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

/** AI checklist prompt'u için id:label listesi */
export function vehicleExtraChecklistForPrompt(): string {
  return VEHICLE_EXTRA_GROUPS.map(
    (g) => `${g.label}: ${g.items.map((i) => `${i.id} (${i.label})`).join(", ")}`
  ).join("\n");
}

/** AI / serbest metin etiketlerini bizim id listesine çevir */
export function matchVehicleExtrasFromText(...chunks: string[]): string[] {
  const blob = normExtra(chunks.filter(Boolean).join(" \n "));
  const found = new Set<string>();
  for (const row of SYNONYMS) {
    if (row.keys.some((k) => blob.includes(normExtra(k)))) {
      found.add(row.id);
    }
  }
  for (const [id, label] of LABEL_BY_ID) {
    if (blob.includes(normExtra(id)) || blob.includes(normExtra(label))) found.add(id);
  }
  return [...found];
}

export const VEHICLE_EKSPERTIZ = {
  tramer: ["Yok", "Var"],
  boyaDurumu: ["Boyasız", "Lokal boyalı", "Boyalı"],
  degisenDurumu: ["Değişensiz", "Değişen var"],
  hasarDurumu: ["Hasarsız", "Hasarlı", "Ağır hasar kayıtlı"],
} as const;
