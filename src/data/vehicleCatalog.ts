/** Vasıta kataloğu — Sahibinden tarzı marka / model / paket (trim) */

export type VehicleTrim = { slug: string; name: string };
export type VehicleModel = { slug: string; name: string; trims?: VehicleTrim[] };
export type VehicleBrand = { slug: string; name: string; models: VehicleModel[] };

/** Alt tip (otomobil, suv…) → markalar */
export const VEHICLE_CATALOG: Record<string, VehicleBrand[]> = {
  otomobil: [
    {
      slug: "audi",
      name: "Audi",
      models: [
        {
          slug: "a3",
          name: "A3",
          trims: [
            { slug: "a3-35-tfsi", name: "35 TFSI" },
            { slug: "a3-30-tdi", name: "30 TDI" },
            { slug: "a3-sportback", name: "Sportback" },
          ],
        },
        {
          slug: "a4",
          name: "A4",
          trims: [
            { slug: "a4-40-tfsi", name: "40 TFSI" },
            { slug: "a4-35-tdi", name: "35 TDI" },
            { slug: "a4-avant", name: "Avant" },
          ],
        },
        { slug: "a6", name: "A6", trims: [{ slug: "a6-45-tfsi", name: "45 TFSI" }, { slug: "a6-40-tdi", name: "40 TDI" }] },
        { slug: "q2", name: "Q2" },
      ],
    },
    {
      slug: "bmw",
      name: "BMW",
      models: [
        {
          slug: "3-serisi",
          name: "3 Serisi",
          trims: [
            { slug: "318i", name: "318i" },
            { slug: "320i", name: "320i" },
            { slug: "320d", name: "320d" },
            { slug: "330i", name: "330i" },
          ],
        },
        {
          slug: "5-serisi",
          name: "5 Serisi",
          trims: [
            { slug: "520i", name: "520i" },
            { slug: "520d", name: "520d" },
            { slug: "530i", name: "530i" },
          ],
        },
        { slug: "1-serisi", name: "1 Serisi", trims: [{ slug: "116i", name: "116i" }, { slug: "118i", name: "118i" }] },
        { slug: "x1", name: "X1" },
      ],
    },
    {
      slug: "mercedes-benz",
      name: "Mercedes-Benz",
      models: [
        {
          slug: "c-serisi",
          name: "C Serisi",
          trims: [
            { slug: "c180", name: "C 180" },
            { slug: "c200", name: "C 200" },
            { slug: "c220d", name: "C 220 d" },
          ],
        },
        {
          slug: "e-serisi",
          name: "E Serisi",
          trims: [
            { slug: "e200", name: "E 200" },
            { slug: "e220d", name: "E 220 d" },
            { slug: "e300", name: "E 300" },
          ],
        },
        { slug: "a-serisi", name: "A Serisi", trims: [{ slug: "a180", name: "A 180" }, { slug: "a200", name: "A 200" }] },
        { slug: "cla", name: "CLA" },
      ],
    },
    {
      slug: "volkswagen",
      name: "Volkswagen",
      models: [
        {
          slug: "golf",
          name: "Golf",
          trims: [
            { slug: "golf-1-0-tsi", name: "1.0 TSI" },
            { slug: "golf-1-5-tsi", name: "1.5 TSI" },
            { slug: "golf-2-0-tdi", name: "2.0 TDI" },
          ],
        },
        {
          slug: "passat",
          name: "Passat",
          trims: [
            { slug: "passat-1-5-tsi", name: "1.5 TSI" },
            { slug: "passat-2-0-tdi", name: "2.0 TDI" },
          ],
        },
        { slug: "polo", name: "Polo", trims: [{ slug: "polo-1-0-tsi", name: "1.0 TSI" }, { slug: "polo-1-0", name: "1.0" }] },
        { slug: "jetta", name: "Jetta" },
      ],
    },
    {
      slug: "toyota",
      name: "Toyota",
      models: [
        { slug: "corolla", name: "Corolla", trims: [{ slug: "corolla-1-6", name: "1.6" }, { slug: "corolla-hybrid", name: "Hybrid" }] },
        { slug: "yaris", name: "Yaris" },
        { slug: "camry", name: "Camry" },
        { slug: "auris", name: "Auris" },
      ],
    },
    {
      slug: "renault",
      name: "Renault",
      models: [
        { slug: "clio", name: "Clio", trims: [{ slug: "clio-1-0-tce", name: "1.0 TCe" }, { slug: "clio-1-5-dci", name: "1.5 dCi" }] },
        { slug: "megane", name: "Megane", trims: [{ slug: "megane-1-3-tce", name: "1.3 TCe" }, { slug: "megane-1-5-dci", name: "1.5 dCi" }] },
        { slug: "talisman", name: "Talisman" },
        { slug: "symbol", name: "Symbol" },
      ],
    },
    {
      slug: "fiat",
      name: "Fiat",
      models: [
        { slug: "egea", name: "Egea", trims: [{ slug: "egea-1-4", name: "1.4" }, { slug: "egea-1-6-multijet", name: "1.6 Multijet" }] },
        { slug: "tipo", name: "Tipo" },
        { slug: "500", name: "500" },
      ],
    },
    {
      slug: "ford",
      name: "Ford",
      models: [
        { slug: "focus", name: "Focus", trims: [{ slug: "focus-1-0-ecoboost", name: "1.0 EcoBoost" }, { slug: "focus-1-5-tdci", name: "1.5 TDCi" }] },
        { slug: "fiesta", name: "Fiesta" },
        { slug: "mondeo", name: "Mondeo" },
      ],
    },
    {
      slug: "opel",
      name: "Opel",
      models: [
        { slug: "astra", name: "Astra", trims: [{ slug: "astra-1-2", name: "1.2" }, { slug: "astra-1-5-diesel", name: "1.5 Dizel" }] },
        { slug: "corsa", name: "Corsa" },
        { slug: "insignia", name: "Insignia" },
      ],
    },
    {
      slug: "hyundai",
      name: "Hyundai",
      models: [
        { slug: "i20", name: "i20" },
        { slug: "i30", name: "i30" },
        { slug: "elantra", name: "Elantra" },
        { slug: "accent", name: "Accent" },
      ],
    },
    {
      slug: "honda",
      name: "Honda",
      models: [
        { slug: "civic", name: "Civic", trims: [{ slug: "civic-1-5-vtec", name: "1.5 VTEC" }, { slug: "civic-eco", name: "Elegance" }] },
        { slug: "city", name: "City" },
        { slug: "accord", name: "Accord" },
      ],
    },
    {
      slug: "skoda",
      name: "Skoda",
      models: [
        { slug: "octavia", name: "Octavia", trims: [{ slug: "octavia-1-0-tsi", name: "1.0 TSI" }, { slug: "octavia-1-6-tdi", name: "1.6 TDI" }] },
        { slug: "superb", name: "Superb" },
        { slug: "fabia", name: "Fabia" },
      ],
    },
    {
      slug: "peugeot",
      name: "Peugeot",
      models: [
        { slug: "208", name: "208" },
        { slug: "308", name: "308" },
        { slug: "508", name: "508" },
      ],
    },
    {
      slug: "citroen",
      name: "Citroën",
      models: [
        { slug: "c3", name: "C3" },
        { slug: "c4", name: "C4" },
        { slug: "c-elysee", name: "C-Elysée" },
      ],
    },
    {
      slug: "seat",
      name: "Seat",
      models: [
        { slug: "leon", name: "Leon" },
        { slug: "ibiza", name: "Ibiza" },
        { slug: "toledo", name: "Toledo" },
      ],
    },
    {
      slug: "volvo",
      name: "Volvo",
      models: [
        { slug: "s60", name: "S60" },
        { slug: "s90", name: "S90" },
        { slug: "v40", name: "V40" },
      ],
    },
    {
      slug: "tesla",
      name: "Tesla",
      models: [
        { slug: "model-3", name: "Model 3", trims: [{ slug: "model-3-rwd", name: "RWD" }, { slug: "model-3-long-range", name: "Long Range" }] },
        { slug: "model-y", name: "Model Y" },
        { slug: "model-s", name: "Model S" },
      ],
    },
  ],

  "arazi-suv-pickup": [
    {
      slug: "toyota",
      name: "Toyota",
      models: [
        { slug: "rav4", name: "RAV4" },
        { slug: "land-cruiser", name: "Land Cruiser" },
        { slug: "hilux", name: "Hilux", trims: [{ slug: "hilux-2-4", name: "2.4" }, { slug: "hilux-2-8", name: "2.8" }] },
        { slug: "c-hr", name: "C-HR" },
      ],
    },
    {
      slug: "bmw",
      name: "BMW",
      models: [
        { slug: "x3", name: "X3" },
        { slug: "x5", name: "X5", trims: [{ slug: "x5-30d", name: "xDrive30d" }, { slug: "x5-40i", name: "xDrive40i" }] },
        { slug: "x1", name: "X1" },
      ],
    },
    {
      slug: "mercedes-benz",
      name: "Mercedes-Benz",
      models: [
        { slug: "glc", name: "GLC" },
        { slug: "gle", name: "GLE" },
        { slug: "gla", name: "GLA" },
        {
          slug: "g-class",
          name: "G-Class",
          trims: [
            { slug: "g-63-amg", name: "G 63 AMG" },
            { slug: "g-500", name: "G 500" },
            { slug: "g-350d", name: "G 350d" },
          ],
        },
      ],
    },
    {
      slug: "volkswagen",
      name: "Volkswagen",
      models: [
        { slug: "tiguan", name: "Tiguan" },
        { slug: "touareg", name: "Touareg" },
        { slug: "t-roc", name: "T-Roc" },
        { slug: "amarok", name: "Amarok" },
      ],
    },
    {
      slug: "nissan",
      name: "Nissan",
      models: [
        { slug: "qashqai", name: "Qashqai" },
        { slug: "x-trail", name: "X-Trail" },
        { slug: "navara", name: "Navara" },
      ],
    },
    {
      slug: "hyundai",
      name: "Hyundai",
      models: [
        { slug: "tucson", name: "Tucson" },
        { slug: "santa-fe", name: "Santa Fe" },
        { slug: "kona", name: "Kona" },
      ],
    },
    {
      slug: "kia",
      name: "Kia",
      models: [
        { slug: "sportage", name: "Sportage" },
        { slug: "sorento", name: "Sorento" },
        { slug: "stonic", name: "Stonic" },
      ],
    },
    {
      slug: "ford",
      name: "Ford",
      models: [
        { slug: "ranger", name: "Ranger" },
        { slug: "kuga", name: "Kuga" },
        { slug: "ecosport", name: "EcoSport" },
      ],
    },
    {
      slug: "jeep",
      name: "Jeep",
      models: [
        { slug: "renegade", name: "Renegade" },
        { slug: "compass", name: "Compass" },
        { slug: "wrangler", name: "Wrangler" },
      ],
    },
    {
      slug: "land-rover",
      name: "Land Rover",
      models: [
        { slug: "range-rover-evoque", name: "Range Rover Evoque" },
        { slug: "discovery-sport", name: "Discovery Sport" },
        { slug: "defender", name: "Defender" },
      ],
    },
  ],

  motosiklet: [
    {
      slug: "honda",
      name: "Honda",
      models: [
        { slug: "pcx", name: "PCX" },
        { slug: "cbr", name: "CBR" },
        { slug: "africa-twin", name: "Africa Twin" },
      ],
    },
    {
      slug: "yamaha",
      name: "Yamaha",
      models: [
        { slug: "r25", name: "YZF-R25" },
        { slug: "mt-07", name: "MT-07" },
        { slug: "nmax", name: "NMAX" },
      ],
    },
    {
      slug: "kawasaki",
      name: "Kawasaki",
      models: [
        { slug: "ninja", name: "Ninja" },
        { slug: "z650", name: "Z650" },
        { slug: "versys", name: "Versys" },
      ],
    },
    {
      slug: "suzuki",
      name: "Suzuki",
      models: [
        { slug: "gsx-r", name: "GSX-R" },
        { slug: "v-strom", name: "V-Strom" },
        { slug: "burgman", name: "Burgman" },
      ],
    },
    {
      slug: "bmw",
      name: "BMW",
      models: [
        { slug: "r1250", name: "R 1250" },
        { slug: "s1000rr", name: "S 1000 RR" },
        { slug: "g310", name: "G 310" },
      ],
    },
    {
      slug: "ktm",
      name: "KTM",
      models: [
        { slug: "duke-390", name: "Duke 390" },
        { slug: "adventure", name: "Adventure" },
      ],
    },
  ],

  "minivan-panelvan": [
    {
      slug: "volkswagen",
      name: "Volkswagen",
      models: [
        { slug: "transporter", name: "Transporter" },
        { slug: "caddy", name: "Caddy" },
        { slug: "multivan", name: "Multivan" },
      ],
    },
    {
      slug: "ford",
      name: "Ford",
      models: [
        { slug: "transit", name: "Transit" },
        { slug: "transit-custom", name: "Transit Custom" },
        { slug: "tourneo", name: "Tourneo" },
      ],
    },
    {
      slug: "mercedes-benz",
      name: "Mercedes-Benz",
      models: [
        { slug: "sprinter", name: "Sprinter" },
        { slug: "vito", name: "Vito" },
        { slug: "v-class", name: "V Class" },
      ],
    },
    {
      slug: "fiat",
      name: "Fiat",
      models: [
        { slug: "doblo", name: "Doblo" },
        { slug: "ducato", name: "Ducato" },
        { slug: "fiorino", name: "Fiorino" },
      ],
    },
    {
      slug: "renault",
      name: "Renault",
      models: [
        { slug: "trafic", name: "Trafic" },
        { slug: "master", name: "Master" },
        { slug: "kangoo", name: "Kangoo" },
      ],
    },
  ],

  "ticari-araclar": [
    {
      slug: "ford",
      name: "Ford",
      models: [{ slug: "transit", name: "Transit" }, { slug: "ranger", name: "Ranger" }],
    },
    {
      slug: "mercedes-benz",
      name: "Mercedes-Benz",
      models: [{ slug: "sprinter", name: "Sprinter" }, { slug: "actros", name: "Actros" }],
    },
    {
      slug: "volkswagen",
      name: "Volkswagen",
      models: [{ slug: "crafter", name: "Crafter" }, { slug: "transporter", name: "Transporter" }],
    },
    {
      slug: "iveco",
      name: "Iveco",
      models: [{ slug: "daily", name: "Daily" }, { slug: "eurocargo", name: "Eurocargo" }],
    },
  ],

  "elektrikli-araclar": [
    {
      slug: "tesla",
      name: "Tesla",
      models: [
        { slug: "model-3", name: "Model 3" },
        { slug: "model-y", name: "Model Y" },
        { slug: "model-s", name: "Model S" },
      ],
    },
    {
      slug: "bmw",
      name: "BMW",
      models: [{ slug: "i4", name: "i4" }, { slug: "ix", name: "iX" }, { slug: "i3", name: "i3" }],
    },
    {
      slug: "volkswagen",
      name: "Volkswagen",
      models: [{ slug: "id3", name: "ID.3" }, { slug: "id4", name: "ID.4" }],
    },
    {
      slug: "hyundai",
      name: "Hyundai",
      models: [{ slug: "ioniq-5", name: "Ioniq 5" }, { slug: "kona-electric", name: "Kona Electric" }],
    },
    {
      slug: "tog",
      name: "TOGG",
      models: [{ slug: "t10x", name: "T10X" }],
    },
  ],
};

/** Kataloğu olmayan alt tipler için boş (ilan formu yine marka/model serbest yazabilir) */
export function brandsForSubtype(subtype: string): VehicleBrand[] {
  return VEHICLE_CATALOG[subtype] || [];
}

export function modelsForBrand(subtype: string, brandSlug: string): VehicleModel[] {
  return brandsForSubtype(subtype).find((b) => b.slug === brandSlug)?.models || [];
}

export function trimsForModel(subtype: string, brandSlug: string, modelSlug: string): VehicleTrim[] {
  return modelsForBrand(subtype, brandSlug).find((m) => m.slug === modelSlug)?.trims || [];
}

export function brandName(subtype: string, brandSlug: string) {
  return brandsForSubtype(subtype).find((b) => b.slug === brandSlug)?.name || brandSlug;
}

export function modelName(subtype: string, brandSlug: string, modelSlug: string) {
  return modelsForBrand(subtype, brandSlug).find((m) => m.slug === modelSlug)?.name || modelSlug;
}

export function trimName(subtype: string, brandSlug: string, modelSlug: string, trimSlug: string) {
  return trimsForModel(subtype, brandSlug, modelSlug).find((t) => t.slug === trimSlug)?.name || trimSlug;
}

/** Modelde paket/trim var mı? Varsa seçim zorunlu. */
export function modelRequiresTrim(subtype: string, brandSlug: string, modelSlug: string) {
  return trimsForModel(subtype, brandSlug, modelSlug).length > 0;
}
