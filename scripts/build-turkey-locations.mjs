/**
 * Builds src/data/turkey-locations.json from TurkiyeAPI 2025 datasets.
 * Usage:
 *   node scripts/build-turkey-locations.mjs
 * Optional local cache:
 *   scripts/_tmp_tr/{provinces,districts,neighborhoods}.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cacheDir = path.join(__dirname, "_tmp_tr");
const outPath = path.join(root, "src", "data", "turkey-locations.json");
const BASE = "https://api.turkiyeapi.dev/v2/datasets/2025";

async function loadJson(name) {
  const local = path.join(cacheDir, name);
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf8"));
  }
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  const data = await res.json();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(local, JSON.stringify(data));
  return data;
}

function trSort(a, b) {
  return a.localeCompare(b, "tr");
}

const provinces = await loadJson("provinces.json");
const districts = await loadJson("districts.json");
const neighborhoods = await loadJson("neighborhoods.json");

const byDistrict = new Map();
for (const n of neighborhoods) {
  const list = byDistrict.get(n.districtId) || [];
  list.push(n.name);
  byDistrict.set(n.districtId, list);
}

const cities = provinces
  .slice()
  .sort((a, b) => trSort(a.name, b.name))
  .map((p) => ({
    name: p.name,
    districts: districts
      .filter((d) => d.provinceId === p.id)
      .sort((a, b) => trSort(a.name, b.name))
      .map((d) => {
        const seen = new Set();
        const names = [];
        for (const name of (byDistrict.get(d.id) || []).sort(trSort)) {
          if (!seen.has(name)) {
            seen.add(name);
            names.push(name);
          }
        }
        return { name: d.name, neighborhoods: names };
      }),
  }));

const out = {
  source: "TurkiyeAPI 2025 (https://api.turkiyeapi.dev)",
  generatedAt: new Date().toISOString().slice(0, 10),
  cities,
};

fs.writeFileSync(outPath, JSON.stringify(out));
const nh = cities.reduce((a, c) => a + c.districts.reduce((b, d) => b + d.neighborhoods.length, 0), 0);
console.log(
  `Wrote ${outPath} — ${cities.length} il, ${cities.reduce((a, c) => a + c.districts.length, 0)} ilçe, ${nh} mahalle`
);
