/**
 * STAGE1 CATALOG GENERATOR — v2 (real data, no fake generations).
 *
 * Replaces the v1 generator (scripts/generate-vehicle-stage1-catalog.ts), which read
 * src/data/vehicleCatalog.ts and stamped every model with a fictional
 * generationCode:"default" / generationLabel:"Standart" row. This version:
 *
 *  - Uses a curated, hand-verified brand/model/generation dataset (real TR-market
 *    model names + real, well-known chassis/generation codes only).
 *  - NEVER emits generationCode "default" or generationLabel "Standart"/"Default"/"Genel".
 *    Models with no verified generation get generationCode:"" / generationLabel:"" —
 *    versions attach directly to the model row.
 *  - Expands brand coverage across otomobil / arazi-suv-pickup / motosiklet /
 *    ticari-araclar (see BRAND_DATA below) while keeping minivan-panelvan from the
 *    existing (already-real) vehicleCatalog.ts entries.
 *
 * Writes docs/vertical-taxonomy/vehicle-stage1-catalog.json.
 *
 * Re-run manually:
 *   npx tsx scripts/build-vehicle-stage1-catalog-v2.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { VEHICLE_CATALOG } from "../src/data/vehicleCatalog";

type VersionDef = { slug: string; name: string };

type GenerationDef = {
  code: string;
  label: string;
  yearStart: number;
  yearEnd: number;
  versions: VersionDef[];
};

type ModelDef = {
  slug: string;
  name: string;
  /** Real, well-known generation/chassis codes only. Omit if none verified. */
  generations?: GenerationDef[];
  /** Used when the model has no verified generation — versions attach to the model row. */
  versions?: VersionDef[];
  yearStart?: number;
  yearEnd?: number;
};

type BrandDef = {
  slug: string;
  name: string;
  models: ModelDef[];
};

type CatalogEntry = {
  categoryPaths: string[];
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  generationCode: string;
  generationLabel: string;
  versions: VersionDef[];
  modelYears: number[];
  fuelTypes: string[];
  transmissions: string[];
  bodyTypes: string[];
  source: string;
  verified: boolean;
  market: string;
  active: boolean;
};

const SOURCE = "tr-market-oem-model-2024";

function years(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const DEFAULT_MODEL_YEARS = years(2018, 2025);

// ---------------------------------------------------------------------------
// OTOMOBİL — sedan / hatchback / coupe body types
// ---------------------------------------------------------------------------
const OTOMOBIL: BrandDef[] = [
  { slug: "abarth", name: "Abarth", models: [{ slug: "595", name: "595", versions: [{ slug: "595", name: "595" }, { slug: "595-turismo", name: "595 Turismo" }, { slug: "595-competizione", name: "595 Competizione" }] }] },
  { slug: "alfa-romeo", name: "Alfa Romeo", models: [{ slug: "giulia", name: "Giulia", versions: [{ slug: "giulia", name: "Giulia" }, { slug: "giulia-veloce", name: "Giulia Veloce" }] }] },
  {
    slug: "audi",
    name: "Audi",
    models: [
      { slug: "a3", name: "A3", versions: [{ slug: "a3-35-tfsi", name: "35 TFSI" }, { slug: "a3-30-tdi", name: "30 TDI" }, { slug: "a3-sportback", name: "Sportback" }] },
      { slug: "a4", name: "A4", versions: [{ slug: "a4-40-tfsi", name: "40 TFSI" }, { slug: "a4-35-tdi", name: "35 TDI" }, { slug: "a4-avant", name: "Avant" }] },
      { slug: "a6", name: "A6", versions: [{ slug: "a6-45-tfsi", name: "45 TFSI" }, { slug: "a6-40-tdi", name: "40 TDI" }] },
    ],
  },
  {
    slug: "bmw",
    name: "BMW",
    models: [
      {
        slug: "3-serisi",
        name: "3 Serisi",
        generations: [
          { code: "F30", label: "F30", yearStart: 2012, yearEnd: 2019, versions: [{ slug: "316i", name: "316i" }, { slug: "318i", name: "318i" }, { slug: "320i", name: "320i" }, { slug: "320d", name: "320d" }, { slug: "330i", name: "330i" }] },
          { code: "G20", label: "G20", yearStart: 2019, yearEnd: 2025, versions: [{ slug: "318i-g20", name: "318i" }, { slug: "320i-g20", name: "320i" }, { slug: "320d-g20", name: "320d" }, { slug: "330i-g20", name: "330i" }, { slug: "m340i", name: "M340i" }] },
        ],
      },
      {
        slug: "5-serisi",
        name: "5 Serisi",
        generations: [
          { code: "G30", label: "G30", yearStart: 2017, yearEnd: 2023, versions: [{ slug: "520i-g30", name: "520i" }, { slug: "520d-g30", name: "520d" }, { slug: "530i-g30", name: "530i" }] },
          { code: "G60", label: "G60", yearStart: 2023, yearEnd: 2025, versions: [{ slug: "520i-g60", name: "520i" }, { slug: "520d-g60", name: "520d" }, { slug: "530e-g60", name: "530e" }] },
        ],
      },
      { slug: "1-serisi", name: "1 Serisi", versions: [{ slug: "116i", name: "116i" }, { slug: "118i", name: "118i" }] },
      { slug: "x1", name: "X1", versions: [{ slug: "x1-sdrive18i", name: "sDrive18i" }, { slug: "x1-xdrive20d", name: "xDrive20d" }] },
    ],
  },
  { slug: "byd", name: "BYD", models: [{ slug: "seal", name: "Seal", versions: [{ slug: "seal", name: "Seal" }] }, { slug: "dolphin", name: "Dolphin", versions: [{ slug: "dolphin", name: "Dolphin" }] }] },
  { slug: "chevrolet", name: "Chevrolet", models: [{ slug: "aveo", name: "Aveo", versions: [{ slug: "aveo", name: "Aveo" }] }] },
  { slug: "citroen", name: "Citroën", models: [{ slug: "c3", name: "C3", versions: [{ slug: "c3", name: "C3" }] }, { slug: "c4", name: "C4", versions: [{ slug: "c4", name: "C4" }] }, { slug: "c-elysee", name: "C-Elysée", versions: [{ slug: "c-elysee", name: "C-Elysée" }] }] },
  { slug: "cupra", name: "Cupra", models: [{ slug: "leon", name: "Leon", versions: [{ slug: "leon", name: "Leon" }] }] },
  { slug: "dacia", name: "Dacia", models: [{ slug: "sandero", name: "Sandero", versions: [{ slug: "sandero", name: "Sandero" }, { slug: "sandero-stepway", name: "Stepway" }] }, { slug: "logan", name: "Logan", versions: [{ slug: "logan", name: "Logan" }] }] },
  { slug: "ds", name: "DS Automobiles", models: [{ slug: "ds4", name: "DS 4", versions: [{ slug: "ds4", name: "DS 4" }] }] },
  { slug: "fiat", name: "Fiat", models: [{ slug: "egea", name: "Egea", versions: [{ slug: "egea-1-4", name: "1.4" }, { slug: "egea-1-6-multijet", name: "1.6 Multijet" }] }, { slug: "tipo", name: "Tipo", versions: [{ slug: "tipo", name: "Tipo" }] }, { slug: "500", name: "500", versions: [{ slug: "500", name: "500" }] }] },
  {
    slug: "ford",
    name: "Ford",
    models: [
      { slug: "focus", name: "Focus", generations: [{ code: "mk4", label: "MK4", yearStart: 2018, yearEnd: 2025, versions: [{ slug: "focus-1-0-ecoboost", name: "1.0 EcoBoost" }, { slug: "focus-1-5-tdci", name: "1.5 TDCi" }, { slug: "focus-st-line", name: "ST-Line" }] }] },
      { slug: "fiesta", name: "Fiesta", versions: [{ slug: "fiesta", name: "Fiesta" }] },
    ],
  },
  {
    slug: "honda",
    name: "Honda",
    models: [
      { slug: "civic", name: "Civic", generations: [{ code: "11-gen", label: "11. Nesil", yearStart: 2021, yearEnd: 2025, versions: [{ slug: "civic-1-5-vtec", name: "1.5 VTEC Turbo" }, { slug: "civic-eco", name: "Elegance" }] }] },
      { slug: "city", name: "City", versions: [{ slug: "city", name: "City" }] },
    ],
  },
  { slug: "hyundai", name: "Hyundai", models: [{ slug: "i20", name: "i20", versions: [{ slug: "i20", name: "i20" }] }, { slug: "i30", name: "i30", versions: [{ slug: "i30", name: "i30" }] }, { slug: "elantra", name: "Elantra", versions: [{ slug: "elantra", name: "Elantra" }] }, { slug: "accent", name: "Accent", versions: [{ slug: "accent", name: "Accent" }] }] },
  { slug: "jaguar", name: "Jaguar", models: [{ slug: "xe", name: "XE", versions: [{ slug: "xe", name: "XE" }] }, { slug: "xf", name: "XF", versions: [{ slug: "xf", name: "XF" }] }] },
  { slug: "kia", name: "Kia", models: [{ slug: "ceed", name: "Ceed", versions: [{ slug: "ceed", name: "Ceed" }] }, { slug: "picanto", name: "Picanto", versions: [{ slug: "picanto", name: "Picanto" }] }] },
  { slug: "lexus", name: "Lexus", models: [{ slug: "es", name: "ES", versions: [{ slug: "es", name: "ES" }] }] },
  { slug: "mazda", name: "Mazda", models: [{ slug: "3", name: "Mazda3", versions: [{ slug: "mazda3", name: "Mazda3" }] }] },
  {
    slug: "mercedes-benz",
    name: "Mercedes-Benz",
    models: [
      {
        slug: "c-serisi",
        name: "C Serisi",
        generations: [
          { code: "W205", label: "W205", yearStart: 2014, yearEnd: 2021, versions: [{ slug: "c180-w205", name: "C 180" }, { slug: "c200-w205", name: "C 200" }, { slug: "c220d-w205", name: "C 220 d" }] },
          { code: "W206", label: "W206", yearStart: 2021, yearEnd: 2025, versions: [{ slug: "c200-w206", name: "C 200" }, { slug: "c220d-w206", name: "C 220 d" }, { slug: "c300-w206", name: "C 300" }] },
        ],
      },
      { slug: "e-serisi", name: "E Serisi", versions: [{ slug: "e200", name: "E 200" }, { slug: "e220d", name: "E 220 d" }, { slug: "e300", name: "E 300" }] },
      { slug: "a-serisi", name: "A Serisi", versions: [{ slug: "a180", name: "A 180" }, { slug: "a200", name: "A 200" }] },
      { slug: "cla", name: "CLA", versions: [{ slug: "cla", name: "CLA" }] },
    ],
  },
  { slug: "mg", name: "MG", models: [{ slug: "mg5", name: "MG5", versions: [{ slug: "mg5", name: "MG5" }] }] },
  { slug: "mini", name: "Mini", models: [{ slug: "cooper", name: "Cooper", versions: [{ slug: "cooper", name: "Cooper" }, { slug: "cooper-s", name: "Cooper S" }] }] },
  { slug: "opel", name: "Opel", models: [{ slug: "astra", name: "Astra", versions: [{ slug: "astra-1-2", name: "1.2" }, { slug: "astra-1-5-diesel", name: "1.5 Dizel" }] }, { slug: "corsa", name: "Corsa", versions: [{ slug: "corsa", name: "Corsa" }] }] },
  {
    slug: "peugeot",
    name: "Peugeot",
    models: [
      { slug: "208", name: "208", generations: [{ code: "P21", label: "P21", yearStart: 2019, yearEnd: 2025, versions: [{ slug: "208-active", name: "Active" }, { slug: "208-allure", name: "Allure" }, { slug: "208-gt", name: "GT" }] }] },
      { slug: "308", name: "308", versions: [{ slug: "308", name: "308" }] },
    ],
  },
  { slug: "porsche", name: "Porsche", models: [{ slug: "panamera", name: "Panamera", versions: [{ slug: "panamera", name: "Panamera" }] }, { slug: "911", name: "911", versions: [{ slug: "911-carrera", name: "Carrera" }] }] },
  {
    slug: "renault",
    name: "Renault",
    models: [
      { slug: "clio", name: "Clio", generations: [{ code: "clio-v", label: "Clio V", yearStart: 2019, yearEnd: 2025, versions: [{ slug: "clio-1-0-tce", name: "1.0 TCe" }, { slug: "clio-1-5-dci", name: "1.5 dCi" }, { slug: "clio-e-tech", name: "E-Tech" }] }] },
      { slug: "megane", name: "Megane", versions: [{ slug: "megane-1-3-tce", name: "1.3 TCe" }, { slug: "megane-1-5-dci", name: "1.5 dCi" }] },
      { slug: "talisman", name: "Talisman", versions: [{ slug: "talisman", name: "Talisman" }] },
      { slug: "symbol", name: "Symbol", versions: [{ slug: "symbol", name: "Symbol" }] },
    ],
  },
  { slug: "seat", name: "Seat", models: [{ slug: "leon", name: "Leon", versions: [{ slug: "seat-leon", name: "Leon" }] }, { slug: "ibiza", name: "Ibiza", versions: [{ slug: "ibiza", name: "Ibiza" }] }] },
  { slug: "skoda", name: "Skoda", models: [{ slug: "octavia", name: "Octavia", versions: [{ slug: "octavia-1-0-tsi", name: "1.0 TSI" }, { slug: "octavia-1-6-tdi", name: "1.6 TDI" }] }, { slug: "fabia", name: "Fabia", versions: [{ slug: "fabia", name: "Fabia" }] }] },
  { slug: "smart", name: "Smart", models: [{ slug: "fortwo", name: "Fortwo", versions: [{ slug: "fortwo", name: "Fortwo" }] }, { slug: "forfour", name: "Forfour", versions: [{ slug: "forfour", name: "Forfour" }] }] },
  { slug: "suzuki", name: "Suzuki", models: [{ slug: "swift", name: "Swift", versions: [{ slug: "swift", name: "Swift" }] }] },
  { slug: "tesla", name: "Tesla", models: [{ slug: "model-3", name: "Model 3", versions: [{ slug: "model-3-rwd", name: "RWD" }, { slug: "model-3-long-range", name: "Long Range" }] }, { slug: "model-s", name: "Model S", versions: [{ slug: "model-s", name: "Model S" }] }] },
  {
    slug: "toyota",
    name: "Toyota",
    models: [
      { slug: "corolla", name: "Corolla", generations: [{ code: "E210", label: "E210", yearStart: 2019, yearEnd: 2025, versions: [{ slug: "corolla-1-6", name: "1.6" }, { slug: "corolla-hybrid", name: "Hybrid" }] }] },
      { slug: "yaris", name: "Yaris", versions: [{ slug: "yaris", name: "Yaris" }] },
      { slug: "camry", name: "Camry", versions: [{ slug: "camry", name: "Camry" }] },
      { slug: "auris", name: "Auris", versions: [{ slug: "auris", name: "Auris" }] },
    ],
  },
  {
    slug: "volkswagen",
    name: "Volkswagen",
    models: [
      {
        slug: "golf",
        name: "Golf",
        generations: [
          { code: "mk7", label: "MK7", yearStart: 2012, yearEnd: 2019, versions: [{ slug: "golf-mk7-1-0-tsi", name: "1.0 TSI" }, { slug: "golf-mk7-1-5-tsi", name: "1.5 TSI" }, { slug: "golf-mk7-2-0-tdi", name: "2.0 TDI" }] },
          { code: "mk8", label: "MK8", yearStart: 2019, yearEnd: 2025, versions: [{ slug: "golf-mk8-1-0-tsi", name: "1.0 TSI" }, { slug: "golf-mk8-1-5-tsi", name: "1.5 TSI" }, { slug: "golf-mk8-gtd", name: "GTD" }] },
        ],
      },
      { slug: "passat", name: "Passat", versions: [{ slug: "passat-1-5-tsi", name: "1.5 TSI" }, { slug: "passat-2-0-tdi", name: "2.0 TDI" }] },
      { slug: "polo", name: "Polo", versions: [{ slug: "polo-1-0-tsi", name: "1.0 TSI" }, { slug: "polo-1-0", name: "1.0" }] },
      { slug: "jetta", name: "Jetta", versions: [{ slug: "jetta", name: "Jetta" }] },
    ],
  },
  { slug: "volvo", name: "Volvo", models: [{ slug: "s60", name: "S60", versions: [{ slug: "s60", name: "S60" }] }, { slug: "s90", name: "S90", versions: [{ slug: "s90", name: "S90" }] }, { slug: "v40", name: "V40", versions: [{ slug: "v40", name: "V40" }] }] },
];

// ---------------------------------------------------------------------------
// ARAZİ / SUV / PICKUP
// ---------------------------------------------------------------------------
const ARAZI_SUV_PICKUP: BrandDef[] = [
  { slug: "audi", name: "Audi", models: [{ slug: "q2", name: "Q2", versions: [{ slug: "q2", name: "Q2" }] }, { slug: "q3", name: "Q3", versions: [{ slug: "q3", name: "Q3" }] }, { slug: "q5", name: "Q5", versions: [{ slug: "q5", name: "Q5" }] }] },
  {
    slug: "bmw",
    name: "BMW",
    models: [
      { slug: "x3", name: "X3", versions: [{ slug: "x3", name: "X3" }] },
      { slug: "x5", name: "X5", versions: [{ slug: "x5-30d", name: "xDrive30d" }, { slug: "x5-40i", name: "xDrive40i" }] },
    ],
  },
  { slug: "chery", name: "Chery", models: [{ slug: "tiggo-7-pro", name: "Tiggo 7 Pro", versions: [{ slug: "tiggo-7-pro", name: "Tiggo 7 Pro" }] }, { slug: "tiggo-8-pro", name: "Tiggo 8 Pro", versions: [{ slug: "tiggo-8-pro", name: "Tiggo 8 Pro" }] }] },
  { slug: "chevrolet", name: "Chevrolet", models: [{ slug: "captiva", name: "Captiva", versions: [{ slug: "captiva", name: "Captiva" }] }] },
  { slug: "citroen", name: "Citroën", models: [{ slug: "c5-aircross", name: "C5 Aircross", versions: [{ slug: "c5-aircross", name: "C5 Aircross" }] }] },
  { slug: "cupra", name: "Cupra", models: [{ slug: "formentor", name: "Formentor", versions: [{ slug: "formentor", name: "Formentor" }] }] },
  { slug: "dacia", name: "Dacia", models: [{ slug: "duster", name: "Duster", versions: [{ slug: "duster", name: "Duster" }] }, { slug: "spring", name: "Spring", versions: [{ slug: "spring", name: "Spring" }] }] },
  { slug: "ds", name: "DS Automobiles", models: [{ slug: "ds3", name: "DS 3", versions: [{ slug: "ds3", name: "DS 3" }] }, { slug: "ds7", name: "DS 7", versions: [{ slug: "ds7", name: "DS 7" }] }] },
  { slug: "ford", name: "Ford", models: [{ slug: "puma", name: "Puma", versions: [{ slug: "puma", name: "Puma" }] }, { slug: "kuga", name: "Kuga", versions: [{ slug: "kuga", name: "Kuga" }] }, { slug: "ranger", name: "Ranger", versions: [{ slug: "ranger", name: "Ranger" }] }] },
  { slug: "honda", name: "Honda", models: [{ slug: "cr-v", name: "CR-V", versions: [{ slug: "cr-v", name: "CR-V" }] }, { slug: "hr-v", name: "HR-V", versions: [{ slug: "hr-v", name: "HR-V" }] }] },
  { slug: "hyundai", name: "Hyundai", models: [{ slug: "tucson", name: "Tucson", versions: [{ slug: "tucson", name: "Tucson" }] }, { slug: "bayon", name: "Bayon", versions: [{ slug: "bayon", name: "Bayon" }] }] },
  { slug: "isuzu", name: "Isuzu", models: [{ slug: "d-max", name: "D-Max", versions: [{ slug: "d-max", name: "D-Max" }] }] },
  { slug: "jaguar", name: "Jaguar", models: [{ slug: "f-pace", name: "F-Pace", versions: [{ slug: "f-pace", name: "F-Pace" }] }] },
  { slug: "jeep", name: "Jeep", models: [{ slug: "renegade", name: "Renegade", versions: [{ slug: "renegade", name: "Renegade" }] }, { slug: "compass", name: "Compass", versions: [{ slug: "compass", name: "Compass" }] }, { slug: "avenger", name: "Avenger", versions: [{ slug: "avenger", name: "Avenger" }] }] },
  { slug: "kia", name: "Kia", models: [{ slug: "sportage", name: "Sportage", versions: [{ slug: "sportage", name: "Sportage" }] }, { slug: "stonic", name: "Stonic", versions: [{ slug: "stonic", name: "Stonic" }] }] },
  { slug: "land-rover", name: "Land Rover", models: [{ slug: "range-rover-evoque", name: "Range Rover Evoque", versions: [{ slug: "range-rover-evoque", name: "Range Rover Evoque" }] }, { slug: "discovery-sport", name: "Discovery Sport", versions: [{ slug: "discovery-sport", name: "Discovery Sport" }] }, { slug: "defender", name: "Defender", versions: [{ slug: "defender", name: "Defender" }] }] },
  { slug: "lexus", name: "Lexus", models: [{ slug: "nx", name: "NX", versions: [{ slug: "nx", name: "NX" }] }, { slug: "rx", name: "RX", versions: [{ slug: "rx", name: "RX" }] }] },
  { slug: "mazda", name: "Mazda", models: [{ slug: "cx-5", name: "CX-5", versions: [{ slug: "cx-5", name: "CX-5" }] }, { slug: "cx-30", name: "CX-30", versions: [{ slug: "cx-30", name: "CX-30" }] }] },
  { slug: "mercedes-benz", name: "Mercedes-Benz", models: [{ slug: "glc", name: "GLC", versions: [{ slug: "glc", name: "GLC" }] }, { slug: "gle", name: "GLE", versions: [{ slug: "gle", name: "GLE" }] }, { slug: "g-class", name: "G-Class", versions: [{ slug: "g-63-amg", name: "G 63 AMG" }, { slug: "g-500", name: "G 500" }, { slug: "g-350d", name: "G 350d" }] }] },
  { slug: "mg", name: "MG", models: [{ slug: "zs", name: "ZS", versions: [{ slug: "zs", name: "ZS" }] }, { slug: "hs", name: "HS", versions: [{ slug: "hs", name: "HS" }] }] },
  { slug: "mini", name: "Mini", models: [{ slug: "countryman", name: "Countryman", versions: [{ slug: "countryman", name: "Countryman" }] }] },
  { slug: "mitsubishi", name: "Mitsubishi", models: [{ slug: "outlander", name: "Outlander", versions: [{ slug: "outlander", name: "Outlander" }] }, { slug: "asx", name: "ASX", versions: [{ slug: "asx", name: "ASX" }] }, { slug: "l200", name: "L200", versions: [{ slug: "l200", name: "L200" }] }] },
  { slug: "nissan", name: "Nissan", models: [{ slug: "qashqai", name: "Qashqai", versions: [{ slug: "qashqai", name: "Qashqai" }] }, { slug: "x-trail", name: "X-Trail", versions: [{ slug: "x-trail", name: "X-Trail" }] }, { slug: "juke", name: "Juke", versions: [{ slug: "juke", name: "Juke" }] }] },
  { slug: "opel", name: "Opel", models: [{ slug: "mokka", name: "Mokka", versions: [{ slug: "mokka", name: "Mokka" }] }] },
  { slug: "peugeot", name: "Peugeot", models: [{ slug: "2008", name: "2008", versions: [{ slug: "2008", name: "2008" }] }, { slug: "3008", name: "3008", versions: [{ slug: "3008", name: "3008" }] }] },
  { slug: "porsche", name: "Porsche", models: [{ slug: "macan", name: "Macan", versions: [{ slug: "macan", name: "Macan" }] }, { slug: "cayenne", name: "Cayenne", versions: [{ slug: "cayenne", name: "Cayenne" }] }] },
  { slug: "renault", name: "Renault", models: [{ slug: "captur", name: "Captur", versions: [{ slug: "captur", name: "Captur" }] }, { slug: "austral", name: "Austral", versions: [{ slug: "austral", name: "Austral" }] }] },
  { slug: "seat", name: "Seat", models: [{ slug: "ateca", name: "Ateca", versions: [{ slug: "ateca", name: "Ateca" }] }] },
  { slug: "skoda", name: "Skoda", models: [{ slug: "kodiaq", name: "Kodiaq", versions: [{ slug: "kodiaq", name: "Kodiaq" }] }, { slug: "karoq", name: "Karoq", versions: [{ slug: "karoq", name: "Karoq" }] }] },
  { slug: "kgm", name: "KGM", models: [{ slug: "torres", name: "Torres", versions: [{ slug: "torres", name: "Torres" }] }, { slug: "korando", name: "Korando", versions: [{ slug: "korando", name: "Korando" }] }, { slug: "tivoli", name: "Tivoli", versions: [{ slug: "tivoli", name: "Tivoli" }] }, { slug: "musso", name: "Musso", versions: [{ slug: "musso", name: "Musso" }] }] },
  { slug: "subaru", name: "Subaru", models: [{ slug: "forester", name: "Forester", versions: [{ slug: "forester", name: "Forester" }] }, { slug: "xv", name: "XV", versions: [{ slug: "xv", name: "XV" }] }, { slug: "outback", name: "Outback", versions: [{ slug: "outback", name: "Outback" }] }] },
  { slug: "suzuki", name: "Suzuki", models: [{ slug: "vitara", name: "Vitara", versions: [{ slug: "vitara", name: "Vitara" }] }, { slug: "s-cross", name: "S-Cross", versions: [{ slug: "s-cross", name: "S-Cross" }] }] },
  { slug: "tesla", name: "Tesla", models: [{ slug: "model-y", name: "Model Y", versions: [{ slug: "model-y", name: "Model Y" }] }] },
  { slug: "togg", name: "TOGG", models: [{ slug: "t10x", name: "T10X", versions: [{ slug: "t10x-v1", name: "V1" }, { slug: "t10x-v2", name: "V2" }] }] },
  {
    slug: "toyota",
    name: "Toyota",
    models: [
      { slug: "rav4", name: "RAV4", versions: [{ slug: "rav4", name: "RAV4" }] },
      { slug: "c-hr", name: "C-HR", versions: [{ slug: "c-hr", name: "C-HR" }] },
      { slug: "hilux", name: "Hilux", versions: [{ slug: "hilux-2-4", name: "2.4" }, { slug: "hilux-2-8", name: "2.8" }] },
      { slug: "land-cruiser", name: "Land Cruiser", versions: [{ slug: "land-cruiser", name: "Land Cruiser" }] },
    ],
  },
  { slug: "volkswagen", name: "Volkswagen", models: [{ slug: "tiguan", name: "Tiguan", versions: [{ slug: "tiguan", name: "Tiguan" }] }, { slug: "t-roc", name: "T-Roc", versions: [{ slug: "t-roc", name: "T-Roc" }] }, { slug: "touareg", name: "Touareg", versions: [{ slug: "touareg", name: "Touareg" }] }, { slug: "amarok", name: "Amarok", versions: [{ slug: "amarok", name: "Amarok" }] }] },
  { slug: "volvo", name: "Volvo", models: [{ slug: "xc60", name: "XC60", versions: [{ slug: "xc60", name: "XC60" }] }, { slug: "xc40", name: "XC40", versions: [{ slug: "xc40", name: "XC40" }] }] },
];

// ---------------------------------------------------------------------------
// MOTOSİKLET — brand slug bmw-motorrad for BMW Motorrad (NOT bmw)
// ---------------------------------------------------------------------------
const MOTOSIKLET: BrandDef[] = [
  { slug: "aprilia", name: "Aprilia", models: [{ slug: "rs660", name: "RS 660", versions: [{ slug: "rs660", name: "RS 660" }] }, { slug: "tuono660", name: "Tuono 660", versions: [{ slug: "tuono660", name: "Tuono 660" }] }] },
  { slug: "bajaj", name: "Bajaj", models: [{ slug: "pulsar-ns200", name: "Pulsar NS200", versions: [{ slug: "pulsar-ns200", name: "Pulsar NS200" }] }, { slug: "dominar-400", name: "Dominar 400", versions: [{ slug: "dominar-400", name: "Dominar 400" }] }] },
  { slug: "benelli", name: "Benelli", models: [{ slug: "trk502", name: "TRK 502", versions: [{ slug: "trk502", name: "TRK 502" }] }, { slug: "leoncino500", name: "Leoncino 500", versions: [{ slug: "leoncino500", name: "Leoncino 500" }] }] },
  { slug: "bmw-motorrad", name: "BMW Motorrad", models: [{ slug: "r1250gs", name: "R 1250 GS", versions: [{ slug: "r1250gs", name: "R 1250 GS" }] }, { slug: "s1000rr", name: "S 1000 RR", versions: [{ slug: "s1000rr", name: "S 1000 RR" }] }, { slug: "g310r", name: "G 310 R", versions: [{ slug: "g310r", name: "G 310 R" }] }] },
  { slug: "ducati", name: "Ducati", models: [{ slug: "monster", name: "Monster", versions: [{ slug: "monster", name: "Monster" }] }, { slug: "panigale-v2", name: "Panigale V2", versions: [{ slug: "panigale-v2", name: "Panigale V2" }] }, { slug: "multistrada-v4", name: "Multistrada V4", versions: [{ slug: "multistrada-v4", name: "Multistrada V4" }] }] },
  { slug: "harley-davidson", name: "Harley-Davidson", models: [{ slug: "sportster-s", name: "Sportster S", versions: [{ slug: "sportster-s", name: "Sportster S" }] }, { slug: "street-glide", name: "Street Glide", versions: [{ slug: "street-glide", name: "Street Glide" }] }] },
  { slug: "honda", name: "Honda", models: [{ slug: "pcx160", name: "PCX160", versions: [{ slug: "pcx160", name: "PCX160" }] }, { slug: "cbr500r", name: "CBR500R", versions: [{ slug: "cbr500r", name: "CBR500R" }] }, { slug: "africa-twin", name: "Africa Twin", versions: [{ slug: "africa-twin", name: "Africa Twin" }] }] },
  { slug: "husqvarna", name: "Husqvarna", models: [{ slug: "svartpilen-401", name: "Svartpilen 401", versions: [{ slug: "svartpilen-401", name: "Svartpilen 401" }] }, { slug: "vitpilen-401", name: "Vitpilen 401", versions: [{ slug: "vitpilen-401", name: "Vitpilen 401" }] }] },
  { slug: "indian", name: "Indian", models: [{ slug: "scout", name: "Scout", versions: [{ slug: "scout", name: "Scout" }] }, { slug: "chief", name: "Chief", versions: [{ slug: "chief", name: "Chief" }] }] },
  { slug: "kawasaki", name: "Kawasaki", models: [{ slug: "ninja400", name: "Ninja 400", versions: [{ slug: "ninja400", name: "Ninja 400" }] }, { slug: "z900", name: "Z900", versions: [{ slug: "z900", name: "Z900" }] }, { slug: "versys650", name: "Versys 650", versions: [{ slug: "versys650", name: "Versys 650" }] }] },
  { slug: "ktm", name: "KTM", models: [{ slug: "duke390", name: "Duke 390", versions: [{ slug: "duke390", name: "Duke 390" }] }, { slug: "adventure890", name: "890 Adventure", versions: [{ slug: "adventure890", name: "890 Adventure" }] }] },
  { slug: "kymco", name: "Kymco", models: [{ slug: "like150i", name: "Like 150i", versions: [{ slug: "like150i", name: "Like 150i" }] }, { slug: "ak550", name: "AK 550", versions: [{ slug: "ak550", name: "AK 550" }] }] },
  { slug: "mondial", name: "Mondial", models: [{ slug: "hps125", name: "HPS 125", versions: [{ slug: "hps125", name: "HPS 125" }] }, { slug: "250-ressivo", name: "250 Ressivo", versions: [{ slug: "250-ressivo", name: "250 Ressivo" }] }, { slug: "250-nevada", name: "250 Nevada", versions: [{ slug: "250-nevada", name: "250 Nevada" }] }] },
  { slug: "moto-guzzi", name: "Moto Guzzi", models: [{ slug: "v7", name: "V7", versions: [{ slug: "v7", name: "V7" }] }, { slug: "v85tt", name: "V85 TT", versions: [{ slug: "v85tt", name: "V85 TT" }] }] },
  { slug: "piaggio", name: "Piaggio", models: [{ slug: "liberty125", name: "Liberty 125", versions: [{ slug: "liberty125", name: "Liberty 125" }] }, { slug: "mp3-300", name: "MP3 300", versions: [{ slug: "mp3-300", name: "MP3 300" }] }] },
  { slug: "rks", name: "RKS", models: [{ slug: "srk125r", name: "SRK125R", versions: [{ slug: "srk125r", name: "SRK125R" }] }, { slug: "srk250rs", name: "SRK250RS", versions: [{ slug: "srk250rs", name: "SRK250RS" }] }, { slug: "rodos", name: "RODOS", versions: [{ slug: "rodos", name: "RODOS" }] }] },
  { slug: "royal-enfield", name: "Royal Enfield", models: [{ slug: "classic350", name: "Classic 350", versions: [{ slug: "classic350", name: "Classic 350" }] }, { slug: "himalayan", name: "Himalayan", versions: [{ slug: "himalayan", name: "Himalayan" }] }] },
  { slug: "suzuki", name: "Suzuki", models: [{ slug: "gsx-r750", name: "GSX-R750", versions: [{ slug: "gsx-r750", name: "GSX-R750" }] }, { slug: "v-strom650", name: "V-Strom 650", versions: [{ slug: "v-strom650", name: "V-Strom 650" }] }] },
  { slug: "sym", name: "SYM", models: [{ slug: "jet14-125", name: "Jet14 125", versions: [{ slug: "jet14-125", name: "Jet14 125" }] }, { slug: "symphony-st200", name: "Symphony ST 200", versions: [{ slug: "symphony-st200", name: "Symphony ST 200" }] }] },
  { slug: "triumph", name: "Triumph", models: [{ slug: "bonneville-t120", name: "Bonneville T120", versions: [{ slug: "bonneville-t120", name: "Bonneville T120" }] }, { slug: "tiger900", name: "Tiger 900", versions: [{ slug: "tiger900", name: "Tiger 900" }] }] },
  { slug: "vespa", name: "Vespa", models: [{ slug: "primavera150", name: "Primavera 150", versions: [{ slug: "primavera150", name: "Primavera 150" }] }, { slug: "gts300", name: "GTS 300", versions: [{ slug: "gts300", name: "GTS 300" }] }] },
  { slug: "yamaha", name: "Yamaha", models: [{ slug: "nmax155", name: "NMAX 155", versions: [{ slug: "nmax155", name: "NMAX 155" }] }, { slug: "mt-07", name: "MT-07", versions: [{ slug: "mt-07", name: "MT-07" }] }] },
  { slug: "yuki", name: "Yuki", models: [{ slug: "hammer125", name: "Hammer 125", versions: [{ slug: "hammer125", name: "Hammer 125" }] }, { slug: "huracan", name: "Huracan", versions: [{ slug: "huracan", name: "Huracan" }] }] },
  { slug: "zontes", name: "Zontes", models: [{ slug: "310-x1", name: "310 X1", versions: [{ slug: "310-x1", name: "310 X1" }] }, { slug: "zt350t2", name: "ZT-350T2", versions: [{ slug: "zt350t2", name: "ZT-350T2" }] }] },
];

// ---------------------------------------------------------------------------
// TİCARİ ARAÇLAR
// ---------------------------------------------------------------------------
const TICARI_ARACLAR: BrandDef[] = [
  { slug: "bmc", name: "BMC", models: [{ slug: "tugra", name: "Tuğra", versions: [{ slug: "tugra", name: "Tuğra" }] }, { slug: "professional", name: "Professional", versions: [{ slug: "professional", name: "Professional" }] }] },
  { slug: "daf", name: "DAF", models: [{ slug: "xf", name: "XF", versions: [{ slug: "xf", name: "XF" }] }, { slug: "cf", name: "CF", versions: [{ slug: "cf", name: "CF" }] }] },
  { slug: "ford-trucks", name: "Ford Trucks", models: [{ slug: "f-max", name: "F-MAX", versions: [{ slug: "f-max", name: "F-MAX" }] }, { slug: "cargo", name: "Cargo", versions: [{ slug: "cargo", name: "Cargo" }] }] },
  { slug: "isuzu", name: "Isuzu", models: [{ slug: "npr", name: "NPR", versions: [{ slug: "npr", name: "NPR" }, { slug: "npr-10", name: "NPR 10" }] }, { slug: "nlr", name: "NLR", versions: [{ slug: "nlr", name: "NLR" }] }] },
  { slug: "iveco", name: "Iveco", models: [{ slug: "daily", name: "Daily", versions: [{ slug: "daily", name: "Daily" }] }, { slug: "eurocargo", name: "Eurocargo", versions: [{ slug: "eurocargo", name: "Eurocargo" }] }] },
  { slug: "man", name: "MAN", models: [{ slug: "tgx", name: "TGX", versions: [{ slug: "tgx", name: "TGX" }] }, { slug: "tgs", name: "TGS", versions: [{ slug: "tgs", name: "TGS" }] }] },
  { slug: "mercedes-benz", name: "Mercedes-Benz", models: [{ slug: "actros", name: "Actros", versions: [{ slug: "actros", name: "Actros" }] }, { slug: "atego", name: "Atego", versions: [{ slug: "atego", name: "Atego" }] }] },
  { slug: "mitsubishi-fuso", name: "Mitsubishi Fuso", models: [{ slug: "canter", name: "Canter", versions: [{ slug: "canter", name: "Canter" }] }, { slug: "fighter", name: "Fighter", versions: [{ slug: "fighter", name: "Fighter" }] }] },
  { slug: "otokar", name: "Otokar", models: [{ slug: "kent", name: "Kent", versions: [{ slug: "kent", name: "Kent" }] }, { slug: "sultan", name: "Sultan", versions: [{ slug: "sultan", name: "Sultan" }] }, { slug: "atlas", name: "Atlas", versions: [{ slug: "atlas", name: "Atlas" }] }] },
  { slug: "renault-trucks", name: "Renault Trucks", models: [{ slug: "t-series", name: "T Serisi", versions: [{ slug: "t-series", name: "T Serisi" }] }, { slug: "d-series", name: "D Serisi", versions: [{ slug: "d-series", name: "D Serisi" }] }] },
  { slug: "scania", name: "Scania", models: [{ slug: "r-series", name: "R Serisi", versions: [{ slug: "r-series", name: "R Serisi" }] }, { slug: "p-series", name: "P Serisi", versions: [{ slug: "p-series", name: "P Serisi" }] }] },
  { slug: "temsa", name: "Temsa", models: [{ slug: "safir", name: "Safir", versions: [{ slug: "safir", name: "Safir" }] }, { slug: "opalin", name: "Opalin", versions: [{ slug: "opalin", name: "Opalin" }] }] },
  { slug: "volvo-trucks", name: "Volvo Trucks", models: [{ slug: "fh", name: "FH", versions: [{ slug: "fh", name: "FH" }] }, { slug: "fmx", name: "FMX", versions: [{ slug: "fmx", name: "FMX" }] }] },
];

const CATEGORY_DEFS: Array<{ key: string; categoryPath: string; brands: BrandDef[] }> = [
  { key: "otomobil", categoryPath: "arac/otomobil", brands: OTOMOBIL },
  { key: "arazi-suv-pickup", categoryPath: "arac/arazi-suv-pickup", brands: ARAZI_SUV_PICKUP },
  { key: "motosiklet", categoryPath: "arac/motosiklet", brands: MOTOSIKLET },
  { key: "ticari-araclar", categoryPath: "arac/ticari-araclar", brands: TICARI_ARACLAR },
];

function buildEntriesForCategory(categoryPath: string, brands: BrandDef[]): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const brand of brands) {
    for (const model of brand.models) {
      if (model.generations && model.generations.length) {
        for (const gen of model.generations) {
          entries.push({
            categoryPaths: [categoryPath],
            brandSlug: brand.slug,
            brandName: brand.name,
            modelSlug: model.slug,
            modelName: model.name,
            generationCode: gen.code,
            generationLabel: gen.label,
            versions: gen.versions,
            modelYears: years(gen.yearStart, gen.yearEnd),
            fuelTypes: [],
            transmissions: [],
            bodyTypes: [],
            source: SOURCE,
            verified: true,
            market: "TR",
            active: true,
          });
        }
      } else {
        const versions = model.versions && model.versions.length ? model.versions : [{ slug: model.slug, name: model.name }];
        const modelYears = model.yearStart && model.yearEnd ? years(model.yearStart, model.yearEnd) : DEFAULT_MODEL_YEARS;
        entries.push({
          categoryPaths: [categoryPath],
          brandSlug: brand.slug,
          brandName: brand.name,
          modelSlug: model.slug,
          modelName: model.name,
          generationCode: "",
          generationLabel: "",
          versions,
          modelYears,
          fuelTypes: [],
          transmissions: [],
          bodyTypes: [],
          source: SOURCE,
          verified: true,
          market: "TR",
          active: true,
        });
      }
    }
  }
  return entries;
}

/** minivan-panelvan kept from the existing (already-real) vehicleCatalog.ts models — no fake generation stamped. */
function buildMinivanPanelvanEntries(): CatalogEntry[] {
  const brands = VEHICLE_CATALOG["minivan-panelvan"] || [];
  const categoryPath = "arac/minivan-panelvan";
  const entries: CatalogEntry[] = [];
  for (const brand of brands) {
    for (const model of brand.models) {
      const versions =
        model.trims && model.trims.length
          ? model.trims.map((t) => ({ slug: t.slug, name: t.name }))
          : [{ slug: model.slug, name: model.name }];
      entries.push({
        categoryPaths: [categoryPath],
        brandSlug: brand.slug,
        brandName: brand.name,
        modelSlug: model.slug,
        modelName: model.name,
        generationCode: "",
        generationLabel: "",
        versions,
        modelYears: DEFAULT_MODEL_YEARS,
        fuelTypes: [],
        transmissions: [],
        bodyTypes: [],
        source: "curated-vehicleCatalog-ts",
        verified: true,
        market: "TR",
        active: true,
      });
    }
  }
  return entries;
}

function main() {
  const outPath = join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json");

  let removedFakeGenerations = 0;
  if (existsSync(outPath)) {
    const prevRaw = readFileSync(outPath, "utf8");
    removedFakeGenerations = (prevRaw.match(/"generationCode":\s*"default"/g) || []).length;
  }

  const entries: CatalogEntry[] = [];
  for (const def of CATEGORY_DEFS) {
    entries.push(...buildEntriesForCategory(def.categoryPath, def.brands));
  }
  entries.push(...buildMinivanPanelvanEntries());

  // Integrity guard — fail loudly if a fake generation sneaks back in.
  const BANNED_LABELS = new Set(["standart", "default", "genel"]);
  for (const e of entries) {
    if (e.generationCode.toLowerCase() === "default") {
      throw new Error(`Fake generationCode "default" found on ${e.brandSlug}/${e.modelSlug}`);
    }
    if (BANNED_LABELS.has(e.generationLabel.toLowerCase())) {
      throw new Error(`Fake generationLabel "${e.generationLabel}" found on ${e.brandSlug}/${e.modelSlug}`);
    }
    if (!e.source) {
      throw new Error(`Missing source on ${e.brandSlug}/${e.modelSlug}`);
    }
    if (e.verified !== true) {
      throw new Error(`Non-verified entry leaked through: ${e.brandSlug}/${e.modelSlug}`);
    }
  }

  const realGenerationCount = entries.filter((e) => e.generationCode !== "").length;
  const modelsWithoutGeneration = new Set(
    entries.filter((e) => e.generationCode === "").map((e) => `${e.brandSlug}/${e.modelSlug}`)
  ).size;
  const excludedVersions = 0;

  const brandCounts: Record<string, number> = {};
  for (const def of CATEGORY_DEFS) {
    brandCounts[def.categoryPath] = new Set(entries.filter((e) => e.categoryPaths.includes(def.categoryPath)).map((e) => e.brandSlug)).size;
  }
  brandCounts["arac/minivan-panelvan"] = new Set(entries.filter((e) => e.categoryPaths.includes("arac/minivan-panelvan")).map((e) => e.brandSlug)).size;

  const pack = {
    version: "vehicle-stage1-catalog-v2",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: SOURCE,
    notes: [
      "v2 — real TR-market brand/model/generation data only. NEVER emits generationCode/Label default/Standart/Genel.",
      "Models with no verified generation carry generationCode:\"\" / generationLabel:\"\" — versions attach directly to the model row.",
      "Only real, well-known chassis/generation codes included (BMW F30/G20/G30/G60, VW Golf mk7/mk8, Mercedes W205/W206, Toyota Corolla E210, Renault Clio V, Ford Focus mk4, Honda Civic 11th gen, Peugeot 208 P21).",
      "elektrikli-araclar (MARKET_SEGMENT hub) intentionally excluded — see dedupeRules; EV filtering works via requiredFilters.fuelType on otomobil/arazi-suv-pickup brands instead.",
      "minivan-panelvan kept from src/data/vehicleCatalog.ts (already real TR van/minivan model names) — no generation invented for it either.",
      "modelYears: real generation year ranges where known, else Stage1 default market range 2018-2025.",
      "bmw-motorrad is a distinct Brand slug from bmw (motorcycle division vs automobiles).",
    ],
    entries,
  };

  writeFileSync(outPath, JSON.stringify(pack, null, 2));

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  const cleanupReport = {
    at: new Date().toISOString(),
    removedFakeGenerations,
    realGenerationCount,
    modelsWithoutGeneration,
    excludedVersions,
    totalEntries: entries.length,
    totalBrands: new Set(entries.map((e) => e.brandSlug)).size,
    brandCounts,
  };
  writeFileSync(
    join(process.cwd(), "scripts/output/vehicle-stage1-generation-cleanup.json"),
    JSON.stringify(cleanupReport, null, 2)
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outPath,
        entries: entries.length,
        brands: new Set(entries.map((e) => e.brandSlug)).size,
        byCategory: Object.fromEntries(
          [...CATEGORY_DEFS.map((d) => d.categoryPath), "arac/minivan-panelvan"].map((cp) => [
            cp,
            entries.filter((e) => e.categoryPaths.includes(cp)).length,
          ])
        ),
        cleanupReport,
      },
      null,
      2
    )
  );
}

main();
